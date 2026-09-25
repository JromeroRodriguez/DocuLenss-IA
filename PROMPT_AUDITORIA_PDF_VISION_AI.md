# AUDITORÍA Y HARDENING — PDF VISION AI

## Rol

Actúa como **Senior Software Engineer especializado en Python, FastAPI, React, RAG, IA multimodal, PostgreSQL/pgvector, seguridad de APIs y automatización de pipelines documentales**.

Debes trabajar directamente sobre el proyecto existente.

**No reconstruyas el proyecto desde cero.** Primero comprende la arquitectura actual y luego modifica únicamente lo necesario para corregir los problemas encontrados.

---

# 1. Objetivo

Auditar, corregir y mejorar técnicamente la aplicación **PDF Vision AI**.

La aplicación permite:

- subir documentos PDF;
- extraer texto;
- ejecutar OCR cuando es necesario;
- extraer imágenes;
- generar embeddings;
- almacenar embeddings en PostgreSQL + pgvector;
- realizar búsqueda semántica;
- responder preguntas mediante RAG;
- analizar imágenes mediante modelos multimodales;
- utilizar proveedores de IA como Groq/Gemini;
- mostrar documentos, páginas e imágenes desde React.

El objetivo es llevar el proyecto a un estado **estable, seguro, mantenible y demostrable**, manteniendo su alcance académico y evitando sobreingeniería.

---

# 2. Reglas importantes

Antes de modificar código:

1. Analiza toda la estructura del proyecto.
2. Identifica backend, frontend, base de datos, servicios, configuración, tests y Docker.
3. Lee primero los archivos relacionados con cada problema.
4. No reemplaces componentes funcionales sin necesidad.
5. No cambies tecnologías principales.
6. No introduzcas dependencias innecesarias.
7. Mantén compatibilidad con el código existente.
8. No elimines funcionalidades existentes.
9. No cambies endpoints públicamente utilizados sin mantener compatibilidad.
10. Toda modificación debe estar justificada técnicamente.
11. Ejecuta tests después de cada bloque importante de cambios.
12. Si encuentras un problema adicional crítico, corrígelo aunque no esté listado aquí.
13. No ocultes errores simplemente agregando `try/except`.
14. No hardcodees API keys, passwords, URLs privadas ni secretos.
15. Usa variables de entorno para configuración sensible.
16. Mantén el proyecto funcionando con Docker/local development.

---

# 3. PRIORIDAD P0 — Seguridad

## 3.1 Corregir Path Traversal

Revisa especialmente:

```text
backend/app/routers/chat.py
backend/app/routers/documentos.py
```

Actualmente existe una validación de rutas en algunos endpoints pero no de forma consistente.

Crea una función reutilizable para validar cualquier archivo asociado a un documento.

Debe garantizar que la ruta resuelta pertenezca realmente al directorio permitido.

Debe bloquear intentos como:

```text
../../archivo
../.env
../../../etc/passwd
```

o cualquier variante equivalente.

No dependas únicamente de `startswith()`.

Utiliza `Path.resolve()` y comprobación segura de directorio padre.

Aplica la misma función en:

- descarga de PDF;
- descarga de imágenes;
- análisis de imágenes;
- cualquier endpoint que reciba nombres/rutas de archivos.

Agrega tests específicos de seguridad.

---

# 4. PRIORIDAD P0 — Tests reproducibles

Actualmente la suite puede fallar durante la importación por dependencias como:

```text
ModuleNotFoundError: No module named 'groq'
```

aunque la dependencia esté declarada.

Investiga por qué ocurre.

Verifica:

```text
requirements.txt
requirements-dev.txt
pyproject.toml
Dockerfile
docker-compose
imports
entorno de ejecución
```

El objetivo es que un entorno limpio pueda ejecutar:

```bash
pytest
```

sin errores de importación.

Si una dependencia es opcional, implementa correctamente el patrón de dependencia opcional.

Si es obligatoria, asegúrate de que esté instalada y documentada.

No soluciones el problema eliminando imports necesarios.

---

# 5. PRIORIDAD P0 — Tests de seguridad

Crea tests para:

