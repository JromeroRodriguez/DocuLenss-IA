"""
Pipeline de ingesta de documentos PDF
--------------------------------------
Arquitectura de velocidad (post-migración a Tesseract):
  - Páginas escaneadas e imágenes se procesan en paralelo usando
    ThreadPoolExecutor. pytesseract invoca Tesseract como subproceso y
    libera el GIL en cada llamada, por lo que el paralelismo por hilos
    escala de forma lineal sin necesidad de procesos separados.
  - _max_ocr_workers usa cpu_count()//2 (≈6 en máquina de 12 núcleos)
    en lugar de los 4 procesos anteriores.
  - La actualización de progreso en BD se hace cada ~5 ítems para
    minimizar escrituras de red.
"""

import os
import re
import uuid
import logging
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, Any, List

from app.config import (
    STORAGE_DIR,
    ENABLE_VISION_DESCRIPTIONS,
    VISION_MAX_IMAGES_PER_DOCUMENT,
    CHUNK_SIZE,
    CHUNK_OVERLAP,
)
from app.db import actualizar_documento
from app.services.pdf_extractor import (
    extract_pdf_content,
    validar_limite_paginas,
    split_text_into_chunks,
    MAX_PAGINAS_POR_DOCUMENTO,
)
from app.services.embeddings import generar_embeddings
from app.services.vector_store import insertar_chunks_lote

logger = logging.getLogger(__name__)

# ── Helpers de paralelismo ───────────────────────────────────────────────────

