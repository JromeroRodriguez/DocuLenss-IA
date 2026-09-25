"""
Módulo OCR local — Motor primario: Tesseract (pytesseract), fallback: RapidOCR
-------------------------------------------------------------------------------
Estrategia:
  1. Tesseract se invoca como subproceso por cada llamada a pytesseract, lo que
     libera el GIL de Python. Esto hace que ThreadPoolExecutor escale de forma
     lineal: ~1-2 s/pág con 6 workers → 21 páginas ≈ 5-8 s.
  2. Si Tesseract no está instalado o falla, se cae automáticamente a RapidOCR
     (ONNX) para que la app nunca se rompa.
  3. RapidOCR sigue siendo un singleton (no es hilo-seguro); Tesseract no lo
     necesita porque cada llamada es stateless.

Fachada pública: extraer_texto_ocr(image_path, max_dim) — no cambia la firma.
"""

import logging
import shutil
import threading
from pathlib import Path

from PIL import Image, ImageOps

from app.config import OCR_LANG

logger = logging.getLogger(__name__)

# ── Estado de disponibilidad de Tesseract (detectado una sola vez al arranque) ─
_tesseract_disponible: bool | None = None  # None = aún no verificado

# ── Singleton y Lock de RapidOCR (fallback seguro entre hilos) ────────────────
_rapid_engine = None
_rapid_tipo: str = "unset"   # "rapid" | "none" | "unset"
_rapid_lock = threading.Lock()


# ──────────────────────────────────────────────────────────────────────────────
# Tesseract
# ──────────────────────────────────────────────────────────────────────────────

def get_tesseract_engine() -> bool:
    """
    Verifica que el binario tesseract esté en PATH y que el idioma configurado
    (OCR_LANG) esté disponible en tessdata.

    Retorna True si Tesseract está listo, False en caso contrario.
    """
    if shutil.which("tesseract") is None:
        logger.warning("[OCR] Tesseract binario no encontrado en PATH.")
        return False

    try:
        import pytesseract  # type: ignore
        idiomas_disponibles = pytesseract.get_languages(config="")
        # OCR_LANG puede ser "spa+eng"; verificamos cada uno
        requeridos = [l for l in OCR_LANG.split("+") if l]
        faltantes = [l for l in requeridos if l not in idiomas_disponibles]
        if faltantes:
            logger.warning(
                f"[OCR] Tesseract instalado pero faltan tessdata para: {faltantes}. "
                f"Disponibles: {idiomas_disponibles}"
            )
            return False
        logger.info(
            f"[OCR] Tesseract listo (lang={OCR_LANG}, "
            f"tessdata: {idiomas_disponibles})."
        )
        return True
    except Exception as e:
        logger.warning(f"[OCR] Error al verificar Tesseract: {e}")
        return False


def precargar_tesseract() -> None:
    """
    Valida el binario y los idiomas de Tesseract al arranque de la aplicación.
    Actualiza la bandera global _tesseract_disponible.
    """
    global _tesseract_disponible
    _tesseract_disponible = get_tesseract_engine()
    if _tesseract_disponible:
        print("[Startup] Tesseract OCR listo.")
    else:
        print("[Startup] Tesseract no disponible; se usará RapidOCR como fallback.")


