import React from 'react';
import { SearchIcon, DocumentIcon, ExternalLinkIcon } from './Icons';

/**
 * Fila de fuentes y citas que aparece al pie de las respuestas del asistente:
 * - Chips interactivos de página con salto directo al visor.
 * - Miniaturas de imágenes citadas en alta resolución.
 * - Iconografía 100% SVG vectorial.
 */
export default function SourcesRow({ fuentes, onPageClick, onImageClick }) {
  if (!fuentes || fuentes.length === 0) return null;

  // Agrupar páginas únicas de texto
  const paginasTexto = Array.from(
    new Set(fuentes.filter((f) => f.tipo === 'texto').map((f) => f.pagina))
  ).sort((a, b) => a - b);

  // Imágenes citadas
  const imagenesFuentes = fuentes.filter((f) => f.tipo === 'imagen' && f.imagen_url);

  return (
    <div className="mt-3.5 pt-2.5 border-t border-slate-800/80 flex flex-col gap-2">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
        <SearchIcon className="w-3.5 h-3.5 text-indigo-400" />
        <span>Citas y fuentes del documento (clic para ver):</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Chips de páginas de texto con salto directo al visor */}
        {paginasTexto.map((pagina) => (
          <button
            key={`page-${pagina}`}
            type="button"
            onClick={() => onPageClick && onPageClick(pagina)}
            className="text-[11px] font-mono bg-slate-900 hover:bg-indigo-950/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 border border-slate-700/80 hover:border-indigo-500/80 text-indigo-300 hover:text-indigo-100 px-2.5 py-1 rounded-lg cursor-pointer transition flex items-center gap-1.5 shadow-sm active:scale-95 group"
            title={`Abrir página ${pagina} en el visor`}
            aria-label={`Ver página ${pagina} del documento`}
          >
            <DocumentIcon className="w-3.5 h-3.5 text-indigo-400 group-hover:scale-110 transition duration-150" />
            <span className="font-semibold">Pág. {pagina}</span>
            <ExternalLinkIcon className="w-3 h-3 text-slate-500 group-hover:text-indigo-300" />
          </button>
        ))}

        {/* Miniaturas de imágenes citadas con salto directo al visor */}
        {imagenesFuentes.map((img, idx) => (
          <button
            key={`img-${img.imagen_id || idx}`}
            type="button"
            onClick={() => {
              if (onImageClick) {
                onImageClick(img.imagen_id, img.imagen_url, img.pagina);
              } else if (onPageClick) {
                onPageClick(img.pagina);
              }
            }}
            className="group relative h-12 w-12 rounded-lg overflow-hidden border border-slate-700 hover:border-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition cursor-pointer shrink-0 shadow-sm active:scale-95 bg-slate-900"
            title={`Imagen citada de la pág. ${img.pagina} (clic para ampliar)`}
            aria-label={`Ver imagen de la página ${img.pagina}`}
          >
            <img
              src={img.imagen_url}
              alt={`Fuente visual pág. ${img.pagina}`}
              className="h-full w-full object-cover group-hover:scale-110 transition duration-200"
              loading="lazy"
            />
            <span className="absolute bottom-0 right-0 bg-slate-950/90 text-indigo-300 text-[9px] font-mono px-1 rounded-tl leading-tight border-t border-l border-slate-800">
              p.{img.pagina}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
