"""Schutzmechanismen: Schwärzungen respektieren, Opferschutz, Provenienz.

Zentrale Regeln:
- Geschwärzte Passagen werden NICHT an die KI gesendet und nicht rekonstruiert.
- "In einem Dokument genannt" wird strikt von "beschuldigt/verurteilt" getrennt.
- Jede Ausgabe trägt einen Disclaimer.
"""

from __future__ import annotations

import re

DISCLAIMER = (
    "Hinweis: Diese Daten stammen aus öffentlich freigegebenen Dokumenten. "
    "Eine Nennung in einem Dokument bedeutet KEINE Schuld, Anklage oder "
    "Verurteilung. Geschwärzte Inhalte wurden nicht ausgewertet."
)

# Marker für geschwärzte/redigierte Passagen.
_REDACTION_PATTERNS = [
    re.compile(r"█+"),                       # Block-Schwärzung
    re.compile(r"▮+"),
    re.compile(r"[▀-▟]{2,}"),      # Block-Element-Zeichen
    re.compile(r"\bREDACTED\b", re.IGNORECASE),
    re.compile(r"\bGESCHW[AÄ]RZT\b", re.IGNORECASE),
    re.compile(r"\[\s*redacted\s*\]", re.IGNORECASE),
    re.compile(r"X{6,}"),                     # lange XXXXXX-Platzhalter
    re.compile(r"_{6,}"),                     # lange ______-Platzhalter
]


def strip_redactions(text: str) -> str:
    """Ersetzt geschwärzte Passagen durch einen neutralen Platzhalter.

    So sieht die KI, DASS etwas geschwärzt wurde, ohne den Inhalt zu erhalten —
    und wird nicht dazu verleitet, ihn zu "raten".
    """
    # Platzhalter ohne die Wörter, auf die die Muster reagieren ("REDACTED",
    # "GESCHWÄRZT") — sonst würde der Platzhalter sich selbst erneut treffen.
    cleaned = text
    for pattern in _REDACTION_PATTERNS:
        cleaned = pattern.sub(" [REDIGIERT] ", cleaned)
    # Mehrfache Platzhalter zusammenfassen.
    cleaned = re.sub(r"(\s*\[REDIGIERT\]\s*){2,}", " [REDIGIERT] ", cleaned)
    return cleaned


def contains_redactions(text: str) -> bool:
    return any(p.search(text) for p in _REDACTION_PATTERNS)
