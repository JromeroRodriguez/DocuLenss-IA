import uuid
import pytest
from pathlib import Path
from fastapi import HTTPException
from app.config import STORAGE_DIR
from app.security import (
    validar_uuid,
    validar_ruta_segura,
    obtener_ruta_pdf_segura,
    obtener_ruta_imagen_segura,
    es_archivo_pdf_valido,
)


def test_validar_uuid_correcto():
    test_id = "c2e5cf0f-106c-4cce-95de-814c72b54677"
    res = validar_uuid(test_id)
    assert isinstance(res, uuid.UUID)
    assert str(res) == test_id


def test_validar_uuid_invalido():
    with pytest.raises(HTTPException) as exc:
        validar_uuid("uuid-falso-invalido")
    assert exc.value.status_code == 400


def test_es_archivo_pdf_valido():
    assert es_archivo_pdf_valido(b"%PDF-1.4\n...") is True
    assert es_archivo_pdf_valido(b"%PDF-2.0") is True
    assert es_archivo_pdf_valido(b"PK\x03\x04") is False
    assert es_archivo_pdf_valido(b"") is False
    assert es_archivo_pdf_valido(b"GIF89a") is False


def test_validar_ruta_segura_permite_archivo_valido(tmp_path):
    archivo = tmp_path / "foto.jpg"
    archivo.write_text("dummy")

    res = validar_ruta_segura(tmp_path, "foto.jpg")
    assert res == archivo.resolve()


def test_validar_ruta_segura_bloquea_path_traversal(tmp_path):
    subfolder = tmp_path / "sub"
    subfolder.mkdir()

    intentos = [
        "../secreto.txt",
        "../../etc/passwd",
        "../../../etc/shadow",
        "foo/../../secreto.txt",
        "/etc/passwd",
        "sub/../../otra_cosa",
    ]

    for ataque in intentos:
        with pytest.raises(HTTPException) as exc:
            validar_ruta_segura(subfolder, ataque)
        assert exc.value.status_code in (400, 403), f"Falló en bloquear ataque: {ataque}"


def test_obtener_ruta_imagen_segura_bloquea_traversal():
    doc_id = uuid.uuid4()
    
    intentos = [
        "../original.pdf",
        "../../.env",
        "../../../etc/passwd",
        "/etc/hosts",
        "subfolder/imagen.jpg",
    ]

    for ataque in intentos:
        with pytest.raises(HTTPException) as exc:
            obtener_ruta_imagen_segura(doc_id, ataque)
        assert exc.value.status_code in (400, 403), f"Falló en bloquear imagen: {ataque}"


def test_obtener_ruta_pdf_segura_confinada_a_doc_dir():
    doc_id = uuid.uuid4()
    pdf_path = obtener_ruta_pdf_segura(doc_id)
    doc_dir = (STORAGE_DIR / str(doc_id)).resolve()
    
    assert pdf_path.is_relative_to(doc_dir)
    assert pdf_path.name == "original.pdf"
