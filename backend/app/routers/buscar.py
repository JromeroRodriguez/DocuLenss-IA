import uuid
from typing import List, Optional, Literal
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, status

from app.services.embeddings import generar_embedding
from app.services.vector_store import buscar_similares
from app.db import obtener_documento

router = APIRouter(prefix="/api", tags=["Búsqueda"])


class BuscarRequest(BaseModel):
    doc_id: uuid.UUID
    consulta: str = Field(..., min_length=1, description="Texto de búsqueda del usuario")
    tipo: Literal["todos", "texto", "imagen"] = "todos"
    k: int = Field(default=5, ge=1, le=20, description="Número de resultados a retornar")


class ResultadoItem(BaseModel):
    tipo: str
    pagina: int
    fragmento: str
    imagen_id: Optional[str] = None
    imagen_url: Optional[str] = None
    score: float


class BuscarResponse(BaseModel):
    resultados: List[ResultadoItem]


@router.post("/buscar", response_model=BuscarResponse)
def buscar_en_documento(payload: BuscarRequest):
    """
    Realiza una búsqueda semántica vectorial en el documento especificado.
    Compara el embedding de la consulta contra chunks de texto y descripciones de imágenes.
    """
    # 1. Validar que el documento exista y esté listo
    doc = obtener_documento(payload.doc_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Documento no encontrado"
        )

    if doc["estado"] != "listo":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El documento aún está en estado '{doc['estado']}'. Espera a que termine de procesar."
        )

    # 2. Generar embedding de la consulta
    emb_consulta = generar_embedding(payload.consulta)

    # 3. Buscar similares en pgvector
    filas = buscar_similares(
        doc_id=payload.doc_id,
        embedding_consulta=emb_consulta,
        tipo=payload.tipo,
        k=payload.k
    )

    # 4. Formatear resultados
    resultados = []
    for r in filas:
        img_id = r.get("imagen_id")
        img_url = f"/api/imagenes/{str(payload.doc_id)}/{img_id}" if img_id else None

        resultados.append(ResultadoItem(
            tipo=r["tipo"],
            pagina=r["pagina"],
            fragmento=r["contenido"],
            imagen_id=img_id,
            imagen_url=img_url,
            score=round(float(r["score"]), 4)
        ))

    return BuscarResponse(resultados=resultados)
