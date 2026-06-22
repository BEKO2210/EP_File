"""Aggregiert die Einzel-Analysen zu einem Graphen + Zeitleiste.

- Entitäten werden über alle Dokumente hinweg dedupliziert (per Name+Typ).
- networkx berechnet den Knotengrad → Knotengröße in der Visualisierung.
- mention_only bleibt nur dann true, wenn KEIN Beleg eine Anklage/Verurteilung
  zeigt (konservativ: ein einziges mention_only=false setzt die Entität auf
  "belegt nicht nur genannt").
"""

from __future__ import annotations

import json
from pathlib import Path

import networkx as nx


def _key(name: str, etype: str) -> str:
    return f"{etype}:{name.strip().lower()}"


def load_analyses(in_dir: Path) -> list[dict]:
    analyses = []
    for fp in sorted(in_dir.glob("*.json")):
        try:
            analyses.append(json.loads(fp.read_text(encoding="utf-8")))
        except json.JSONDecodeError as exc:
            print(f"  ! {fp.name} übersprungen: {exc}")
    return analyses


def build_graph(analyses: list[dict]) -> nx.Graph:
    g = nx.Graph()
    for doc in analyses:
        source_doc = doc.get("source_document", "?")
        for ent in doc.get("entities", []):
            k = _key(ent["name"], ent["type"])
            if k not in g:
                g.add_node(
                    k,
                    name=ent["name"],
                    type=ent["type"],
                    mention_only=bool(ent.get("mention_only", True)),
                    documents={source_doc},
                )
            else:
                node = g.nodes[k]
                node["documents"].add(source_doc)
                # konservativ: sobald irgendwo nicht nur "genannt", merken.
                if not ent.get("mention_only", True):
                    node["mention_only"] = False

        # Beziehungen als Kanten (Entitäten ggf. anlegen, falls nur hier referenziert).
        for rel in doc.get("relationships", []):
            for endpoint in (rel["source"], rel["target"]):
                ek = _key(endpoint, _guess_type(endpoint, doc))
                if ek not in g:
                    g.add_node(ek, name=endpoint, type=_guess_type(endpoint, doc),
                               mention_only=True, documents={source_doc})
            sk = _key(rel["source"], _guess_type(rel["source"], doc))
            tk = _key(rel["target"], _guess_type(rel["target"], doc))
            g.add_edge(
                sk, tk,
                relation=rel.get("relation", ""),
                evidence_quote=rel.get("evidence_quote", ""),
                page=rel.get("page"),
                source_document=source_doc,
            )
    return g


def _guess_type(name: str, doc: dict) -> str:
    for ent in doc.get("entities", []):
        if ent["name"].strip().lower() == name.strip().lower():
            return ent["type"]
    return "person"


def collect_events(analyses: list[dict]) -> list[dict]:
    events = []
    for doc in analyses:
        src = doc.get("source_document", "?")
        for ev in doc.get("events", []):
            events.append({
                "date": ev.get("date", ""),
                "description": ev.get("description", ""),
                "source_document": src,
                "source_page": ev.get("source_page"),
            })
    events.sort(key=lambda e: e["date"])
    return events


def collect_summaries(analyses: list[dict]) -> list[dict]:
    return [
        {"source_document": d.get("source_document", "?"), "summary": d.get("document_summary", "")}
        for d in analyses
    ]
