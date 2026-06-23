import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/data/database.types";

/**
 * Browser Supabase client (spec section 2.2 / 5). Returns null when the
 * environment is not configured, so the app cleanly falls back to the
 * local-first store. Wire it up by setting:
 *
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 */
export function getSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  return createBrowserClient<Database>(url, anon);
}

/** True when remote sync is available; the app runs local-only otherwise. */
export function isRemoteConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
