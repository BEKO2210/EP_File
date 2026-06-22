"""Lädt öffentlich freigegebene PDF-Dokumente aus den in config/sources.yaml
hinterlegten URLs herunter.

Nur für ÖFFENTLICH freigegebene Quellen verwenden. Die URLs trägt der Nutzer
selbst ein (siehe config/sources.yaml).
"""

from __future__ import annotations

import argparse
import hashlib
from pathlib import Path

import httpx
import yaml

DEFAULT_SOURCES = Path("config/sources.yaml")
DEFAULT_OUT = Path("data/raw")


def load_sources(path: Path) -> list[dict]:
    if not path.exists():
        raise FileNotFoundError(
            f"{path} fehlt. Lege die Datei an (siehe config/sources.yaml.example) "
            "und trage öffentliche Quell-URLs ein."
        )
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    return data.get("documents", [])


def _filename_for(doc: dict, url: str) -> str:
    name = doc.get("id") or hashlib.sha1(url.encode()).hexdigest()[:12]
    return f"{name}.pdf"


def download_all(sources: Path = DEFAULT_SOURCES, out_dir: Path = DEFAULT_OUT) -> list[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    documents = load_sources(sources)
    saved: list[Path] = []
    with httpx.Client(follow_redirects=True, timeout=120) as client:
        for doc in documents:
            url = doc["url"]
            target = out_dir / _filename_for(doc, url)
            if target.exists():
                print(f"= übersprungen (vorhanden): {target.name}")
                saved.append(target)
                continue
            print(f"↓ lade: {url}")
            resp = client.get(url)
            resp.raise_for_status()
            target.write_bytes(resp.content)
            print(f"  → gespeichert: {target.name} ({len(resp.content):,} bytes)")
            saved.append(target)
    return saved


def main() -> None:
    parser = argparse.ArgumentParser(description="PDFs aus öffentlichen Quellen laden.")
    parser.add_argument("--sources", type=Path, default=DEFAULT_SOURCES)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()
    paths = download_all(args.sources, args.out)
    print(f"\nFertig: {len(paths)} Dokument(e) in {args.out}")


if __name__ == "__main__":
    main()
