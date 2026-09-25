import os
import uuid
import re
import shutil
from pathlib import Path
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks, status
from fastapi.responses import FileResponse
from app.config import STORAGE_DIR, MAX_UPLOAD_MB
from app.db import crear_documento, obtener_documento, listar_documentos, eliminar_documento
from app.security import (
    validar_uuid,
    obtener_ruta_pdf_segura,
    obtener_ruta_imagen_segura,
    es_archivo_pdf_valido,
)
from app.services.ingesta import procesar_documento_pipeline

router = APIRouter(prefix="/api", tags=["Documentos"])


def format_doc_response(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Formatea la respuesta del documento según el contrato de la API."""
    return {
        "doc_id": str(doc["doc_id"]),
        "nombre": doc["nombre"],
        "paginas": doc["paginas"],
        "estado": doc["estado"],
        "progreso": {
            "imagenes_total": doc["imagenes_total"] or 0,
            "imagenes_procesadas": doc["imagenes_procesadas"] or 0,
        },
        "error": doc["error"],
        "creado_en": doc["creado_en"].isoformat() if doc.get("creado_en") else None,
    }


def parse_page_from_filename(filename: str) -> int:
    """Extrae el número de página de nombres con formato p{pagina}_{n}.jpg"""
    match = re.match(r"^p(\d+)_", filename)
    if match:
        return int(match.group(1))
    return 1


@router.post("/documentos", status_code=status.HTTP_202_ACCEPTED)
async def subir_documento(
    background_tasks: BackgroundTasks,
    archivo: UploadFile = File(...)
):
    """
    Sube un archivo PDF, valida su formato y tamaño, lo persiste en disco,
    crea el registro en PostgreSQL y dispara la extracción en segundo plano.
    """
    # 1. Validar extensión y sanitizar nombre
    raw_filename = archivo.filename or "documento.pdf"
    filename = Path(raw_filename).name  # Remueve cualquier prefijo de ruta malicioso
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo proporcionado debe tener extensión .pdf"
        )

    # 2. Generar UUID y preparar directorios
    doc_id = uuid.uuid4()
    doc_dir = (STORAGE_DIR / str(doc_id)).resolve()
    doc_dir.mkdir(parents=True, exist_ok=True)
    pdf_path = doc_dir / "original.pdf"

    # 3. Guardar archivo verificando tamaño máximo y magic bytes (%PDF-)
    max_bytes = MAX_UPLOAD_MB * 1024 * 1024
    total_size = 0
    primer_chunk = True

    try:
        with open(pdf_path, "wb") as f:
            while chunk := await archivo.read(1024 * 1024):  # 1MB por chunk
                if primer_chunk:
                    if not es_archivo_pdf_valido(chunk[:5]):
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="El archivo no es un documento PDF válido (cabecera corrupta o no reconocida)."
                        )
                    primer_chunk = False
                
                total_size += len(chunk)
                if total_size > max_bytes:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"El archivo excede el tamaño máximo permitido de {MAX_UPLOAD_MB} MB"
                    )
                f.write(chunk)

        if total_size == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El archivo PDF subido está vacío (0 bytes)."
            )
    except HTTPException:
        shutil.rmtree(doc_dir, ignore_errors=True)
        raise
    except Exception as e:
        shutil.rmtree(doc_dir, ignore_errors=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al guardar el archivo: {str(e)}"
        )

    # 4. Insertar documento en base de datos
    nuevo_doc = crear_documento(doc_id=doc_id, nombre=filename)

    # 5. Despachar ingesta en segundo plano
    background_tasks.add_task(procesar_documento_pipeline, doc_id, pdf_path)

    return {
        "doc_id": str(doc_id),
        "nombre": filename,
        "estado": nuevo_doc["estado"]
    }


@router.get("/documentos")
def get_documentos():
    """Retorna la lista de todos los documentos registrados."""
    docs = listar_documentos()
    return [format_doc_response(d) for d in docs]


@router.get("/documentos/{doc_id}")
def get_documento_detalle(doc_id: str):
    """Retorna el estado y los metadatos de un documento específico."""
    valid_uuid = validar_uuid(doc_id)
    doc = obtener_documento(valid_uuid)
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado")

    return format_doc_response(doc)


@router.delete("/documentos/{doc_id}", status_code=status.HTTP_200_OK)
def borrar_documento(doc_id: str):
    """
    Elimina un documento de forma transaccional y segura:
    1. Valida el UUID del documento.
    2. Comprueba existencia en base de datos.
    3. Elimina el documento y sus chunks en cascada (PostgreSQL ON DELETE CASCADE).
    4. Purga el directorio físico asociado en storage/{doc_id}/ evitando archivos huérfanos.
    """
    valid_uuid = validar_uuid(doc_id)
    doc = obtener_documento(valid_uuid)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Documento no encontrado para eliminar."
        )

    # 1. Eliminar de la base de datos (chunks asociados caen por cascade)
    eliminar_documento(valid_uuid)

    # 2. Eliminar directorio de archivos físicos en almacenamiento
    doc_dir = (STORAGE_DIR / str(valid_uuid)).resolve()
    if doc_dir.exists() and doc_dir.is_relative_to(STORAGE_DIR.resolve()):
        shutil.rmtree(doc_dir, ignore_errors=True)

    return {
        "doc_id": str(valid_uuid),
        "nombre": doc["nombre"],
        "mensaje": f"Documento '{doc['nombre']}' y todos sus recursos asociados fueron eliminados.",
        "eliminado": True
    }


@router.get("/documentos/{doc_id}/pdf")
def get_documento_pdf(doc_id: str):
    """Sirve el archivo PDF original para visualización embebida en iframe de forma segura."""
    valid_uuid = validar_uuid(doc_id)
    pdf_path = obtener_ruta_pdf_segura(valid_uuid)

    if not pdf_path.is_file():
        raise HTTPException(status_code=404, detail="Archivo PDF no encontrado en el servidor")

    doc = obtener_documento(valid_uuid)
    nombre = doc["nombre"] if doc else "documento.pdf"

    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        filename=nombre,
        headers={"Content-Disposition": f'inline; filename="{nombre}"'}
    )


@router.get("/documentos/{doc_id}/imagenes")
def get_documento_imagenes(doc_id: str):
    """Retorna la lista de imágenes extraídas del documento con sus descripciones de IA."""
    valid_uuid = validar_uuid(doc_id)
    doc = obtener_documento(valid_uuid)
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado")

    images_dir = STORAGE_DIR / str(valid_uuid) / "imagenes"
    if not images_dir.is_dir():
        return []

    # Consultar si hay descripciones indexadas en chunks
    from app.services.vector_store import obtener_imagenes_documento
    db_images = {row["imagen_id"]: row["descripcion"] for row in obtener_imagenes_documento(valid_uuid)}

    imagenes = []
    for file_path in sorted(images_dir.glob("*.jpg")):
        filename = file_path.name
        pagina = parse_page_from_filename(filename)
        imagenes.append({
            "imagen_id": filename,
            "pagina": pagina,
            "url": f"/api/imagenes/{str(valid_uuid)}/{filename}",
            "descripcion": db_images.get(filename, "")
        })

    return imagenes


@router.get("/imagenes/{doc_id}/{archivo}")
def get_imagen(doc_id: str, archivo: str):
    """
    Sirve una imagen extraída de un documento.
    Verifica estrictamente que la ruta esté contenida dentro de storage/{doc_id}/imagenes/
    para prevenir cualquier ataque de directory traversal.
    """
    valid_uuid = validar_uuid(doc_id)
    image_path = obtener_ruta_imagen_segura(valid_uuid, archivo)

    if not image_path.is_file():
        raise HTTPException(status_code=404, detail="Imagen no encontrada")

    return FileResponse(
        path=image_path,
        media_type="image/jpeg"
    )
