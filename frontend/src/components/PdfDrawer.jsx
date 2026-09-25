import React, { useEffect } from 'react';
import { getPdfUrl } from '../api';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  CloseIcon,
} from './Icons';

/**
 * Panel lateral (drawer) para visualizar el documento PDF en páginas específicas.
 * - Iconografía 100% SVG vectorial.
 * - Se abre al hacer clic en "Ver PDF" o en los chips de fuente "p. X".
 * - Se cierra con la × o presionando la tecla Esc.
 */
export default function PdfDrawer({
  isOpen,
  onClose,
  docId,
  docName,
  currentPage = 1,
  totalPages = 1,
  onPageChange,
}) {
  // Manejo de la tecla Esc para cerrar
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

  if (!isOpen || !docId) return null;

  const pdfUrl = `${getPdfUrl(docId)}#page=${currentPage}`;

  return (
    <div className="fixed inset-0 z-50 flex justify-end animate-fade-in" role="dialog" aria-modal="true" aria-label="Visor de PDF">
      {/* Fondo semitransparente con clic para cerrar */}
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Contenedor del Drawer deslizante */}
      <div className="relative w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl h-full bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col z-10 animate-slide-in-right">
        {/* Barra superior con controles */}
        <div className="px-4 py-3 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between text-xs shrink-0">
          {/* Navegación de páginas */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPageChange && onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed transition text-slate-300 active:scale-95 cursor-pointer"
              title="Página anterior"
              aria-label="Página anterior"
            >
              <ChevronLeftIcon className="w-4 h-4" />
            </button>

            <span className="font-mono text-slate-300 px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-[11px]">
              Pág. <strong className="text-white">{currentPage}</strong> / {totalPages || 1}
            </span>

            <button
              type="button"
              onClick={() => onPageChange && onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed transition text-slate-300 active:scale-95 cursor-pointer"
              title="Página siguiente"
              aria-label="Página siguiente"
            >
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Título y acciones */}
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-slate-400 font-medium truncate max-w-[150px] sm:max-w-[200px]" title={docName}>
              {docName}
            </span>

            {/* Abrir en pestaña nueva */}
            <a
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 text-indigo-400 transition text-[11px] flex items-center gap-1 cursor-pointer"
              title="Abrir PDF en pestaña nueva"
              aria-label="Abrir PDF en pestaña nueva"
            >
              <ExternalLinkIcon className="w-3.5 h-3.5" />
            </a>

            {/* Botón cerrar */}
            <button
              type="button"
              onClick={onClose}
              className="h-7 w-7 rounded-lg bg-slate-800 hover:bg-rose-950/50 hover:text-rose-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 text-slate-400 transition flex items-center justify-center cursor-pointer text-sm font-semibold active:scale-95"
              aria-label="Cerrar visor de PDF"
              title="Cerrar (Esc)"
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Iframe del visor de PDF con clave dinámica para forzar salto de página */}
        <div className="flex-1 w-full bg-slate-950 relative">
          <iframe
            key={`pdf-${docId}-p${currentPage}`}
            src={pdfUrl}
            className="w-full h-full absolute inset-0 border-0"
            title={`Visor PDF - ${docName} Página ${currentPage}`}
          />
        </div>
      </div>
    </div>
  );
}
