"""Importiert NEUTRALE Dokument-Metadaten (Datum/Typ/Ort) aus dem
vorbereiteten Datensatz robertDouglass/epstein-files in unsere data.json.

Quelle: https://github.com/robertDouglass/epstein-files (KI-vorbereitete
Indizes der bereits opfer-geschwärzten HOUSE_OVERSIGHT-Releases).

Bewusst NICHT übernommen: Personennamen (im Quelldatensatz nur als anonyme
Codes E01–E30) — es entstehen keine neuen Graph-Knoten. Nur Zeitleiste und
Kurz-Zusammenfassungen werden ergänzt.
"""

from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import Path

RAW = Path("ingest/raw/INDEX_SUMMARIES_002.md")
DATA = Path("web/public/data.json")
PROVENANCE = "robertDouglass/epstein-files (HOUSE_OVERSIGHT-Release)"
CAP = 250  # so viele Dokumente höchstens übernehmen (UI/Performance)

BLOCK = re.compile(
    r"^### (HOUSE_OVERSIGHT_\d+)\s*\n"
    r"\*\*Type:\*\*\s*(.*?)\s*\|\s*\*\*Date:\*\*\s*(.*?)\s*\|.*?\n"
    r"(?:\*\*Key people:\*\*.*?\n)?"
    r"\*\*Locations:\*\*\s*(.*?)\s*\n",
    re.MULTILINE,
)


def parse_date(raw: str) -> str | None:
    raw = raw.strip()
    for fmt in ("%m/%d/%Y", "%B %d, %Y", "%b %d, %Y", "%m/%d/%y"):
        try:
            return datetime.strptime(raw, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def main() -> None:
    text = RAW.read_text(encoding="utf-8")
    docs = []
    for m in BLOCK.finditer(text):
        doc_id, dtype, date_raw, locations = (g.strip() for g in m.groups())
        iso = parse_date(date_raw)
        docs.append(
            {
                "doc_id": doc_id,
                "type": dtype or "Dokument",
                "date_raw": date_raw,
                "iso": iso,
                "locations": locations,
            }
        )

    # Datierte zuerst, neueste zuerst auswählen, dann begrenzen.
    dated = [d for d in docs if d["iso"]]
    dated.sort(key=lambda d: d["iso"], reverse=True)
    selected = dated[:CAP]

    data = json.loads(DATA.read_text(encoding="utf-8"))

    existing_summary_docs = {s["source_document"] for s in data["summaries"]}
    added_docs = 0
    for d in selected:
        src = f"{d['doc_id']} (via {PROVENANCE})"
        loc = f" Orte: {d['locations']}." if d["locations"] and d["locations"].lower() not in ("", "none", "n/a") else ""
        summary = f"{d['type']}-Dokument, datiert {d['date_raw']}.{loc} Quelle: {PROVENANCE}."
        if src not in existing_summary_docs:
            data["summaries"].append({"source_document": src, "summary": summary})
            existing_summary_docs.add(src)
            added_docs += 1
        desc = f"{d['type']}" + (f" · {d['locations']}" if loc else "")
        data["events"].append(
            {
                "date": d["iso"],
                "description": desc,
                "source_document": src,
                "source_page": None,
            }
        )

    data["events"].sort(key=lambda e: e["date"])
    data["stats"]["documents"] += added_docs
    data["stats"]["events"] = len(data["events"])
    data["ingest_note"] = (
        "Zeitleiste und Kurz-Zusammenfassungen ergänzt aus dem vorbereiteten "
        f"Datensatz {PROVENANCE}. Personennamen wurden bewusst nicht übernommen."
    )

    DATA.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Übernommen: {added_docs} Dokumente → Summaries={len(data['summaries'])}, Events={len(data['events'])}")


if __name__ == "__main__":
    main()
