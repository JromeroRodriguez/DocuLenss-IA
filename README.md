# DocuLens AI — Workspace Conversacional Multimodal para Documentos y Firmas

**DocuLens AI** es una aplicación web full-stack que transforma la interacción con documentos PDF, fotos de facturas, recetas médicas y cédulas en una **experiencia de espacio de trabajo visual con chat integrado (Dual Panel / Split View)**. Combina modelos de lenguaje multimodal, visión por computador, OCR local híbrido y búsqueda semántica vectorial sobre PostgreSQL con `pgvector`.

No solo extrae y busca texto: **comprende diagramas, esquemas, gráficos y tablas**, permitiendo inspeccionar imágenes visualmente en alta resolución y dialogar con el documento mediante citas precisas de páginas.

---

## Características Principales

1. **Interfaz de Chat Conversacional Centralizada (React 19 + Tailwind CSS v4)**:
   - Experiencia de conversación fluida con input expansible, drag & drop a pantalla completa y renderizado Markdown.
   - Visor nativo de PDF en panel lateral (*drawer*) interactivo bajo demanda.
   - Galería de figuras y visor ampliado (*lightbox*) con el botón *"Preguntar sobre esta imagen"*.

2. **Extracción y Procesamiento Híbrido**:
   - **Texto Digital:** Segmentación en fragmentos con solapamiento contextual respetando límites de palabras (`CHUNK_SIZE=1000`, `CHUNK_OVERLAP=150`).
   - **OCR Local de Alto Rendimiento:** Motor primario Tesseract (libera el GIL en subprocesos) con fallback automático y sincronizado a RapidOCR (ONNX).
   - **Páginas Escaneadas:** Detección automática para páginas con menos de 50 caracteres seleccionables, renderizadas a 100 DPI y procesadas con OCR/IA.
   - **Imágenes Embebidas:** Filtrado de iconos (<100×100 px), deduplicación por hash MD5 y conversión a JPEG optimizado.

3. **Visión Multimodal con IA (Groq `qwen/qwen3.8-27b` + Google Gemini Fallback)**:
   - **Caso A (RAG General):** Recuperación semántica de fragmentos de texto y descripciones visuales, con citas de página (`p. X`) y miniaturas de fuentes.
   - **Caso B (Inspección Visual Directa):** Envío de la imagen real en base64 junto con el texto contextual de su página para responder preguntas minuciosas sobre figuras, gráficos o tablas.
   - Respaldo automático con Google Gemini si Groq alcanza límites de cuota (429).
   - Limpieza automática de tokens de razonamiento interno (`<think>`).

4. **Búsqueda Semántica Vectorial con Corte de Relevancia (pgvector)**:
   - Embeddings multilingües de 384 dimensiones (`paraphrase-multilingual-MiniLM-L12-v2`).
   - Búsqueda por similitud coseno indexada con HNSW.
   - **Filtro de Relevancia Mínima (`RAG_SIMILARITY_THRESHOLD`):** Si ningún fragmento supera el umbral, el sistema responde controladamente sin consumir llamadas innecesarias al LLM.
   - **Abstracción de Reranking:** Reordenamiento de candidatos previo a la síntesis.

5. **Seguridad y Hardening**:
   - Protección estricta contra **Path Traversal** en todos los endpoints de archivos mediante resolución canónica y verificación `is_relative_to()`.
   - Validación de cabeceras de archivo (*magic bytes* `%PDF-`) antes de procesar subidas.
   - CORS parametrizable por entorno (`CORS_ORIGINS`).
   - Endpoint seguro de eliminación completa de documentos (`DELETE /api/documentos/{doc_id}`) con purga física de archivos.

---

## Stack Tecnológico

| Capa | Tecnología |
|---|---|
| **Frontend** | React 19, Vite 6, Tailwind CSS v4 (`@tailwindcss/vite`), `react-markdown` |
| **Backend** | Python 3.12+, FastAPI, Uvicorn, Pydantic v2 |
| **Base de Datos** | PostgreSQL 16 con extensión `pgvector` (Docker Compose) |
| **Acceso a Datos** | `psycopg` (v3) con `ConnectionPool` y soporte nativo de vectores |
| **Procesamiento PDF & OCR** | PyMuPDF (`pymupdf`), Pillow (`PIL`), Tesseract OCR (`pytesseract`), RapidOCR |
| **IA & Visión** | Groq API (`qwen/qwen3.8-27b`) con respaldo en Google Gemini (`gemini-2.5-flash`) |
| **Embeddings** | `sentence-transformers` (`paraphrase-multilingual-MiniLM-L12-v2`, 384 dims) |
| **Testing** | Pytest 8+ (`pytest.ini` configurado para ejecución directa) |

