import pytest
import pymupdf
from pathlib import Path
from app.services.pdf_extractor import (
    split_text_into_chunks,
    validar_limite_paginas,
    extract_pdf_content,
    MAX_PAGINAS_POR_DOCUMENTO,
)


def test_split_text_into_chunks_vacio():
    assert split_text_into_chunks("") == []
    assert split_text_into_chunks("   ") == []


def test_split_text_into_chunks_corto():
    texto = "Este es un texto corto que cabe en un solo chunk."
    chunks = split_text_into_chunks(texto, chunk_size=100)
    assert len(chunks) == 1
    assert chunks[0] == texto


def test_split_text_into_chunks_largo_con_solapamiento():
    palabras = ["palabra" + str(i) for i in range(200)]
    texto = " ".join(palabras)
    
    chunks = split_text_into_chunks(texto, chunk_size=300, overlap=50)
    assert len(chunks) > 1
    # Verificar que no corta a la mitad de una palabra
    for c in chunks:
        assert not c.startswith(" ")
        assert not c.endswith(" ")


def test_extract_pdf_content_texto_digital(tmp_path):
    pdf_path = tmp_path / "digital.pdf"
    img_dir = tmp_path / "imagenes"

    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_text((50, 50), "Este es un documento con texto digital completo para pruebas de extracción.")
    doc.save(str(pdf_path))
    doc.close()

    resultado = extract_pdf_content(pdf_path, img_dir)
    assert resultado["paginas"] == 1
    assert len(resultado["text_chunks"]) >= 1
    assert "digital" in resultado["text_chunks"][0]["contenido"]
    assert len(resultado["scanned_pages"]) == 0
