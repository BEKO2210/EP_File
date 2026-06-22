# EP_File — KI-Analyse & Visualisierung öffentlich freigegebener Dokumente

Eine Pipeline, die **öffentlich freigegebene** Dokumente mit der Anthropic
Claude API analysiert (Entitäten, Beziehungen, Ereignisse, Zusammenfassungen)
und in einer **modernen Web-App** als Netzwerkgraph, Zeitleiste und
Zusammenfassungen darstellt.

> ⚠️ **Bitte zuerst [DISCLAIMER.md](./DISCLAIMER.md) lesen.** Eine Nennung in
> einem Dokument bedeutet keine Schuld. Geschwärzte Inhalte werden nicht
> ausgewertet. Standardmäßig für private, lokale Auswertung gedacht.

## Architektur

```
PDFs (öffentliche Quelle)
   │  acquire.py        Download (config/sources.yaml)
   ▼
data/raw/*.pdf
   │  extract.py        PDF→Text (+ OCR-Fallback für Scans), Schwärzungen entfernt
   ▼
data/text/*.txt
   │  analyze.py        Claude: strukturiertes JSON (Batch-API, Caching, Refusal-Handling)
   ▼
data/analysis/*.json
   │  export.py         Aggregation (networkx) → data.json
   ▼
web/public/data.json
   │  Vite + React + Tailwind  (Reagraph-Graph, eigene Timeline)
   ▼
Browser (Graph / Zeitleiste / Zusammenfassungen)
```

## Setup

### 1. Python-Pipeline

```bash
pip install -e .
cp .env.example .env          # ANTHROPIC_API_KEY eintragen
# Für OCR zusätzlich: tesseract + poppler installieren (System-Pakete)
```

### 2. Web-App

```bash
cd web
npm install
```

## Verwendung

```bash
# 1. Öffentliche Quell-URLs in config/sources.yaml eintragen, dann:
python -m ep_file.acquire

# 2. Text extrahieren (mit OCR-Fallback)
python -m ep_file.extract

# 3. KI-Analyse — erst EIN Dokument zum Testen:
python -m ep_file.analyze --one data/text/<dokument>.txt
#    dann der volle Batch-Lauf (50 % günstiger):
python -m ep_file.analyze

# 4. data.json für die Web-App bauen
python -m ep_file.export

# 5. Web-App starten
cd web && npm run dev
```

### Schnelldemo ohne API-Key

Mit den mitgelieferten **synthetischen** Beispieldaten (frei erfundene Namen):

```bash
python -m ep_file.export --in samples/analysis    # erzeugt web/public/data.json
cd web && npm install && npm run dev
```

## Modellwahl

- Bulk-Extraktion: `claude-haiku-4-5` (günstig, Default)
- Höhere Qualität: `python -m ep_file.analyze --model claude-sonnet-4-6`

## Design

Hochmodern und übersichtlich: warme „elevated neutrals", ein zurückhaltender
**Teal-Akzent**, klare Typografie, viel Whitespace — **bewusst ohne Lila**.
