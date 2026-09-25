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
  ContrastIcon,
  SlidersIcon,
  MaximizeIcon,
  MoveIcon,
} from './Icons';

/**
 * Presets de filtros visuales para restaurar y leer facturas borrosas, recibos térmicos y documentos tenues.
 */
const IMAGE_FILTERS = [
  {
    id: 'normal',
    name: 'Original',
    filter: 'none',
    description: 'Resolución nativa a 220 DPI sin filtros',
  },
  {
    id: 'contrast',
    name: 'Alto Contraste',
    filter: 'contrast(145%) brightness(105%) saturate(110%)',
    description: 'Resalta texto tenue, firmas y elimina neblina de fondo',
  },
  {
    id: 'thermal',
    name: 'Escáner Térmico',
    filter: 'grayscale(100%) contrast(180%) brightness(110%)',
    description: 'Optimizado para recibos térmicos borrosos y tickets descoloridos',
  },
  {
    id: 'sharp',
    name: 'Documento B/N',
    filter: 'grayscale(100%) contrast(250%) brightness(95%)',
    description: 'Binarización nítida para sellos, códigos y números pequeños',
  },
  {
    id: 'invert',
    name: 'Invertido / Noche',
    filter: 'invert(100%) hue-rotate(180deg) contrast(125%)',
    description: 'Fondo oscuro con texto brillante para reducir reflejos',
  },
];

