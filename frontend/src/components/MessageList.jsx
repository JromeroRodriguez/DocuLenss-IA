import React, { useRef, useEffect } from 'react';

/**
 * Contenedor de la lista de mensajes con ancho máximo centrado (max-w-3xl)
 * e implementación de autoscroll inteligente (solo hace scroll hacia abajo si el
 * usuario ya estaba cerca del fondo).
 */
export default function MessageList({ children, messagesCount }) {
  const containerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const wasNearBottomRef = useRef(true);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const threshold = 120; // px desde el fondo
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
    wasNearBottomRef.current = isNearBottom;
  };

  useEffect(() => {
    if (wasNearBottomRef.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messagesCount, children]);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-4 py-6 w-full scroll-smooth"
    >
      <div className="max-w-3xl mx-auto space-y-6">
        {children}
        <div ref={messagesEndRef} className="h-2" />
      </div>
    </div>
  );
}
