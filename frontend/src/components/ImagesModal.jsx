import React, { useState, useEffect } from 'react';
import { getDocumentoImagenes } from '../api';
import {
  ImageIcon,
  CloseIcon,
  AlertTriangleIcon,
  ArrowRightIcon,
} from './Icons';

/**
 * Modal "Imágenes": Cuadrícula de todas las imágenes extraídas del documento.
 * - Iconografía 100% SVG vectorial.
 * - Al hacer clic en una miniatura, se abre el visor individual (Lightbox).
 * - Cierra con tecla Esc o botón SVG.
 */
export default function ImagesModal({
  isOpen,
  onClose,
  docId,
  docName,
  onSelectImage,
}) {
  const [images, setImages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !docId) return;

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    getDocumentoImagenes(docId)
      .then((data) => {
        if (isMounted) {
          setImages(data || []);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Error al cargar la galería de imágenes.');
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, docId]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Galería de imágenes"
    >
      {/* Fondo semitransparente */}
      <div
        className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Contenedor principal del Modal */}
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700/80 rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden z-10">
        {/* Encabezado */}
        <div className="px-5 py-3.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-2.5">
            <ImageIcon className="w-4 h-4 text-indigo-400" />
            <span className="font-semibold text-white text-sm">
              Imágenes del documento
            </span>
            <span className="font-mono text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-[11px]">
              {images.length} {images.length === 1 ? 'imagen' : 'imágenes'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px] text-slate-400 font-medium truncate max-w-[150px] sm:max-w-[200px]" title={docName}>
              {docName}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="h-7 w-7 rounded-lg bg-slate-800 hover:bg-rose-950/50 hover:text-rose-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 text-slate-400 transition flex items-center justify-center cursor-pointer text-sm font-semibold active:scale-95"
              aria-label="Cerrar modal de imágenes"
              title="Cerrar (Esc)"
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Cuadrícula de miniaturas */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {isLoading ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-3">
              <span className="inline-block h-6 w-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs">Cargando imágenes extraídas...</p>
            </div>
          ) : error ? (
            <div className="h-64 flex flex-col items-center justify-center text-rose-400 text-xs gap-1.5">
              <AlertTriangleIcon className="w-5 h-5 text-rose-400" />
              <span>{error}</span>
            </div>
          ) : images.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-500 gap-2">
              <ImageIcon className="w-10 h-10 text-slate-600" />
              <p className="text-sm font-medium">No se encontraron imágenes</p>
              <p className="text-xs text-slate-600">Este PDF no contiene imágenes o figuras extraíbles.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
              {images.map((img) => (
                <div
                  key={img.imagen_id}
                  onClick={() => onSelectImage && onSelectImage(img)}
                  className="group bg-slate-950/80 border border-slate-800 hover:border-indigo-500/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-xl overflow-hidden cursor-pointer transition flex flex-col shadow-sm hover:shadow-indigo-500/10 active:scale-98"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelectImage && onSelectImage(img)}
                  aria-label={`Ver imagen de la página ${img.pagina}`}
                >
                  {/* Vista previa con relación de aspecto cuadrada */}
                  <div className="relative aspect-video sm:aspect-square bg-slate-900 overflow-hidden flex items-center justify-center">
                    <img
                      src={img.url}
                      alt={img.descripcion || `Imagen página ${img.pagina}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                      loading="lazy"
                    />
                    <span className="absolute top-2 left-2 bg-slate-950/90 text-indigo-300 font-mono text-[10px] px-1.5 py-0.5 rounded border border-slate-800">
                      p. {img.pagina}
                    </span>
                  </div>

                  {/* Descripción breve */}
                  <div className="p-2 sm:p-2.5 flex-1 flex flex-col justify-between">
                    <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed">
                      {img.descripcion || 'Sin descripción disponible.'}
                    </p>
                    <span className="text-[10px] text-indigo-400 group-hover:text-indigo-300 font-medium mt-1.5 inline-flex items-center gap-1">
                      <span>Ver detalle</span>
                      <ArrowRightIcon className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
