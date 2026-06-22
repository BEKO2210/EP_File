"""Pydantic-Modelle für die strukturierte KI-Ausgabe.

Diese Modelle definieren das JSON-Schema, das Claude per `output_config.format`
zurückgeben muss. Jede Beziehung und jedes Ereignis trägt einen Quellenbeleg
(Dokument + Seite + Zitat), damit im Graph alles zurückverfolgbar bleibt.
"""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class EntityType(str, Enum):
    person = "person"
    org = "org"
    place = "place"


class Entity(BaseModel):
    name: str = Field(description="Name der Entität, exakt wie im Dokument genannt.")
    type: EntityType
    mention_only: bool = Field(
        default=True,
        description=(
            "True, solange die Person/Org im Dokument nur GENANNT wird. "
            "False nur, wenn der Text eine offizielle Anklage oder Verurteilung "
            "explizit belegt. Im Zweifel True."
        ),
    )


class Relationship(BaseModel):
    source: str = Field(description="Name der Quell-Entität.")
    target: str = Field(description="Name der Ziel-Entität.")
    relation: str = Field(description="Art der Beziehung, z. B. 'reiste mit', 'arbeitete für'.")
    evidence_quote: str = Field(description="Wörtliches Beleg-Zitat aus dem Dokument.")
    page: int | None = Field(default=None, description="Seitenzahl des Belegs.")


class Event(BaseModel):
    date: str = Field(description="Datum im Format YYYY-MM-DD, oder so genau wie belegbar.")
    description: str = Field(description="Knappe Beschreibung des Ereignisses.")
    source_page: int | None = Field(default=None, description="Seitenzahl des Belegs.")


class DocumentAnalysis(BaseModel):
    """Vollständige strukturierte Analyse eines einzelnen Dokuments."""

    document_summary: str = Field(description="Neutrale 3–5-Satz-Zusammenfassung.")
    entities: list[Entity] = Field(default_factory=list)
    relationships: list[Relationship] = Field(default_factory=list)
    events: list[Event] = Field(default_factory=list)


def anthropic_json_schema() -> dict:
    """JSON-Schema für `output_config={"format": {"type": "json_schema", ...}}`.

    Entfernt die `title`-Felder, die Pydantic erzeugt, und erzwingt
    `additionalProperties: false` (von der Structured-Outputs-API verlangt).
    """
    schema = DocumentAnalysis.model_json_schema()
    _harden(schema)
    return schema


def _harden(node: dict) -> None:
    node.pop("title", None)
    if node.get("type") == "object" and "properties" in node:
        node["additionalProperties"] = False
        node["required"] = list(node["properties"].keys())
    for child in node.get("properties", {}).values():
        _harden(child)
    if "items" in node and isinstance(node["items"], dict):
        _harden(node["items"])
    for key in ("$defs", "definitions"):
        for sub in node.get(key, {}).values():
            _harden(sub)
