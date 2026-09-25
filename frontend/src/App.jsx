import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getHealth, enviarChat, getDocumentoImagenes } from './api';

import Header from './components/Header';
import EmptyState from './components/EmptyState';
import Composer from './components/Composer';
import MessageList from './components/MessageList';
import Message from './components/Message';
import DropOverlay from './components/DropOverlay';
import DocumentViewer from './components/DocumentViewer';
import PdfDrawer from './components/PdfDrawer';
import ImagesModal from './components/ImagesModal';
import ImageLightbox from './components/ImageLightbox';

import { useDocumento } from './hooks/useDocumento';
import { useDragAndDrop } from './hooks/useDragAndDrop';

export default function App() {
  const [health, setHealth] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isWaitingResponse, setIsWaitingResponse] = useState(false);

  // Estados para imagen seleccionada en contexto (Caso B)
  const [chatImageId, setChatImageId] = useState(null);
  const [chatImageThumb, setChatImageThumb] = useState(null);
  const [chatImagePage, setChatImagePage] = useState(null);

  // Estados de Workspace: Vista Dividida (Split View) y navegación de páginas
  const [isSplitView, setIsSplitView] = useState(true);
  const [viewerPage, setViewerPage] = useState(1);
  const [activeMobileTab, setActiveMobileTab] = useState('chat'); // 'chat' | 'viewer'
  const [documentImages, setDocumentImages] = useState([]);

  // Estados para Drawer de PDF y Modales bajo demanda
  const [isPdfDrawerOpen, setIsPdfDrawerOpen] = useState(false);
  const [isImagesModalOpen, setIsImagesModalOpen] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [selectedLightboxImage, setSelectedLightboxImage] = useState(null);

  const composerTextareaRef = useRef(null);

  // Hook para gestión de documentos, subidas y polling
  const {
    selectedDoc,
    isUploading,
    uploadFile,
    retryUpload,
    resetDoc,
  } = useDocumento({ setMessages });

  // Hook para arrastrar y soltar a nivel de ventana con overlay
  const { isDragging } = useDragAndDrop({
    onFileDropped: (file, { hasIgnoredFiles }) => {
      uploadFile(file);
      setIsSplitView(true);
      if (hasIgnoredFiles) {
        setMessages((prev) => [
          ...prev,
          {
            id: `notice-${Date.now()}`,
            sender: 'assistant',
            tipo: 'texto',
            texto: 'ℹ️ Has soltado varios archivos. Se procesa únicamente el primer PDF y los demás fueron ignorados.',
          },
        ]);
      }
    },
    onError: (errorMessage) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'assistant',
          tipo: 'error',
          texto: errorMessage,
          canRetryUpload: false,
        },
      ]);
    },
  });

  // Comprobar salud del backend y base de datos
  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch(() => setHealth({ estado: 'error', base_de_datos: 'error' }));
  }, []);

  // Cargar imágenes del documento cuando esté listo
  useEffect(() => {
    if (selectedDoc?.doc_id && selectedDoc.estado === 'listo') {
      getDocumentoImagenes(selectedDoc.doc_id)
        .then((data) => {
          setDocumentImages(data || []);
        })
        .catch((err) => {
          console.error('Error al cargar imágenes del documento:', err);
        });
    } else if (!selectedDoc) {
      setDocumentImages([]);
    }
  }, [selectedDoc?.doc_id, selectedDoc?.estado]);

  // Reiniciar conversación con "Nuevo chat"
  const handleNewChat = useCallback(() => {
    setMessages([]);
    resetDoc();
    setChatImageId(null);
    setChatImageThumb(null);
    setChatImagePage(null);
    setInput('');
    setIsWaitingResponse(false);
    setIsPdfDrawerOpen(false);
    setIsImagesModalOpen(false);
    setIsLightboxOpen(false);
    setViewerPage(1);
    setDocumentImages([]);
    setActiveMobileTab('chat');
  }, [resetDoc]);

  // Manejo de apertura y cierre de PDF Drawer
  const handleOpenPdf = useCallback((page = 1) => {
    setViewerPage(page);
    setIsPdfDrawerOpen(true);
  }, []);

  const handleClosePdf = useCallback(() => {
    setIsPdfDrawerOpen(false);
    composerTextareaRef.current?.focus();
  }, []);

  // Manejo de apertura y cierre de Modal Galería de Imágenes
  const handleOpenImages = useCallback(() => {
    setIsImagesModalOpen(true);
  }, []);

  const handleCloseImages = useCallback(() => {
    setIsImagesModalOpen(false);
    composerTextareaRef.current?.focus();
  }, []);

  // Manejo de apertura de Lightbox individual
  const handleSelectImageFromGallery = useCallback((image) => {
    setSelectedLightboxImage(image);
    setIsLightboxOpen(true);
  }, []);

  const handleCloseLightbox = useCallback(() => {
    setIsLightboxOpen(false);
    composerTextareaRef.current?.focus();
  }, []);

  // Clic en citas de fuentes: Navega y enfoca el visor lateral inmediatamente
  const handlePageClick = useCallback((pagina) => {
    setViewerPage(pagina);
    setIsSplitView(true);
    setActiveMobileTab('viewer');
  }, []);

  const handleImageClick = useCallback(
    (imgId, url, pagina) => {
      if (pagina) {
        setViewerPage(pagina);
      }
      setIsSplitView(true);

      const match = documentImages.find((i) => i.imagen_id === imgId);
      setSelectedLightboxImage({
        imagen_id: imgId,
        url: url,
        pagina: pagina || 1,
        descripcion: match?.descripcion || `Imagen de la página ${pagina || 1}.`,
      });
      setIsLightboxOpen(true);
    },
    [documentImages]
  );

  // Acción "Preguntar sobre esta imagen" desde el visor o Lightbox
  const handleAskAboutImage = useCallback((image) => {
    setChatImageId(image.imagen_id);
    setChatImageThumb(image.url);
    setChatImagePage(image.pagina);
    setIsLightboxOpen(false);
    setIsImagesModalOpen(false);
    setActiveMobileTab('chat');
    setTimeout(() => {
      composerTextareaRef.current?.focus();
    }, 100);
  }, []);

  // Envío de preguntas al endpoint /api/chat
  const handleSendMessage = useCallback(
    async (textToSend) => {
      const query = (textToSend || input).trim();
      if (!query || isWaitingResponse) return;

      if (!selectedDoc) {
        setMessages((prev) => [
          ...prev,
          {
            id: `warn-${Date.now()}`,
            sender: 'assistant',
            tipo: 'texto',
            texto: 'Primero sube un PDF para poder comenzar a responder preguntas.',
          },
        ]);
        setInput('');
        return;
      }

      if (selectedDoc.estado !== 'listo') {
        setMessages((prev) => [
          ...prev,
          {
            id: `warn-${Date.now()}`,
            sender: 'assistant',
            tipo: 'texto',
            texto: 'El documento aún se está procesando. Espera un momento a que esté listo.',
          },
        ]);
        return;
      }

      const userMsgId = `user-${Date.now()}`;
      const typingMsgId = `typing-${Date.now()}`;

      // Asegurar que en móvil volvamos a la pestaña de chat al enviar
      setActiveMobileTab('chat');

      setMessages((prev) => [
        ...prev,
        {
          id: userMsgId,
          sender: 'user',
          tipo: 'texto',
          texto: query,
        },
        {
          id: typingMsgId,
          sender: 'assistant',
          tipo: 'escribiendo',
        },
      ]);

      setInput('');
      setIsWaitingResponse(true);

      const historial = messages
        .filter((m) => m.tipo === 'texto' && (m.sender === 'user' || m.sender === 'assistant'))
        .slice(-8)
        .map((m) => ({
          rol: m.sender,
          contenido: m.texto,
        }));

      const activeImageId = chatImageId;

      try {
        const res = await enviarChat(
          selectedDoc.doc_id,
          query,
          historial,
          activeImageId
        );

        setMessages((prev) =>
          prev
            .filter((m) => m.id !== typingMsgId)
            .concat({
              id: `asst-${Date.now()}`,
              sender: 'assistant',
              tipo: 'texto',
              texto: res.respuesta,
              fuentes: res.fuentes || [],
            })
        );

        // Si la respuesta incluye citas de página, actualizar suavemente la página del visor
        if (res.fuentes && res.fuentes.length > 0) {
          const firstPageSource = res.fuentes.find((f) => f.pagina);
          if (firstPageSource && firstPageSource.pagina) {
            setViewerPage(firstPageSource.pagina);
          }
        }

        if (activeImageId) {
          setChatImageId(null);
          setChatImageThumb(null);
          setChatImagePage(null);
        }
      } catch (err) {
        console.error('Error al enviar mensaje a /api/chat:', err);
        setMessages((prev) =>
          prev
            .filter((m) => m.id !== typingMsgId)
            .concat({
              id: `err-${Date.now()}`,
              sender: 'assistant',
              tipo: 'error',
              texto: err.message || 'No fue posible obtener una respuesta del servidor.',
              canRetryChat: true,
              lastQuestion: query,
            })
        );
      } finally {
        setIsWaitingResponse(false);
      }
    },
    [input, isWaitingResponse, selectedDoc, messages, chatImageId]
  );

  // Manejo de clic en sugerencias
  const handleSuggestionClick = useCallback(
    (text, autoSend) => {
      if (!autoSend) {
        setInput(text);
        setActiveMobileTab('chat');
        setTimeout(() => composerTextareaRef.current?.focus(), 50);
        return;
      }
      handleSendMessage(text);
    },
    [handleSendMessage]
  );

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white overflow-hidden">
      {/* Overlay a pantalla completa para Drag & Drop */}
      <DropOverlay isVisible={isDragging} />

      {/* 1. Encabezado */}
      <Header
        health={health}
        onNewChat={handleNewChat}
        hasActiveDoc={!!selectedDoc}
        isSplitView={isSplitView}
        onToggleSplitView={() => setIsSplitView((prev) => !prev)}
        activeMobileTab={activeMobileTab}
        onSelectMobileTab={setActiveMobileTab}
        currentPage={viewerPage}
      />

      {/* 2. Área Principal de Trabajo */}
      {messages.length === 0 && !selectedDoc ? (
        <main className="flex-1 flex flex-col justify-center overflow-auto p-4">
          <EmptyState onSelectFile={uploadFile} />
        </main>
      ) : (
        <div className="flex-1 flex overflow-hidden relative">
          {/* Panel Izquierdo: Visor Interactivo de Documento e Imágenes */}
          {selectedDoc && (
            <div
              className={`
                ${activeMobileTab === 'viewer' ? 'flex w-full' : 'hidden'}
                ${isSplitView ? 'lg:flex lg:w-1/2 xl:w-[50%]' : 'hidden'}
                h-full flex-col shrink-0 transition-all duration-200 z-10
              `}
            >
              <DocumentViewer
                docId={selectedDoc?.doc_id}
                docName={selectedDoc?.nombre}
                totalPages={selectedDoc?.paginas || 1}
                currentPage={viewerPage}
                onPageChange={setViewerPage}
                images={documentImages}
                onAskAboutImage={handleAskAboutImage}
                onClose={() => setIsSplitView(false)}
              />
            </div>
          )}

          {/* Panel Derecho: Área de Chat y Conversación */}
          <main
            className={`
              ${activeMobileTab === 'chat' ? 'flex w-full' : 'hidden'}
              ${isSplitView && selectedDoc ? 'lg:flex lg:w-1/2 xl:w-[50%]' : 'flex w-full'}
              flex-col h-full overflow-hidden relative transition-all duration-200 justify-between
            `}
          >
            <MessageList messagesCount={messages.length}>
              {messages.map((msg) => (
                <Message
                  key={msg.id}
                  message={msg}
                  onSuggestionClick={handleSuggestionClick}
                  onRetryUpload={retryUpload}
                  onRetryChat={(lastQuestion) => handleSendMessage(lastQuestion)}
                  onPageClick={handlePageClick}
                  onImageClick={handleImageClick}
                />
              ))}
            </MessageList>

            {/* Caja de mensaje (Composer) pegada al fondo */}
            <Composer
              input={input}
              setInput={setInput}
              onSend={() => handleSendMessage()}
              onAttachFile={uploadFile}
              disabled={!selectedDoc || isUploading || isWaitingResponse}
              isUploading={isUploading}
              placeholder={
                !selectedDoc
                  ? 'Sube un PDF para empezar…'
                  : isUploading
                  ? 'Transcribiendo documento con OCR local...'
                  : isWaitingResponse
                  ? 'DocuLens AI está respondiendo...'
                  : 'Haz una pregunta sobre el documento...'
              }
              selectedDoc={selectedDoc}
              chatImageId={chatImageId}
              chatImageThumb={chatImageThumb}
              chatImagePage={chatImagePage}
              onClearImage={() => {
                setChatImageId(null);
                setChatImageThumb(null);
                setChatImagePage(null);
              }}
              onOpenPdf={() => handleOpenPdf(viewerPage)}
              onOpenImages={handleOpenImages}
              totalImages={documentImages.length || selectedDoc?.totalImages || 0}
              textareaRef={composerTextareaRef}
            />
          </main>
        </div>
      )}

      {/* 4. Visor Lateral de PDF (Drawer bajo demanda) */}
      <PdfDrawer
        isOpen={isPdfDrawerOpen}
        onClose={handleClosePdf}
        docId={selectedDoc?.doc_id}
        docName={selectedDoc?.nombre}
        currentPage={viewerPage}
        totalPages={selectedDoc?.paginas || 1}
        onPageChange={setViewerPage}
      />

      {/* 5. Modal de Galería de Imágenes bajo demanda */}
      <ImagesModal
        isOpen={isImagesModalOpen}
        onClose={handleCloseImages}
        docId={selectedDoc?.doc_id}
        docName={selectedDoc?.nombre}
        onSelectImage={handleSelectImageFromGallery}
      />

      {/* 6. Lightbox de Detalle de Imagen bajo demanda */}
      <ImageLightbox
        isOpen={isLightboxOpen}
        onClose={handleCloseLightbox}
        image={selectedLightboxImage}
        onAskAboutImage={handleAskAboutImage}
      />
    </div>
  );
}
