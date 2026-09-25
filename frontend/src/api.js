/**
 * Cliente API para comunicarse con el backend de DocuLens AI.
 * Todas las llamadas pasan por el proxy de Vite en /api.
 */

export async function getHealth() {
  const response = await fetch('/api/health');
  if (!response.ok) {
    throw new Error(`Error en health check: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export async function subirDocumento(file) {
  const formData = new FormData();
  formData.append('archivo', file);

  const response = await fetch('/api/documentos', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Error al subir documento: ${response.statusText}`);
  }

  return response.json();
}

export async function getDocumentos() {
  const response = await fetch('/api/documentos');
  if (!response.ok) {
    throw new Error(`Error al listar documentos: ${response.statusText}`);
  }
  return response.json();
}

export async function getDocumento(docId) {
  const response = await fetch(`/api/documentos/${docId}`);
  if (!response.ok) {
    throw new Error(`Error al obtener documento: ${response.statusText}`);
  }
  return response.json();
}

export async function eliminarDocumento(docId) {
  const response = await fetch(`/api/documentos/${docId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Error al eliminar documento: ${response.statusText}`);
  }
  return response.json();
}

export async function getDocumentoImagenes(docId) {
  const response = await fetch(`/api/documentos/${docId}/imagenes`);
  if (!response.ok) {
    throw new Error(`Error al obtener imágenes: ${response.statusText}`);
  }
  return response.json();
}

export async function buscar(docId, consulta, tipo = 'todos', k = 5) {
  const response = await fetch('/api/buscar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      doc_id: docId,
      consulta,
      tipo,
      k,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Error en búsqueda: ${response.statusText}`);
  }

  return response.json();
}

export async function enviarChat(docId, mensaje, historial = [], imagenId = null) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      doc_id: docId,
      mensaje,
      historial,
      imagen_id: imagenId,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Error en chat: ${response.statusText}`);
  }

  return response.json();
}

export function getPdfUrl(docId) {
  return `/api/documentos/${docId}/pdf`;
}

export function getImagenUrl(docId, archivo) {
  return `/api/imagenes/${docId}/${archivo}`;
}
