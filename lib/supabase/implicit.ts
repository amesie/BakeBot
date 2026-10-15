import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Client for sending password-reset emails whose links work in any browser.
 * The default (PKCE) link only works in the browser that asked for it, which
 * fails when the email is opened in the Gmail app. These links carry the
 * session in the URL fragment and are finished by /auth/callback.
 */
export function createImplicitClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );
}
