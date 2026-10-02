import { NextRequest, NextResponse } from "next/server";
import { fetchRecentChanges } from "@/lib/ingest";
import { supabaseService } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET nicht konfiguriert." }, { status: 500 });
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const eva = process.env.STATION_EVA ?? "8000105";
  try {
    const rows = await fetchRecentChanges(eva);
    let upserted = 0;
    if (rows.length > 0) {
      const payload = rows.map(({ destination, ...r }) => ({
        ...r,
        planned_time: r.planned_time,
        changed_time: r.changed_time,
        updated_at: new Date().toISOString(),
      }));
      const { error, count } = await supabaseService()
        .from("departures")
        .upsert(payload, { onConflict: "trip_id", count: "exact" });
      if (error) throw new Error(`Supabase upsert: ${error.message}`);
      upserted = count ?? rows.length;
    }
    return NextResponse.json({
      status: "ok",
      station_eva: eva,
      processed: rows.length,
      upserted,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json(
      { status: "error", error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
