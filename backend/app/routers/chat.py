import uuid
from pathlib import Path
from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, status

from app.config import STORAGE_DIR, RAG_SIMILARITY_THRESHOLD, RAG_TOP_K
from app.db import obtener_documento
from app.security import obtener_ruta_imagen_segura
import re
from app.services.embeddings import generar_embedding
from app.services.vector_store import (
    buscar_similares,
    obtener_detalle_imagen,
    obtener_texto_pagina,
    rerank_results,
    obtener_imagenes_documento,
)
from app.services.vision import responder_chat_rag, responder_chat_imagen

router = APIRouter(prefix="/api", tags=["Chat"])


def _es_consulta_catalogo_imagenes(pregunta: str) -> bool:
    """Detecta si la pregunta solicita ver, listar o resumir el catálogo de imágenes del documento."""
    p = pregunta.lower().strip()
    patrones = [
        "qué imágenes contiene", "que imagenes contiene",
        "cuáles imágenes", "cuales imagenes",
        "qué imágenes hay", "que imagenes hay",
        "lista las imágenes", "listar las imágenes",
        "resumen de imágenes", "muestra las imágenes",
        "todas las imágenes", "todas las imagenes",
        "imágenes del documento", "imagenes del documento"
    ]
    return any(pat in p for pat in patrones)


class MensajeHistorial(BaseModel):
    rol: Literal["user", "assistant"]
    contenido: str


class ChatRequest(BaseModel):
    doc_id: uuid.UUID
    mensaje: str = Field(..., min_length=1, description="Pregunta del usuario")
    historial: List[MensajeHistorial] = Field(default_factory=list, description="Últimos mensajes de la conversación")
    imagen_id: Optional[str] = Field(default=None, description="ID de imagen específica para el Caso B")


class FuenteItem(BaseModel):
    tipo: str
    pagina: int
    imagen_id: Optional[str] = None
    imagen_url: Optional[str] = None


class ChatResponse(BaseModel):
    respuesta: str
    fuentes: List[FuenteItem]


