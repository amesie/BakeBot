// POST /api/payments/proof (spec 7.3, REQ-15): customer uploads proof of
// payment from their status page. multipart/form-data: order_number, token,
// file (image or PDF, 4 MB max; the page shrinks photos first).
//
// Uses only the public key: start_proof_upload() checks the token and that
// the order is approved and unpaid, and grants one private path; the storage
// policy allows that path only; finish_proof_upload() links it (D-050).
import { NextResponse } from "next/server";
import { createAnonClient } from "@/lib/supabase/anon";
import { logError } from "@/lib/log-error";

const noStore = { "Cache-Control": "no-store" };
const MAX_BYTES = 4 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

const reply = (error: string, status: number) => NextResponse.json({ error }, { status, headers: noStore });

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return reply("bad_request", 400);
  }
  const orderNumber = String(form.get("order_number") ?? "");
  const token = String(form.get("token") ?? "");
  const file = form.get("file");

  if (!(file instanceof File) || file.size === 0) return reply("no_file", 422);
  if (file.size > MAX_BYTES) return reply("too_large", 413);
  const extension = EXTENSIONS[file.type];
  if (!extension) return reply("bad_type", 415);

  const supabase = createAnonClient();
  const start = await supabase.rpc("start_proof_upload", {
    p_order_number: orderNumber,
    p_token: token,
    p_extension: extension,
  });
  if (start.error) {
    const known = ["not_found", "not_approved", "already_paid", "bad_type"];
    const code = known.includes(start.error.message) ? start.error.message : "unavailable";
    if (code === "unavailable") await logError("payments/proof", `start: ${start.error.message}`);
    return reply(code, code === "not_found" ? 404 : code === "unavailable" ? 503 : 409);
  }

  const path = start.data as string;
  const upload = await supabase.storage
    .from("payment-proofs")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upload.error) {
    await logError("payments/proof", `upload: ${upload.error.message}`);
    return reply("unavailable", 503);
  }

  const finish = await supabase.rpc("finish_proof_upload", {
    p_order_number: orderNumber,
    p_token: token,
    p_path: path,
  });
  if (finish.error) {
    await logError("payments/proof", `finish: ${finish.error.message}`);
    return reply("unavailable", 503);
  }
  return NextResponse.json(finish.data, { headers: noStore });
}
