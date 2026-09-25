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
      2. Redimensionar si el lado mayor supera max_dim (BILINEAR).
      3. Llamar a pytesseract.image_to_string con --psm 3 (página completa, auto).
      4. Capturar TesseractError y devolver "" si falla.

    Nota: pytesseract invoca el binario como subproceso y libera el GIL, por lo
    que ES seguro llamar esta función desde varios hilos simultáneamente.
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
            lado_largo = max(ancho, alto)
            if lado_largo > max_dim:
                factor = max_dim / lado_largo
                img = img.resize(
                    (max(1, int(ancho * factor)), max(1, int(alto * factor))),
                    Image.Resampling.BILINEAR,
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

    Estrategia de fallback:
      1. Tesseract (pytesseract) — rápido, hilo-seguro, ~1-2 s/pág.
      2. RapidOCR (ONNX)        — preciso pero lento (~6 s/pág), fallback si
                                   Tesseract no está instalado o devuelve vacío.

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

    # ── Intento 1: Tesseract ─────────────────────────────────────────────────
    if _tesseract_disponible:
        texto = extraer_texto_tesseract(image_path, max_dim=max_dim)
        if texto:
            return texto
        # Tesseract devolvió vacío → fallback a RapidOCR
        logger.debug(
            f"[OCR] Tesseract devolvió vacío para {image_path.name}; "
            "intentando RapidOCR."
        )

    # ── Intento 2: RapidOCR (fallback) ──────────────────────────────────────
    return extraer_texto_rapid(image_path, max_dim=max_dim)
