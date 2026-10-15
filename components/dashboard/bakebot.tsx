"use client";

// Kaydee's BakeBot tools: handover inbox and weekly chat review (REQ-23,
// AI transparency NFR), and the approved-answer editor (REQ-22).

import { deleteFaq, reembedAllFaqs, resolveConversation, saveFaq } from "@/app/dashboard/actions";
import type { Conversation, Faq } from "@/lib/dashboard/data";
import { formatDay, sastDate } from "@/lib/dates";
import { dictionaries } from "@/lib/i18n";
import { ActionForm, WhatsAppLinks } from "./action-form";

const en = dictionaries.en;
const when = (iso: string) =>
  `${formatDay(sastDate(iso), en)} ${new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit" }).format(new Date(iso))}`;

function Transcript({ conversation }: { conversation: Conversation }) {
  return (
    <ol className="m-0 stack" style={{ listStyle: "none", padding: 0, gap: 6 }}>
      {conversation.messages.map((message, i) => (
        <li key={i} className={message.role === "customer" ? "chat-line chat-customer" : "chat-line chat-bot"} style={{ maxWidth: "100%" }}>
          <span className="form-note" style={{ display: "block", color: "inherit", opacity: 0.8 }}>
            {message.role === "customer" ? "Customer" : message.role === "bot" ? "BakeBot" : "System"}
          </span>
          {message.text}
        </li>
      ))}
    </ol>
  );
}

function replyLink(conversation: Conversation) {
  if (!conversation.contact_phone) return null;
  const lastQuestion = [...conversation.messages].reverse().find((m) => m.role === "customer" && !m.text.startsWith("["));
  const name = conversation.contact_name ? ` ${conversation.contact_name}` : "";
  const text = `Hi${name}, it's Kaydee from KD Pops about your question${lastQuestion ? `: "${lastQuestion.text}"` : ""}. `;
  return `https://wa.me/${conversation.contact_phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

export function InboxPanel({ handovers, recent }: { handovers: Conversation[]; recent: Conversation[] }) {
  return (
    <div className="stack" style={{ gap: 28 }}>
      <section className="stack">
        <h2 className="font-display" style={{ fontSize: 22, margin: 0 }}>Waiting for you ({handovers.length})</h2>
        <p className="form-note m-0">
          Customers who asked for you, or whose question BakeBot could not answer twice.
        </p>
        {handovers.length === 0 && <p className="kd-card form-note">No questions waiting.</p>}
        {handovers.map((c) => {
          const link = replyLink(c);
          return (
            <article key={c.conversation_id} className="kd-card stack" style={{ padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <b>{c.contact_name ?? "Customer"}{c.contact_phone ? ` · ${c.contact_phone}` : " · no number left"}</b>
                <span className="form-note">Handed over {c.escalated_at ? when(c.escalated_at) : ""}</span>
              </div>
              <Transcript conversation={c} />
              <div className="actions-row" style={{ marginTop: 0 }}>
                {link && <WhatsAppLinks links={[{ label: `Reply on WhatsApp`, href: link }]} />}
                <ActionForm action={resolveConversation}>
                  {(pending) => (
                    <>
                      <input type="hidden" name="conversation_id" value={c.conversation_id} />
                      <button className="pill pill-small pill-outline" disabled={pending}>
                        Mark as dealt with
                      </button>
                    </>
                  )}
                </ActionForm>
              </div>
            </article>
          );
        })}
      </section>

      <section className="stack">
        <h2 className="font-display" style={{ fontSize: 22, margin: 0 }}>This week&apos;s chats (review)</h2>
        <p className="form-note m-0">
          The 10 most recent chats. Check that BakeBot only says what you approved. Chats are deleted after 30 days.
        </p>
        {recent.length === 0 && <p className="kd-card form-note">No chats this week.</p>}
        {recent.map((c) => (
          <details key={c.conversation_id} className="kd-card" style={{ padding: 16 }}>
            <summary style={{ cursor: "pointer", minHeight: 44, display: "flex", alignItems: "center" }}>
              {when(c.created_at)} · {c.messages.filter((m) => m.role === "customer").length} questions ·{" "}
              {c.language.toUpperCase()}
              {c.escalated ? " · handed over" : ""}
              {c.fallback_count ? ` · ${c.fallback_count} fallback` : ""}
            </summary>
            <div style={{ marginTop: 12 }}>
              <Transcript conversation={c} />
            </div>
          </details>
        ))}
      </section>
    </div>
  );
}

const CATEGORIES = ["pricing", "discounts", "allergens", "other"] as const;

function FaqForm({ faq }: { faq?: Faq }) {
  return (
    <ActionForm action={saveFaq}>
      {(pending) => (
        <div className="stack" style={{ gap: 10 }}>
          {faq && <input type="hidden" name="faq_id" value={faq.faq_id} />}
          <label className="field">
            Question(s) customers might ask
            <input className="input" name="question" defaultValue={faq?.question} required maxLength={500} />
          </label>
          <label className="field">
            Approved answer (use {"{menu}"} for the live menu and prices, {"{place}"} for the collection place)
            <textarea className="input" name="approved_answer" rows={3} defaultValue={faq?.approved_answer} required maxLength={1500} />
          </label>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
            <label className="field">
              Topic
              <select className="input" name="category" defaultValue={faq?.category ?? "other"}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="field">
              Language
              <select className="input" name="language" defaultValue={faq?.language ?? "en"}>
                <option value="en">English</option>
                <option value="xh">isiXhosa</option>
                <option value="af">Afrikaans</option>
              </select>
            </label>
            <label className="choice">
              <input type="checkbox" name="is_active" defaultChecked={faq?.is_active ?? true} />
              BakeBot may use this
            </label>
            <button className="pill pill-small" disabled={pending}>
              {pending ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}
    </ActionForm>
  );
}

export function FaqPanel({ faqs }: { faqs: Faq[] }) {
  const missing = faqs.filter((f) => f.is_active && !f.has_embedding).length;
  return (
    <div className="stack" style={{ gap: 24 }}>
      <p className="notice m-0">
        BakeBot only answers with what you write here. If nothing here matches a question, it says it will check with
        you. It never makes up prices, discounts or allergen information.
      </p>
      {missing > 0 && (
        <ActionForm action={reembedAllFaqs} className="kd-card">
          {(pending) => (
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <p className="m-0" style={{ flex: 1 }}>
                {missing} answer{missing === 1 ? " is" : "s are"} not searchable yet (needs the Gemini key).
              </p>
              <button className="pill pill-small" disabled={pending}>
                {pending ? "Working..." : "Make all searchable"}
              </button>
            </div>
          )}
        </ActionForm>
      )}
      {faqs.map((faq) => (
        <article key={faq.faq_id} className="kd-card stack" style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <span className="status-pill" style={{ fontSize: 12 }}>
              {faq.category} · {faq.language.toUpperCase()} · {faq.is_active ? "on" : "off"}
            </span>
            <ActionForm action={deleteFaq} confirm="Delete this answer?">
              {(pending) => (
                <>
                  <input type="hidden" name="faq_id" value={faq.faq_id} />
                  <button className="pill pill-small pill-outline" disabled={pending}>Delete</button>
                </>
              )}
            </ActionForm>
          </div>
          <FaqForm faq={faq} />
        </article>
      ))}
      <section className="kd-card stack">
        <h3>Add an answer</h3>
        <FaqForm />
      </section>
    </div>
  );
}
