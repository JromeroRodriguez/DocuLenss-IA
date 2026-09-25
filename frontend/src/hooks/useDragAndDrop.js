import { useState, useEffect, useRef } from 'react';

/**
 * Hook para gestionar arrastrar y soltar (drag & drop) a nivel de ventana.
 * Implementa un contador para evitar parpadeos en dragenter/dragleave
 * y reacciona únicamente cuando los tipos arrastrados incluyen 'Files'.
 */
export function useDragAndDrop({ onFileDropped, onError }) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  useEffect(() => {
    const handleDragEnter = (e) => {
      e.preventDefault();
      // Verificar si lo que se arrastra son archivos
      const types = e.dataTransfer?.types;
      if (types && Array.from(types).includes('Files')) {
        dragCounter.current += 1;
        if (dragCounter.current === 1) {
          setIsDragging(true);
        }
      }
    };

    const handleDragLeave = (e) => {
      e.preventDefault();
      const types = e.dataTransfer?.types;
      if (types && Array.from(types).includes('Files')) {
        dragCounter.current -= 1;
        if (dragCounter.current <= 0) {
          dragCounter.current = 0;
          setIsDragging(false);
        }
      }
    };

    const handleDragOver = (e) => {
      e.preventDefault();
      // Necesario para permitir soltar (drop)
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleDrop = (e) => {
      e.preventDefault();
      dragCounter.current = 0;
      setIsDragging(false);

      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      const fileList = Array.from(files);
      const pdfFiles = fileList.filter(
        (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
      );

      if (pdfFiles.length === 0) {
        if (onError) {
          onError('Solo se admiten documentos en formato PDF (.pdf).');
        }
        return;
      }

      const selectedFile = pdfFiles[0];
      const hasIgnoredFiles = fileList.length > 1;

      // Validación de tamaño (máx 50 MB)
      const maxSizeBytes = 50 * 1024 * 1024;
      if (selectedFile.size > maxSizeBytes) {
        if (onError) {
          onError(`El archivo "${selectedFile.name}" supera el límite de 50 MB.`);
        }
        return;
      }

      if (onFileDropped) {
        onFileDropped(selectedFile, { hasIgnoredFiles, totalDropped: fileList.length });
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, [onFileDropped, onError]);

  return { isDragging };
}
