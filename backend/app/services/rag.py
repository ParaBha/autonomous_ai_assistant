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

    def _retrieve_context_and_sources(self, question: str, document_id: Optional[Any] = None) -> tuple[str, List[Dict[str, Any]]]:
        sources = []
        context_parts = []
        doc_id_str = str(document_id).strip() if document_id is not None and str(document_id).strip() != "" and str(document_id).strip().lower() != "null" else None

        # Fast exit: check if vector DB directory exists before lazy loading embeddings
        if os.path.exists(self.vector_db_path):
            vector_db = self._get_vector_db()
            if vector_db is not None:
                try:
                    if vector_db._collection.count() > 0:
                        if doc_id_str:
                            filter_dict = {"document_id": doc_id_str}
                            docs = vector_db.similarity_search(question, k=4, filter=filter_dict)
                        else:
                            docs = vector_db.similarity_search(question, k=4)
                        
                        if docs:
                            for doc in docs:
                                fname = doc.metadata.get("filename", "Document")
                                doc_id = doc.metadata.get("document_id")
                                context_parts.append(f"--- Document ({fname}) ---\n{doc.page_content}")
                                if not any(s.get("filename") == fname for s in sources):
                                    sources.append({"filename": fname, "document_id": doc_id, "content": doc.page_content[:200]})
                except Exception as e:
                    print(f"ChromaDB similarity search notice: {e}")

        # Fallback to DB documents if ChromaDB yielded no text
        if not context_parts:
            try:
                from app.db.database import SessionLocal
                from app.models.models import Document as DocumentModel
                db = SessionLocal()
                try:
                    if doc_id_str:
                        db_docs = db.query(DocumentModel).filter(DocumentModel.id == int(doc_id_str)).all()
                    else:
                        db_docs = db.query(DocumentModel).order_by(DocumentModel.id.desc()).limit(3).all()
                    
                    for db_doc in db_docs:
                        if db_doc and db_doc.extracted_text and len(db_doc.extracted_text.strip()) > 0:
                            context_parts.append(f"--- Document ({db_doc.filename}) ---\n{db_doc.extracted_text[:4000]}")
                            sources.append({"filename": db_doc.filename, "document_id": str(db_doc.id)})
                finally:
                    db.close()
            except Exception as ex:
                print(f"DB fallback error: {ex}")

        context = "\n\n".join(context_parts)
        return context, sources

    def query(self, question: str, chat_history: List[tuple] = [], document_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Executes a direct single-pass research query over retrieved document context.
        """
        context, sources = self._retrieve_context_and_sources(question, document_id)

        history_text = ""
        if chat_history:
            formatted_history = []
            for role, content in chat_history:
                r_name = "User" if str(role).lower() == "user" else "Assistant"
                formatted_history.append(f"{r_name}: {content}")
            history_text = "\n\nPrevious Conversation History:\n" + "\n".join(formatted_history)

        source_instruction = (
            "Context from Uploaded Research Documents is provided below. Prioritize information from these uploaded documents. If you add additional facts beyond the documents, mark those parts with '[ADDITIONAL KNOWLEDGE]'."
            if context else
            "No uploaded research document matched this query. Answer directly using your Research Knowledge. Include '[ADDITIONAL KNOWLEDGE]' at the beginning."
        )

        prompt = f"""You are an Autonomous AI Research Assistant powered by Google Gemini.
Your task is to provide complete, highly thorough, articulate, and accurate research responses.

SOURCE & RESPONSE GUIDELINES:
- {source_instruction}
- Provide comprehensive, fully detailed answers without truncating or stopping mid-thought.
- Format your response cleanly using standard GitHub-flavored Markdown (headers, bullet points, bold key terms).
- Do NOT repeat headers or text fragments sequentially.

Context from Uploaded Research Documents:
{context if context else 'No uploaded document context attached.'}{history_text}

User Question: {question}

Research Response:"""

        try:
            answer = gemini_key_manager.invoke_with_fallback(prompt, temperature=0.5, max_output_tokens=4096)
            return {"answer": answer, "sources": sources, "response_source": "documents" if sources else "gemini"}
        except APIKeysExhaustedError:
            raise
        except Exception as e:
            print(f"Query execution error: {e}")
            return {"answer": f"Error during query execution: {str(e)}", "sources": sources, "response_source": "error"}

    def _sync_stream_query(self, question: str, chat_history: List[tuple], document_id: Optional[Any]):
        """
        Synchronous generator. Yields text chunks and metadata.
        Called from a thread-pool via stream_query (async).
        """
        print(f"[RAG] _sync_stream_query started for: {question[:80]}")
        # Flush HTTP 200 OK headers to the client immediately
        yield " "

        context, sources = self._retrieve_context_and_sources(question, document_id)
        print(f"[RAG] context_len={len(context)}, sources={len(sources)}")

        # Tell the frontend where the answer came from
        if sources:
            yield f"[[RESPONSE_SOURCE:DOCUMENTS]]\n"
            yield f"[[SOURCES_METADATA:{json.dumps(sources)}]]\n"
        else:
            yield f"[[RESPONSE_SOURCE:GEMINI]]\n"

        history_text = ""
        if chat_history:
            formatted_history = []
            for role, content in chat_history:
                r_name = "User" if str(role).lower() == "user" else "Assistant"
                formatted_history.append(f"{r_name}: {content}")
            history_text = "\n\nPrevious Conversation History:\n" + "\n".join(formatted_history)

        source_instruction = (
            "Context from Uploaded Research Documents is provided below. Prioritize information from these uploaded documents. If you add extra facts, mark those parts with '[ADDITIONAL KNOWLEDGE]'."
            if context else
            "No uploaded research document matched this query. Answer directly using your Research Knowledge. Include '[ADDITIONAL KNOWLEDGE]' at the start of your answer."
        )

        prompt = f"""You are an Autonomous AI Research Assistant powered by Google Gemini.
Your task is to provide complete, highly thorough, articulate, and accurate research responses.

SOURCE & RESPONSE GUIDELINES:
- {source_instruction}
- Provide comprehensive, fully detailed answers without truncating or stopping mid-thought.
- Format your response cleanly using standard GitHub-flavored Markdown (headers, bullet points, bold key terms).
- Do NOT repeat headers or text fragments sequentially.

Context from Uploaded Research Documents:
{context if context else 'No uploaded document context attached.'}{history_text}

User Question: {question}

Research Response:"""

        try:
            chunk_count = 0
            for chunk in gemini_key_manager.stream_with_fallback(prompt, temperature=0.5, max_output_tokens=4096):
                chunk_count += 1
                if chunk_count == 1:
                    print(f"[RAG] First Gemini chunk: {repr(chunk[:50])}")
                yield chunk
            print(f"[RAG] Streaming done. Chunks yielded: {chunk_count}")
        except APIKeysExhaustedError:
            yield "\n\n[ERROR: 429 Rate Limit – All Gemini API keys are currently exhausted.]"
        except Exception as e:
            print(f"[RAG] Stream error: {e}")
            yield f"\n\n[Error: {str(e)}]"

    async def stream_query(self, question: str, chat_history: List[tuple] = [], document_id: Optional[Any] = None):
        """
        Async generator. Runs the blocking _sync_stream_query in a thread executor
        and forwards chunks via asyncio.Queue.
        Sends keepalive spaces every 3s so proxy servers don't close the idle connection.
        """
        loop = asyncio.get_running_loop()
        queue: asyncio.Queue = asyncio.Queue()
        _DONE = object()  # sentinel

        def _run_sync():
            """Executed in thread pool — collects sync generator chunks and enqueues them."""
            try:
                for chunk in self._sync_stream_query(question, chat_history, document_id):
                    # run_coroutine_threadsafe is safe to call from any thread
                    fut = asyncio.run_coroutine_threadsafe(queue.put(chunk), loop)
                    fut.result(timeout=30)  # block this thread until put completes
            except Exception as ex:
                asyncio.run_coroutine_threadsafe(
                    queue.put(f"\n\n[Error: {str(ex)}]"), loop
                ).result(timeout=5)
            finally:
                asyncio.run_coroutine_threadsafe(queue.put(_DONE), loop).result(timeout=5)

        # Launch sync generator in a thread
        future = loop.run_in_executor(None, _run_sync)

        # Yield chunks as they arrive; send keepalive if we wait too long
        while True:
            try:
                item = await asyncio.wait_for(queue.get(), timeout=3.0)
                if item is _DONE:
                    break
                yield item
            except asyncio.TimeoutError:
                yield " "  # keepalive — invisible to frontend (whitespace)

        # Surface any thread exception (optional, for debugging)
        try:
            await asyncio.shield(asyncio.wrap_future(future))
        except Exception:
            pass


rag_service = RAGService()
