import React from 'react';
import ReactMarkdown from 'react-markdown';
import SourcesRow from './SourcesRow';
import {
  DocumentIcon,
  EyeIcon,
  ImageIcon,
  SparklesIcon,
  IdCardIcon,
  PillIcon,
  ReceiptIcon,
  AlertTriangleIcon,
  RefreshIcon,
} from './Icons';

/**
 * Componente Message para renderizar las distintas variantes del chat:
 * - Tarjeta de archivo PDF (mensaje de usuario)
 * - Mensaje de progreso (asistente)
 * - Mensaje de éxito 'listo' con resumen y chips de acción inteligentes
 * - Indicador de 'escribiendo' (tres puntos animados)
 * - Mensaje de error con botón de reintento
 * - Mensajes normales de texto con Markdown y tablas
 * - Iconografía 100% SVG vectorial profesional
 */
export default function Message({
  message,
  onSuggestionClick,
  onRetryUpload,
  onRetryChat,
  onPageClick,
  onImageClick,
}) {
  const isUser = message.sender === 'user';

  // 1. Variante: Tarjeta de archivo PDF subido por el usuario
  if (message.tipo === 'archivo') {
    return (
      <div className="flex justify-end animate-fade-in">
        <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-3.5 max-w-sm sm:max-w-md shadow-lg flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <DocumentIcon className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs sm:text-sm font-semibold text-slate-100 truncate">
              {message.nombre}
            </p>
            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
              <span>
                {message.paginas
                  ? `${message.paginas} ${message.paginas === 1 ? 'página' : 'páginas'}`
                  : 'Procesando páginas...'}
              </span>
              {message.tamano && (
                <>
                  <span>•</span>
                  <span>{message.tamano}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. Variante: Progreso de procesamiento (asistente)
  if (message.tipo === 'progreso') {
    const { texto, total = 0, procesadas = 0 } = message;
    const porcentaje = total > 0 ? Math.round((procesadas / total) * 100) : null;

    return (
      <div className="flex items-start gap-3 animate-fade-in text-slate-200">
        <div className="h-7 w-7 rounded-lg bg-indigo-600 flex items-center justify-center text-xs shrink-0 font-bold text-white shadow-sm mt-0.5">
          <EyeIcon className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 max-w-xl">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2.5 text-xs sm:text-sm font-medium text-slate-300">
              <span className="inline-block h-3.5 w-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin shrink-0" />
              <span>{texto || 'Leyendo el documento…'}</span>
            </div>

            {total > 0 && (
              <div className="mt-3">
                <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                  <span>Extracción y análisis de contenido</span>
                  <span className="font-mono">{procesadas} / {total} ({porcentaje}%)</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-indigo-500 h-1.5 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${porcentaje}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 3. Variante: Documento Listo con resumen y chips contextuales inteligentes
  if (message.tipo === 'listo') {
    return (
      <div className="flex items-start gap-3 animate-fade-in text-slate-200">
        <div className="h-7 w-7 rounded-lg bg-indigo-600 flex items-center justify-center text-xs shrink-0 font-bold text-white shadow-sm mt-0.5">
          <EyeIcon className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 max-w-2xl space-y-3">
          <div className="text-xs sm:text-sm text-slate-200 leading-relaxed">
            <span>Documento procesado correctamente: </span>
            <strong className="text-white font-semibold">{message.nombre}</strong>.
          </div>

          {/* Resumen de páginas e imágenes */}
          <div className="flex flex-wrap gap-2 text-[11px]">
            <span className="bg-slate-900 border border-slate-800 text-slate-300 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
              <DocumentIcon className="w-3.5 h-3.5 text-indigo-400" />
              <span>{message.paginas || 1} {message.paginas === 1 ? 'página' : 'páginas'}</span>
            </span>
            <span className="bg-slate-900 border border-slate-800 text-slate-300 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
              <span>{message.imagenes || 0} {message.imagenes === 1 ? 'imagen analizada' : 'imágenes analizadas'}</span>
            </span>
          </div>

          {/* Chips de acción sugeridos */}
          <div className="pt-1">
            <p className="text-[11px] text-slate-400 font-medium mb-2">
              Sugerencias rápidas para comenzar:
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onSuggestionClick && onSuggestionClick('Resume el documento indicando qué contiene cada página', true)}
                className="text-xs bg-slate-900/90 hover:bg-indigo-950/60 border border-slate-800 hover:border-indigo-600/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 text-slate-300 hover:text-indigo-200 px-3 py-1.5 rounded-xl transition cursor-pointer text-left shadow-sm active:scale-95 flex items-center gap-1.5"
              >
                <SparklesIcon className="w-3.5 h-3.5 text-indigo-400" />
                <span>Resumen general</span>
              </button>
              <button
                type="button"
                onClick={() => onSuggestionClick && onSuggestionClick('¿Hay cédula o documento de identidad? Extrae los nombres, número y datos visibles.', true)}
                className="text-xs bg-slate-900/90 hover:bg-amber-950/40 border border-slate-800 hover:border-amber-700/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 text-slate-300 hover:text-amber-200 px-3 py-1.5 rounded-xl transition cursor-pointer text-left shadow-sm active:scale-95 flex items-center gap-1.5"
              >
                <IdCardIcon className="w-3.5 h-3.5 text-amber-400" />
                <span>Buscar cédula / ID</span>
              </button>
              <button
                type="button"
                onClick={() => onSuggestionClick && onSuggestionClick('¿Qué medicamentos, fórmulas u órdenes médicas se encuentran en el documento?', true)}
                className="text-xs bg-slate-900/90 hover:bg-indigo-950/60 border border-slate-800 hover:border-indigo-600/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 text-slate-300 hover:text-indigo-200 px-3 py-1.5 rounded-xl transition cursor-pointer text-left shadow-sm active:scale-95 flex items-center gap-1.5"
              >
                <PillIcon className="w-3.5 h-3.5 text-indigo-400" />
                <span>Medicamentos y recetas</span>
              </button>
              <button
                type="button"
                onClick={() => onSuggestionClick && onSuggestionClick('¿Hay facturas o recibos? Detalla montos, conceptos y páginas donde están.', true)}
                className="text-xs bg-slate-900/90 hover:bg-emerald-950/40 border border-slate-800 hover:border-emerald-700/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 text-slate-300 hover:text-emerald-200 px-3 py-1.5 rounded-xl transition cursor-pointer text-left shadow-sm active:scale-95 flex items-center gap-1.5"
              >
                <ReceiptIcon className="w-3.5 h-3.5 text-emerald-400" />
                <span>Facturas y recibos</span>
              </button>
              <button
                type="button"
                onClick={() => onSuggestionClick && onSuggestionClick('¿Qué imágenes contiene el documento y en qué páginas están?', true)}
                className="text-xs bg-slate-900/90 hover:bg-indigo-950/60 border border-slate-800 hover:border-indigo-600/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 text-slate-300 hover:text-indigo-200 px-3 py-1.5 rounded-xl transition cursor-pointer text-left shadow-sm active:scale-95 flex items-center gap-1.5"
              >
                <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
                <span>Catálogo de imágenes</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 4. Variante: Indicador de 'escribiendo' (tres puntos animados)
  if (message.tipo === 'escribiendo') {
    return (
      <div className="flex items-start gap-3 animate-fade-in text-slate-200">
        <div className="h-7 w-7 rounded-lg bg-indigo-600 flex items-center justify-center text-xs shrink-0 font-bold text-white shadow-sm mt-0.5">
          <EyeIcon className="w-4 h-4 text-white" />
        </div>
        <div className="flex items-center gap-1.5 py-2.5 px-3.5 bg-slate-900/70 border border-slate-800/80 rounded-2xl shadow-sm">
          <span
            className="h-2 w-2 rounded-full bg-indigo-400 animate-bounce"
            style={{ animationDelay: '0ms' }}
          />
          <span
            className="h-2 w-2 rounded-full bg-indigo-400 animate-bounce"
            style={{ animationDelay: '150ms' }}
          />
          <span
            className="h-2 w-2 rounded-full bg-indigo-400 animate-bounce"
            style={{ animationDelay: '300ms' }}
          />
        </div>
      </div>
    );
  }

  // 5. Variante: Error con botón de reintento
  if (message.tipo === 'error') {
    return (
      <div className="flex items-start gap-3 animate-fade-in text-slate-200">
        <div className="h-7 w-7 rounded-lg bg-rose-600 flex items-center justify-center text-xs shrink-0 font-bold text-white shadow-sm mt-0.5">
          <AlertTriangleIcon className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 max-w-xl">
          <div className="bg-rose-950/20 border border-rose-900/50 rounded-2xl p-4 text-xs sm:text-sm text-rose-200 space-y-2.5">
            <p className="font-medium text-rose-300">
              {message.texto || 'Ocurrió un error al procesar la solicitud.'}
            </p>
            {message.canRetryUpload && onRetryUpload && (
              <button
                type="button"
                onClick={onRetryUpload}
                className="text-xs bg-rose-900/40 hover:bg-rose-900/70 border border-rose-700/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 text-white px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5"
              >
                <RefreshIcon className="w-3.5 h-3.5" />
                <span>Reintentar subida</span>
              </button>
            )}
            {message.canRetryChat && onRetryChat && (
              <button
                type="button"
                onClick={() => onRetryChat(message.lastQuestion)}
                className="text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 text-slate-200 px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5"
              >
                <RefreshIcon className="w-3.5 h-3.5" />
                <span>Reintentar pregunta</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 6. Variante: Mensaje de usuario habitual (pregunta)
  if (isUser) {
    return (
      <div className="flex justify-end animate-fade-in">
        <div className="bg-indigo-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[85%] sm:max-w-[75%] shadow-md text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">
          {message.texto}
        </div>
      </div>
    );
  }

  // 7. Variante: Mensaje del asistente habitual (respuesta con Markdown y tablas)
  return (
    <div className="flex items-start gap-3 animate-fade-in text-slate-200">
      <div className="h-7 w-7 rounded-lg bg-indigo-600 flex items-center justify-center text-xs shrink-0 font-bold text-white shadow-sm mt-0.5">
        <EyeIcon className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 max-w-none min-w-0">
        <div className="text-xs sm:text-sm leading-relaxed text-slate-200 space-y-2">
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
              strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
              em: ({ children }) => <em className="italic text-slate-300">{children}</em>,
              ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>,
              blockquote: ({ children }) => (
                <blockquote className="border-l-2 border-indigo-500 pl-3 py-1 my-2 text-slate-400 italic bg-slate-900/30 rounded-r-lg">
                  {children}
                </blockquote>
              ),
              table: ({ children }) => (
                <div className="overflow-x-auto my-2 rounded-xl border border-slate-800">
                  <table className="min-w-full divide-y divide-slate-800 text-left text-xs">{children}</table>
                </div>
              ),
              thead: ({ children }) => <thead className="bg-slate-900/90 text-slate-200 font-semibold">{children}</thead>,
              tbody: ({ children }) => <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">{children}</tbody>,
              th: ({ children }) => <th className="px-3 py-2 text-slate-200 font-semibold">{children}</th>,
              td: ({ children }) => <td className="px-3 py-2 text-slate-300">{children}</td>,
              pre: ({ children }) => (
                <pre className="bg-slate-900 border border-slate-800 text-slate-200 p-3 rounded-xl overflow-x-auto text-[11px] font-mono my-2">
                  {children}
                </pre>
              ),
              code: ({ className, children, ...props }) => {
                const isBlock = Boolean(className);
                return isBlock ? (
                  <code className={className} {...props}>
                    {children}
                  </code>
                ) : (
                  <code className="bg-slate-900 border border-slate-800 text-indigo-300 px-1.5 py-0.5 rounded text-[11px] font-mono" {...props}>
                    {children}
                  </code>
                );
              },
              h1: ({ children }) => <h1 className="text-base font-bold text-white mb-2 mt-3">{children}</h1>,
              h2: ({ children }) => <h2 className="text-sm font-bold text-white mb-1.5 mt-2.5">{children}</h2>,
              h3: ({ children }) => <h3 className="text-xs font-semibold text-white mb-1 mt-2">{children}</h3>,
            }}
          >
            {message.texto || ''}
          </ReactMarkdown>
        </div>

        {/* Fila de fuentes y citas */}
        <SourcesRow
          fuentes={message.fuentes}
          onPageClick={onPageClick}
          onImageClick={onImageClick}
        />
      </div>
    </div>
  );
}