/**
 * Componente DocumentViewer:
 * Panel interactivo para visualizar el documento PDF y sus páginas en alta definición.
 * - Iconografía 100% SVG vectorial.
 * - Soporta Modo Foto HD (220 DPI) y Modo PDF nativo.
 * - Filtros visuales en tiempo real (Alto Contraste, Papel Térmico, B/N, Invertido).
 * - Zoom expandido de 50% a 400% con pan/drag fluido.
 * - Tira horizontal de miniaturas con etiquetas de categoría inteligentes.
 * - Botones de acción rápida: Inspección 1:1, enlace a imagen HD y "Preguntar sobre esta imagen".
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
  const [activeFilter, setActiveFilter] = useState('normal');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [showAiInsights, setShowAiInsights] = useState(true);

  const thumbnailContainerRef = useRef(null);
  const filterMenuRef = useRef(null);
  const dragStartRef = useRef({ x: 0, y: 0 });

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

  // Configuración del filtro activo
  const activeFilterConfig = useMemo(() => {
    return IMAGE_FILTERS.find((f) => f.id === activeFilter) || IMAGE_FILTERS[0];
  }, [activeFilter]);

  // Cerrar menú de filtros al hacer clic afuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target)) {
        setShowFilterMenu(false);
      }
    };
    if (showFilterMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showFilterMenu]);

  // Reset de zoom y posición de paneo al cambiar de página
  useEffect(() => {
    setZoomLevel(1);
    setRotation(0);
    setPanPosition({ x: 0, y: 0 });
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
    setZoomLevel((prev) => Math.min(4.0, +(prev + 0.25).toFixed(2)));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => {
      const next = Math.max(0.5, +(prev - 0.25).toFixed(2));
      if (next <= 1) {
        setPanPosition({ x: 0, y: 0 });
      }
      return next;
    });
  };

  const handleResetView = () => {
    setZoomLevel(1);
    setRotation(0);
    setPanPosition({ x: 0, y: 0 });
  };

  const handleToggle100 = () => {
    if (zoomLevel === 1) {
      setZoomLevel(2.0);
    } else {
      handleResetView();
    }
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

  // Manejo de paneo (arrastrar con el ratón cuando zoom > 1)
  const handleMouseDown = (e) => {
    if (zoomLevel <= 1) return;
    if (e.target.closest('button') || e.target.closest('a')) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - panPosition.x,
      y: e.clientY - panPosition.y,
    };
  };

  const handleMouseMove = (e) => {
    if (!isDragging || zoomLevel <= 1) return;
    e.preventDefault();
    setPanPosition({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e) => {
    if (zoomLevel <= 1 || e.touches.length !== 1) return;
    if (e.target.closest('button') || e.target.closest('a')) return;
    setIsDragging(true);
    const touch = e.touches[0];
    dragStartRef.current = {
      x: touch.clientX - panPosition.x,
      y: touch.clientY - panPosition.y,
    };
  };

  const handleTouchMove = (e) => {
    if (!isDragging || zoomLevel <= 1) return;
    const touch = e.touches[0];
    setPanPosition({
      x: touch.clientX - dragStartRef.current.x,
      y: touch.clientY - dragStartRef.current.y,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleWheel = (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      if (e.deltaY < 0) {
        setZoomLevel((prev) => Math.min(4.0, +(prev + 0.25).toFixed(2)));
      } else {
        setZoomLevel((prev) => {
          const next = Math.max(0.5, +(prev - 0.25).toFixed(2));
          if (next <= 1) setPanPosition({ x: 0, y: 0 });
          return next;
        });
      }
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
            title="Ver imagen extraída en alta definición (220 DPI)"
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
          {/* Selector de Filtros de Visibilidad en modo Foto HD */}
          {viewMode === 'image' && currentImage && (
            <div className="relative" ref={filterMenuRef}>
              <button
                type="button"
                onClick={() => setShowFilterMenu((prev) => !prev)}
                className={`h-8 px-2.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer border ${
                  activeFilter !== 'normal'
                    ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300 shadow-sm'
                    : 'bg-slate-800 border-slate-700/80 text-slate-300 hover:text-white hover:border-slate-600'
                }`}
                title="Filtros de mejora para facturas tenues, sellos y recibos térmicos"
              >
                <ContrastIcon className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden lg:inline">{activeFilterConfig.name}</span>
                <ChevronDownIcon className="w-3 h-3 text-slate-400" />
              </button>

              {showFilterMenu && (
                <div className="absolute top-full mt-1.5 right-0 z-50 w-60 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1.5 backdrop-blur-md">
                  <div className="px-2.5 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800/80 mb-1 flex items-center justify-between">
                    <span>Filtros de Visibilidad</span>
                    <span className="text-indigo-400 font-mono text-[9px]">Tiempo Real</span>
                  </div>
                  {IMAGE_FILTERS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        setActiveFilter(f.id);
                        setShowFilterMenu(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer flex flex-col gap-0.5 ${
                        activeFilter === f.id
                          ? 'bg-indigo-600 text-white font-medium shadow-sm'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{f.name}</span>
                        {activeFilter === f.id && (
                          <span className="text-[10px] bg-white/20 px-1.5 py-0.2 rounded font-mono">Activo</span>
                        )}
                      </div>
                      <span
                        className={`text-[10px] ${
                          activeFilter === f.id ? 'text-indigo-200' : 'text-slate-400'
                        }`}
                      >
                        {f.description}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Controles de Zoom en modo Foto HD */}
          {viewMode === 'image' && currentImage && (
            <div className="hidden sm:flex items-center gap-1 bg-slate-950 border border-slate-800 px-1 py-0.5 rounded-lg text-xs">
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={zoomLevel <= 0.5}
                className="h-6 w-6 rounded hover:bg-slate-800 disabled:opacity-30 text-slate-300 font-bold transition flex items-center justify-center cursor-pointer"
                title="Alejar (zoom -)"
              >
                <ZoomOutIcon className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleToggle100}
                className="px-1 text-[11px] font-mono text-slate-300 hover:text-indigo-400 cursor-pointer min-w-10 text-center"
                title={zoomLevel === 1 ? 'Aumentar a 200%' : 'Restablecer a 100%'}
              >
                {Math.round(zoomLevel * 100)}%
              </button>
              <button
                type="button"
                onClick={handleZoomIn}
                disabled={zoomLevel >= 4.0}
                className="h-6 w-6 rounded hover:bg-slate-800 disabled:opacity-30 text-slate-300 font-bold transition flex items-center justify-center cursor-pointer"
                title="Acercar (zoom + hasta 400%)"
              >
                <ZoomInIcon className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleResetView}
                className="h-6 w-6 rounded hover:bg-slate-800 text-slate-300 transition flex items-center justify-center cursor-pointer"
                title="Restablecer vista a 100% y centrar"
              >
                <MaximizeIcon className="w-3.5 h-3.5" />
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
      <div
        className="flex-1 relative overflow-hidden bg-slate-950/95 flex items-center justify-center select-none"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {viewMode === 'image' && currentImage ? (
          <div
            className={`relative w-full h-full flex flex-col items-center justify-center ${
              zoomLevel > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
            }`}
          >
            {/* Contenedor con zoom, paneo interactivo y rotación suave */}
            <div
              className={`flex items-center justify-center max-w-full max-h-full ${
                isDragging ? 'transition-none' : 'transition-transform duration-200 ease-out'
              }`}
              style={{
                transform: `translate(${panPosition.x}px, ${panPosition.y}px) scale(${zoomLevel}) rotate(${rotation}deg)`,
                transformOrigin: 'center center',
              }}
            >
              <img
                src={currentImage.url}
                alt={currentImage.descripcion || `Página ${currentPage}`}
                draggable={false}
                style={{
                  filter: activeFilterConfig.filter,
                  transition: 'filter 150ms ease-out',
                }}
                className="max-h-[62vh] sm:max-h-[68vh] max-w-full object-contain rounded-xl shadow-2xl border border-slate-800/80 bg-slate-900 pointer-events-none"
              />
            </div>

            {/* Ayuda visual cuando hay zoom activo */}
            {zoomLevel > 1 && (
              <div className="absolute bottom-3 left-3 z-10 pointer-events-none bg-slate-900/85 backdrop-blur-md border border-slate-700/60 text-slate-300 text-[11px] px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-lg">
                <MoveIcon className="w-3.5 h-3.5 text-indigo-400" />
                <span>Arrastra para moverte · {Math.round(zoomLevel * 100)}%</span>
              </div>
            )}

            {/* Acciones flotantes superiores: Ver original HD y Preguntar a IA */}
            <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
              <a
                href={currentImage.url}
                target="_blank"
                rel="noreferrer"
                className="bg-slate-900/90 hover:bg-slate-800 text-slate-200 text-xs font-medium px-2.5 py-1.5 rounded-xl shadow-lg backdrop-blur-md transition flex items-center gap-1.5 cursor-pointer border border-slate-700/70"
                title="Abrir imagen original HD en pestaña nueva a resolución completa"
              >
                <ExternalLinkIcon className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden sm:inline">Original HD</span>
              </a>

              {onAskAboutImage && (
                <button
                  type="button"
                  onClick={() => onAskAboutImage(currentImage)}
                  className="bg-indigo-600/90 hover:bg-indigo-600 text-white text-xs font-medium px-3 py-1.5 rounded-xl shadow-lg shadow-indigo-600/30 backdrop-blur transition flex items-center gap-1.5 cursor-pointer border border-indigo-500/40 active:scale-95"
                  title="Seleccionar esta imagen para hacerle una pregunta en el chat"
                >
                  <ChatBubbleIcon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Preguntar sobre esta imagen</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Modo PDF nativo (o fallback si no hay imagen de la página) */
          <div className="w-full h-full p-2 sm:p-4">
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
