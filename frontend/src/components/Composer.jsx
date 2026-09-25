import React, { useRef, useEffect } from 'react';
import {
  DocumentIcon,
  ImageIcon,
  CloseIcon,
  PaperclipIcon,
  ArrowUpIcon,
} from './Icons';

export default function Composer({
  input,
  setInput,
  onSend,
  onAttachFile,
  disabled,
  isUploading = false,
  placeholder,
  selectedDoc,
  chatImageId,
  chatImageThumb,
  chatImagePage,
  onClearImage,
  onOpenPdf,
  onOpenImages,
  totalImages = 0,
  textareaRef: externalTextareaRef,
}) {
  const internalTextareaRef = useRef(null);
  const textareaRef = externalTextareaRef || internalTextareaRef;
  const fileInputRef = useRef(null);

  // Auto-ajustar altura del textarea según el contenido (hasta ~6 líneas)
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      const newHeight = Math.min(el.scrollHeight, 150);
      el.style.height = `${newHeight}px`;
    }
  }, [input]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && input.trim()) {
        onSend();
      }
    }
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = (e) => {
    const file = e.target.files?.[0];
    if (file && onAttachFile) {
      onAttachFile(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-4 pt-2 shrink-0">
      {/* Input oculto para adjuntar PDF */}
      <input
        type="file"
        accept="application/pdf,.pdf"
        ref={fileInputRef}
        onChange={handleFileSelected}
        className="hidden"
      />

      {/* Caja contenedora principal con bordes muy redondeados y sombra suave */}
      <div className="bg-slate-900/90 border border-slate-700/80 rounded-3xl shadow-xl shadow-black/20 backdrop-blur flex flex-col p-2.5 transition focus-within:border-indigo-500/80 focus-within:ring-1 focus-within:ring-indigo-500/50">
        
        {/* Chips de Contexto Superiores (Documento Activo e Imagen Seleccionada) */}
        {(selectedDoc || chatImageId) && (
          <div className="flex flex-wrap items-center gap-2 px-2 pb-2 mb-1 border-b border-slate-800/80 text-xs">
            {/* Chip de Documento Activo */}
            {selectedDoc && (
              <div className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-800 px-2.5 py-1 rounded-xl text-slate-300">
                <DocumentIcon className="w-3.5 h-3.5 text-indigo-400" />
                <span className="font-medium text-[11px] truncate max-w-[150px] sm:max-w-[220px]">
                  {selectedDoc.nombre}
                </span>
                
                <div className="flex items-center gap-1 ml-1 pl-1 border-l border-slate-800 text-[10px]">
                  <button
                    type="button"
                    onClick={onOpenPdf}
                    className="hover:text-indigo-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400 rounded px-1 transition text-slate-400 cursor-pointer font-medium"
                    title="Ver PDF"
                    aria-label="Ver documento PDF"
                  >
                    Ver PDF
                  </button>
                  <span className="text-slate-600">·</span>
                  <button
                    type="button"
                    onClick={onOpenImages}
                    className="hover:text-indigo-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400 rounded px-1 transition text-slate-400 cursor-pointer font-medium"
                    title="Ver galería de imágenes"
                    aria-label={`Ver galería de ${totalImages} imágenes`}
                  >
                    Imágenes ({totalImages})
                  </button>
                </div>
              </div>
            )}

            {/* Chip de Imagen Seleccionada (Caso B) */}
            {chatImageId && (
              <div className="flex items-center gap-2 bg-indigo-950/70 border border-indigo-700/70 px-2.5 py-1 rounded-xl text-indigo-200">
                {chatImageThumb ? (
                  <img
                    src={chatImageThumb}
                    alt="Miniatura"
                    className="h-4 w-4 rounded object-cover border border-indigo-500/40"
                  />
                ) : (
                  <ImageIcon className="w-3.5 h-3.5 text-indigo-300" />
                )}
                <span className="text-[11px]">
                  Preguntando sobre la imagen {chatImagePage ? `de la p. ${chatImagePage}` : ''}
                </span>
                <button
                  type="button"
                  onClick={onClearImage}
                  className="text-indigo-300 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white rounded cursor-pointer ml-1 p-0.5"
                  aria-label="Quitar imagen seleccionada"
                  title="Quitar imagen"
                >
                  <CloseIcon className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Fila del Textarea y Botones */}
        <div className="flex items-end gap-2 px-1">
          {/* Botón de Adjuntar PDF */}
          <button
            type="button"
            onClick={handleAttachClick}
            disabled={isUploading}
            className="h-9 w-9 rounded-full hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-30 disabled:hover:bg-transparent text-slate-400 hover:text-slate-200 flex items-center justify-center transition cursor-pointer disabled:cursor-not-allowed shrink-0"
            aria-label="Adjuntar archivo PDF"
            title={isUploading ? 'Subiendo archivo...' : 'Adjuntar PDF'}
          >
            <PaperclipIcon className="w-4 h-4" />
          </button>

          {/* Textarea multilínea */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={
              placeholder || (selectedDoc ? 'Haz una pregunta sobre el documento...' : 'Sube un PDF para empezar…')
            }
            className="flex-1 bg-transparent border-0 focus:ring-0 focus:outline-none text-xs sm:text-sm text-slate-100 placeholder-slate-500 py-2 resize-none max-h-36 min-h-[36px] leading-relaxed"
          />

          {/* Botón Enviar */}
          <button
            type="button"
            onClick={onSend}
            disabled={disabled || !input.trim()}
            className="h-9 w-9 rounded-full bg-indigo-600 hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:opacity-30 disabled:hover:bg-indigo-600 text-white flex items-center justify-center transition cursor-pointer shrink-0 disabled:cursor-not-allowed shadow-sm"
            aria-label="Enviar mensaje"
            title="Enviar"
          >
            <ArrowUpIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      <p className="text-[10px] text-slate-500 text-center mt-2">
        DocuLens AI procesa texto e imágenes con IA multimodal. Las respuestas citan páginas del documento.
      </p>
    </div>
  );
}