```text
test_path_traversal
test_invalid_doc_id
test_invalid_image_id
test_nonexistent_file
test_access_outside_storage
```

Prueba variantes como:

```text
../
../../
../../../
foo/../../
absolute paths
encoded traversal cuando aplique
```

Los tests deben demostrar que el backend responde con un error controlado y nunca permite acceso fuera de `STORAGE_DIR`.

---

# 6. PRIORIDAD P0 — RAG con relevancia mínima

Actualmente el sistema recupera los Top-K resultados vectoriales y los entrega al LLM.

Esto puede provocar que el modelo reciba contexto irrelevante.

Implementa:

```text
query
 ↓
embedding
 ↓
vector search
 ↓
top K
 ↓
relevance threshold
 ↓
contexto válido
 ↓
LLM
```

El threshold debe ser configurable mediante `.env`.

Por ejemplo:

```env
RAG_SIMILARITY_THRESHOLD=0.45
RAG_TOP_K=6
```

NO asumas que `0.45` es universal. El valor debe poder calibrarse.

Si ningún resultado supera el threshold:

- no llamar al LLM innecesariamente;
- responder mediante una respuesta controlada indicando que no se encontró información suficientemente relevante.

Importante:

- documentar cómo interpretar el score;
- no inventar información;
- conservar las fuentes/páginas cuando sí haya resultados.

---

# 7. PRIORIDAD P1 — Mejorar recuperación RAG

Evalúa el sistema actual.

Si puede hacerse sin agregar demasiada complejidad:

```text
Pregunta
 ↓
Vector Search Top 15
 ↓
Reranking
 ↓
Top 5
 ↓
LLM
```

No agregues un servicio externo de reranking si no es necesario.

Si implementar reranking introduce demasiada complejidad para el alcance académico, deja una abstracción preparada:

```python
rerank_results(...)
```

y documenta cómo podría incorporarse posteriormente.

No rompas el sistema actual por intentar agregar una mejora experimental.

---

# 8. PRIORIDAD P1 — Mejorar pipeline multimodal

Analiza cuidadosamente:

```text
backend/app/services/ingesta.py
backend/app/services/vision.py
backend/app/services/pdf_extractor.py
```

La aplicación tiene capacidad de análisis visual, pero la descripción IA de imágenes puede estar deshabilitada por configuración.

Mantén el procesamiento eficiente.

Diseña el pipeline:

```text
PDF
 │
 ├── texto extraíble
 │      ↓
 │    extracción normal
 │
 ├── texto insuficiente
 │      ↓
 │     OCR
 │
 └── imágenes
        ↓
   clasificación
        │
        ├── imagen irrelevante
        │
        ├── imagen con texto → OCR
        │
        └── gráfico/diagrama/imagen relevante
                    ↓
                Vision AI
                    ↓
              descripción
                    ↓
                embedding
```

La IA multimodal NO debe ejecutarse innecesariamente sobre todas las imágenes.

Debe existir una estrategia configurable.

Por ejemplo:

```env
ENABLE_VISION_DESCRIPTIONS=false
VISION_MAX_IMAGES_PER_DOCUMENT=...
```

Mantén el modo actual para desarrollo económico.

---

# 9. PRIORIDAD P1 — Metadata enriquecida para RAG

Revisa el modelo de chunks.

Cada chunk debería conservar metadata útil:

```json
{
  "document_id": "...",
  "page": 5,
  "chunk_index": 12,
  "content_type": "text",
  "section": "...",
  "source": "...",
  "has_image": false
}
```

No inventes secciones si no pueden determinarse.

Como mínimo conserva:

- documento;
- página;
- índice del chunk;
- tipo de contenido;
- origen.

Esto debe permitir respuestas como:

```text
Fuente: documento.pdf
Página: 5
```

---

# 10. PRIORIDAD P1 — Eliminar documentos

Implementa:

```http
DELETE /api/documentos/{doc_id}
```

El proceso debe:

1. verificar que el documento existe;
2. eliminar chunks/embeddings relacionados;
3. eliminar el PDF;
4. eliminar imágenes generadas;
5. eliminar directorios asociados;
6. manejar errores de forma segura;
7. devolver una respuesta clara.

