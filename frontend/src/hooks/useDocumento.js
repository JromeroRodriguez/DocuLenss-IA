import { useState, useRef, useEffect, useCallback } from 'react';
import { subirDocumento, getDocumento } from '../api';

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Hook para gestionar la subida de PDFs y el polling de estado cada 500ms.
 * Detiene el polling en 'listo' o 'error' y limpia el intervalo al desmontar.
 */
export function useDocumento({ setMessages }) {
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const pollIntervalRef = useRef(null);
  const lastFileRef = useRef(null);

  // Limpiar cualquier intervalo pendiente al desmontar
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const uploadFile = useCallback(async (file) => {
    if (!file) return;

    // 1. Validaciones previas del lado del cliente
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      const errorMsg = {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        tipo: 'error',
        texto: 'Solo se admiten documentos en formato PDF (.pdf).',
        canRetryUpload: false,
      };
      setMessages((prev) => [...prev, errorMsg]);
      return;
    }

    const maxSizeBytes = 50 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      const errorMsg = {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        tipo: 'error',
        texto: `El archivo "${file.name}" supera el límite de 50 MB.`,
        canRetryUpload: false,
      };
      setMessages((prev) => [...prev, errorMsg]);
      return;
    }

    lastFileRef.current = file;
    stopPolling();
    setIsUploading(true);

    const fileMsgId = `file-${Date.now()}`;
    const progressMsgId = `prog-${Date.now()}`;

    // 2. Agregar tarjeta de archivo y mensaje inicial de progreso al chat
    const fileCardMessage = {
      id: fileMsgId,
      sender: 'user',
      tipo: 'archivo',
      nombre: file.name,
      tamano: formatFileSize(file.size),
      paginas: null,
    };

    const initialProgressMessage = {
      id: progressMsgId,
      sender: 'assistant',
      tipo: 'progreso',
      texto: 'Leyendo el documento…',
      total: 0,
      procesadas: 0,
    };

    setMessages((prev) => [...prev, fileCardMessage, initialProgressMessage]);

    try {
      // 3. Subir archivo a /api/documentos
      const data = await subirDocumento(file);
      const docId = data.doc_id;

      // Actualizar doc activo preliminar
      setSelectedDoc({
        doc_id: docId,
        nombre: data.nombre || file.name,
        estado: data.estado || 'subido',
        paginas: null,
        totalImages: 0,
      });

      // 4. Polling a GET /api/documentos/{id}. El backend ya responde en décimas
      // de segundo, por eso se consulta cada 500ms + una comprobación inmediata
      // para detectar 'listo' casi al instante.
      const runPoll = async () => {
        try {
          const doc = await getDocumento(docId);
          const totalImg = doc.progreso?.imagenes_total || 0;
          const procImg = doc.progreso?.imagenes_procesadas || 0;

          // Si ya conocemos las páginas, actualizar la tarjeta de archivo
          if (doc.paginas) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === fileMsgId ? { ...msg, paginas: doc.paginas } : msg
              )
            );
          }

          if (doc.estado === 'procesando') {
            const progresoTexto =
              totalImg > 0
                ? `Analizando contenido e imágenes (${procImg}/${totalImg})…`
                : 'Leyendo texto del documento…';

            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === progressMsgId
                  ? {
                      ...msg,
                      texto: progresoTexto,
                      total: totalImg,
                      procesadas: procImg,
                    }
                  : msg
              )
            );
          } else if (doc.estado === 'listo') {
            stopPolling();
            setIsUploading(false);

            setSelectedDoc({
              doc_id: doc.doc_id,
              nombre: doc.nombre,
              paginas: doc.paginas,
              estado: 'listo',
              totalImages: totalImg,
            });

            // Reemplazar mensaje de progreso por el mensaje 'listo' con sugerencias
            const readyMessage = {
              id: `ready-${Date.now()}`,
              sender: 'assistant',
              tipo: 'listo',
              nombre: doc.nombre,
              paginas: doc.paginas,
              imagenes: totalImg,
            };

            setMessages((prev) =>
              prev
                .filter((msg) => msg.id !== progressMsgId)
                .concat(readyMessage)
            );
          } else if (doc.estado === 'error') {
            stopPolling();
            setIsUploading(false);

            const errorMessage = {
              id: `err-${Date.now()}`,
              sender: 'assistant',
              tipo: 'error',
              texto: `Error al procesar "${doc.nombre}": ${doc.error || 'Ocurrió una falla inesperada en el pipeline.'}`,
              canRetryUpload: true,
            };

            setMessages((prev) =>
              prev
                .filter((msg) => msg.id !== progressMsgId)
                .concat(errorMessage)
            );
          }
        } catch (pollErr) {
          console.error('Error durante el polling del documento:', pollErr);
        }
      };

      runPoll();
      pollIntervalRef.current = setInterval(runPoll, 2000);
    } catch (uploadErr) {
      stopPolling();
      setIsUploading(false);

      const errorMessage = {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        tipo: 'error',
        texto: uploadErr.message || 'Error al conectar con el servidor para subir el documento.',
        canRetryUpload: true,
      };

      setMessages((prev) =>
        prev
          .filter((msg) => msg.id !== progressMsgId)
          .concat(errorMessage)
      );
    }
  }, [setMessages, stopPolling]);

  const retryUpload = useCallback(() => {
    if (lastFileRef.current) {
      uploadFile(lastFileRef.current);
    }
  }, [uploadFile]);

  const resetDoc = useCallback(() => {
    stopPolling();
    setIsUploading(false);
    setSelectedDoc(null);
    lastFileRef.current = null;
  }, [stopPolling]);

  return {
    selectedDoc,
    setSelectedDoc,
    isUploading,
    uploadFile,
    retryUpload,
    resetDoc,
  };
}
