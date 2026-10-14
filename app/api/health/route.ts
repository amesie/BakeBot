// Availability NFR: UptimeRobot pings this every 5 minutes. It runs a trivial
// database query, which also stops the free Supabase plan pausing the project.
import { connection, NextResponse } from "next/server";
import { createAnonClient } from "@/lib/supabase/anon";

export async function GET() {
  await connection(); // always run at request time, never cached

  const started = Date.now();
  const { data, error } = await createAnonClient().rpc("health_check");
  const latencyMs = Date.now() - started;

  if (error) {
    return NextResponse.json(
      { status: "error", db: "unreachable", latencyMs },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    { status: "ok", db: "ok", dbTime: data?.db_time, latencyMs },
    { headers: { "Cache-Control": "no-store" } },
  );
}
