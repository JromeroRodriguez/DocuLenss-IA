import os
from pathlib import Path
from dotenv import load_dotenv

# Cargar variables de entorno desde backend/.env o raíz
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")
load_dotenv(BASE_DIR.parent / ".env")

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
MODELO_VISION = os.getenv("MODELO_VISION", "qwen/qwen3.8-27b")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "paraphrase-multilingual-MiniLM-L12-v2")
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://pdfvision:pdfvision@localhost:5434/pdfvision")
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "50"))
OCR_LANG = os.getenv("OCR_LANG", "spa+eng")  # idiomas para Tesseract
USE_IA_DESCRIPTIONS_FOR_PDF_EXTRACTION = os.getenv("USE_IA_DESCRIPTIONS_FOR_PDF_EXTRACTION", "false").strip().lower() in {"1", "true", "yes", "on"}
ENABLE_VISION_DESCRIPTIONS = os.getenv("ENABLE_VISION_DESCRIPTIONS", str(USE_IA_DESCRIPTIONS_FOR_PDF_EXTRACTION)).strip().lower() in {"1", "true", "yes", "on"}
VISION_MAX_IMAGES_PER_DOCUMENT = int(os.getenv("VISION_MAX_IMAGES_PER_DOCUMENT", "10"))

# ── Parámetros RAG y Chunking ────────────────────────────────────────────────
RAG_SIMILARITY_THRESHOLD = float(os.getenv("RAG_SIMILARITY_THRESHOLD", "0.25"))
RAG_TOP_K = int(os.getenv("RAG_TOP_K", "6"))
CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "1000"))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "150"))

if CHUNK_OVERLAP >= CHUNK_SIZE:
    CHUNK_OVERLAP = CHUNK_SIZE // 4

# ── CORS Configurable ────────────────────────────────────────────────────────
raw_cors = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173")
CORS_ORIGINS = [o.strip() for o in raw_cors.split(",") if o.strip()]

# ── Google Gemini API (Fallback / Proveedor alternativo) ─────────────────────
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite")

# ── Proveedor Local Ollama (qwen2.5vl:3b) ───────────────────────────────────
IA_PROVIDER = os.getenv("IA_PROVIDER", "groq").strip().lower()
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5vl:3b")

STORAGE_DIR = BASE_DIR / "storage"
STORAGE_DIR.mkdir(parents=True, exist_ok=True)

