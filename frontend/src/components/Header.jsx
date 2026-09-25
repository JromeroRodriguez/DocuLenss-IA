import React from 'react';
import {
  DocuLensIcon,
  ChatBubbleIcon,
  DocumentIcon,
  SplitViewIcon,
  SingleViewIcon,
  SparklesIcon,
} from './Icons';

/**
 * Header enriquecido con íconos SVG profesionales:
 * - Logo vectorial y estado de salud DB & API.
 * - Pestañas de cambio rápido en dispositivos móviles (Chat vs Visor de Documento).
 * - Botón de alternancia de Vista Dividida (Split View) en escritorio.
 * - Botón "Nuevo chat".
 */
export default function Header({
  health,
  onNewChat,
  hasActiveDoc,
  isSplitView = true,
  onToggleSplitView,
  activeMobileTab = 'chat',
  onSelectMobileTab,
  currentPage = 1,
}) {
  const isOnline = health?.estado === 'ok' && health?.base_de_datos === 'ok';

  return (
    <header className="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur px-3 sm:px-6 py-2.5 flex items-center justify-between shrink-0 sticky top-0 z-20">
      {/* 1. Logo y Nombre */}
      <div className="flex items-center space-x-2.5">
        <div className="h-7 w-7 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-sm shadow-indigo-600/30">
          <DocuLensIcon className="w-4 h-4 text-white" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold tracking-tight text-white">DocuLens AI</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-slate-900 text-indigo-300 border border-slate-800 hidden md:inline-block">
            Vision Workspace
          </span>
        </div>
      </div>

      {/* 2. Pestañas de navegación para móviles (< lg) cuando hay documento activo */}
      {hasActiveDoc && (
        <div className="flex lg:hidden items-center bg-slate-900 border border-slate-800 p-0.5 rounded-lg text-xs">
          <button
            type="button"
            onClick={() => onSelectMobileTab && onSelectMobileTab('chat')}
            className={`px-3 py-1 rounded-md font-medium transition cursor-pointer flex items-center gap-1.5 ${
              activeMobileTab === 'chat'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ChatBubbleIcon className="w-3.5 h-3.5" />
            <span>Chat</span>
          </button>
          <button
            type="button"
            onClick={() => onSelectMobileTab && onSelectMobileTab('viewer')}
            className={`px-3 py-1 rounded-md font-medium transition cursor-pointer flex items-center gap-1.5 ${
              activeMobileTab === 'viewer'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <DocumentIcon className="w-3.5 h-3.5" />
            <span>Visor (p.{currentPage})</span>
          </button>
        </div>
      )}

      {/* 3. Controles de la derecha */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Toggle de Vista Dividida (Desktop >= lg) */}
        {hasActiveDoc && (
          <button
            type="button"
            onClick={onToggleSplitView}
            className={`hidden lg:flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition cursor-pointer shadow-sm active:scale-95 ${
              isSplitView
                ? 'bg-indigo-950/70 border-indigo-700/80 text-indigo-300 hover:bg-indigo-900/60'
                : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
            }`}
            title={isSplitView ? 'Colapsar visor y expandir chat' : 'Abrir visor de documento lateral'}
          >
            {isSplitView ? (
              <SplitViewIcon className="w-3.5 h-3.5" />
            ) : (
              <SingleViewIcon className="w-3.5 h-3.5" />
            )}
            <span>{isSplitView ? 'Vista Dividida' : 'Ver Documento'}</span>
          </button>
        )}

        {/* Indicador de Estado DB & API */}
        <div className="hidden sm:flex items-center gap-1.5 text-[11px] bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-full text-slate-400">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
            }`}
          />
          <span className="font-mono text-[10px]">
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>

        {/* Botón Nuevo Chat */}
        <button
          type="button"
          onClick={onNewChat}
          className="text-xs bg-slate-900 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700/80 transition flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
          aria-label="Iniciar nueva conversación"
          title="Limpiar conversación actual"
        >
          <SparklesIcon className="w-3.5 h-3.5 text-indigo-400" />
          <span className="hidden sm:inline">Nuevo chat</span>
        </button>
      </div>
    </header>
  );
}
