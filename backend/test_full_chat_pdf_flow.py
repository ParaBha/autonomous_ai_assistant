import os
import fitz
import json
from app.services.ingestion import ingestion_service
from app.services.rag import rag_service

def test_flow():
    print("=== STARTING FULL PDF UPLOAD & RESEARCH CHAT TEST ===")
    
    # 1. Create test PDF
    pdf_path = "test_ai_research_paper.pdf"
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 50), """TITLE: Neural Memory Compression for Autonomous AI Agents

ABSTRACT:
This paper introduces Neural Memory Compression (NMC), a novel architecture for autonomous AI agents that compresses long-term conversation history and document context into dense vector embeddings. NMC achieves a 94.2% reduction in memory footprint while improving retrieval accuracy by 18.5% on multi-step reasoning benchmarks.

KEY RESULTS:
1. NMC reduces token consumption from 120,000 tokens to 7,200 tokens per session.
2. Latency drops from 4.2 seconds to 0.8 seconds.
3. Zero-shot transfer capabilities on complex scientific Q&A tasks.
""")
    doc.save(pdf_path)
    doc.close()
    print("1. Created test PDF:", pdf_path)

    # 2. Test Ingestion
    extracted_text = ingestion_service.process_file(pdf_path)
    print("2. Extracted text length:", len(extracted_text))
    assert "Neural Memory Compression" in extracted_text

    # 3. Test RAG Vector Indexing
    doc_id = "999"
    rag_service.process_and_store(extracted_text, doc_id, {"filename": pdf_path})
    print("3. Processed and stored in ChromaDB vector store.")

    # 4. Test RAG Query without explicit document_id filter (global research search)
    print("4. Testing RAG query without explicit doc_id (global search)...")
    res_global = rag_service.query("What is the token consumption reduction achieved by NMC?")
    print("   Answer:", res_global["answer"][:200])
    print("   Sources:", res_global["sources"])
    assert len(res_global["answer"]) > 20

    # 5. Test RAG Stream Query with chat history
    print("5. Testing RAG stream query with chat history...")
    history = [("user", "Tell me about Neural Memory Compression"), ("assistant", "NMC is an architecture for autonomous AI agents.")]
    chunks = []
    for chunk in rag_service._sync_stream_query("What are the key results?", history, doc_id):
        chunks.append(chunk)
    
    full_stream_output = "".join(chunks)
    print("   Stream output length:", len(full_stream_output))
    print("   Stream preview:", full_stream_output[:250])
    
    # Cleanup
    if os.path.exists(pdf_path):
        os.remove(pdf_path)

    print("\n✅ ALL PDF UPLOADING, RAG CHAT, AND RESPONSE TESTS PASSED!")

if __name__ == "__main__":
    test_flow()
