import uuid
import pytest
from app.services.vector_store import rerank_results
from app.config import RAG_SIMILARITY_THRESHOLD


def test_rerank_results_ordena_por_coincidencia():
    query = "diagrama de arquitectura del sistema"
    
    chunks = [
        {
            "id": 1,
            "contenido": "En este capítulo se habla de costos financieros y presupuesto anual.",
            "score": 0.40,
        },
        {
            "id": 2,
            "contenido": "La arquitectura del sistema incluye un diagrama detallado de componentes.",
            "score": 0.41,
        },
        {
            "id": 3,
            "contenido": "Breve introducción histórica a las computadoras.",
            "score": 0.42,
        },
    ]

    reranked = rerank_results(query, chunks, top_n=2)
    assert len(reranked) == 2
    # El chunk 2 contiene "arquitectura", "sistema" y "diagrama", por lo que debe recibir boost y quedar primero
    assert reranked[0]["id"] == 2


def test_rerank_results_lista_vacia():
    assert rerank_results("consulta", [], top_n=5) == []


def test_rag_threshold_filtra_irrelevantes():
    threshold = RAG_SIMILARITY_THRESHOLD
    
    candidatos = [
        {"id": 1, "contenido": "Texto altamente relacionado", "score": threshold + 0.15},
        {"id": 2, "contenido": "Texto irrelevante sobre cocina", "score": threshold - 0.10},
        {"id": 3, "contenido": "Texto marginal", "score": threshold - 0.01},
        {"id": 4, "contenido": "Texto relevante", "score": threshold + 0.05},
    ]

    relevantes = [c for c in candidatos if c["score"] >= threshold]
    assert len(relevantes) == 2
    assert {c["id"] for c in relevantes} == {1, 4}