def extraer_texto_tesseract(image_path: Path, max_dim: int = 1800) -> str:
    """
    Extrae texto con Tesseract vía pytesseract.

    Pasos:
      1. Abrir imagen con PIL, convertir a escala de grises y aplicar autocontraste
         (mejora drásticamente la lectura de fotos tomadas con celular y recibos).
      2. Redimensionar preservando el ancho legible (en tiras continuas de tickets,
         alto >> ancho, nunca se reduce por la altura para no aplastar los caracteres).
      3. Llamar a pytesseract.image_to_string con --psm 3 (página completa, auto).
      4. Capturar TesseractError y devolver "" si falla.
    """
    try:
        import pytesseract  # type: ignore
        from pytesseract import TesseractError  # type: ignore
    except ImportError:
        logger.error("[OCR/Tesseract] pytesseract no instalado.")
        return ""

    try:
        with Image.open(image_path) as img:
            # Escala de grises + autocontraste para fotos de cámara con sombras o contraste disparejo
            img = img.convert("L")
            img = ImageOps.autocontrast(img)
            ancho, alto = img.size

            # En tiras largas de tickets/recibos (alto >> ancho), nunca reducir
            # basándonos en la altura, porque reduciría el ancho a niveles ilegibles.
            if ancho > 2400:
                factor = 2400 / ancho
                img = img.resize(
                    (int(ancho * factor), int(alto * factor)),
                    Image.Resampling.LANCZOS,
                )
            elif max(ancho, alto) > max_dim and ancho < 2000 and alto <= max_dim * 1.5:
                # Documentos de proporción estándar A4/carta
                lado_largo = max(ancho, alto)
                factor = max_dim / lado_largo
                img = img.resize(
                    (max(1, int(ancho * factor)), max(1, int(alto * factor))),
                    Image.Resampling.LANCZOS,
                )

            texto = pytesseract.image_to_string(
                img,
                lang=OCR_LANG,
                config="--psm 3",
            )
            return texto.strip()
    except TesseractError as e:
        logger.error(f"[OCR/Tesseract] TesseractError en {image_path.name}: {e}")
        return ""
    except Exception as e:
        logger.error(f"[OCR/Tesseract] Error inesperado en {image_path.name}: {e}")
        return ""


# ──────────────────────────────────────────────────────────────────────────────
# RapidOCR (fallback)
# ──────────────────────────────────────────────────────────────────────────────

def _init_rapid():
    """Inicializa RapidOCR como motor de respaldo (singleton)."""
    try:
        from rapidocr_onnxruntime import RapidOCR  # type: ignore
        engine = RapidOCR()
        logger.info("[OCR] Motor RapidOCR inicializado (fallback).")
        return engine, "rapid"
    except Exception as e:
        logger.error(f"[OCR] RapidOCR tampoco disponible ({e}). OCR desactivado.")
        return None, "none"


def get_rapid_engine():
    """Retorna el singleton de RapidOCR (inicializa si es la primera vez)."""
    global _rapid_engine, _rapid_tipo
    if _rapid_tipo == "unset":
        _rapid_engine, _rapid_tipo = _init_rapid()
    return _rapid_engine, _rapid_tipo


def extraer_texto_rapid(image_path: Path, max_dim: int = 1800) -> str:
    """Extrae texto con RapidOCR (ONNX). No es hilo-seguro; usar desde un solo hilo."""
    import numpy as np  # importación diferida para no romper si no está

    engine, kind = get_rapid_engine()
    if engine is None:
        return ""

    try:
        with Image.open(image_path) as img:
            if img.mode != "RGB":
                img = img.convert("RGB")
            ancho, alto = img.size
            lado_largo = max(ancho, alto)
            if lado_largo > max_dim:
                factor = max_dim / lado_largo
                img = img.resize(
                    (max(1, int(ancho * factor)), max(1, int(alto * factor))),
                    Image.Resampling.BILINEAR,
                )
            img_np = np.array(img)
    except Exception as e:
        logger.error(f"[OCR/Rapid] Error al cargar imagen {image_path.name}: {e}")
        return ""

    try:
        with _rapid_lock:
            result, _ = engine(img_np)
        if not result:
            return ""
        lineas = [
            line[1].strip()
            for line in result
            if line and len(line) > 1 and line[1].strip()
        ]
        return "\n".join(lineas)
    except Exception as e:
        logger.error(f"[OCR/Rapid] Error en {image_path.name}: {e}")
        return ""


