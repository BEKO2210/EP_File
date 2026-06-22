"""Extrahiert Text aus PDFs. Fällt bei gescannten Seiten auf OCR zurück.

Viele freigegebene Dokumente sind Scans ohne Text-Layer → OCR via Tesseract.
Schwärzungen werden direkt nach der Extraktion neutralisiert (safeguards).
"""

from __future__ import annotations

import argparse
from pathlib import Path

import pdfplumber

from .safeguards import strip_redactions

DEFAULT_IN = Path("data/raw")
DEFAULT_OUT = Path("data/text")

# Schwelle: weniger Zeichen pro Seite ⇒ vermutlich ein Scan ⇒ OCR versuchen.
_MIN_CHARS_PER_PAGE = 40


def _ocr_page(pdf_path: Path, page_number: int) -> str:
    """OCR einer einzelnen Seite. Importe lokal, damit das Modul auch ohne
    installierten Tesseract/poppler importierbar bleibt."""
    try:
        import pytesseract
        from pdf2image import convert_from_path
    except ImportError:
        return ""
    try:
        images = convert_from_path(
            str(pdf_path), first_page=page_number, last_page=page_number, dpi=300
        )
    except Exception as exc:  # poppler fehlt o. ä.
        print(f"    ! OCR übersprungen (S.{page_number}): {exc}")
        return ""
    if not images:
        return ""
    return pytesseract.image_to_string(images[0], lang="eng+deu")


def extract_pages(pdf_path: Path) -> list[str]:
    """Gibt eine Liste von Seitentexten zurück (Index 0 = Seite 1)."""
    pages: list[str] = []
    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages, start=1):
            text = page.extract_text() or ""
            if len(text.strip()) < _MIN_CHARS_PER_PAGE:
                ocr = _ocr_page(pdf_path, i)
                if len(ocr.strip()) > len(text.strip()):
                    text = ocr
            pages.append(strip_redactions(text))
    return pages


def extract_all(in_dir: Path = DEFAULT_IN, out_dir: Path = DEFAULT_OUT) -> list[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []
    for pdf_path in sorted(in_dir.glob("*.pdf")):
        print(f"• extrahiere: {pdf_path.name}")
        pages = extract_pages(pdf_path)
        target = out_dir / f"{pdf_path.stem}.txt"
        # Seiten mit Markern trennen, damit analyze.py Seitenzahlen kennt.
        joined = "\n".join(
            f"<<<PAGE {i}>>>\n{p}" for i, p in enumerate(pages, start=1)
        )
        target.write_text(joined, encoding="utf-8")
        print(f"  → {target.name} ({len(pages)} Seiten)")
        written.append(target)
    return written


def main() -> None:
    parser = argparse.ArgumentParser(description="PDFs zu Text extrahieren (mit OCR-Fallback).")
    parser.add_argument("--in", dest="in_dir", type=Path, default=DEFAULT_IN)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()
    written = extract_all(args.in_dir, args.out)
    print(f"\nFertig: {len(written)} Textdatei(en) in {args.out}")


if __name__ == "__main__":
    main()
