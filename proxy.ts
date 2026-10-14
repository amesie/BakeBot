import { updateSession } from "@/lib/supabase/proxy";
import { type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

// Only staff pages need a session. Customer pages and API routes stay public;
// API routes check their own access (access token, CRON_SECRET or staff role).
export const config = {
  matcher: ["/dashboard/:path*"],
};
