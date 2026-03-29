import os
import traceback
from typing import List, Dict, Any, Optional
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI
from langchain_text_splitters import RecursiveCharacterTextSplitter

from langchain_community.vectorstores import Chroma
from app.core.config import settings

class RAGService:
    def __init__(self):
        self.embeddings = GoogleGenerativeAIEmbeddings(
            model="models/gemini-embedding-001",
            google_api_key=settings.GEMINI_API_KEY
        )
        self.model_name = settings.GEMINI_MODEL
        self.fallback_models = ["gemini-flash-latest", "gemini-2.0-flash", "gemini-pro-latest"]
        self.llm = self._get_llm(self.model_name)
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=100
        )
        self.vector_db_path = "chroma_db"

    def _get_llm(self, model_name: str):
        return ChatGoogleGenerativeAI(
            model=model_name,
            google_api_key=settings.GEMINI_API_KEY,
            max_retries=3,
        )

    def _get_content(self, response) -> str:
        if isinstance(response.content, str):
            return response.content
        if isinstance(response.content, list):
            return "".join([part.get("text", "") if isinstance(part, dict) else str(part) for part in response.content])
        return str(response.content)

    def process_and_store(self, text: str, document_id: str, metadata: Dict[str, Any] = {}):
        try:
            chunks = self.text_splitter.split_text(text)
            metadatas = [metadata or {} for _ in chunks]
            for meta in metadatas:
                meta["document_id"] = document_id
                
            vector_db = Chroma.from_texts(
                texts=chunks,
                embedding=self.embeddings,
                persist_directory=self.vector_db_path,
                metadatas=metadatas
            )
        except Exception as e:
            print(f"Error in process_and_store: {str(e)}")
            traceback.print_exc()

    def query(self, question: str, chat_history: List[tuple] = [], document_id: Optional[str] = None) -> Dict[str, Any]:
        sources = []
        prompt = question
        try:
            if not os.path.exists(self.vector_db_path):
                # If no DB yet, just use LLM directly
                response = self.llm.invoke(question)
                return {
                    "answer": self._get_content(response),
                    "sources": []
                }

            vector_db = Chroma(
                persist_directory=self.vector_db_path,
                embedding_function=self.embeddings
            )
            
            # Add filtering if document_id is provided
            filter_dict = {"document_id": document_id} if document_id else None
            docs = vector_db.similarity_search(question, k=4, filter=filter_dict)
            context = "\n\n".join([doc.page_content for doc in docs])
            
            prompt = f"""
            You are an Autonomous AI Research Assistant. Use the following pieces of context to answer the user's question.
            If you don't know the answer, just say that you don't know, don't try to make up an answer.
            
            Context:
            {context}
            
            Question: {question}
            
            Answer:"""
            
            response = self.llm.invoke(prompt)
            
            return {
                "answer": self._get_content(response),
                "sources": [{"content": doc.page_content, **doc.metadata} for doc in docs]
            }
        except Exception as e:
            # ... (error handling remains the same)
            return self._handle_query_error(e, prompt, sources)

    def stream_query(self, question: str, chat_history: List[tuple] = [], document_id: Optional[str] = None):
        """Generator for streaming chat responses"""
        try:
            if not os.path.exists(self.vector_db_path):
                for chunk in self.llm.stream(question):
                    yield self._get_content(chunk)
                return

            vector_db = Chroma(
                persist_directory=self.vector_db_path,
                embedding_function=self.embeddings
            )
            
            filter_dict = {"document_id": document_id} if document_id else None
            docs = vector_db.similarity_search(question, k=4, filter=filter_dict)
            context = "\n\n".join([doc.page_content for doc in docs])
            
            prompt = f"""
            You are an Autonomous AI Research Assistant. Use the following context to answer.
            Context: {context}
            Question: {question}
            Answer:"""
            
            # Send source metadata first as a special JSON chunk
            sources = [{"filename": doc.metadata.get("filename", "Unknown"), "document_id": doc.metadata.get("document_id")} for doc in docs]
            import json
            yield f"__SOURCES__:{json.dumps(sources)}\n"
            
            for chunk in self.llm.stream(prompt):
                yield self._get_content(chunk)
                
        except Exception as e:
            yield f"Error: {str(e)}"

    def _handle_query_error(self, e, prompt, sources):
        error_str = str(e)
        if "429" in error_str or "RESOURCE_EXHAUSTED" in error_str:
            for fallback in self.fallback_models:
                if fallback == self.model_name: continue
                try:
                    fallback_llm = self._get_llm(fallback)
                    response = fallback_llm.invoke(prompt)
                    return {"answer": self._get_content(response), "sources": sources}
                except: continue
        return {"answer": f"Error: {error_str}", "sources": []}

rag_service = RAGService()
