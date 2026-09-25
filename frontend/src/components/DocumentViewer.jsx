import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getPdfUrl } from '../api';
import { getDocumentCategory } from '../utils/documentCategories';
import {
  CategoryIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ImageIcon,
  DocumentIcon,
  ZoomInIcon,
  ZoomOutIcon,
  RotateIcon,
  ExternalLinkIcon,
  CloseIcon,
  ChatBubbleIcon,
  SparklesIcon,
} from './Icons';

/**
 * Componente DocumentViewer:
 * Panel interactivo para visualizar el documento PDF y sus páginas en alta definición.
 * - Iconografía 100% SVG vectorial.
 * - Soporta Modo Foto HD y Modo PDF nativo.
 * - Controles de zoom (50% a 250%), rotación (0°-270°) y restablecimiento.
 * - Tira horizontal de miniaturas con etiquetas de categoría inteligentes.
 * - Botón "Preguntar sobre esta imagen" para transferir el contexto al chat.
 */
export default function DocumentViewer({
  docId,
  docName,
  totalPages = 1,
  currentPage = 1,
  onPageChange,
  images = [],
  onAskAboutImage,
  onClose,
}) {
  const [viewMode, setViewMode] = useState('image'); // 'image' | 'pdf'
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [showAiInsights, setShowAiInsights] = useState(true);

  const thumbnailContainerRef = useRef(null);

  // Mapear imágenes por página para acceso O(1)
  const imagesByPage = useMemo(() => {
    const map = {};
    images.forEach((img) => {
      if (img.pagina && !map[img.pagina]) {
        map[img.pagina] = img;
      }
    });
    return map;
  }, [images]);

  // Imagen activa según la página actual
  const currentImage = imagesByPage[currentPage] || null;

  // Categoría inteligente inferida de la descripción de la IA
  const currentCategory = useMemo(() => {
    return getDocumentCategory(currentImage?.descripcion, currentPage);
  }, [currentImage, currentPage]);

  // Reset de zoom al cambiar de página
  useEffect(() => {
    setZoomLevel(1);
    setRotation(0);
  }, [currentPage]);

  // Asegurar que la miniatura activa esté visible en el scroll
  useEffect(() => {
    if (thumbnailContainerRef.current) {
      const activeThumb = thumbnailContainerRef.current.querySelector(
        `[data-thumb-page="${currentPage}"]`
      );
      if (activeThumb) {
        activeThumb.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center',
        });
      }
    }
  }, [currentPage]);

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(2.5, +(prev + 0.25).toFixed(2)));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(0.5, +(prev - 0.25).toFixed(2)));
  };

  const handleResetView = () => {
    setZoomLevel(1);
    setRotation(0);
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  const pdfUrl = docId ? `${getPdfUrl(docId)}#page=${currentPage}` : '';

  return (
    <div className="h-full flex flex-col bg-slate-950 border-r border-slate-800/80 overflow-hidden select-none">
      {/* 1. Barra de herramientas superior */}
      <div className="px-3 sm:px-4 py-2 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0 backdrop-blur z-10">
        {/* Navegación de páginas */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handlePrevPage}
            disabled={currentPage <= 1}
            className="h-8 w-8 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-200 flex items-center justify-center transition cursor-pointer text-xs font-bold"
            title="Página anterior"
            aria-label="Página anterior"
          >
            <ChevronLeftIcon className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1 px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono">
            <span className="text-slate-400">Pág.</span>
            <strong className="text-indigo-400 font-bold">{currentPage}</strong>
            <span className="text-slate-500">/</span>
            <span className="text-slate-300">{totalPages || 1}</span>
          </div>

          <button
            type="button"
            onClick={handleNextPage}
            disabled={currentPage >= totalPages}
            className="h-8 w-8 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-200 flex items-center justify-center transition cursor-pointer text-xs font-bold"
            title="Página siguiente"
            aria-label="Página siguiente"
          >
            <ChevronRightIcon className="w-4 h-4" />
          </button>

          {/* Badge de tipo de documento para la página actual */}
          <span
            className={`hidden sm:inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-md border ${currentCategory.badgeClass}`}
            title={currentCategory.label}
          >
            <CategoryIcon type={currentCategory.type} className="w-3.5 h-3.5" />
            <span>{currentCategory.category}</span>
          </span>
        </div>

        {/* Selector de Modo: Foto HD vs PDF */}
        <div className="flex items-center bg-slate-950 border border-slate-800 p-0.5 rounded-lg text-xs">
          <button
            type="button"
            onClick={() => setViewMode('image')}
            className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'image'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Ver imagen extraída en alta definición"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Foto HD</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('pdf')}
            className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'pdf'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Ver documento PDF original embebido"
          >
            <DocumentIcon className="w-3.5 h-3.5" />
            <span className="hidden md:inline">PDF</span>
          </button>
        </div>

        {/* Acciones de visor */}
        <div className="flex items-center gap-1.5">
          {/* Controles de Zoom en modo Foto HD */}
          {viewMode === 'image' && currentImage && (
            <div className="hidden sm:flex items-center gap-1 bg-slate-950 border border-slate-800 px-1 py-0.5 rounded-lg text-xs">
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={zoomLevel <= 0.5}
                className="h-6 w-6 rounded hover:bg-slate-800 disabled:opacity-30 text-slate-300 font-bold transition flex items-center justify-center cursor-pointer"
                title="Alejar"
              >
                <ZoomOutIcon className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleResetView}
                className="px-1 text-[11px] font-mono text-slate-300 hover:text-indigo-400 cursor-pointer"
                title="Restablecer vista a 100%"
              >
                {Math.round(zoomLevel * 100)}%
              </button>
              <button
                type="button"
                onClick={handleZoomIn}
                disabled={zoomLevel >= 2.5}
                className="h-6 w-6 rounded hover:bg-slate-800 disabled:opacity-30 text-slate-300 font-bold transition flex items-center justify-center cursor-pointer"
                title="Acercar"
              >
                <ZoomInIcon className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleRotate}
                className="h-6 w-6 rounded hover:bg-slate-800 text-slate-300 transition flex items-center justify-center cursor-pointer"
                title="Rotar 90 grados"
              >
                <RotateIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Enlace para abrir PDF en pestaña nueva */}
          <a
            href={pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="h-8 w-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-400 flex items-center justify-center transition text-xs font-semibold cursor-pointer"
            title="Abrir PDF en pestaña nueva"
            aria-label="Abrir PDF en pestaña nueva"
          >
            <ExternalLinkIcon className="w-3.5 h-3.5" />
          </a>

          {/* Botón para cerrar/ocultar panel */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 rounded-lg bg-slate-800 hover:bg-rose-950/60 hover:text-rose-400 text-slate-400 flex items-center justify-center transition cursor-pointer text-xs"
              title="Cerrar visor"
              aria-label="Cerrar visor"
            >
              <CloseIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Área principal de visualización */}
      <div className="flex-1 relative overflow-auto bg-slate-950/90 flex items-center justify-center p-2 sm:p-4">
        {viewMode === 'image' && currentImage ? (
          <div className="relative w-full h-full flex flex-col items-center justify-center overflow-auto">
            {/* Contenedor con zoom y rotación suave */}
            <div
              className="transition-transform duration-200 ease-out flex items-center justify-center max-w-full max-h-full"
              style={{
                transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                transformOrigin: 'center center',
              }}
            >
              <img
                src={currentImage.url}
                alt={currentImage.descripcion || `Página ${currentPage}`}
                className="max-h-[62vh] sm:max-h-[68vh] max-w-full object-contain rounded-xl shadow-2xl border border-slate-800/80 bg-slate-900"
              />
            </div>

            {/* Botón flotante para preguntar sobre esta imagen */}
            {onAskAboutImage && (
              <div className="absolute top-3 right-3 z-10">
                <button
                  type="button"
                  onClick={() => onAskAboutImage(currentImage)}
                  className="bg-indigo-600/90 hover:bg-indigo-600 text-white text-xs font-medium px-3 py-1.5 rounded-xl shadow-lg shadow-indigo-600/30 backdrop-blur transition flex items-center gap-1.5 cursor-pointer border border-indigo-500/40 active:scale-95"
                  title="Seleccionar esta imagen para hacerle una pregunta en el chat"
                >
                  <ChatBubbleIcon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Preguntar sobre esta imagen</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Modo PDF nativo (o fallback si no hay imagen de la página) */
          <div className="w-full h-full rounded-xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-900">
            {docId ? (
              <iframe
                src={pdfUrl}
                title={`Visualizador de ${docName}`}
                className="w-full h-full border-0"
              />
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                No hay documento seleccionado
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Panel de Análisis de Visión IA (Insights) */}
      {currentImage?.descripcion && (
        <div className="px-3 py-2 bg-slate-900/95 border-t border-slate-800/80 text-xs shrink-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <button
              type="button"
              onClick={() => setShowAiInsights((prev) => !prev)}
              className="flex items-center gap-1.5 text-indigo-300 hover:text-indigo-200 font-semibold cursor-pointer"
            >
              <SparklesIcon className="w-3.5 h-3.5 text-indigo-400" />
              <span>Análisis de Visión IA · Pág. {currentPage}</span>
              {showAiInsights ? (
                <ChevronDownIcon className="w-3 h-3 text-slate-400" />
              ) : (
                <ChevronUpIcon className="w-3 h-3 text-slate-400" />
              )}
            </button>

            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded border inline-flex items-center gap-1 ${currentCategory.badgeClass}`}
            >
              <CategoryIcon type={currentCategory.type} className="w-3 h-3" />
              <span>{currentCategory.category}</span>
            </span>
          </div>

          {showAiInsights && (
            <p className="text-[11px] text-slate-300 leading-relaxed max-h-16 overflow-y-auto pr-1">
              {currentImage.descripcion}
            </p>
          )}
        </div>
      )}

      {/* 4. Tira Horizontal de Miniaturas (Thumbnail Strip) */}
      <div className="bg-slate-950/95 border-t border-slate-800/80 p-2 shrink-0">
        <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 mb-1.5">
          <span className="font-medium">Explorador de páginas ({totalPages || 1})</span>
          <span className="text-[10px] text-slate-500">Haz clic en una miniatura para saltar</span>
        </div>

        <div
          ref={thumbnailContainerRef}
          className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5"
        >
          {Array.from({ length: totalPages || 1 }, (_, i) => i + 1).map((pageNum) => {
            const pageImage = imagesByPage[pageNum];
            const isCurrent = pageNum === currentPage;
            const category = getDocumentCategory(pageImage?.descripcion, pageNum);

            return (
              <button
                key={`thumb-${pageNum}`}
                data-thumb-page={pageNum}
                type="button"
                onClick={() => onPageChange(pageNum)}
                className={`relative shrink-0 rounded-lg overflow-hidden transition-all duration-150 cursor-pointer flex flex-col items-center group ${
                  isCurrent
                    ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-slate-950 scale-105 shadow-md shadow-indigo-500/20'
                    : 'opacity-70 hover:opacity-100 border border-slate-800 hover:border-slate-700'
                }`}
                title={`Página ${pageNum}: ${category.label}`}
                aria-label={`Ir a la página ${pageNum}`}
              >
                {/* Miniatura visual */}
                <div className="w-14 h-16 bg-slate-900 flex items-center justify-center overflow-hidden">
                  {pageImage?.url ? (
                    <img
                      src={pageImage.url}
                      alt={`Página ${pageNum}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-150"
                      loading="lazy"
                    />
                  ) : (
                    <DocumentIcon className="w-6 h-6 text-slate-600" />
                  )}
                </div>

                {/* Badge inferior con número de página y categoría */}
                <div
                  className={`w-full py-0.5 text-center text-[10px] font-mono border-t border-slate-800 flex items-center justify-center gap-1 ${
                    isCurrent
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'bg-slate-950 text-slate-400'
                  }`}
                >
                  <CategoryIcon type={category.type} className="w-2.5 h-2.5" />
                  <span>p.{pageNum}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
