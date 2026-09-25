# Prompt: rediseñar el frontend de PDF Vision como chat (estilo Claude / ChatGPT)

## 1. Contexto

**PDF Vision** ya funciona: el backend (FastAPI + Postgres/pgvector + Groq `qwen/qwen3.8-27b`) sube PDFs, extrae texto e imágenes, describe las imágenes con visión, busca y responde en un chat RAG. El frontend actual (React + Vite + Tailwind v4) tiene **3 paneles a la vez**: visor de PDF, galería de imágenes y un panel derecho con pestañas Chat/Buscador.

## 2. Objetivo

Reemplazar esa interfaz por **una sola experiencia de chat**, como Claude o ChatGPT:

- Una columna de conversación centrada, con la caja de mensaje abajo.
- El PDF se **sube o se arrastra directamente al chat**.
- El visor de PDF, las imágenes y la búsqueda dejan de ser paneles fijos: aparecen **solo cuando hacen falta** (panel lateral, ventanas modales, fuentes dentro de las respuestas).

**No toques el backend.** Solo cambia el frontend. Mantén React + Vite + Tailwind v4 (JSX, sin librerías de estado) y el tema oscuro actual (reutiliza los colores que ya existen).

## 3. Antes de escribir código (revisión primero)

Revisa el frontend actual y respóndeme, en máximo 10 líneas:

1. Qué componentes y funciones de `api.js` vas a **reutilizar tal cual**.
2. Qué vas a **eliminar** (layout de 3 paneles, pestaña Buscador, selector de documento, galería fija).
3. El **contrato real** de `/api/chat` y `/api/documentos/*` que encontraste en el código (no asumas: lee el código).
4. Cualquier problema o ambigüedad que veas en este documento.

Espera mi confirmación antes de continuar.

## 4. Comportamiento esperado

### 4.1 Pantalla inicial (sin documento)
- Título y una frase corta centrados, y una **zona de subida grande** con el texto "Arrastra un PDF aquí o haz clic para subirlo (máx. 50 MB)".
- La caja de mensaje aparece abajo, deshabilitada, con el texto "Sube un PDF para empezar…".

### 4.2 Subir un PDF (dos formas)
1. **Botón de adjuntar** (ícono de clip o "+") dentro de la caja de mensaje: abre el selector de archivos (`accept="application/pdf"`).
2. **Arrastrar y soltar** en cualquier parte de la ventana:
   - Al arrastrar un archivo sobre la ventana, aparece un **overlay a pantalla completa**: "Suelta el PDF para subirlo".
   - Usa un contador para `dragenter`/`dragleave` y evitar parpadeos, y reacciona solo si `dataTransfer.types` incluye `"Files"`.
   - Si sueltan varios archivos, usa el primer PDF y avisa que los demás se ignoraron.
   - Si no es PDF o pesa más de 50 MB: mensaje de error claro en español, sin llamar al backend.

### 4.3 Proceso dentro del chat
Al subir, se agrega a la conversación:
1. Una **tarjeta de archivo** (mensaje del usuario): ícono, nombre del PDF y páginas cuando se conozcan.
2. Un **mensaje del asistente** con el progreso ("Leyendo el documento…", luego "Analizando imágenes (3/12)…"), consultando `GET /api/documentos/{id}` cada 2 s. Detén el polling en `listo` o `error` y limpia el intervalo al desmontar.
3. Cuando el estado sea `listo`: mensaje "Listo, ya puedes preguntarme sobre **nombre.pdf**" con un resumen (páginas e imágenes) y **3 sugerencias clicables** que envían ese texto como pregunta: "Resume el documento", "¿Qué imágenes contiene?", "Busca una imagen de…" (la última rellena el input sin enviar).
4. Si hay error: mensaje del asistente con el motivo y botón "Reintentar subida".

### 4.4 Conversación
- Mensajes del **usuario**: burbuja alineada a la derecha. Mensajes del **asistente**: sin burbuja, alineados a la izquierda con un avatar pequeño (estilo ChatGPT/Claude).
- Renderiza las respuestas del asistente como **Markdown** con `react-markdown` (única dependencia nueva permitida; no habilites HTML crudo).
- Debajo de cada respuesta, la fila de **fuentes**: chips "p. 5" (al hacer clic abren el panel del PDF en esa página) y **miniaturas** de las imágenes citadas (al hacer clic abren el visor de imagen, ver 4.6).
- Mientras se espera respuesta: indicador de "escribiendo" (tres puntos). Bloquea el envío hasta que responda.
- Si falla la petición: mensaje de error del asistente con botón "Reintentar" que reenvía la última pregunta.
- **Autoscroll** al final cuando llegan mensajes nuevos, salvo que el usuario haya subido a leer (solo desplaza si ya estaba cerca del final).
- Si el usuario escribe sin haber subido un PDF, responde con un mensaje del asistente ("Primero sube un PDF") sin llamar a la API.

### 4.5 Caja de mensaje (composer)
- `textarea` que **crece con el contenido** (hasta ~6 líneas); **Enter envía**, **Shift+Enter** hace salto de línea.
- Botones: adjuntar PDF (izquierda) y enviar (derecha, deshabilitado si no hay texto).
- Encima del textarea, **chips de contexto**:
  - **Documento activo**: nombre del PDF con botones "Ver PDF" y "Imágenes (N)" (ver 4.6 y 4.7).
  - **Imagen seleccionada** (si hay): miniatura + "Preguntando sobre la imagen de la p. X" con una **×** para quitarla. Al enviar el mensaje se manda `imagen_id` en la petición y el chip se limpia.