---

## Estructura del Proyecto

```text
.
├── docker-compose.yml           # Contenedor PostgreSQL 16 + pgvector (puerto 5434:5432)
├── pytest.ini                   # Configuración de pruebas para ejecución directa
├── db/
│   └── init.sql                 # Extensión vector, tablas documentos/chunks e índices
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI, ciclo de vida (lifespan), CORS y routers
│   │   ├── config.py            # Carga de variables de entorno y parámetros RAG
│   │   ├── security.py          # Prevención de Path Traversal y validación de archivos
│   │   ├── db.py                # Pool de PostgreSQL y CRUD de documentos
│   │   ├── routers/
│   │   │   ├── documentos.py    # Subida, listado, descarga, imágenes y eliminación
│   │   │   ├── buscar.py        # Búsqueda semántica vectorial directa
│   │   │   └── chat.py          # Chat RAG multilínea y preguntas sobre imágenes
│   │   └── services/
│   │       ├── pdf_extractor.py # Extracción de texto e imágenes con PyMuPDF
│   │       ├── ocr.py           # Fachada OCR híbrida (Tesseract + RapidOCR thread-safe)
│   │       ├── vision.py        # Clientes Groq y Gemini, prompts y chat
│   │       ├── embeddings.py    # Generación de vectores con sentence-transformers
│   │       ├── vector_store.py  # Inserción en lote, búsqueda coseno y reranking
│   │       └── ingesta.py       # Pipeline orquestador en segundo plano
│   ├── tests/                   # Suite de pruebas unitarias y de seguridad
│   │   ├── test_security.py     # Tests contra Path Traversal, UUIDs y cabeceras
│   │   ├── test_rag_pipeline.py # Tests de threshold RAG y reranking
│   │   ├── test_pdf_processing.py # Tests de chunking y extracción PDF
│   │   └── test_pdf_limits.py   # Tests de límites de páginas
│   ├── storage/                 # Almacenamiento local ({doc_id}/original.pdf e imagenes/)
│   ├── requirements.txt         # Dependencias Python de backend y testing
│   └── .env.example             # Plantilla de variables de entorno
└── frontend/                    # Aplicación React + Vite + Tailwind v4
    ├── src/
    │   ├── components/          # Componentes de UI tipo chat
    │   │   ├── Header.jsx       # Barra superior con estado API/DB y Nuevo Chat
    │   │   ├── EmptyState.jsx   # Pantalla inicial con zona de subida interactiva
    │   │   ├── Composer.jsx     # Textarea expansible con chips de contexto y adjuntos
    │   │   ├── MessageList.jsx  # Lista de conversación con autoscroll inteligente
    │   │   ├── Message.jsx      # Renderizado de usuario, asistente, tarjeta de archivo y Markdown
    │   │   ├── SourcesRow.jsx   # Chips de páginas y miniaturas interactivas
    │   │   ├── DropOverlay.jsx  # Overlay a pantalla completa para drag & drop
    │   │   ├── PdfDrawer.jsx    # Visor nativo lateral de PDF por página
    │   │   ├── ImagesModal.jsx  # Galería de imágenes extraídas del documento
    │   │   └── ImageLightbox.jsx # Visor ampliado con botón "Preguntar sobre esta imagen"
    │   ├── hooks/
    │   │   ├── useDocumento.js  # Gestión de subida y polling de estado
    │   │   └── useDragAndDrop.js# Gestión de arrastre de archivos en ventana
    │   ├── api.js               # Cliente HTTP hacia /api
    │   ├── App.jsx              # Estado principal de la aplicación
    │   └── index.css            # Estilos globales y animaciones Tailwind v4
    ├── package.json
    └── vite.config.js           # Proxy hacia backend (puerto 8000)
```

---

## Instalación y Puesta en Marcha

