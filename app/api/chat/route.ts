// POST /api/chat: BakeBot (spec 7.4, REQ-21 to REQ-24).
// Body: { conversation_id, token, language, action, text?, name?, phone? }
//   action "start"   -> logs the disclosure (REQ-21), returns it
//   action "ask"     -> answers from approved FAQ answers, or "check with
//                       Kaydee"; 2 unresolved -> handover; slow/error -> fallback
//   action "human"   -> handover on request (REQ-23)
//   action "contact" -> customer leaves name + number for Kaydee's reply
// Every customer and BakeBot message is logged (100%, AI transparency NFR).
import { NextResponse } from "next/server";
import { z } from "zod";
import { handleQuestion, MAX_QUESTION_LENGTH } from "@/lib/chat/engine";
import { geminiChatModel } from "@/lib/chat/gemini";
import { formatRand } from "@/lib/format";
import { dictionaries, isLanguage } from "@/lib/i18n";
import { getMenu } from "@/lib/menu";
import { getOrderOptions } from "@/lib/order-options";
import { createAnonClient } from "@/lib/supabase/anon";
import { logError } from "@/lib/log-error";

const noStore = { "Cache-Control": "no-store" };

const schema = z.object({
  conversation_id: z.uuid(),
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  language: z.string().refine(isLanguage),
  action: z.enum(["start", "ask", "human", "contact"]),
  text: z.string().trim().min(1).max(MAX_QUESTION_LENGTH).optional(),
  name: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(20).optional(),
});

type Message = { role: "bot" | "customer" | "system"; text: string; at: string };

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 422, headers: noStore });
  const { conversation_id, token, action, text } = parsed.data;
  const language = parsed.data.language as "en" | "xh" | "af";
  const m = dictionaries[language].chat;
  const supabase = createAnonClient();
  const now = () => new Date().toISOString();

  const log = async (messages: Message[], extra: { unresolved?: number; escalate?: boolean; fallback?: boolean } = {}) => {
    const { data, error } = await supabase.rpc("chat_append", {
      p_conversation_id: conversation_id,
      p_token: token,
      p_language: language,
      p_messages: messages,
      p_unresolved_delta: extra.unresolved ?? 0,
      p_escalate: extra.escalate ?? false,
      p_fallback: extra.fallback ?? false,
    });
    if (error) throw new Error(error.message);
    return data as { unresolved_attempts: number; escalated: boolean; has_contact: boolean };
  };

  try {
    if (action === "start") {
      await log([{ role: "bot", text: m.disclosure, at: now() }]);
      return NextResponse.json({ reply: m.disclosure }, { headers: noStore });
    }

    if (action === "contact") {
      const { error } = await supabase.rpc("chat_set_contact", {
        p_conversation_id: conversation_id,
        p_token: token,
        p_name: parsed.data.name ?? "",
        p_phone: parsed.data.phone ?? "",
      });
      if (error) {
        const status = error.message === "invalid_phone" ? 422 : 404;
        return NextResponse.json({ error: error.message }, { status, headers: noStore });
      }
      await log([{ role: "system", text: "Customer left contact details for Kaydee.", at: now() }]);
      return NextResponse.json({ reply: m.contactThanks }, { headers: noStore });
    }

    if (action === "human") {
      const state = await log([{ role: "customer", text: "[Talk to Kaydee]", at: now() }, { role: "bot", text: m.handover, at: now() }], {
        escalate: true,
      });
      return NextResponse.json({ reply: m.handover, escalated: true, needs_contact: !state.has_contact }, { headers: noStore });
    }

    // action === "ask"
    if (!text) return NextResponse.json({ error: "invalid" }, { status: 422, headers: noStore });
    const [menu, options] = await Promise.all([getMenu(), getOrderOptions()]);
    const menuText = menu.map((item) => `${item.flavour} ${formatRand(item.unit_price)}`).join(", ");

    const outcome = await handleQuestion(text, language, {
      model: geminiChatModel(),
      matchFaq: async (embedding, lang) => {
        const { data, error } = await supabase.rpc("match_faq", {
          p_embedding: JSON.stringify(embedding),
          p_language: lang,
          p_limit: 3,
        });
        if (error) throw new Error(error.message);
        return data ?? [];
      },
      fill: (answer) => answer.replaceAll("{menu}", menuText).replaceAll("{place}", options.collection_place || "school"),
    });

    const asked: Message = { role: "customer", text, at: now() };

    if (outcome.kind === "fallback") {
      await log([asked, { role: "system", text: `Fallback to order form (${outcome.reason}).`, at: now() }], { fallback: true });
      return NextResponse.json({ reply: m.fallback, fallback: true }, { headers: noStore });
    }

    if (outcome.kind === "answer") {
      await log([asked, { role: "bot", text: outcome.text, at: now() }]);
      return NextResponse.json({ reply: outcome.text }, { headers: noStore });
    }

    if (outcome.kind === "human") {
      const state = await log([asked, { role: "bot", text: m.handover, at: now() }], { escalate: true });
      return NextResponse.json({ reply: m.handover, escalated: true, needs_contact: !state.has_contact }, { headers: noStore });
    }

    // Unresolved: "I'll check with Kaydee"; the second one hands over (REQ-23).
    const before = await log([asked], { unresolved: 1 });
    const escalate = before.unresolved_attempts >= 2;
    const reply = escalate ? `${m.checkWithKaydee} ${m.handover}` : m.checkWithKaydee;
    const state = await log([{ role: "bot", text: reply, at: now() }], { escalate });
    return NextResponse.json(
      { reply, escalated: state.escalated, needs_contact: state.escalated && !state.has_contact },
      { headers: noStore },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "error";
    if (message === "too_long") return NextResponse.json({ reply: m.limit, fallback: true }, { headers: noStore });
    if (message === "not_found") return NextResponse.json({ error: "not_found" }, { status: 404, headers: noStore });
    await logError("chat", message, { action });
    // Anything unexpected: send the customer to the order form (REQ-24).
    return NextResponse.json({ reply: m.fallback, fallback: true }, { headers: noStore });
  }
}
