// Robuste Konvertierung DB-Format YYMMDDHHMM (Europe/Berlin-Wandzeit)
// z.B. "2410021305" -> "2024-10-02T13:05:00+02:00"
// EU-Sommerzeit: letzter Sonntag Maerz 02:00 -> letzter Sonntag Oktober 03:00.

export function lastSunday(year: number, month: number): number {
  // month: 1-12, Rueckgabe: Tagesnummer des letzten Sonntags
  const last = new Date(Date.UTC(year, month, 0)); // letzter Tag des Monats (UTC, DST-frei)
  const dow = last.getUTCDay(); // 0 = Sonntag
  return last.getUTCDate() - dow;
}

export function berlinOffset(yy: number, mm: number, dd: number, hh: number, min: number): "+01:00" | "+02:00" {
  const year = 2000 + yy;
  const dstStart = lastSunday(year, 3); // Maerz
  const dstEnd = lastSunday(year, 10); // Oktober
  const afterStart =
    mm > 3 || (mm === 3 && (dd > dstStart || (dd === dstStart && hh >= 3)));
  const beforeEnd =
    mm < 10 || (mm === 10 && (dd < dstEnd || (dd === dstEnd && hh < 3)));
  return afterStart && beforeEnd ? "+02:00" : "+01:00";
}

export function parseDbTimeToISO(s: string | undefined | null): string | null {
  if (!s || typeof s !== "string" || s.length !== 10 || !/^\d{10}$/.test(s)) return null;
  const yy = +s.slice(0, 2), mo = +s.slice(2, 4), dd = +s.slice(4, 6);
  const hh = +s.slice(6, 8), mi = +s.slice(8, 10);
  if (mo < 1 || mo > 12 || dd < 1 || dd > 31 || hh > 23 || mi > 59) return null;
  const off = berlinOffset(yy, mo, dd, hh, mi);
  const p = (n: number) => String(n).padStart(2, "0");
  return `20${p(yy)}-${p(mo)}-${p(dd)}T${p(hh)}:${p(mi)}:00${off}`;
}

export function delayMinutes(plannedISO: string | null, changedISO: string | null): number | null {
  if (!plannedISO || !changedISO) return null;
  const ms = new Date(changedISO).getTime() - new Date(plannedISO).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.round(ms / 60000);
}

export function destinationOf(path: string | undefined | null): string {
  if (!path) return "";
  const parts = path.split("|").map((x) => x.trim()).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "";
}
