"use client";
import { useState } from "react";
import { RefreshCw } from "lucide-react";

export default function RefreshButton() {
  const [state, setState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function trigger() {
    setState("loading");
    setMsg("");
    try {
      const secret = window.prompt("CRON_SECRET eingeben (Testzwecke):", "") ?? "";
      const res = await fetch("/api/cron/check-station", {
        headers: { Authorization: `Bearer ${secret}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setState("ok");
      setMsg(`OK: ${data.processed ?? 0} Fahrten (${new Date(data.timestamp).toLocaleTimeString("de-DE")})`);
      window.location.reload();
    } catch (e) {
      setState("error");
      setMsg(e instanceof Error ? e.message : "Fehler");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={trigger}
        disabled={state === "loading"}
        className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
      >
        <RefreshCw size={16} className={state === "loading" ? "animate-spin" : ""} />
        {state === "loading" ? "Lade …" : "Jetzt abrufen"}
      </button>
      {msg && <span className="text-xs text-zinc-600">{msg}</span>}
    </div>
  );
}