def _max_ocr_workers(n_tareas: int) -> int:
    """
    Calcula cuántos hilos usar para OCR con Tesseract.
    Tesseract libera el GIL (subproceso), así que los hilos sí escalan.
    Se usa cpu_count()//2 para no saturar I/O de disco/CPU simultáneamente.
    """
    cores = os.cpu_count() or 2
    return min(max(1, cores // 2), n_tareas)


def _ocr_pagina_escaneada(sc: Dict[str, Any]) -> tuple:
    """
    Worker ejecutado en un hilo: transcribe una página escaneada usando OCR local.
    Si el OCR no detecta texto y ENABLE_VISION_DESCRIPTIONS está activo,
    aplica transcripción visual con IA como respaldo.
    """
    from app.services.ocr import extraer_texto_ocr
    try:
        transcripcion = extraer_texto_ocr(Path(sc["ruta"]))
        # Detectar si la página es en blanco, fantasma o mero ruido visual (muy pocas palabras válidas)
        palabras_validas = re.findall(r'[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]{3,}', transcripcion or "")
        es_ruido_o_vacio = not transcripcion or len(palabras_validas) < 3

        if es_ruido_o_vacio and ENABLE_VISION_DESCRIPTIONS:
            from app.services.vision import transcribir_pagina_escaneada
            transcripcion = transcribir_pagina_escaneada(Path(sc["ruta"]), sc["pagina"])
        elif es_ruido_o_vacio:
            transcripcion = "Página escaneada con contenido gráfico / visual sin texto relevante."
    except Exception as e:
        logger.error(f"[OCR] Error en página escaneada {sc['pagina']}: {e}")
        transcripcion = "Página escaneada sin texto detectable."

    return sc["imagen_id"], {
        "pagina": sc["pagina"],
        "transcripcion": transcripcion,
        "ruta": sc["ruta"],
    }


def _ocr_imagen_embebida(args: tuple) -> tuple:
    """
    Worker ejecutado en un hilo: transcribe una imagen embebida con OCR
    y enriquece su descripción con contexto o IA de visión según configuración.
    """
    img, page_contexts, index = args
    from app.services.ocr import extraer_texto_ocr

    img_id = img["imagen_id"]
    pagina = img["pagina"]
    ruta_img = Path(img["ruta"])
    contexto = page_contexts.get(pagina, "")

    try:
        texto_ocr = extraer_texto_ocr(ruta_img, max_dim=1600)
    except Exception as e:
        logger.warning(f"[OCR] Aviso al extraer OCR de {img_id}: {e}")
        texto_ocr = ""

    if texto_ocr and len(texto_ocr.strip()) > 5:
        descripcion = f"Gráfico / Diagrama con texto (pág. {pagina}):\n{texto_ocr.strip()}"
    elif ENABLE_VISION_DESCRIPTIONS and index < VISION_MAX_IMAGES_PER_DOCUMENT:
        try:
            from app.services.vision import describir_imagen
            descripcion = describir_imagen(ruta_img, contexto_pagina=contexto)
        except Exception as e:
            logger.warning(f"[Vision AI] Aviso al describir {img_id}: {e}")
            descripcion = f"Figura de la pág. {pagina}. Contexto: {contexto.strip()[:200]}" if contexto else f"Imagen extraída de la página {pagina}."
    elif contexto and len(contexto.strip()) > 10:
        descripcion = f"Figura / Imagen de la pág. {pagina}. Contexto: {contexto.strip()[:200]}"
    else:
        descripcion = f"Imagen extraída de la página {pagina}."

    return img_id, {"pagina": pagina, "descripcion": descripcion}


def _construir_descripcion_imagen_escaneada(pagina: int, img_id: str, texto_ocr: str) -> str:
    """
    Enriquece la descripción del chunk de imagen para páginas escaneadas y fotos de documentos
    (facturas, cédulas, recetas, órdenes) para que el buscador semántico y visual las localice con precisión.
    """
    texto_clean = " ".join(texto_ocr.split()) if texto_ocr else ""
    texto_upper = texto_clean.upper()

    etiquetas = []
    if any(k in texto_upper for k in ["CEDULA", "CÉDULA", "NUIP", "CIUDADANÍA", "CIUDADANIA", "REPUBLICA DE COLOMBIA"]):
        etiquetas.append("Cédula de ciudadanía / Documento de identidad e identificación")
    if any(k in texto_upper for k in ["ACTA DE ENTREGA", "DISPENSACION", "DISPENSACIÓN", "MEDICAMENTOS", "RECIBO", "FACTURA", "PREVISALUD", "SEMEDICAL"]):
        etiquetas.append("Factura / Recibo / Acta de entrega y dispensación de medicamentos")
    if any(k in texto_upper for k in ["ORDEN", "ORDENES", "ÓRDENES", "CEMINSA", "FORMULA", "FÓRMULA", "DIAGNOSTICO", "DIAGNÓSTICO", "POSOLOGIA", "POSOLOGÍA"]):
        etiquetas.append("Orden médica / Fórmula médica y prescripción de consulta externa")
    if any(k in texto_upper for k in ["ICCOL", "<<<<<<<<<<", "MRZ"]):
        etiquetas.append("Reverso de documento de identificación con código de barras y código MRZ")

    palabras_validas = re.findall(r'[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]{3,}', texto_clean)
    if not etiquetas and len(palabras_validas) < 3:
        return f"Página {pagina} ({img_id}) en blanco o reverso sin texto relevante."

    tipo_doc = " / ".join(etiquetas) if etiquetas else "Documento / Fotografía escaneada"
    resumen = texto_clean[:500]
    return f"Imagen de la página {pagina} ({img_id}): Fotografía de {tipo_doc}. Contenido: {resumen}"


# ── Pipeline principal ───────────────────────────────────────────────────────

def procesar_documento_pipeline(doc_id: uuid.UUID, pdf_path: Path):
    """
    Pipeline completo de ingesta (corre en background task de FastAPI):

    Paso 1  — Extracción de texto digital e imágenes con PyMuPDF.
    Paso 2  — OCR paralelo de páginas escaneadas con PaddleOCR / RapidOCR.
    Paso 3  — OCR paralelo + descripción de imágenes embebidas.
    Paso 4  — Construcción de chunks (texto + imagen) para indexar.
    Paso 5  — Generación de embeddings en lote (all-MiniLM-L6-v2, 384 dims).
    Paso 6  — Inserción masiva en PostgreSQL con pgvector.
    Paso 7  — Marca el documento como 'listo'.
    """
    output_images_dir = STORAGE_DIR / str(doc_id) / "imagenes"

    try:
        # ── Validación preventiva de límite de páginas ────────────────────────
        validar_limite_paginas(pdf_path, max_pages=MAX_PAGINAS_POR_DOCUMENTO)

        # ── Paso 1: Extracción PyMuPDF ───────────────────────────────────────
        logger.info(f"[{doc_id}] Iniciando extracción de texto e imágenes...")
        resultado = extract_pdf_content(pdf_path, output_images_dir)
        total_paginas  = resultado["paginas"]
        imagenes       = resultado["imagenes"]
        scanned_pages  = resultado.get("scanned_pages", [])
        text_chunks    = resultado["text_chunks"]
        page_contexts  = resultado["page_contexts"]

        total_tareas_visuales = len(imagenes) + len(scanned_pages)

        actualizar_documento(
            doc_id=doc_id,
            paginas=total_paginas,
            imagenes_total=total_tareas_visuales,
            imagenes_procesadas=0,
            estado="procesando",
        )
        logger.info(
            f"[{doc_id}] Extracción: {total_paginas} págs, "
            f"{len(imagenes)} imgs embebidas, {len(scanned_pages)} págs escaneadas."
        )

        procesadas             = 0
        transcripciones_escaneadas: Dict[str, Any] = {}
        descripciones_imagenes:     Dict[str, Any] = {}

        # ── Paso 2: OCR paralelo — páginas escaneadas ────────────────────────
        if scanned_pages:
            n = len(scanned_pages)
            workers = _max_ocr_workers(n)
            logger.info(f"[{doc_id}] OCR de {n} páginas escaneadas ({workers} hilos)...")

            with ThreadPoolExecutor(max_workers=workers) as pool:
                futuras = {
                    pool.submit(_ocr_pagina_escaneada, sc): sc
                    for sc in scanned_pages
                }
                for fut in as_completed(futuras):
                    try:
                        img_id, info = fut.result()
                        transcripciones_escaneadas[img_id] = info
                    except Exception as e:
                        sc = futuras[fut]
                        logger.error(f"[{doc_id}] Fallo en página {sc['pagina']}: {e}")
                        transcripciones_escaneadas[sc["imagen_id"]] = {
                            "pagina": sc["pagina"],
                            "transcripcion": "Página escaneada sin texto detectable.",
                            "ruta": sc["ruta"],
                        }
                    procesadas += 1
                    # Reportar progreso cada 5 páginas para no saturar la BD
                    if procesadas % 5 == 0 or procesadas == n:
                        actualizar_documento(doc_id=doc_id, imagenes_procesadas=procesadas)

            actualizar_documento(doc_id=doc_id, imagenes_procesadas=procesadas)
            logger.info(f"[{doc_id}] OCR de páginas escaneadas completado ({procesadas}).")

        # ── Paso 3: OCR paralelo — imágenes embebidas ────────────────────────
        if imagenes:
            n = len(imagenes)
            workers = _max_ocr_workers(n)
            logger.info(f"[{doc_id}] OCR de {n} imágenes embebidas ({workers} hilos)...")

            args = [(img, page_contexts, idx) for idx, img in enumerate(imagenes)]
            with ThreadPoolExecutor(max_workers=workers) as pool:
                futuras = {
                    pool.submit(_ocr_imagen_embebida, a): a[0]
                    for a in args
                }
                for fut in as_completed(futuras):
                    try:
                        img_id, info = fut.result()
                        descripciones_imagenes[img_id] = info
                    except Exception as e:
                        img = futuras[fut]
                        logger.error(f"[{doc_id}] Fallo en imagen {img['imagen_id']}: {e}")
                        descripciones_imagenes[img["imagen_id"]] = {
                            "pagina": img["pagina"],
                            "descripcion": f"Imagen de la página {img['pagina']}.",
                        }
                    procesadas += 1
                    if procesadas % 5 == 0 or procesadas == total_tareas_visuales:
                        actualizar_documento(doc_id=doc_id, imagenes_procesadas=procesadas)

            actualizar_documento(doc_id=doc_id, imagenes_procesadas=procesadas)
            logger.info(f"[{doc_id}] OCR de imágenes completado ({procesadas}/{total_tareas_visuales}).")

        # ── Paso 4: Construir lista de chunks para indexar ───────────────────
        chunks_para_indexar = []

        # Texto digital nativo
        for tc in text_chunks:
            chunks_para_indexar.append({
                "doc_id":    doc_id,
                "tipo":      "texto",
                "pagina":    tc["pagina"],
                "contenido": tc["contenido"],
                "imagen_id": None,
            })

        # Páginas escaneadas → chunk de texto (dividido en fragmentos contextuales) + chunk de imagen
        for img_id, sc_info in transcripciones_escaneadas.items():
            texto_escaneado = sc_info["transcripcion"]
            sub_chunks = split_text_into_chunks(texto_escaneado, chunk_size=CHUNK_SIZE, overlap=CHUNK_OVERLAP)
            if not sub_chunks:
                sub_chunks = [texto_escaneado]

            for sub in sub_chunks:
                chunks_para_indexar.append({
                    "doc_id":    doc_id,
                    "tipo":      "texto",
                    "pagina":    sc_info["pagina"],
                    "contenido": f"[Transcripción de página {sc_info['pagina']} escaneada]:\n{sub}",
                    "imagen_id": None,
                })

            desc_visual = _construir_descripcion_imagen_escaneada(
                pagina=sc_info["pagina"],
                img_id=img_id,
                texto_ocr=texto_escaneado
            )
            chunks_para_indexar.append({
                "doc_id":    doc_id,
                "tipo":      "imagen",
                "pagina":    sc_info["pagina"],
                "contenido": desc_visual,
                "imagen_id": img_id,
            })

        # Imágenes embebidas
        for img in imagenes:
            img_id = img["imagen_id"]
            info   = descripciones_imagenes.get(img_id, {
                "pagina":      img["pagina"],
                "descripcion": "Imagen extraída del documento.",
            })
            chunks_para_indexar.append({
                "doc_id":    doc_id,
                "tipo":      "imagen",
                "pagina":    info["pagina"],
                "contenido": info["descripcion"],
                "imagen_id": img_id,
            })

        # ── Paso 5: Embeddings en lote ───────────────────────────────────────
        if chunks_para_indexar:
            logger.info(f"[{doc_id}] Generando embeddings para {len(chunks_para_indexar)} chunks...")
            textos     = [c["contenido"] for c in chunks_para_indexar]
            embeddings = generar_embeddings(textos)
            for c, emb in zip(chunks_para_indexar, embeddings):
                c["embedding"] = emb

            # ── Paso 6: Inserción masiva en pgvector ─────────────────────────
            logger.info(f"[{doc_id}] Insertando chunks en PostgreSQL...")
            insertar_chunks_lote(chunks_para_indexar)

        # ── Paso 7: Marcar como listo ────────────────────────────────────────
        actualizar_documento(
            doc_id=doc_id,
            estado="listo",
            imagenes_procesadas=total_tareas_visuales,
        )
        logger.info(f"[{doc_id}] ✓ Documento listo para búsqueda/chat.")

    except Exception as e:
        logger.error(f"[{doc_id}] Error general en el pipeline: {e}", exc_info=True)
        actualizar_documento(doc_id=doc_id, estado="error", error=str(e))
