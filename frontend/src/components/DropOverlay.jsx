import React from 'react';
import { InboxArrowDownIcon } from './Icons';

/**
 * Superposición (Overlay) que se muestra a pantalla completa al arrastrar
 * un archivo PDF sobre cualquier parte de la ventana.
 * Iconografía 100% SVG vectorial.
 */
export default function DropOverlay({ isVisible }) {
  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm border-4 border-dashed border-indigo-500/80 flex flex-col items-center justify-center pointer-events-none transition-all duration-200 animate-fade-in"
      aria-hidden="true"
    >
      <div className="bg-slate-900/90 border border-indigo-500/40 rounded-3xl p-8 sm:p-12 flex flex-col items-center justify-center text-center shadow-2xl max-w-md mx-4 transform scale-100">
        <div className="h-20 w-20 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mb-4 animate-bounce text-indigo-400">
          <InboxArrowDownIcon className="w-10 h-10 text-indigo-400" />
        </div>
        <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">
          Suelta el PDF para subirlo
        </h3>
        <p className="text-xs sm:text-sm text-slate-400">
          Extracción de texto, gráficos con IA y RAG inmediato (máx. 50 MB)
        </p>
      </div>
    </div>
  );
}
