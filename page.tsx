import { TrainFront, Clock, XCircle, CheckCircle2 } from "lucide-react";
import { supabaseAnon, type Departure } from "@/lib/supabase";
import RefreshButton from "@/components/RefreshButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function fmtTime(iso: string | null): string {
  if (!iso) return "–";
  return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

export default async function Page() {
  const eva = process.env.STATION_EVA ?? "8000105";
  const stationName = process.env.STATION_NAME ?? "Bahnhof";
  let rows: Departure[] = [];
  let lastFetch: string | null = null;
  let loadError: string | null = null;

  try {
    const db = supabaseAnon();
    const { data, error } = await db
      .from("departures")
      .select("*")
      .eq("station_eva", eva)
      .order("planned_time", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    rows = (data ?? []) as Departure[];
    lastFetch = rows.reduce<string | null>(
      (acc, r) => (!acc || r.updated_at > acc ? r.updated_at : acc),
      null,
    );
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e);
  }

  const total = rows.length;
  const delayed = rows.filter((r) => !r.cancelled && (r.delay_minutes ?? 0) > 0).length;
  const cancelled = rows.filter((r) => r.cancelled).length;
  const onTime = total - delayed - cancelled;
  const punctuality = total > 0 ? Math.round((onTime / total) * 100) : 100;

  return (
    <main className="mx-auto max-w-5xl p-4 md:p-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-black p-4 text-white">
        <div className="flex items-center gap-3">
          <TrainFront className="text-red-500" />
          <div>
            <h1 className="text-lg font-semibold">
              {stationName} <span className="text-sm font-normal text-zinc-400">EVA {eva}</span>
            </h1>
            <p className="text-xs text-zinc-400">
              Letzte Abfrage:{" "}
              {lastFetch ? new Date(lastFetch).toLocaleString("de-DE") : "noch keine Daten"}
            </p>
          </div>
        </div>
        <RefreshButton />
      </header>

      {loadError && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          Supabase-Fehler: {loadError} – Migration <code>supabase/migrations/01_init.sql</code>{" "}
          anwenden und Env prüfen.
        </div>
      )}

      <section className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Clock size={16} /> Verspätet
          </div>
          <p className="mt-1 text-2xl font-bold text-red-600">{delayed}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <XCircle size={16} /> Ausfälle
          </div>
          <p className="mt-1 text-2xl font-bold">{cancelled}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <CheckCircle2 size={16} /> Pünktlich
          </div>
          <p className="mt-1 text-2xl font-bold text-green-700">{punctuality} %</p>
          <p className="text-xs text-zinc-500">
            {onTime} von {total} erfasst
          </p>
        </div>
      </section>

      <section className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-50 text-left text-zinc-500">
              <th className="p-3">Zug</th>
              <th className="p-3">Gleis</th>
              <th className="p-3">Plan</th>
              <th className="p-3">Ist</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const delay = r.delay_minutes ?? 0;
              const badge = r.cancelled ? (
                <span className="rounded bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">
                  Entfällt
                </span>
              ) : delay > 0 ? (
                <span className="rounded bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">
                  +{delay} Min
                </span>
              ) : (
                <span className="rounded bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">
                  Pünktlich
                </span>
              );
              return (
                <tr key={r.trip_id} className="border-t border-zinc-100">
                  <td className="p-3 font-medium">
                    {r.category ?? ""} {r.train_number ?? ""}
                  </td>
                  <td className="p-3">{r.platform ?? "–"}</td>
                  <td className="p-3">{fmtTime(r.planned_time)}</td>
                  <td className="p-3 font-semibold">{fmtTime(r.changed_time)}</td>
                  <td className="p-3">{badge}</td>
                </tr>
              );
            })}
            {rows.length === 0 && !loadError && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-zinc-500">
                  Noch keine Abfahrten erfasst – Button „Jetzt abrufen“ nutzen oder Cron abwarten.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
