CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS documentos (
  doc_id UUID PRIMARY KEY,
  nombre TEXT NOT NULL,
  paginas INT,
  estado TEXT NOT NULL DEFAULT 'procesando',  -- procesando | listo | error
  error TEXT,
  imagenes_total INT NOT NULL DEFAULT 0,
  imagenes_procesadas INT NOT NULL DEFAULT 0,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chunks (
  id BIGSERIAL PRIMARY KEY,
  doc_id UUID NOT NULL REFERENCES documentos(doc_id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('texto', 'imagen')),
  pagina INT NOT NULL,
  contenido TEXT NOT NULL,          -- fragmento de texto o descripción de la imagen
  imagen_id TEXT,                   -- solo para tipo 'imagen'
  embedding vector(384) NOT NULL    -- 384 = dimensión de paraphrase-multilingual-MiniLM-L12-v2
);

CREATE INDEX IF NOT EXISTS chunks_doc_id_idx ON chunks (doc_id);
CREATE INDEX IF NOT EXISTS chunks_embedding_hnsw_idx ON chunks USING hnsw (embedding vector_cosine_ops);
