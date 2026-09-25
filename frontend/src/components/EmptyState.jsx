import React, { useRef } from 'react';
import {
  EyeIcon,
  ReceiptIcon,
  IdCardIcon,
  ClipboardIcon,
  DocumentIcon,
} from './Icons';

/**
 * Pantalla inicial de bienvenida con zona de carga arrastrable
 * e indicadores de los tipos de documentos admitidos por la IA multimodal.
 * Iconografía 100% SVG vectorial profesional.
 */
export default function EmptyState({ onSelectFile }) {
  const fileInputRef = useRef(null);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file && onSelectFile) {
      onSelectFile(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 text-center max-w-2xl mx-auto my-auto animate-fade-in">
      {/* Ícono distintivo */}
      <div className="h-16 w-16 rounded-2xl bg-indigo-600/15 border border-indigo-500/30 flex items-center justify-center mb-4 shadow-xl shadow-indigo-600/10">
        <EyeIcon className="w-8 h-8 text-indigo-400" />
      </div>

      {/* Título y descripción */}
      <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-2">
        Conversa con tus PDFs e imágenes
      </h2>
      <p className="text-xs sm:text-sm text-slate-400 max-w-lg mb-6 leading-relaxed">
        Sube cualquier documento para extraer su texto con OCR local, inspeccionar gráficos con IA de visión multimodal y resolver consultas con citas visuales de páginas.
      </p>

      {/* Badges de capacidades admitidas */}
      <div className="flex flex-wrap justify-center gap-2 mb-8 max-w-lg">
        <span className="text-[11px] bg-slate-900 border border-slate-800 text-slate-300 px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
          <ReceiptIcon className="w-3.5 h-3.5 text-emerald-400" />
          <span>Facturas y recibos tomados con cámara</span>
        </span>
        <span className="text-[11px] bg-slate-900 border border-slate-800 text-slate-300 px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
          <IdCardIcon className="w-3.5 h-3.5 text-amber-400" />
          <span>Cédulas e identificaciones</span>
        </span>
        <span className="text-[11px] bg-slate-900 border border-slate-800 text-slate-300 px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
          <ClipboardIcon className="w-3.5 h-3.5 text-indigo-400" />
          <span>Órdenes médicas y recetas</span>
        </span>
      </div>

      {/* Zona de subida interactiva */}
      <input
        type="file"
        accept="application/pdf,.pdf"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        id="empty-state-upload"
      />

      <div
        onClick={handleClick}
        className="w-full max-w-md border-2 border-dashed border-slate-700/80 hover:border-indigo-500/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 bg-slate-900/40 hover:bg-slate-900/80 rounded-2xl p-8 cursor-pointer transition duration-200 flex flex-col items-center justify-center group shadow-xl"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleClick()}
        aria-label="Zona de subida de PDF"
      >
        <div className="h-12 w-12 rounded-full bg-indigo-950/70 border border-indigo-800/60 flex items-center justify-center mb-3.5 group-hover:scale-110 transition duration-200">
          <DocumentIcon className="w-6 h-6 text-indigo-400" />
        </div>
        <p className="text-xs sm:text-sm font-medium text-slate-200">
          Arrastra un PDF aquí o haz clic para subirlo
        </p>
        <p className="text-[11px] text-slate-500 mt-1">
          (Formatos PDF escaneados o digitales de hasta 50 MB)
        </p>
      </div>
    </div>
  );
}
