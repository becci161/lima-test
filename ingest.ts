import { XMLParser } from "fast-xml-parser";
import { parseDbTimeToISO, delayMinutes, destinationOf } from "./dbTime";

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

export type IngestRow = {
  trip_id: string;
  station_eva: string;
  category: string | null;
  train_number: string | null;
  planned_time: string | null;
  changed_time: string | null;
  delay_minutes: number | null;
  cancelled: boolean;
  platform: string | null;
  destination: string;
};

type XmlStop = {
  "@_id"?: string;
  tl?: { "@_c"?: string; "@_n"?: string } | Array<{ "@_c"?: string; "@_n"?: string }>;
  dp?: Record<string, string | undefined>;
};

export async function fetchRecentChanges(eva: string): Promise<IngestRow[]> {
  const base =
    process.env.DB_TIMETABLES_BASE ??
    "https://apis.deutschebahn.com/db-api-marketplace/apis/timetables/v1";
  const res = await fetch(`${base}/rchg/${eva}`, {
    headers: {
      // Header-Namen sind case-insensitiv; Doku schreibt DB-Client-ID / DB-Api-Key
      "DB-Client-Id": process.env.DB_CLIENT_ID ?? "",
      "DB-Api-Key": process.env.DB_API_KEY ?? "",
      Accept: "application/xml",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`DB API HTTP ${res.status}: ${body.slice(0, 500)}`);
  }
  const xml = await res.text();
  const doc = parser.parse(xml) as { timetable?: { s?: XmlStop | XmlStop[] } };
  const raw = doc?.timetable?.s;
  const stops: XmlStop[] = raw ? (Array.isArray(raw) ? raw : [raw]) : [];

  const rows: IngestRow[] = [];
  for (const s of stops) {
    const tripId = s["@_id"];
    const dp = s.dp;
    if (!tripId || !dp) continue; // nur Stops mit Abfahrt
    const pt = typeof dp["@_pt"] === "string" ? dp["@_pt"] : undefined;
    const ct = typeof dp["@_ct"] === "string" ? dp["@_ct"] : undefined;
    if (!pt && !ct) continue;
    const plannedISO = parseDbTimeToISO(pt ?? ct!);
    const changedISO = parseDbTimeToISO(ct ?? pt!);
    const tl = Array.isArray(s.tl) ? s.tl[0] : s.tl;
    rows.push({
      trip_id: tripId,
      station_eva: eva,
      category: tl?.["@_c"] ?? null,
      train_number: tl?.["@_n"] ?? null,
      planned_time: plannedISO,
      changed_time: changedISO,
      delay_minutes:
        pt && ct ? delayMinutes(plannedISO, changedISO) : ct && !pt ? 0 : null,
      cancelled: dp["@_cs"] === "c",
      platform:
        (typeof dp["@_cp"] === "string" ? dp["@_cp"] : null) ??
        (typeof dp["@_pp"] === "string" ? dp["@_pp"] : null),
      destination: destinationOf(
        (typeof dp["@_cpth"] === "string" ? dp["@_cpth"] : undefined) ??
          (typeof dp["@_ppth"] === "string" ? dp["@_ppth"] : undefined),
      ),
    });
  }
  return rows;
}
