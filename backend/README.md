# Lokales Python-Backend

FastAPI + Pydantic v2 für die H&P-iCal-Verfügbarkeitsdaten. Die iCal-URLs bleiben serverseitig in der Projekt-Root-Datei `.env`.

## Voraussetzungen

- Python 3.11 oder neuer
- Die beiden privaten H&P-iCal-URLs in der Root-`.env` (siehe `../.env.example`)

## Installation (macOS)

Im Repository-Verzeichnis:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r backend/requirements.txt
```

Falls noch keine lokale `.env` existiert:

```bash
cp .env.example .env
```

Trage in der Root-`.env` die beiden von H&P bereitgestellten Werte ein:

```dotenv
HP_ICAL_141_URL=dein_privater_feed_fuer_141
HP_ICAL_136_URL=dein_privater_feed_fuer_136
```

Die URLs sind geheime Feed-Adressen. Nicht in Git committen, nicht im Browser öffnen und nicht in Screenshots oder Logs teilen.

## Start

Terminal 1 – Python API:

```bash
source .venv/bin/activate
uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000
```

Terminal 2 – vorhandene Website mit dem Node-Server:

```bash
npm install
npm start
```

Öffne danach http://localhost:3000. Die lokale Website erkennt localhost und fragt das Python-Backend unter http://127.0.0.1:8000 ab. Außerhalb von localhost bleibt die bisherige relative API-Adresse erhalten.

## Prüfen

- http://127.0.0.1:8000/api/health
- http://127.0.0.1:8000/api/availability?house=141
- http://127.0.0.1:8000/api/availability?house=136
- http://127.0.0.1:8000/docs – interaktive Swagger-Oberfläche

Automatisierte Python-Tests (API, Pydantic-Validierung, CORS, Cache und iCal-Parser):

```bash
python -m pytest backend/tests -v
```

Die API validiert die Hausnummer mit einem Pydantic-`Literal`, validiert die Response-Modelle, expandiert wiederkehrende iCal-Termine und berücksichtigt EXDATE/RECURRENCE-ID-Ausnahmen. Ergebnisse werden 60 Sekunden im Speicher zwischengespeichert.

## API-Response

```json
{
  "house": "141",
  "bookedDates": ["2026-11-10", "2026-11-11"],
  "fetchedAt": "2026-11-05T12:00:00Z",
  "rangeMonths": 18,
  "cached": false
}
```
