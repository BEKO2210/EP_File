"""Baut aus den Einzel-Analysen das finale `web/public/data.json` für die Web-App.

Schema von data.json:
{
  "generated_at": "...",
  "disclaimer": "...",
  "stats": {...},
  "nodes": [{id, name, type, mention_only, degree, documents[]}],
  "links": [{source, target, relation, evidence_quote, page, source_document}],
  "events": [{date, description, source_document, source_page}],
  "summaries": [{source_document, summary}]
}
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from .aggregate import build_graph, collect_events, collect_summaries, load_analyses
from .safeguards import DISCLAIMER

DEFAULT_IN = Path("data/analysis")
DEFAULT_OUT = Path("web/public/data.json")


def build_payload(in_dir: Path) -> dict:
    analyses = load_analyses(in_dir)
    graph = build_graph(analyses)

    nodes = [
        {
            "id": key,
            "name": data["name"],
            "type": data["type"],
            "mention_only": data["mention_only"],
            "degree": graph.degree(key),
            "documents": sorted(data["documents"]),
        }
        for key, data in graph.nodes(data=True)
    ]
    links = [
        {
            "source": u,
            "target": v,
            "relation": data.get("relation", ""),
            "evidence_quote": data.get("evidence_quote", ""),
            "page": data.get("page"),
            "source_document": data.get("source_document", ""),
        }
        for u, v, data in graph.edges(data=True)
    ]
    events = collect_events(analyses)
    summaries = collect_summaries(analyses)

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "disclaimer": DISCLAIMER,
        "stats": {
            "documents": len(analyses),
            "entities": len(nodes),
            "relationships": len(links),
            "events": len(events),
        },
        "nodes": nodes,
        "links": links,
        "events": events,
        "summaries": summaries,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="data.json für die Web-App bauen.")
    parser.add_argument("--in", dest="in_dir", type=Path, default=DEFAULT_IN)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()

    payload = build_payload(args.in_dir)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    s = payload["stats"]
    print(
        f"→ {args.out}\n"
        f"  Dokumente: {s['documents']}, Entitäten: {s['entities']}, "
        f"Beziehungen: {s['relationships']}, Ereignisse: {s['events']}"
    )


if __name__ == "__main__":
    main()
