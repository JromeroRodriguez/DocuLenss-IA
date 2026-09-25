import sys
from pathlib import Path
from contextlib import asynccontextmanager

# Asegurar que el directorio 'backend' esté en sys.path sin importar desde dónde se invoque uvicorn
backend_dir = str(Path(__file__).resolve().parent.parent)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db import check_db_health, inicializar_pool, cerrar_pool
from app.routers import documentos, buscar, chat


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Precarga los modelos pesados (embeddings, OCR) y el pool de BD al arrancar.

    Esto evita que la primera petición pague la demora de cargar
    sentence-transformers y los motores OCR (Tesseract / RapidOCR fallback).
    """
    print("[Startup] Precargando dependencias pesadas...")
    inicializar_pool()

    try:
        from app.services.embeddings import get_embedding_model
        get_embedding_model()
        print("[Startup] Modelo de embeddings listo.")
    except Exception as e:
        print(f"[Startup] Aviso: no se pudo precargar embeddings: {e}")

    try:
        from app.services.ocr import precargar_ocr
        precargar_ocr()
    except Exception as e:
        print(f"[Startup] Aviso: no se pudo precargar OCR: {e}")

    try:
        from app.services.vision import get_groq_client, get_gemini_client
        if get_groq_client():
            print("[Startup] Cliente Groq listo.")
        if get_gemini_client():
            print("[Startup] Cliente Google Gemini listo (activo como respaldo/fallback).")
    except Exception as e:
        print(f"[Startup] Aviso en clientes de IA: {e}")

    yield

    cerrar_pool()


from app.config import CORS_ORIGINS

app = FastAPI(title="PDF Vision API", version="1.0.0", lifespan=lifespan)

# CORS seguro configurable mediante variable de entorno CORS_ORIGINS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS if CORS_ORIGINS else ["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS", "HEAD"],
    allow_headers=["*"],
)

# Registrar routers
app.include_router(documentos.router)
app.include_router(buscar.router)
app.include_router(chat.router)

@app.get("/api/health")
def get_health():
    db_ok = check_db_health()
    return {
        "estado": "ok",
        "base_de_datos": "ok" if db_ok else "error"
    }
