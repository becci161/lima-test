# DB Dashboard (Next.js + Supabase)

## Setup
1. Supabase-Projekt anlegen, SQL aus `supabase/migrations/01_init.sql` im SQL-Editor ausführen (Tabelle `departures`, Index, RLS + anon-SELECT-Policy).
2. Env anlegen:
   ```bash
   cp .env.example .env.local
   ```
   Werte eintragen: Supabase URL/Keys, `DB_CLIENT_ID`, `DB_API_KEY`, `STATION_EVA`, `CRON_SECRET`, optional `STATION_NAME`.
3. Installieren & starten (Node 20+ nötig):
   ```bash
   npm install
   npm run dev
   ```
4. Cron testen:
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/check-station
   ```

## Deploy (Vercel)
- Env-Variablen in Vercel eintragen (inkl. `CRON_SECRET` – Vercel sendet ihn automatisch als `Authorization`-Header bei Cron-Jobs).
- `vercel.json` triggert `GET /api/cron/check-station` alle 5 Minuten (`*/5 * * * *`).
- Wichtig: DB-App muss im DB-Developer-Portal für den Timetables-Plan subscribed sein, sonst 403 `Not registered to plan`. Bei 401 Keys prüfen (Header `DB-Client-Id` / `DB-Api-Key`).

## Hinweise
- Route nutzt `rchg` (recent changes, letzte 2 Min). Für Vollabgleich `fchg`, für Fahrplan `plan/{eva}/{YYMMDD}/{HH}` – siehe `Timetables-1.0.274.json`.
- Zeitformat DB `YYMMDDHHMM` wird in `lib/dbTime.ts` mit Berlin-Offset (CET/CEST) nach ISO konvertiert.
- `trip_id` = Stop-`id` der DB (idempotent per UPSERT `onConflict: trip_id`).
- Dashboard liest via anon-Key (RLS SELECT erlaubt), Schreiben nur via service_role in der Cron-Route.
