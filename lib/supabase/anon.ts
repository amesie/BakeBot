import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side client with the public (publishable) key and no user session.
 * Can only call the functions granted to anon (health_check, get_menu, ...);
 * it has no direct table access (see supabase/migrations/*_rls.sql).
 */
export function createAnonClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