Usa transacciones donde corresponda.

Evita dejar archivos huérfanos.

---

# 11. PRIORIDAD P1 — Deduplicación

Evalúa agregar SHA-256 del PDF original.

Flujo:

```text
upload
 ↓
SHA-256
 ↓
¿Existe?
 ├── sí → evitar reprocesamiento
 └── no → crear documento
```

No implementes esto si requiere una migración destructiva.

Si se implementa:

- agrega campo adecuado;
- agrega índice;
- maneja concurrencia;
- evita duplicados.

---

# 12. PRIORIDAD P1 — CORS

La configuración actual permite:

```python
allow_origins=["*"]
allow_credentials=True
```

Esto debe corregirse.

Implementa:

```env
CORS_ORIGINS=http://localhost:5173
```

y permite múltiples orígenes mediante configuración.

Ejemplo:

```env
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

No hardcodees producción.

---

# 13. PRIORIDAD P1 — Manejo de errores

Revisa todos los routers y servicios.

No expongas directamente:

```python
str(e)
```

al cliente cuando pueda revelar información interna.

Implementa:

```text
logs internos detallados
+
respuesta externa controlada
```

Ejemplo:

```json
{
  "detail": "No fue posible procesar la solicitud.",
  "error_id": "..."
}
```

El servidor debe registrar el error real.

No ocultes errores de programación.

---

# 14. PRIORIDAD P1 — Logging

Implementa logging estructurado razonable.

Registrar:

- inicio de procesamiento;
- documento;
- número de páginas;
- OCR ejecutado;
- cantidad de imágenes;
- cantidad de chunks;
- embeddings;
- errores;
- proveedor de IA utilizado;
- fallback;
- duración del pipeline.

NO registrar:

- API keys;
- passwords;
- tokens;
- documentos completos;
- información privada innecesaria.

---

# 15. PRIORIDAD P1 — Background processing

Actualmente se utiliza `BackgroundTasks`.

No reemplazar inmediatamente por Celery/RQ/Redis si el alcance académico no lo necesita.

En su lugar:

1. conserva `BackgroundTasks`;
2. mejora el estado del documento;
3. evita inconsistencias;
4. asegúrate de manejar errores;
5. permite estados:

```text
pending
processing
completed
failed
```

El frontend debe poder distinguir claramente estos estados.

Deja documentada una futura migración a:

```text
Redis + Celery/RQ
```

si el proyecto escala.

---

# 16. PRIORIDAD P2 — Chunking

Revisa:

```text
chunk_size
overlap
```

Actualmente existe una estrategia basada en caracteres.

No la reemplaces por una solución compleja sin evidencia.

Haz que:

```env
CHUNK_SIZE=1000
CHUNK_OVERLAP=150
```

sean configurables.

Asegúrate de que:

```text
overlap < chunk_size
```

y valida valores inválidos.

---

# 17. PRIORIDAD P2 — Configuración

Centraliza configuración mediante `.env`.

Revisa:

```text
DATABASE_URL
GROQ_API_KEY
GEMINI_API_KEY
STORAGE_DIR
CORS_ORIGINS
RAG_TOP_K
RAG_SIMILARITY_THRESHOLD
CHUNK_SIZE
CHUNK_OVERLAP
VISION_ENABLED
```

No expongas secretos en:

- Git;
- README;
- código;
- logs;
- frontend.

Verifica `.gitignore`.

---

# 18. PRIORIDAD P2 — Documentación

Actualiza README para que describa exactamente lo que realmente hace el código.

No documentes funcionalidades inexistentes.

Debe incluir:

```text
1. Descripción
2. Arquitectura
3. Stack
4. Instalación
5. Variables de entorno
6. Docker
7. Ejecución backend
8. Ejecución frontend
9. Pipeline de procesamiento
10. Arquitectura RAG
11. Arquitectura multimodal
12. Endpoints
13. Tests
14. Seguridad
15. Limitaciones
16. Mejoras futuras
```

Corrige inconsistencias como:

- resolución DPI documentada vs real;
- nombres antiguos de componentes;
- funcionalidades que ya cambiaron.

---

# 19. Tests mínimos finales

Debes terminar con una suite que cubra al menos:

## PDF

```text
valid PDF
invalid PDF
empty PDF
large PDF
PDF with text
scanned PDF
```

## RAG

```text
relevant query
irrelevant query
threshold rejection
source/page metadata
empty results
```

## Seguridad

```text
path traversal
invalid UUID
invalid image
unauthorized path
```

## API

```text
upload
list
get
delete
chat
image analysis
```

## IA

Mockea proveedores externos.

Los tests NO deben consumir API keys reales.

---

# 20. No romper funcionalidades

Después de cada modificación ejecuta:

```bash
pytest
```

y, si existe:

```bash
npm test
```

También ejecuta:

```bash
npm run build
```

y el build/validación del backend.

Comprueba:

```text
Docker build
Docker compose
backend startup
frontend startup
database connection
```

---

# 21. Criterio de aceptación

## Seguridad

```text
[ ] No existe path traversal
[ ] No se accede a archivos fuera de STORAGE_DIR
[ ] CORS configurable
[ ] Secrets fuera del código
[ ] Errores internos no expuestos
```

## RAG

```text
[ ] Threshold configurable
[ ] No se llama al LLM con contexto irrelevante
[ ] Las fuentes siguen funcionando
[ ] Página/documento correctamente identificados
[ ] Metadata preservada
```

## Multimodal

```text
[ ] Imágenes pueden analizarse
[ ] Vision AI es configurable
[ ] No se consume IA innecesariamente
[ ] OCR y Vision tienen responsabilidades claras
```

## Pipeline

```text
[ ] pending
[ ] processing
[ ] completed
[ ] failed
```

## Documentos

```text
[ ] upload
[ ] processing
[ ] consulta
[ ] eliminación
[ ] limpieza de archivos
```

## Tests

```text
[ ] pytest inicia correctamente
[ ] tests de seguridad
[ ] tests RAG
[ ] tests API
[ ] mocks de IA
```

## Frontend

```text
[ ] build correcto
[ ] estados de procesamiento
[ ] errores controlados
[ ] eliminación de documentos
[ ] chat funcionando
```

---

# 22. Forma de trabajo del agente

Trabaja en este orden:

```text
FASE 1
Auditar
 ↓
