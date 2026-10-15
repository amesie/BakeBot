// POST /api/cron/delete-proofs: called by pg_cron + pg_net at 02:00 SAST
// (spec 7.6). Deletes proof-of-payment files 30 days after payment, files of
// anonymised customers, and files no payment points to (D-055). Storage only
// allows deleting files the database marks as due, and only with the shared
// CRON_SECRET can the list of due files be read.
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAnonClient } from "@/lib/supabase/anon";

function sameSecret(given: string | null, expected: string | undefined) {
  if (!given || !expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!sameSecret(request.headers.get("x-cron-secret"), secret)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const supabase = createAnonClient();
  const due = await supabase.rpc("due_proof_paths", { p_secret: secret });
  if (due.error) return NextResponse.json({ error: due.error.message }, { status: 500 });

  const paths = (due.data ?? []) as string[];
  const deleted: string[] = [];
  for (let i = 0; i < paths.length; i += 100) {
    const { data, error } = await supabase.storage.from("payment-proofs").remove(paths.slice(i, i + 100));
    if (error) console.error("proof deletion failed", error.message);
    deleted.push(...(data ?? []).map((file) => file.name));
  }

  const done = await supabase.rpc("proofs_deleted", { p_secret: secret, p_paths: deleted });
  if (done.error) return NextResponse.json({ error: done.error.message }, { status: 500 });
  return NextResponse.json({ due: paths.length, deleted: deleted.length });
}
