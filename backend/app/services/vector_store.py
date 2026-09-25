import uuid
from typing import List, Dict, Any, Optional
import numpy as np
import psycopg
from psycopg.rows import dict_row
from app.db import get_connection


def insertar_chunks_lote(chunks: List[Dict[str, Any]]):
    """
    Inserta una lista de chunks (texto e imágenes) con sus embeddings en la tabla chunks
    utilizando executemany para máxima eficiencia.
    """
    if not chunks:
        return

    sql = """
        INSERT INTO chunks (doc_id, tipo, pagina, contenido, imagen_id, embedding)
        VALUES (%s, %s, %s, %s, %s, %s::vector);
    """

    filas = [
        (
            c["doc_id"],
            c["tipo"],
            c["pagina"],
            c["contenido"],
            c.get("imagen_id"),
            np.array(c["embedding"], dtype=np.float32)
        )
        for c in chunks
    ]

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.executemany(sql, filas)
            conn.commit()


def buscar_similares(
    doc_id: uuid.UUID,
    embedding_consulta: List[float],
    tipo: str = "todos",
    k: int = 5
) -> List[Dict[str, Any]]:
    """
    Realiza una búsqueda semántica por similitud coseno (1 - distancia <=>),
    siempre acotada al documento (doc_id) y opcionalmente filtrada por tipo ('todos', 'texto', 'imagen').
    """
    emb_array = np.array(embedding_consulta, dtype=np.float32)

    if tipo in ("texto", "imagen"):
        sql = """
            SELECT tipo, pagina, contenido, imagen_id, 1 - (embedding <=> %s::vector) AS score
            FROM chunks
            WHERE doc_id = %s AND tipo = %s
            ORDER BY embedding <=> %s::vector
            LIMIT %s;
        """
        params = (emb_array, doc_id, tipo, emb_array, k)
    else:
        sql = """
            SELECT tipo, pagina, contenido, imagen_id, 1 - (embedding <=> %s::vector) AS score
            FROM chunks
            WHERE doc_id = %s
            ORDER BY embedding <=> %s::vector
            LIMIT %s;
        """
        params = (emb_array, doc_id, emb_array, k)

    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(sql, params)
            return cur.fetchall()


def obtener_imagenes_documento(doc_id: uuid.UUID) -> List[Dict[str, Any]]:
    """
    Obtiene todos los chunks de tipo 'imagen' de un documento para listar
    sus descripciones generadas por IA.
    """
    sql = """
        SELECT pagina, contenido AS descripcion, imagen_id
        FROM chunks
        WHERE doc_id = %s AND tipo = 'imagen'
        ORDER BY pagina ASC, id ASC;
    """
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(sql, (doc_id,))
            return cur.fetchall()


def obtener_detalle_imagen(doc_id: uuid.UUID, imagen_id: str) -> Optional[Dict[str, Any]]:
    """Obtiene la página y descripción registrada de una imagen específica."""
    sql = """
        SELECT pagina, contenido AS descripcion, imagen_id
        FROM chunks
        WHERE doc_id = %s AND imagen_id = %s AND tipo = 'imagen'
        LIMIT 1;
    """
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(sql, (doc_id, imagen_id))
            return cur.fetchone()


def obtener_texto_pagina(doc_id: uuid.UUID, pagina: int) -> str:
    """Obtiene y concatena todo el texto de una página específica."""
    sql = """
        SELECT contenido
        FROM chunks
        WHERE doc_id = %s AND pagina = %s AND tipo = 'texto'
        ORDER BY id ASC;
    """
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(sql, (doc_id, pagina))
            rows = cur.fetchall()
            return "\n\n".join(r["contenido"] for r in rows)


def _normalizar_termino(t: str) -> str:
    t = t.lower().strip()
    return t.replace('á', 'a').replace('é', 'e').replace('í', 'i').replace('ó', 'o').replace('ú', 'u')


def rerank_results(query: str, chunks: List[Dict[str, Any]], top_n: int = 5) -> List[Dict[str, Any]]:
    """
    Abstracción de Reranking para RAG:
    Reordena los candidatos semánticos combinando el score vectorial original con la
    densidad de palabras clave relevantes de la consulta encontradas en el contenido del chunk.
    Filtra stopwords de consulta ('busca', 'una', 'imagen', 'de', 'las', etc.)
    y permite coincidencias léxicas por raíz (ej. 'facturas' -> 'factura').
    """
    if not chunks:
        return []

    import re
    stopwords = {
        "que", "qué", "cual", "cuál", "cuales", "cuáles", "los", "las", "del", "por", "para", "con",
        "una", "uno", "unos", "unas", "sobre", "entre", "este", "esta", "estos", "estas",
        "busca", "buscar", "muestra", "muéstrame", "dime", "encuentra", "imagen", "imagenes", "imágenes"
    }

    raw_tokens = re.findall(r'\b[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]{3,}\b', query)
    palabras_query = [_normalizar_termino(p) for p in raw_tokens if _normalizar_termino(p) not in stopwords]

    if not palabras_query:
        palabras_query = [_normalizar_termino(p) for p in raw_tokens]

    def score_combinado(chunk: Dict[str, Any]) -> float:
        score_vectorial = float(chunk.get("score", 0.0))
        texto = _normalizar_termino(chunk.get("contenido", ""))
        if not palabras_query:
            return score_vectorial

        coincidencias = 0
        for p in palabras_query:
            raiz = p[:-1] if len(p) >= 5 and p.endswith(('s', 'a', 'o', 'e')) else p
            if p in texto or raiz in texto:
                coincidencias += 1

        boost = (coincidencias / len(palabras_query)) * 0.35
        if "imagen" in query.lower() and chunk.get("tipo") == "imagen":
            boost += 0.05

        return score_vectorial + boost

    ordenados = sorted(chunks, key=score_combinado, reverse=True)
    return ordenados[:top_n]

