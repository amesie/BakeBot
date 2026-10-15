// POST /api/cron/check-email: called by pg_cron + pg_net every 10 minutes
// (05:00-20:59 SAST). Reads new emails in the KD Pops inbox over IMAP and
// attaches proofs of payment to orders by the reference in the subject
// (D-069). Matched emails go to the Bin (Gmail empties it after 30 days);
// unmatched ones get the "BakeBot/Unmatched" label and are flagged to Kaydee.
// An emailed proof only sets "pending review": Kaydee still checks the bank.
import { timingSafeEqual } from "node:crypto";
import { ImapFlow } from "imapflow";
import { NextResponse } from "next/server";
import { findReference, pickAttachment, MAX_PROOF_BYTES, type BodyPart } from "@/lib/email/proof-email";
import { logError } from "@/lib/log-error";
import { createAnonClient } from "@/lib/supabase/anon";

export const maxDuration = 60;

const MAX_PER_RUN = 15;
const TIME_BUDGET_MS = 40_000;
const UNMATCHED_FOLDER = "BakeBot/Unmatched";
const BIN = "[Gmail]/Trash";

function sameSecret(given: string | null, expected: string | undefined) {
  if (!given || !expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function toBuffer(stream: NodeJS.ReadableStream, limit: number) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of stream) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
    size += buf.length;
    if (size > limit) throw new Error("too_large");
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!sameSecret(request.headers.get("x-cron-secret"), secret)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const user = process.env.GMAIL_USER || "thebakebot@gmail.com";
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!pass) return NextResponse.json({ skipped: "GMAIL_APP_PASSWORD not set" });

  const supabase = createAnonClient();
  const started = Date.now();
  let seen = 0;
  let matched = 0;
  let unmatched = 0;

  const flag = async (subject: string, reason: string, receivedAt: Date | undefined) => {
    unmatched++;
    await supabase.rpc("flag_unmatched_email", {
      p_secret: secret,
      p_subject: subject,
      p_reason: reason,
      p_received_at: (receivedAt ?? new Date()).toISOString(),
    });
  };

  const client = new ImapFlow({ host: "imap.gmail.com", port: 993, secure: true, auth: { user, pass }, logger: false });
  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      const uids = ((await client.search({ seen: false }, { uid: true })) || []).slice(0, MAX_PER_RUN);
      if (uids.length) {
        const existing = await client.list();
        if (!existing.some((box) => box.path === UNMATCHED_FOLDER)) await client.mailboxCreate(UNMATCHED_FOLDER);
      }
      const messages = uids.length
        ? await client.fetchAll(uids, { uid: true, envelope: true, bodyStructure: true, internalDate: true }, { uid: true })
        : [];

      for (const message of messages) {
        if (Date.now() - started > TIME_BUDGET_MS) break;
        seen++;
        const subject = message.envelope?.subject ?? "";
        const received = message.internalDate instanceof Date ? message.internalDate : undefined;
        const reference = findReference(subject);
        const attachment = pickAttachment(message.bodyStructure as BodyPart | undefined);

        let outcome: "matched" | string;
        if (!reference) outcome = "no_reference";
        else if ("reason" in attachment) outcome = attachment.reason;
        else {
          const start = await supabase.rpc("start_emailed_proof", {
            p_secret: secret,
            p_reference: reference,
            p_extension: attachment.extension,
          });
          if (start.error) outcome = start.error.message; // not_found, not_approved, already_paid
          else {
            try {
              const download = await client.download(String(message.uid), attachment.part, { uid: true });
              if (!("content" in download) || !download.content) throw new Error("download_failed");
              const file = await toBuffer(download.content, MAX_PROOF_BYTES);
              const upload = await supabase.storage
                .from("payment-proofs")
                .upload(start.data as string, file, { contentType: attachment.type, upsert: false });
              if (upload.error) throw new Error(`upload: ${upload.error.message}`);
              const finish = await supabase.rpc("finish_emailed_proof", {
                p_secret: secret,
                p_reference: reference,
                p_path: start.data,
              });
              if (finish.error) throw new Error(`finish: ${finish.error.message}`);
              outcome = "matched";
            } catch (error) {
              const message = error instanceof Error ? error.message : "error";
              outcome = message === "too_large" ? "too_large" : "error";
              if (outcome === "error") await logError("cron/check-email", message);
            }
          }
        }

        await client.messageFlagsAdd(String(message.uid), ["\Seen"], { uid: true });
        if (outcome === "matched") {
          matched++;
          await client.messageMove(String(message.uid), BIN, { uid: true });
        } else {
          await flag(subject, outcome, received);
          await client.messageMove(String(message.uid), UNMATCHED_FOLDER, { uid: true });
        }
      }
    } finally {
      lock.release();
    }
    await client.logout();
    if (seen > 0) {
      await supabase.rpc("email_check_done", { p_secret: secret, p_seen: seen, p_matched: matched, p_unmatched: unmatched });
    }
    return NextResponse.json({ seen, matched, unmatched });
  } catch (error) {
    const message = error instanceof Error ? error.message : "error";
    await logError("cron/check-email", message);
    await supabase.rpc("email_check_done", {
      p_secret: secret, p_seen: seen, p_matched: matched, p_unmatched: unmatched, p_error: message,
    });
    try {
      await client.logout();
    } catch {}
    return NextResponse.json({ error: "imap_failed" }, { status: 502 });
  }
}
