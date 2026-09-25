from pathlib import Path

import pytest
import pymupdf

from app.services.pdf_extractor import validar_limite_paginas
from app.services.vision import usar_vision_ia_en_ingesta


def _crear_pdf(path: Path, numero_paginas: int) -> None:
    doc = pymupdf.open()
    for _ in range(numero_paginas):
        page = doc.new_page()
        page.insert_text((72, 72), "Texto de prueba")
    doc.save(path)
    doc.close()


def test_validar_limite_paginas_permite_20_paginas(tmp_path):
    pdf_path = tmp_path / "veinte.pdf"
    _crear_pdf(pdf_path, 20)

    validar_limite_paginas(pdf_path, max_pages=20)


def test_validar_limite_paginas_rechaza_mas_de_20_paginas(tmp_path):
    pdf_path = tmp_path / "veintiuna.pdf"
    _crear_pdf(pdf_path, 21)

    with pytest.raises(ValueError, match="20"):
        validar_limite_paginas(pdf_path, max_pages=20)


def test_vision_ia_queda_desactivada_por_defecto(monkeypatch):
    monkeypatch.setenv("USE_IA_DESCRIPTIONS_FOR_PDF_EXTRACTION", "false")
    import importlib
    import app.config as config
    import app.services.vision as vision

    importlib.reload(config)
    importlib.reload(vision)

    assert vision.usar_vision_ia_en_ingesta() is False


def test_vision_ia_puede_activarse_explicitamente(monkeypatch):
    monkeypatch.setenv("USE_IA_DESCRIPTIONS_FOR_PDF_EXTRACTION", "true")
    import importlib
    import app.config as config
    import app.services.vision as vision

    importlib.reload(config)
    importlib.reload(vision)

    assert vision.usar_vision_ia_en_ingesta() is True