### 1. Prerrequisitos
- **Docker y Docker Compose** activos.
- **Python 3.11+**
- **Node.js 18+** y **npm**
- *(Opcional pero recomendado en Linux)* **Tesseract OCR** con paquetes de idioma español e inglés (`sudo apt install tesseract-ocr tesseract-ocr-spa`).
- **API Key de Groq** (gratuita en [console.groq.com](https://console.groq.com/keys)).
- *(Opcional / Respaldo)* **API Key de Google Gemini** (gratuita en [aistudio.google.com](https://aistudio.google.com)).

### 2. Configurar Variables de Entorno
Copia la plantilla y configura tus claves en `backend/.env`:

```bash
cp backend/.env.example backend/.env
```

Contenido de referencia:
```env
# Proveedores de IA
GROQ_API_KEY=tu_api_key_de_groq_aqui
MODELO_VISION=qwen/qwen3.8-27b
GEMINI_API_KEY=tu_api_key_de_gemini_aqui
GEMINI_MODEL=gemini-2.5-flash

# Base de datos y embeddings
DATABASE_URL=postgresql://pdfvision:pdfvision@localhost:5434/pdfvision
EMBEDDING_MODEL=paraphrase-multilingual-MiniLM-L12-v2

# Límites y OCR
MAX_UPLOAD_MB=50
OCR_LANG=spa+eng

# Parámetros RAG y Chunking
RAG_SIMILARITY_THRESHOLD=0.35
RAG_TOP_K=6
CHUNK_SIZE=1000
CHUNK_OVERLAP=150

# Visión en Ingesta
ENABLE_VISION_DESCRIPTIONS=false
VISION_MAX_IMAGES_PER_DOCUMENT=10

# Seguridad y CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173
```

> **Nota**: El mapeo de Docker Compose usa el puerto `5434:5432` en el host para evitar colisiones con instancias nativas de Postgres.

### 3. Levantar la Base de Datos
```bash
docker compose up -d
```
Verifica que el contenedor `pdfvision-db` esté en ejecución (`docker compose ps`).

### 4. Configurar y Levantar el Backend
```bash
# Crear y activar entorno virtual
python3 -m venv .venv
source .venv/bin/activate

# Instalar dependencias
pip install -r backend/requirements.txt

# Iniciar servidor FastAPI (puerto 8000)
uvicorn app.main:app --app-dir backend --port 8000 --reload
```

### 5. Configurar y Levantar el Frontend
En otra terminal:
```bash
cd frontend
npm install
npm run dev
```

Abre tu navegador en:  
 **`http://localhost:5173`**

---

## Ejecución de Pruebas Automatizadas

El backend incluye una suite completa de pruebas unitarias, de integración y de seguridad que no consumen cuota de APIs externas:

```bash
# Ejecutar todas las pruebas
pytest

# Ejecutar únicamente pruebas de seguridad (Path Traversal, UUIDs, Magic Bytes)
pytest backend/tests/test_security.py -v

# Ejecutar pruebas de RAG (Umbral de relevancia y Reranking)
pytest backend/tests/test_rag_pipeline.py -v
```

---

## Referencia de la API REST

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/health` | Comprueba el estado de la API y la conectividad con PostgreSQL (`SELECT 1`). |
| `POST` | `/api/documentos` | Sube un archivo PDF (`multipart`), valida formato/tamaño/cabecera y lanza el pipeline en segundo plano. |
| `GET` | `/api/documentos` | Retorna la lista de todos los documentos registrados. |
| `GET` | `/api/documentos/{doc_id}` | Obtiene metadatos y estado del procesamiento (`procesando`, `listo`, `error`). |
| `DELETE` | `/api/documentos/{doc_id}` | Elimina el documento de PostgreSQL en cascada y purga los archivos físicos de disco. |
| `GET` | `/api/documentos/{doc_id}/pdf` | Sirve el archivo PDF original de forma segura para incrustación en `<iframe>`. |
| `GET` | `/api/documentos/{doc_id}/imagenes` | Retorna la lista de imágenes extraídas del documento con sus descripciones. |
| `GET` | `/api/imagenes/{doc_id}/{archivo}` | Sirve una imagen física extraída con validación estricta anti Path Traversal. |
| `POST` | `/api/buscar` | Búsqueda semántica por similitud coseno vectorial (filtra por `todos`, `texto` o `imagen`). |
| `POST` | `/api/chat` | Chat conversacional RAG (Caso A: general con filtro de relevancia; Caso B: inspección de imagen). |

---

## Consideraciones de Seguridad Implementadas

1. **Path Traversal:** Toda lectura o entrega de archivos utiliza `validar_ruta_segura()` verificando que la ruta canónica pertenezca a `STORAGE_DIR` mediante `.relative_to()`.
2. **Validación de Archivos:** Se valida la cabecera binaria `%PDF-` antes de guardar cualquier archivo en disco.
3. **Control de Recursos:** Límites estrictos de páginas por documento (20 páginas) y tamaño máximo de archivo (50 MB).
4. **Limpieza Automática:** Los fallos durante la subida eliminan inmediatamente cualquier directorio temporal en disco sin dejar carpetas huérfanas.
