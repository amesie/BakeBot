// Records a server error in error_log (M9) so Kaydee can see it on the
// dashboard's System tab, and in Vercel's logs. Pass codes and ids only,
// never names, phone numbers or message text (POPIA).
import { createAnonClient } from "@/lib/supabase/anon";

export async function logError(source: string, message: string, context?: Record<string, unknown>) {
  console.error(`[${source}]`, message, context ?? "");
  try {
    await createAnonClient().rpc("log_error", {
      p_source: `api:${source}`,
      p_message: message,
      p_context: context ?? null,
    });
  } catch {
    // Logging must never break the request.
  }
}
