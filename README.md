# Station-Collector (DB Timetables)

Sammelt alle 5 Minuten Abfahrten eines festen Bahnhofs via DB Timetables API in SQLite.

## 1. Einrichten
```bash
cd station-collector
cp .env.example .env
# .env editieren: DB_CLIENT_ID, DB_API_KEY, EVA_NO (z.B. 8000105)
mkdir -p data
docker compose up -d --build
docker compose logs -f
```

## 2. Prüfen
```bash
docker compose exec collector python -c "import sqlite3; c=sqlite3.connect('/data/timetable.db'); print(c.execute('select count(*) from departures').fetchone())"
sqlite3 data/timetable.db "SELECT fetched_at, trip_c, trip_n, dest, pt, ct, delay_min, status FROM departures ORDER BY id DESC LIMIT 10;"
```

## 3. Logik
- `GET /plan/{eva}/{YYMMDD}/{HH}` 1x pro Durchlauf (Kontext, aktuelle Stunde Berlin-Zeit)
- `GET /fchg/{eva}` alle `POLL_SECONDS` (Echtzeit: `ct` = aktuell, `cp` = Gleis neu, `cs` = Status; `pt/pp/ppth` = Plan)
- Nur `dp`-Stops (Abfahrten), Ziel = letztes Element aus `cpth|ppth`
- Tabellen: `fetches` (jeder Abruf), `departures` (pro Abruf x Stop, dedup via UNIQUE fetch_id+stop_id)
- 403 `Not registered to plan` = App im DB-Developer-Portal nicht für Timetables subscribed. 401 = Keys falsch/vertauscht.

## 4. EVA wechseln
`.env`: `EVA_NO` ändern, `docker compose up -d` neu starten. Historie bleibt in `data/timetable.db`.
