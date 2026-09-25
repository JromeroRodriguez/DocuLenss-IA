import React, { useEffect } from 'react';
import { CloseIcon, ChatBubbleIcon } from './Icons';

/**
 * Visor de imagen ampliada (Lightbox) con:
 * - Imagen en alta resolución
 * - Número de página de origen
 * - Descripción generada por el modelo de visión IA
 * - Botón interactivo "Preguntar sobre esta imagen"
 * - Cierre con tecla Esc o botón SVG
 * - Iconografía 100% vectorial
 */
export default function ImageLightbox({
  isOpen,
  onClose,
  image,
  onAskAboutImage,
}) {
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

  if (!isOpen || !image) return null;

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-6 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Detalle de imagen"
    >
      {/* Fondo oscuro */}
      <div
        className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Contenedor del Modal */}
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-slate-900 border border-slate-700/80 rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden z-10">
        {/* Barra superior */}
        <div className="px-4 py-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">Detalle de Imagen</span>
            <span className="font-mono text-indigo-400 bg-indigo-950/70 border border-indigo-800/80 px-2 py-0.5 rounded text-[11px]">
              Página {image.pagina || 1}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="h-7 w-7 rounded-lg bg-slate-800 hover:bg-rose-950/50 hover:text-rose-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 text-slate-400 transition flex items-center justify-center cursor-pointer text-sm font-semibold active:scale-95"
            aria-label="Cerrar visor de imagen"
            title="Cerrar (Esc)"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Cuerpo central: Imagen y descripción */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col md:flex-row gap-6 items-center md:items-start justify-center">
          {/* Imagen ampliada */}
          <div className="w-full md:w-1/2 flex items-center justify-center bg-slate-950/60 rounded-xl p-2 border border-slate-800/80">
            <img
              src={image.url}
              alt={image.descripcion || `Imagen página ${image.pagina}`}
              className="max-h-[50vh] md:max-h-[60vh] max-w-full rounded-lg object-contain"
            />
          </div>

          {/* Información y botón de acción */}
          <div className="w-full md:w-1/2 flex flex-col justify-between space-y-4">
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Descripción generada por la IA
              </h4>
              <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-3.5 text-xs sm:text-sm text-slate-200 leading-relaxed max-h-56 overflow-y-auto">
                {image.descripcion ? (
                  <p>{image.descripcion}</p>
                ) : (
                  <p className="text-slate-500 italic">Sin descripción detallada disponible.</p>
                )}
              </div>
            </div>

            {/* Botón de acción: Preguntar sobre esta imagen */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  onAskAboutImage(image);
                  onClose();
                }}
                className="w-full bg-indigo-600 hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 active:scale-98 text-white text-xs sm:text-sm font-semibold py-2.5 px-4 rounded-xl transition duration-150 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/25"
                title="Seleccionar esta imagen para hacer preguntas en el chat"
              >
                <ChatBubbleIcon className="w-4 h-4" />
                <span>Preguntar sobre esta imagen</span>
              </button>
              <p className="text-[11px] text-slate-400 text-center mt-2">
                La fijará como contexto en la caja de mensaje del chat.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