FASE 2
Corregir seguridad
 ↓
FASE 3
Corregir entorno/tests
 ↓
FASE 4
Corregir RAG
 ↓
FASE 5
Mejorar pipeline multimodal
 ↓
FASE 6
Mejorar documentos/persistencia
 ↓
FASE 7
Mejorar configuración/logging
 ↓
FASE 8
Actualizar frontend
 ↓
FASE 9
Actualizar README
 ↓
FASE 10
Ejecutar pruebas completas
 ↓
FASE 11
Auditoría final
```

No hagas todos los cambios de forma ciega.

Después de cada fase:

1. ejecuta tests;
2. revisa errores;
3. corrige regresiones;
4. continúa.

---

# 23. Entregable final

Al terminar, proporciona un informe:

```text
AUDITORÍA FINAL

1. Problemas encontrados
2. Problemas corregidos
3. Archivos modificados
4. Nuevos archivos
5. Dependencias agregadas
6. Migraciones realizadas
7. Tests creados
8. Tests ejecutados
9. Resultado de tests
10. Mejoras de seguridad
11. Mejoras RAG
12. Mejoras multimodales
13. Limitaciones restantes
14. Recomendaciones futuras
```

Para cada modificación importante indica:

```text
Problema
Causa
Solución
Archivo
Impacto
```

No afirmes que algo está solucionado si no lo verificaste ejecutando el código.

---

# RESTRICCIÓN FINAL

**No sobreingenierices el proyecto.**

El objetivo es convertir el proyecto actual en una aplicación académica/portafolio **sólida, segura, demostrable y técnicamente defendible**, no construir una plataforma empresarial completa.

Prioriza:

```text
SEGURIDAD
>
CORRECCIÓN
>
TESTS
>
RAG
>
MULTIMODAL
>
MANTENIBILIDAD
>
RENDIMIENTO
>
ESCALABILIDAD
```

Antes de finalizar, revisa nuevamente todo el código modificado buscando regresiones.