@router.post("/chat", response_model=ChatResponse)
def chat_con_documento(payload: ChatRequest):
    """
    Endpoint RAG conversacional:
    - Caso A (general / buscar imagen): recupera los ~6 mejores fragmentos (texto + descripciones de imagen),
      los sintetiza con Qwen y retorna fuentes.
    - Caso B (imagen_id presente): envía la imagen real en base64 junto con el texto de su página
      y la pregunta del usuario directamente a Qwen.
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
            detail=f"El documento aún no está listo (estado actual: '{doc['estado']}'). Espera a que termine la indexación."
        )

    historial_dicts = [h.model_dump() for h in payload.historial]

    # --- CASO B: Pregunta sobre una imagen específica ---
    if payload.imagen_id:
        img_path = obtener_ruta_imagen_segura(payload.doc_id, payload.imagen_id)
        if not img_path.is_file():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"La imagen {payload.imagen_id} no existe en el almacenamiento del documento."
            )

        detalle_img = obtener_detalle_imagen(payload.doc_id, payload.imagen_id)
        pagina = detalle_img["pagina"] if detalle_img else 1
        desc_guardada = detalle_img["descripcion"] if detalle_img else ""
        texto_pagina = obtener_texto_pagina(payload.doc_id, pagina)

        try:
            respuesta_ia = responder_chat_imagen(
                image_path=img_path,
                pagina=pagina,
                descripcion_guardada=desc_guardada,
                texto_pagina=texto_pagina,
                pregunta=payload.mensaje,
                historial=historial_dicts
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error al procesar la imagen con el modelo de IA: {str(e)}"
            )

        fuentes = [
            FuenteItem(
                tipo="imagen",
                pagina=pagina,
                imagen_id=payload.imagen_id,
                imagen_url=f"/api/imagenes/{str(payload.doc_id)}/{payload.imagen_id}"
            )
        ]

        return ChatResponse(respuesta=respuesta_ia, fuentes=fuentes)

    # --- CASO A1: Consulta general del catálogo de imágenes ---
    if _es_consulta_catalogo_imagenes(payload.mensaje):
        imagenes_doc = obtener_imagenes_documento(payload.doc_id)
        if imagenes_doc:
            bloques_contexto = [
                f"[Página {img['pagina']} - Imagen ({img['imagen_id']})]:\n{img['descripcion']}"
                for img in imagenes_doc
            ]
            fuentes = [
                FuenteItem(
                    tipo="imagen",
                    pagina=img["pagina"],
                    imagen_id=img["imagen_id"],
                    imagen_url=f"/api/imagenes/{str(payload.doc_id)}/{img['imagen_id']}"
                )
                for img in imagenes_doc
            ]
            contexto_str = "\n\n".join(bloques_contexto)
            try:
                respuesta_ia = responder_chat_rag(
                    contexto=contexto_str,
                    pregunta=payload.mensaje,
                    historial=historial_dicts
                )
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Error en el modelo de chat: {str(e)}"
                )
            return ChatResponse(respuesta=respuesta_ia, fuentes=fuentes)

    # --- CASO A2: Pregunta general o búsqueda de información/imágenes ---
    emb_mensaje = generar_embedding(payload.mensaje)
    chunks_candidatos = buscar_similares(
        doc_id=payload.doc_id,
        embedding_consulta=emb_mensaje,
        tipo="todos",
        k=max(RAG_TOP_K * 2, 12)
    )

    stopwords = {
        "que", "qué", "cual", "cuál", "cuales", "cuáles", "los", "las", "del", "por", "para", "con",
        "una", "uno", "unos", "unas", "sobre", "entre", "este", "esta", "estos", "estas",
        "busca", "buscar", "muestra", "muéstrame", "dime", "encuentra", "imagen", "imagenes", "imágenes"
    }
    raw_tokens = re.findall(r'\b[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]{3,}\b', payload.mensaje)
    palabras_clave = [
        p.lower().replace('á', 'a').replace('é', 'e').replace('í', 'i').replace('ó', 'o').replace('ú', 'u')
        for p in raw_tokens
        if p.lower().replace('á', 'a').replace('é', 'e').replace('í', 'i').replace('ó', 'o').replace('ú', 'u') not in stopwords
    ]

    es_busqueda_imagen = any(k in payload.mensaje.lower() for k in ["busca una imagen", "buscar imagen", "imagen de", "foto de", "muestra la imagen"])
    if es_busqueda_imagen:
        candidatos_imagenes = buscar_similares(
            doc_id=payload.doc_id,
            embedding_consulta=emb_mensaje,
            tipo="imagen",
            k=8
        )
        claves_existentes = {(c["tipo"], c["pagina"], c.get("imagen_id")) for c in chunks_candidatos}
        for ci in candidatos_imagenes:
            clave = (ci["tipo"], ci["pagina"], ci.get("imagen_id"))
            if clave not in claves_existentes:
                chunks_candidatos.append(ci)
                claves_existentes.add(clave)

    # 1. Filtro híbrido: relevancia vectorial o coincidencia léxica directa
    def es_relevante(chunk: Dict[str, Any]) -> bool:
        score = float(chunk.get("score", 0.0))
        if score >= RAG_SIMILARITY_THRESHOLD:
            return True
        if palabras_clave and score >= 0.15:
            texto = chunk.get("contenido", "").lower()
            texto = texto.replace('á', 'a').replace('é', 'e').replace('í', 'i').replace('ó', 'o').replace('ú', 'u')
            for p in palabras_clave:
                raiz = p[:-1] if len(p) >= 5 and p.endswith(('s', 'a', 'o', 'e')) else p
                if p in texto or raiz in texto:
                    return True
        return False

    chunks_relevantes = [c for c in chunks_candidatos if es_relevante(c)]

    # 2. Si ningún fragmento supera el corte, responder controladamente
    if not chunks_relevantes:
        return ChatResponse(
            respuesta=(
                "No encontré información suficientemente relevante en este documento para responder con certeza a tu consulta. "
                "Te sugiero reformular la pregunta o consultar sobre aspectos y temas presentes en el texto del PDF."
            ),
            fuentes=[]
        )

    # 3. Aplicar abstracción de Reranking sobre los candidatos que pasaron el filtro
    chunks_seleccionados = rerank_results(payload.mensaje, chunks_relevantes, top_n=RAG_TOP_K)

    bloques_contexto = []
    fuentes_map = {}

    for c in chunks_seleccionados:
        tipo = c["tipo"]
        pagina = c["pagina"]
        contenido = c["contenido"]
        img_id = c.get("imagen_id")

        if tipo == "imagen":
            bloques_contexto.append(f"[Página {pagina} - Contenido visual y encabezado ({img_id})]:\n{contenido}")
            clave_fuente = (tipo, pagina, img_id)
            if clave_fuente not in fuentes_map:
                fuentes_map[clave_fuente] = FuenteItem(
                    tipo="imagen",
                    pagina=pagina,
                    imagen_id=img_id,
                    imagen_url=f"/api/imagenes/{str(payload.doc_id)}/{img_id}"
                )
        else:
            bloques_contexto.append(f"[Página {pagina} - Contenido textual de la página]:\n{contenido}")
            clave_fuente = (tipo, pagina, None)
            if clave_fuente not in fuentes_map:
                fuentes_map[clave_fuente] = FuenteItem(
                    tipo="texto",
                    pagina=pagina,
                    imagen_id=None,
                    imagen_url=None
                )

    contexto_str = "\n\n".join(bloques_contexto)

    try:
        respuesta_ia = responder_chat_rag(
            contexto=contexto_str,
            pregunta=payload.mensaje,
            historial=historial_dicts
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error en el modelo de chat: {str(e)}"
        )

    return ChatResponse(
        respuesta=respuesta_ia,
        fuentes=list(fuentes_map.values())
    )
