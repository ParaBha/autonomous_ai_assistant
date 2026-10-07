import os
import json
import asyncio
import traceback
from typing import List, Dict, Any, Optional
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma

from app.core.config import settings
from app.services.gemini_rotator import gemini_key_manager, APIKeysExhaustedError

class RAGService:
    def __init__(self):
        self._embeddings = None
        self._vector_db = None
        self.model_name = settings.GEMINI_MODEL
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=800,
            chunk_overlap=50
        )
        self.vector_db_path = "chroma_db"
        # Defer ChromaDB and GoogleGenerativeAIEmbeddings loading to lazy first access

    @property
    def embeddings(self):
        if self._embeddings is None:
            active_key, _ = gemini_key_manager.get_active_key()
            self._embeddings = GoogleGenerativeAIEmbeddings(
                model="models/gemini-embedding-001",
                google_api_key=active_key or settings.get_primary_key()
            )
        return self._embeddings

    def invalidate_cache(self):
        """Invalidate cached vector DB instance."""
        self._vector_db = None
        self._embeddings = None

    def _get_vector_db(self):
        """Return cached ChromaDB instance."""
        if self._vector_db is None and os.path.exists(self.vector_db_path):
            self._vector_db = Chroma(
                persist_directory=self.vector_db_path,
                embedding_function=self.embeddings
            )
        return self._vector_db

    def process_and_store(self, text: str, document_id: str, metadata: Dict[str, Any] = {}):
        try:
            chunks = self.text_splitter.split_text(text)
            metadatas = [metadata or {} for _ in chunks]
            for meta in metadatas:
                meta["document_id"] = document_id

            Chroma.from_texts(
                texts=chunks,
                embedding=self.embeddings,
                persist_directory=self.vector_db_path,
                metadatas=metadatas
            )
            self.invalidate_cache()
        except Exception as e:
            print(f"Error in process_and_store: {str(e)}")
            traceback.print_exc()

    def query(self, question: str, chat_history: List[tuple] = [], document_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Executes a direct single-pass research query over retrieved document context.
        """
        sources = []
        context = ""

        # Only hit ChromaDB if the user has a specific document selected
        if document_id is not None:
            vector_db = self._get_vector_db()
            if vector_db is not None:
                filter_dict = {"document_id": str(document_id)}
                try:
                    if vector_db._collection.count() > 0:
                        docs = vector_db.similarity_search(question, k=3, filter=filter_dict)
                        if docs:
                            context = "\n\n".join([doc.page_content for doc in docs])
                            sources = [{"content": doc.page_content, **doc.metadata} for doc in docs]
                except Exception as e:
                    print(f"RAG search error: {e}")

        prompt = f"""You are an Autonomous AI Research Assistant powered by Google Gemini.
Your task is to provide complete, highly thorough, articulate, and accurate research responses.

RESPONSE GUIDELINES:
- Provide comprehensive, fully detailed answers without truncating or stopping mid-thought.
- Format your response cleanly using standard GitHub-flavored Markdown (headers, bullet points, bold key terms).
- Do NOT repeat headers, bullet prefixes, or text fragments sequentially (avoid loop repetition).
- Be precise, informative, and complete.

Context from Uploaded Research Documents:
{context if context else 'No specific document context attached. Provide a clear, detailed general research answer.'}

User Question: {question}

Research Response:"""

        try:
            answer = gemini_key_manager.invoke_with_fallback(prompt, temperature=0.5, max_output_tokens=4096)
            return {"answer": answer, "sources": sources}
        except APIKeysExhaustedError:
            raise
        except Exception as e:
            print(f"Query execution error: {e}")
            return {"answer": f"Error during query execution: {str(e)}", "sources": sources}

    def _sync_stream_query(self, question: str, chat_history: List[tuple], document_id: Optional[Any]):
        """
        Synchronous generator — called from a thread pool via stream_query (async).
        Yields text chunks or __SOURCES__ metadata lines.
        """
        sources = []
        context = ""
        doc_id_str = str(document_id) if document_id is not None else None

        # Only hit ChromaDB if user has a specific document selected
        if doc_id_str:
            vector_db = self._get_vector_db()
            if vector_db is not None:
                filter_dict = {"document_id": doc_id_str}
                try:
                    if vector_db._collection.count() > 0:
                        docs = vector_db.similarity_search(question, k=3, filter=filter_dict)
                        if docs:
                            context = "\n\n".join([f"Source ({doc.metadata.get('filename', 'Doc')}): {doc.page_content[:1000]}" for doc in docs])
                            sources = [{"filename": doc.metadata.get("filename", "Unknown"), "document_id": doc.metadata.get("document_id")} for doc in docs]
                            yield f"__SOURCES__:{json.dumps(sources)}\n"
                except Exception as e:
                    print(f"Similarity search notice: {e}")

            # Fallback to DB text if vector search came back empty
            if not context:
                try:
                    from app.db.database import SessionLocal
                    from app.models.models import Document as DocumentModel
                    db = SessionLocal()
                    try:
                        db_doc = db.query(DocumentModel).filter(DocumentModel.id == int(doc_id_str)).first()
                        if db_doc and db_doc.extracted_text:
                            context = f"Source ({db_doc.filename}): {db_doc.extracted_text[:5000]}"
                            sources = [{"filename": db_doc.filename, "document_id": str(db_doc.id)}]
                            yield f"__SOURCES__:{json.dumps(sources)}\n"
                    finally:
                        db.close()
                except Exception as ex:
                    print(f"DB fallback error: {ex}")

        prompt = f"""You are an Autonomous AI Research Assistant powered by Google Gemini.
Your task is to provide complete, highly thorough, articulate, and accurate research responses.

RESPONSE GUIDELINES:
- Provide comprehensive, fully detailed answers without truncating or stopping mid-thought.
- Format your response cleanly using standard GitHub-flavored Markdown (headers, bullet points, bold key terms).
- Do NOT repeat headers, bullet prefixes, or text fragments sequentially (avoid loop repetition).
- Be precise, informative, and complete.

Context from Uploaded Research Documents:
{context if context else 'No specific document context attached. Provide a clear, detailed general research answer.'}

User Question: {question}

Research Response:"""

        try:
            # max_output_tokens=4096 keeps first-token latency low on gemini-2.5-flash;
            # the model still answers fully — 4096 tokens ≈ 3000 words which covers most responses.
            for chunk in gemini_key_manager.stream_with_fallback(prompt, temperature=0.5, max_output_tokens=4096):
                yield chunk
        except APIKeysExhaustedError:
            yield "\n\n[ERROR: 429 Rate Limit - All Gemini API keys are currently exhausted. Primary key is under a 60-second cooldown.]"
        except Exception as e:
            yield f"\n\n[Error: {str(e)}]"

    async def stream_query(self, question: str, chat_history: List[tuple] = [], document_id: Optional[Any] = None):
        """
        Async generator — runs the blocking sync stream in a thread pool
        and uses the running event loop to put chunks into an asyncio.Queue safely.
        Sends keepalive whitespace every 2s to prevent Render's proxy from closing
        the connection while waiting for the first Gemini token.
        """
        loop = asyncio.get_running_loop()
        queue: asyncio.Queue = asyncio.Queue()
        _DONE = object()

        def _run_sync():
            try:
                for chunk in self._sync_stream_query(question, chat_history, document_id):
                    loop.call_soon_threadsafe(queue.put_nowait, chunk)
            except Exception as ex:
                loop.call_soon_threadsafe(queue.put_nowait, f"\n\n[Error: {str(ex)}]")
            finally:
                loop.call_soon_threadsafe(queue.put_nowait, _DONE)

        loop.run_in_executor(None, _run_sync)

        while True:
            try:
                # Wait up to 2s for a chunk before sending a keepalive space
                item = await asyncio.wait_for(queue.get(), timeout=2.0)
                if item is _DONE:
                    break
                yield item
            except asyncio.TimeoutError:
                # No chunk yet — send a single space to keep the TCP connection alive
                # The frontend strips leading/trailing whitespace so this is invisible
                yield " "



rag_service = RAGService()
