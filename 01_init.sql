-- 01_init: departures for DB Timetables ingestion
create table if not exists public.departures (
  trip_id text primary key,
  station_eva text not null,
  category text,
  train_number text,
  planned_time timestamptz,
  changed_time timestamptz,
  delay_minutes integer,
  cancelled boolean not null default false,
  platform text,
  updated_at timestamptz not null default now()
);

create index if not exists idx_departures_station_time
  on public.departures (station_eva, planned_time desc);

alter table public.departures enable row level security;

drop policy if exists "anon read departures" on public.departures;
create policy "anon read departures"
  on public.departures for select
  to anon
  using (true);
-- Kein INSERT/UPDATE/DELETE-Policy fuer anon/authenticated:
-- Schreibzugriff nur via service_role (bypassed RLS).
