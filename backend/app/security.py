"""
Módulo de Seguridad — PDF Vision AI
-----------------------------------
Funciones centralizadas y reutilizables para:
  1. Prevención estricta de Path Traversal (relative_to / is_relative_to).
  2. Validación de identificadores UUID.
  3. Validación de cabeceras de archivo (magic bytes).
  4. Resolución segura de archivos en STORAGE_DIR.
"""

import uuid
from pathlib import Path
from typing import Union
from fastapi import HTTPException, status
from app.config import STORAGE_DIR

# Firma oficial de un archivo PDF válido
PDF_MAGIC_BYTES = b"%PDF-"


def validar_uuid(doc_id: Union[str, uuid.UUID]) -> uuid.UUID:
    """
    Valida y convierte un identificador a UUID.
    Lanza HTTPException 400 si el formato es inválido.
    """
    if isinstance(doc_id, uuid.UUID):
        return doc_id
    try:
        return uuid.UUID(str(doc_id).strip())
    except (ValueError, AttributeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El identificador del documento no es un UUID válido."
        )


def validar_ruta_segura(directorio_base: Path, ruta_relativa: str) -> Path:
    """
    Resuelve y valida que un archivo se encuentre estrictamente dentro de un directorio base permitido.
    Bloquea variantes de Path Traversal:
      - ../, ../../, ../../../etc/passwd
      - rutas absolutas (/etc/passwd, C:\\...)
      - nombres con caracteres de escape o diagonales intermedias
    """
    base = directorio_base.resolve()
    
    # Sanitizar entrada: no debe ser vacía ni contener nulos
    if not ruta_relativa or "\x00" in ruta_relativa:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nombre de archivo inválido o nulo."
        )

    # Construir y resolver la ruta absoluta de destino
    destino = (base / ruta_relativa).resolve()

    # Comprobación de seguridad estricta: destino DEBE ser descendiente directo de base
    try:
        destino.relative_to(base)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado: la ruta solicitada está fuera del directorio permitido."
        )

    return destino


def obtener_ruta_pdf_segura(doc_id: Union[str, uuid.UUID]) -> Path:
    """
    Retorna la ruta al PDF original de un documento validando que esté confinado en su directorio.
    """
    uuid_valido = validar_uuid(doc_id)
    doc_dir = (STORAGE_DIR / str(uuid_valido)).resolve()
    return validar_ruta_segura(doc_dir, "original.pdf")


def obtener_ruta_imagen_segura(doc_id: Union[str, uuid.UUID], imagen_id: str) -> Path:
    """
    Retorna la ruta a una imagen extraída de un documento validando estrictamente que
    esté confinada dentro de storage/{doc_id}/imagenes/.
    """
    uuid_valido = validar_uuid(doc_id)
    images_dir = (STORAGE_DIR / str(uuid_valido) / "imagenes").resolve()
    
    # Validar que imagen_id sea solo el nombre de archivo (sin directorios ni secuencias ..)
    nombre_limpio = Path(imagen_id).name
    if nombre_limpio != imagen_id or ".." in imagen_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado: nombre de imagen sospechoso o no autorizado."
        )

    return validar_ruta_segura(images_dir, nombre_limpio)


def es_archivo_pdf_valido(primeros_bytes: bytes) -> bool:
    """
    Verifica que la cabecera del archivo contenga la firma mágica '%PDF-'.
    """
    return bool(primeros_bytes and primeros_bytes.startswith(PDF_MAGIC_BYTES))
