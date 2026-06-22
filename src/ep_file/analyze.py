"""KI-Analyse der extrahierten Texte mit der Anthropic Claude API.

Pro Dokument werden Entitäten, Beziehungen, Ereignisse und eine neutrale
Zusammenfassung als strukturiertes JSON extrahiert (Pydantic-Schema).

Designentscheidungen (siehe Plan):
- Strukturierte Ausgabe via `output_config.format` (json_schema).
- Batch API für hohes Volumen → 50 % günstiger; Zuordnung per `custom_id`.
- Prompt Caching: System-Prompt + Schema als stabiler, gecachter Prefix.
- Refusal-Handling: `stop_reason` IMMER vor `content` prüfen; ablehnen → skip.
"""

from __future__ import annotations

import argparse
import json
import os
import time
from pathlib import Path

from .schema import DocumentAnalysis, anthropic_json_schema
from .safeguards import strip_redactions

DEFAULT_IN = Path("data/text")
DEFAULT_OUT = Path("data/analysis")

# Günstiger Default für Bulk-Extraktion; --model claude-sonnet-4-6 für mehr Qualität.
DEFAULT_MODEL = "claude-haiku-4-5"
MAX_CHARS = 120_000  # grobe Sicherung gegen Übergröße pro Dokument

SYSTEM_PROMPT = (
    "Du bist ein sorgfältiger Analyst für öffentlich freigegebene Dokumente. "
    "Extrahiere ausschließlich, was im Text BELEGT ist. Erfinde nichts. "
    "Wichtige Regeln:\n"
    "1. Eine Person/Organisation, die nur GENANNT wird, ist mention_only=true. "
    "Setze mention_only=false nur, wenn der Text eine offizielle Anklage oder "
    "Verurteilung ausdrücklich belegt. Im Zweifel true.\n"
    "2. Ignoriere mit [REDIGIERT] markierte Passagen vollständig. Versuche nie, "
    "geschwärzte Inhalte zu rekonstruieren oder zu erraten.\n"
    "3. Jede Beziehung und jedes Ereignis braucht ein wörtliches Beleg-Zitat.\n"
    "4. Bleibe neutral und faktentreu; keine Wertungen oder Schuldzuweisungen."
)


def _read_client():
    import anthropic

    return anthropic.Anthropic()


def _user_text(doc_text: str) -> str:
    text = strip_redactions(doc_text)[:MAX_CHARS]
    return (
        "Analysiere das folgende Dokument und gib das Ergebnis im geforderten "
        "JSON-Schema zurück. Seitenmarker '<<<PAGE n>>>' geben die Seitenzahl an.\n\n"
        f"{text}"
    )


def _system_blocks() -> list[dict]:
    # System-Prompt als gecachter Prefix (Prompt Caching, ~90 % Ersparnis).
    return [{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}]


def _parse_or_none(raw_text: str, doc_id: str) -> DocumentAnalysis | None:
    try:
        return DocumentAnalysis.model_validate_json(raw_text)
    except Exception as exc:
        print(f"  ! {doc_id}: JSON-Validierung fehlgeschlagen: {exc}")
        return None


# --------------------------------------------------------------------------- #
# Synchroner Einzel-Lauf (zum Testen eines Dokuments)
# --------------------------------------------------------------------------- #
def analyze_one(text_path: Path, model: str = DEFAULT_MODEL) -> DocumentAnalysis | None:
    client = _read_client()
    doc_text = text_path.read_text(encoding="utf-8")
    resp = client.messages.create(
        model=model,
        max_tokens=8000,
        system=_system_blocks(),
        messages=[{"role": "user", "content": _user_text(doc_text)}],
        output_config={"format": {"type": "json_schema", "schema": anthropic_json_schema()}},
    )
    # Refusal IMMER vor content prüfen.
    if resp.stop_reason == "refusal":
        cat = getattr(resp.stop_details, "category", None) if resp.stop_details else None
        print(f"  ⨯ {text_path.stem}: von Safety-Klassifizierer abgelehnt (category={cat}) — übersprungen")
        return None
    raw = next((b.text for b in resp.content if b.type == "text"), "")
    return _parse_or_none(raw, text_path.stem)


# --------------------------------------------------------------------------- #
# Batch-Lauf (Default für hohes Volumen, 50 % günstiger)
# --------------------------------------------------------------------------- #
def analyze_batch(
    in_dir: Path = DEFAULT_IN, out_dir: Path = DEFAULT_OUT, model: str = DEFAULT_MODEL
) -> list[Path]:
    from anthropic.types.message_create_params import MessageCreateParamsNonStreaming
    from anthropic.types.messages.batch_create_params import Request

    client = _read_client()
    out_dir.mkdir(parents=True, exist_ok=True)

    text_files = sorted(in_dir.glob("*.txt"))
    if not text_files:
        print(f"Keine Textdateien in {in_dir}. Zuerst extract ausführen.")
        return []

    schema = anthropic_json_schema()
    requests = [
        Request(
            custom_id=tf.stem,
            params=MessageCreateParamsNonStreaming(
                model=model,
                max_tokens=8000,
                system=_system_blocks(),
                messages=[{"role": "user", "content": _user_text(tf.read_text(encoding="utf-8"))}],
                output_config={"format": {"type": "json_schema", "schema": schema}},
            ),
        )
        for tf in text_files
    ]

    batch = client.messages.batches.create(requests=requests)
    print(f"Batch erstellt: {batch.id} ({len(requests)} Dokumente). Warte auf Ergebnisse …")

    while True:
        batch = client.messages.batches.retrieve(batch.id)
        if batch.processing_status == "ended":
            break
        print(f"  … Status: {batch.processing_status}")
        time.sleep(30)

    written: list[Path] = []
    for result in client.messages.batches.results(batch.id):
        doc_id = result.custom_id
        if result.result.type != "succeeded":
            print(f"  ⨯ {doc_id}: {result.result.type} — übersprungen")
            continue
        msg = result.result.message
        if msg.stop_reason == "refusal":
            print(f"  ⨯ {doc_id}: vom Safety-Klassifizierer abgelehnt — übersprungen")
            continue
        raw = next((b.text for b in msg.content if b.type == "text"), "")
        analysis = _parse_or_none(raw, doc_id)
        if analysis is None:
            continue
        target = out_dir / f"{doc_id}.json"
        payload = analysis.model_dump(mode="json")
        payload["source_document"] = doc_id
        target.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        written.append(target)
        print(f"  ✓ {doc_id} → {target.name}")

    return written


def main() -> None:
    parser = argparse.ArgumentParser(description="Texte mit Claude analysieren (Batch oder einzeln).")
    parser.add_argument("--in", dest="in_dir", type=Path, default=DEFAULT_IN)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--one", type=Path, help="Nur EIN Dokument synchron analysieren (Test).")
    args = parser.parse_args()

    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise SystemExit("ANTHROPIC_API_KEY ist nicht gesetzt (siehe .env.example).")

    if args.one:
        analysis = analyze_one(args.one, model=args.model)
        if analysis:
            args.out.mkdir(parents=True, exist_ok=True)
            payload = analysis.model_dump(mode="json")
            payload["source_document"] = args.one.stem
            (args.out / f"{args.one.stem}.json").write_text(
                json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
            )
            print(json.dumps(payload, ensure_ascii=False, indent=2))
        return

    written = analyze_batch(args.in_dir, args.out, model=args.model)
    print(f"\nFertig: {len(written)} Analyse(n) in {args.out}")


if __name__ == "__main__":
    main()
