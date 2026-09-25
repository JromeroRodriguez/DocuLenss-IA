from typing import List, Union
from sentence_transformers import SentenceTransformer
from app.config import EMBEDDING_MODEL

_embedding_model = None


def get_embedding_model() -> SentenceTransformer:
    """Retorna una instancia singleton del modelo de embeddings multilingüe."""
    global _embedding_model
    if _embedding_model is None:
        print(f"Cargando modelo de embeddings: {EMBEDDING_MODEL}...")
        _embedding_model = SentenceTransformer(EMBEDDING_MODEL)
        print("Modelo de embeddings cargado exitosamente.")
    return _embedding_model


def generar_embeddings(textos: List[str]) -> List[List[float]]:
    """
    Genera embeddings en lote (batch) normalizados (384 dimensiones)
    para una lista de textos.
    """
    if not textos:
        return []
    model = get_embedding_model()
    embeddings = model.encode(textos, normalize_embeddings=True, show_progress_bar=False)
    return embeddings.tolist()


def generar_embedding(texto: str) -> List[float]:
    """Genera un embedding normalizado (384 dimensiones) para un texto."""
    return generar_embeddings([texto])[0]