- Solo hay **un documento activo**. Si suben otro PDF, pasa a ser el activo (se agrega su tarjeta al chat y las siguientes preguntas usan ese `doc_id`).
- Botón **"Nuevo chat"** en el encabezado: limpia mensajes, imagen seleccionada y documento activo (no borra nada en el servidor).

### 4.6 Panel del PDF y visor de imágenes (bajo demanda)
- **Panel lateral derecho (drawer)** con el visor `<iframe src="/api/documentos/{id}/pdf#page=N">` (usa `key` para que recargue al cambiar de página). Se abre con "Ver PDF" o con un chip de página. Se cierra con una × o con **Esc**. En móvil ocupa toda la pantalla.
- **Modal "Imágenes"**: cuadrícula de miniaturas de todas las imágenes del documento (`GET /api/documentos/{id}/imagenes`). Al hacer clic en una se abre el **visor de imagen (lightbox)**.
- **Lightbox**: imagen grande, página, descripción generada por la IA y botón **"Preguntar sobre esta imagen"**, que la selecciona como contexto en la caja de mensaje y cierra el modal. Esc para cerrar.

### 4.7 Búsqueda
- **Elimina la pestaña "Buscador"**: el chat ya cubre la búsqueda ("busca la imagen del diagrama…", "¿dónde habla de X?"). El endpoint `/api/buscar` se queda en el backend sin usar por ahora.

## 5. Componentes sugeridos (ajusta si ves algo mejor y más simple)

```
src/
├── App.jsx                # estado: documento activo, mensajes, imagen seleccionada
├── api.js                 # se mantiene; agrega solo lo que falte
├── hooks/
│   ├── useDragAndDrop.js  # overlay y captura de archivos en window
│   └── useDocumento.js    # subida + polling de estado
└── components/
    ├── Header.jsx         # logo, estado API/DB, "Nuevo chat"
    ├── EmptyState.jsx     # zona de subida inicial
    ├── MessageList.jsx
    ├── Message.jsx        # variantes: usuario, asistente, tarjeta de archivo, progreso
    ├── SourcesRow.jsx     # chips de página + miniaturas
    ├── Composer.jsx       # textarea, adjuntar, enviar, chips de contexto
    ├── DropOverlay.jsx
    ├── PdfDrawer.jsx
    ├── ImagesModal.jsx
    └── ImageLightbox.jsx
```

## 6. Diseño

- Columna de conversación centrada, `max-w-3xl`, con la caja de mensaje pegada abajo (bordes muy redondeados, sombra suave).
- Encabezado delgado: logo y nombre a la izquierda; a la derecha el indicador "DB & API: Online" que ya existe y el botón "Nuevo chat".
- **Responsive**: funciona bien desde 360 px de ancho. Drawer y modales a pantalla completa en móvil.
- **Accesibilidad**: `aria-label` en botones de solo ícono, estados de foco visibles, `Esc` cierra drawer/modales, el foco vuelve al textarea al cerrar.
- Textos de la interfaz en español.

## 7. Reglas

- No cambies el backend ni el contrato de la API. Si crees que hace falta un cambio, **dímelo antes**.
- Sin librerías de estado ni de UI nuevas (solo `react-markdown`). Justifica cualquier otra dependencia y espera mi respuesta.
- Nada de sobreingeniería: sin historial persistente de chats, sin barra lateral de conversaciones, sin streaming de respuestas, sin múltiples documentos a la vez. Si algo se puede hacer más simple, hazlo simple.
- Código legible para alguien de nivel junior, con comentarios breves en español donde aporten.
- Elimina el código de los paneles antiguos que ya no se use (no dejes componentes muertos).

## 8. Forma de trabajo por fases

Al terminar **cada fase** entrégame: (1) qué hiciste, breve y con una analogía si el concepto es nuevo; (2) comandos para probarlo, listos para copiar y pegar; (3) qué captura de pantalla debo enviarte; y **espera mi confirmación**.

### Fase 1: estructura visual
- Layout de chat: encabezado, pantalla inicial (`EmptyState`), lista de mensajes vacía y `Composer` visual (sin lógica todavía).
- **Listo cuando:** la app se ve como un chat vacío, sin rastro de los 3 paneles, y se ve bien en móvil (ancho de 360 px).

### Fase 2: subir y arrastrar
- Botón de adjuntar, drag & drop con overlay, validaciones, tarjeta de archivo, progreso con polling y mensaje final con sugerencias.
- **Listo cuando:** puedo subir el PDF con el clip y arrastrándolo, veo el progreso en el chat y termina con el mensaje "Listo…".

### Fase 3: conversación
- Envío de mensajes, respuesta con Markdown, indicador de escritura, errores con reintento, autoscroll, fila de fuentes (todavía sin abrir nada).
- **Listo cuando:** converso con el documento y cada respuesta muestra sus fuentes (páginas e imágenes).

### Fase 4: PDF e imágenes bajo demanda
- `PdfDrawer`, `ImagesModal`, `ImageLightbox`, chip de imagen seleccionada y envío de `imagen_id`.
- **Listo cuando:** un chip de página abre el PDF en esa página, puedo ver todas las imágenes, y "Preguntar sobre esta imagen" me deja preguntar sobre esa imagen concreta.

### Fase 5: pulido
- Estados de error, "Nuevo chat", accesibilidad, revisión final en móvil y escritorio, limpieza de código muerto.
- **Listo cuando:** el flujo completo funciona sin errores en consola.

## 9. Tu primera tarea

Haz la **revisión de la sección 3** y detente. No escribas código hasta que confirme.
