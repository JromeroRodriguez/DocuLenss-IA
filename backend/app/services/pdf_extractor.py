import io
import hashlib
from pathlib import Path
from typing import List, Dict, Any
from PIL import Image
import pymupdf


MAX_PAGINAS_POR_DOCUMENTO = 20


def validar_limite_paginas(pdf_path: Path, max_pages: int = MAX_PAGINAS_POR_DOCUMENTO) -> None:
    """Rechaza PDFs con más de max_pages páginas para evitar procesamiento excesivo."""
    doc = pymupdf.open(str(pdf_path))
    try:
        total_pages = len(doc)
    finally:
        doc.close()

    if total_pages > max_pages:
        raise ValueError(
            f"El documento excede el límite de {max_pages} páginas por archivo. "
            f"Este PDF tiene {total_pages} páginas."
        )


def split_text_into_chunks(text: str, chunk_size: int = 1000, overlap: int = 150) -> List[str]:
    """
    Divide un texto en fragmentos de aproximadamente chunk_size caracteres
    con un solapamiento de overlap caracteres, respetando límites de palabras.
    """
    text = text.strip()
    if not text:
        return []
    if len(text) <= chunk_size:
        return [text]

    chunks = []
    start = 0
    text_len = len(text)

    while start < text_len:
        end = min(start + chunk_size, text_len)
        if end < text_len:
            # Buscar último espacio o salto de línea para no cortar palabras a la mitad
            last_break = max(text.rfind(" ", start, end), text.rfind("\n", start, end))
            if last_break > start + (chunk_size // 2):
                end = last_break

        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)

        if end >= text_len:
            break

        start = max(end - overlap, start + 1)

    return chunks


def extract_pdf_content(pdf_path: Path, output_images_dir: Path) -> Dict[str, Any]:
    """
    Extrae texto por página e imágenes embebidas.
    - Soporte para PDFs escaneados: si una página tiene < 50 caracteres de texto seleccionable,
      se renderiza la página completa como imagen en alta resolución para transcripción con IA.
    - Filtra imágenes menores a 100x100 px.
    - Elimina duplicados por hash MD5.
    - Convierte a RGB y guarda como JPEG (calidad 85).
    """
    output_images_dir.mkdir(parents=True, exist_ok=True)
    doc = pymupdf.open(str(pdf_path))
    total_pages = len(doc)

    if total_pages == 0:
        doc.close()
        raise ValueError("El documento PDF no contiene páginas legibles.")

    text_chunks = []
    page_contexts = {}
    extracted_images = []
    scanned_pages = []
    seen_hashes = set()

    for page_idx in range(total_pages):
        page_num = page_idx + 1
        page = doc[page_idx]

        # 1. Extracción de texto digital
        raw_text = page.get_text() or ""
        clean_text = " ".join(raw_text.split())
        page_contexts[page_num] = clean_text[:300]

        chunks = split_text_into_chunks(raw_text)
        for chunk in chunks:
            text_chunks.append({
                "pagina": page_num,
                "contenido": chunk
            })

        # --- CASO BORDE: PDFs Escaneados o páginas con muy poco texto (< 50 caracteres) ---
        es_pagina_escaneada = False
        if len(clean_text) < 50:
            es_pagina_escaneada = True
            try:
                # Renderizar página completa a 220 DPI (calidad ultra-nítida para OCR de documentos, recibos y fuentes pequeñas)
                pix = page.get_pixmap(dpi=220)
                scanned_filename = f"p{page_num}_escaneada.jpg"
                scanned_path = output_images_dir / scanned_filename
                pix.pil_save(str(scanned_path), format="JPEG", quality=94)

                scanned_pages.append({
                    "imagen_id": scanned_filename,
                    "archivo": scanned_filename,
                    "pagina": page_num,
                    "ruta": str(scanned_path),
                    "es_escaneada": True
                })
            except Exception as e:
                print(f"Aviso al renderizar página escaneada {page_num}: {e}")

        # 2. Extracción de imágenes embebidas
        image_list = page.get_images(full=True)
        img_counter_page = 1

        for img_info in image_list:
            xref = img_info[0]
            try:
                base_image = doc.extract_image(xref)
                if not base_image or not base_image.get("image"):
                    continue

                image_bytes = base_image["image"]

                # Verificar dimensiones en memoria
                img = Image.open(io.BytesIO(image_bytes))
                width, height = img.size

                # Descartar si es menor a 100x100 px (iconos, viñetas, líneas decorativas)
                if width < 100 or height < 100:
                    continue

                # Si la página es un escaneo/foto completa (sin texto seleccionable) y esta imagen
                # es la única de la página o cubre la mayor parte de ella, ya fue capturada
                # como página escaneada (evita duplicar procesamiento de fotos tomadas con cámara)
                es_foto_pagina = len(image_list) == 1 or ((width >= 700 and height >= 900) or (height >= 700 and width >= 900))
                if es_pagina_escaneada and es_foto_pagina:
                    continue

                # Evitar duplicados por hash MD5
                img_hash = hashlib.md5(image_bytes).hexdigest()
                if img_hash in seen_hashes:
                    continue
                seen_hashes.add(img_hash)

                if img.mode != "RGB":
                    img = img.convert("RGB")

                filename = f"p{page_num}_{img_counter_page}.jpg"
                save_path = output_images_dir / filename
                img.save(save_path, format="JPEG", quality=94)

                extracted_images.append({
                    "imagen_id": filename,
                    "archivo": filename,
                    "pagina": page_num,
                    "ruta": str(save_path),
                    "ancho": width,
                    "alto": height,
                    "es_escaneada": False
                })
                img_counter_page += 1
            except Exception as e:
                print(f"Aviso al extraer imagen xref {xref} en p. {page_num}: {e}")
                continue

    doc.close()

    return {
        "paginas": total_pages,
        "text_chunks": text_chunks,
        "page_contexts": page_contexts,
        "imagenes": extracted_images,
        "scanned_pages": scanned_pages
    }
