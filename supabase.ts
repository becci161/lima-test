import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function supabaseAnon(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!url || !anon) throw new Error("NEXT_PUBLIC_SUPABASE_URL / ANON_KEY fehlt.");
  return createClient(url, anon);
}

export function supabaseService(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY fehlt.");
  return createClient(url, key, { auth: { persistSession: false } });
}

export type Departure = {
  trip_id: string;
  station_eva: string;
  category: string | null;
  train_number: string | null;
  planned_time: string | null;
  changed_time: string | null;
  delay_minutes: number | null;
  cancelled: boolean;
  platform: string | null;
  updated_at: string;
};