def extraer_encabezado_logo_ocr(image_path: Path) -> list:
    """
    Extrae con RapidOCR el encabezado superior (12% inicial de la página),
    donde se ubican logotipos, marcas comerciales y nombres de entidades
    (como 'Previsalud Semedical') que suelen usar fuentes estilizadas o matriz de puntos
    que Tesseract sobre toda la página puede omitir.
    """
    try:
        import cv2
        img_cv = cv2.imread(str(image_path))
        if img_cv is None:
            return []
        h, w = img_cv.shape[:2]
        header_cv = img_cv[0:int(h * 0.12), 0:w]
        engine, _ = get_rapid_engine()
        if engine is None:
            return []
        with _rapid_lock:
            res, _ = engine(header_cv)
        if not res:
            return []
        lineas = []
        for item in res:
            texto = item[1].strip()
            if len(texto) >= 3:
                lineas.append(texto)
        return lineas
    except Exception as e:
        logger.debug(f"[OCR] Aviso al extraer encabezado con RapidOCR: {e}")
        return []


# ──────────────────────────────────────────────────────────────────────────────
# Precarga legacy (compatibilidad con main.py → precargar_ocr)
# ──────────────────────────────────────────────────────────────────────────────

def precargar_ocr() -> None:
    """
    Alias de compatibilidad: preloads OCR engines al arranque.
    Llama a precargar_tesseract(); si no está disponible, inicializa RapidOCR.
    """
    precargar_tesseract()
    if not _tesseract_disponible:
        get_rapid_engine()


# ──────────────────────────────────────────────────────────────────────────────
# Fachada pública — no cambia la firma que usa ingesta.py
# ──────────────────────────────────────────────────────────────────────────────

def extraer_texto_ocr(image_path: Path, max_dim: int = 1800) -> str:
    """
    Extrae texto de una imagen usando el mejor motor OCR disponible.

    Estrategia híbrida:
      1. Tesseract (pytesseract) — rápido, hilo-seguro, transcribe el cuerpo de la página.
      2. RapidOCR (ONNX)        — inspecciona el encabezado/logo (primer 12%) para capturar
                                   marcas estilizadas (ej. 'Previsalud Semedical').
      3. Fallback total         — si Tesseract no está disponible o falla, RapidOCR procesa todo.

    Parámetros:
        image_path : ruta al archivo de imagen (JPEG / PNG).
        max_dim    : lado máximo en px antes de redimensionar.

    Retorna:
        Texto plano extraído o cadena vacía si ningún motor detecta texto.
    """
    global _tesseract_disponible

    # Verificar disponibilidad de Tesseract si aún no se ha hecho
    if _tesseract_disponible is None:
        _tesseract_disponible = get_tesseract_engine()

    texto = ""
    # ── Intento 1: Tesseract para el cuerpo completo ────────────────────────
    if _tesseract_disponible:
        texto = extraer_texto_tesseract(image_path, max_dim=max_dim)
        if not texto:
            logger.debug(
                f"[OCR] Tesseract devolvió vacío para {image_path.name}; "
                "intentando RapidOCR."
            )
            texto = extraer_texto_rapid(image_path, max_dim=max_dim)
    else:
        # ── Intento 2: RapidOCR (fallback si no hay Tesseract) ─────────────────
        texto = extraer_texto_rapid(image_path, max_dim=max_dim)

    # ── Enriquecimiento de encabezado/logotipo con RapidOCR ─────────────────
    try:
        lineas_header = extraer_encabezado_logo_ocr(image_path)
        if lineas_header:
            texto_inicio = (texto[:500] if texto else "").lower()
            faltantes = [l for l in lineas_header if l.lower() not in texto_inicio]
            if faltantes:
                header_extra = "\n".join(faltantes)
                texto = f"{header_extra}\n\n{texto}".strip() if texto else header_extra
    except Exception as e:
        logger.debug(f"[OCR] Error menor en enriquecimiento de encabezado: {e}")

    return texto.strip()
