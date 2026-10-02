#!/usr/bin/env python3
"""Sammelt alle 5 Minuten Abfahrtsdaten eines Bahnhofs (DB Timetables API) in SQLite."""
import os
import sys
import time
import sqlite3
import logging
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import xml.etree.ElementTree as ET
import requests

BERLIN = ZoneInfo("Europe/Berlin")
LOG = logging.getLogger("collector")

BASE = os.getenv("BASE_URL", "https://apis.deutschebahn.com/db-api-marketplace/apis/timetables/v1").rstrip("/")
CLIENT_ID = os.getenv("DB_CLIENT_ID", "")
API_KEY = os.getenv("DB_API_KEY", "")
EVA = os.getenv("EVA_NO", "8000105")
POLL = int(os.getenv("POLL_SECONDS", "300"))
DB_PATH = os.getenv("DB_PATH", "/data/timetable.db")

HEADERS = {"DB-Client-ID": CLIENT_ID, "DB-Api-Key": API_KEY, "Accept": "application/xml"}

SCHEMA = """
CREATE TABLE IF NOT EXISTS fetches(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  eva TEXT NOT NULL,
  kind TEXT NOT NULL,
  http_status INTEGER NOT NULL,
  stops INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS departures(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fetch_id INTEGER NOT NULL REFERENCES fetches(id),
  fetched_at TEXT NOT NULL,
  stop_id TEXT NOT NULL,
  eva TEXT NOT NULL,
  pt TEXT, ct TEXT, delay_min INTEGER,
  trip_c TEXT, trip_n TEXT, trip_o TEXT, line TEXT,
  dest TEXT, pp TEXT, cp TEXT, status TEXT,
  UNIQUE(fetch_id, stop_id)
);
CREATE INDEX IF NOT EXISTS idx_dep_stop ON departures(stop_id);
CREATE INDEX IF NOT EXISTS idx_dep_fetched ON departures(fetched_at);
"""


def db():
    os.makedirs(os.path.dirname(DB_PATH) or ".", exist_ok=True)
    con = sqlite3.connect(DB_PATH)
    con.executescript(SCHEMA)
    return con


def api_get(path: str) -> tuple[int, str]:
    r = requests.get(BASE + path, headers=HEADERS, timeout=30)
    if r.status_code in (401, 403):
        LOG.error("HTTP %s %s: %s -- 403 'Not registered to plan' = App im DB-Portal nicht fuer Timetables subscribed; 401 = Keys falsch/vertauscht.",
                  r.status_code, path, r.text[:300])
    r.raise_for_status()
    return r.status_code, r.text


def berlin_slice(dt: datetime):
    b = dt.astimezone(BERLIN)
    return b.strftime("%y%m%d"), b.strftime("%H")


def parse_db_time(s: str):
    if not s or len(s) != 10:
        return None
    try:
        return datetime(2000 + int(s[0:2]), int(s[2:4]), int(s[4:6]),
                        int(s[6:8]), int(s[8:10]), tzinfo=BERLIN)
    except ValueError:
        return None


def dest_of(ppth: str) -> str:
    if not ppth:
        return ""
    parts = [p for p in ppth.split("|") if p]
    return parts[-1] if parts else ""


def collect_once(con: sqlite3.Connection):
    now = datetime.now(BERLIN)
    fetched_at = now.isoformat(timespec="seconds")
    # 1) Plan: aktuelle Stunde (reicht als Kontext; Fchg liefert Echtzeit)
    d, h = berlin_slice(now)
    plan_xml = None
    try:
        st, plan_xml = api_get(f"/plan/{EVA}/{d}/{h}")
        n_plan = plan_xml.count("<s ")
        con.execute("INSERT INTO fetches(ts,eva,kind,http_status,stops) VALUES(?,?,?,?,?)",
                    (fetched_at, EVA, f"plan/{d}/{h}", st, n_plan))
    except Exception as e:
        LOG.warning("plan fetch failed: %s", e)
        con.execute("INSERT INTO fetches(ts,eva,kind,http_status,stops) VALUES(?,?,?,?,?)",
                    (fetched_at, EVA, f"plan/{d}/{h}", 0, 0))
    # 2) Full changes (alle 5 Min sinnvoll; recent-changes nur bei <2-Min-Takt)
    try:
        st, txt = api_get(f"/fchg/{EVA}")
    except Exception:
        con.commit()
        raise
    root = ET.fromstring(txt)
    stops = root.findall("s")
    cur = con.execute("INSERT INTO fetches(ts,eva,kind,http_status,stops) VALUES(?,?,?,?,?)",
                      (fetched_at, EVA, "fchg", st, len(stops)))
    fid = cur.lastrowid
    rows = 0
    for s in stops:
        sid = s.get("id", "")
        dp = s.find("dp")
        if dp is None:
            continue  # nur Abfahrten speichern
        pt, ct = dp.get("pt"), dp.get("ct")
        if not (pt or ct):
            continue
        pdt, rdt = parse_db_time(pt or ct), parse_db_time(ct or pt)
        delay = round((rdt - pdt).total_seconds() / 60) if (pdt and rdt and ct) else 0
        tl = s.find("tl")
        con.execute(
            "INSERT OR IGNORE INTO departures(fetch_id,fetched_at,stop_id,eva,pt,ct,delay_min,trip_c,trip_n,trip_o,line,dest,pp,cp,status)"
            " VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (fid, fetched_at, sid, EVA, pt, ct, delay,
             tl.get("c") if tl is not None else None,
             tl.get("n") if tl is not None else None,
             tl.get("o") if tl is not None else None,
             dp.get("l"), dest_of(dp.get("cpth") or dp.get("ppth")),
             dp.get("pp"), dp.get("cp"), dp.get("cs") or dp.get("ps") or "p"))
        rows += 1
    con.commit()
    LOG.info("fetch %s: %d stops, %d departures gespeichert", fetched_at, len(stops), rows)


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    if not CLIENT_ID or not API_KEY:
        print("FEHLER: DB_CLIENT_ID / DB_API_KEY als Env setzen (siehe .env.example).", file=sys.stderr)
        sys.exit(2)
    LOG.info("Starte Collector: EVA=%s alle %ss -> %s", EVA, POLL, DB_PATH)
    con = db()
    while True:
        try:
            collect_once(con)
        except requests.HTTPError as e:
            LOG.error("API-Fehler: %s", e)
        except Exception as e:
            LOG.exception("Unerwartet: %s", e)
        time.sleep(POLL)


if __name__ == "__main__":
    main()
