"use client";

// BakeBot chat (spec 7.4): disclosure first (REQ-21), "Talk to Kaydee" on
// every screen (REQ-23), switch to the order form when BakeBot cannot answer
// in time (REQ-24). Short messages only, to save data.

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { Sparkle } from "@/components/kd/sparkle";
import { newOrderIdentity } from "@/lib/orders/identity";
import { whatsAppLink } from "@/lib/site";

export const OPEN_CHAT_EVENT = "kdpops:open-chat";

type Line = { role: "bot" | "customer"; text: string };
type Session = { conversation_id: string; token: string };

const SESSION_KEY = "kdpops-chat";

function loadSession(): Session {
  try {
    const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "null");
    if (saved?.conversation_id && saved?.token) return saved;
  } catch {}
  const { order_id, access_token } = newOrderIdentity();
  const session = { conversation_id: order_id, token: access_token };
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {}
  return session;
}

export function openChat() {
  window.dispatchEvent(new Event(OPEN_CHAT_EVENT));
}

export function ChatWidget() {
  const { messages: dict, language } = useI18n();
  const m = dict.chat;
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [needsContact, setNeedsContact] = useState(false);
  const [fallbackNotice, setFallbackNotice] = useState(false);
  const session = useRef<Session | null>(null);
  const started = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  const call = useCallback(
    async (body: Record<string, string>) => {
      session.current ??= loadSession();
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...session.current, language, ...body }),
      });
      return response.json() as Promise<{
        reply?: string;
        fallback?: boolean;
        escalated?: boolean;
        needs_contact?: boolean;
        error?: string;
      }>;
    },
    [language],
  );

  // REQ-21: the disclosure is the first message of every new session.
  const start = useCallback(() => {
    setOpen(true);
    if (started.current) return;
    started.current = true;
    setLines([{ role: "bot", text: m.disclosure }]);
    void call({ action: "start" }).catch(() => {});
  }, [call, m.disclosure]);

  useEffect(() => {
    window.addEventListener(OPEN_CHAT_EVENT, start);
    return () => window.removeEventListener(OPEN_CHAT_EVENT, start);
  }, [start]);

  useEffect(() => {
    if (open) input.current?.focus();
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [open, lines, needsContact]);

  const goToOrderForm = () => {
    setOpen(false);
    setFallbackNotice(true);
    document.getElementById("order")?.scrollIntoView({ behavior: "smooth" });
    window.setTimeout(() => setFallbackNotice(false), 10000);
  };

  const handle = (data: Awaited<ReturnType<typeof call>>) => {
    if (data.reply) setLines((l) => [...l, { role: "bot", text: data.reply! }]);
    if (data.needs_contact) setNeedsContact(true);
    if (data.fallback) goToOrderForm(); // REQ-24
  };

  const ask = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    setDraft("");
    setLines((l) => [...l, { role: "customer", text }]);
    setBusy(true);
    try {
      handle(await call({ action: "ask", text }));
    } catch {
      handle({ reply: m.fallback, fallback: true });
    } finally {
      setBusy(false);
    }
  };

  const talkToKaydee = async () => {
    if (busy) return;
    setLines((l) => [...l, { role: "customer", text: m.talk }]);
    setBusy(true);
    try {
      handle(await call({ action: "human" }));
    } catch {
      setLines((l) => [...l, { role: "bot", text: m.error }]);
    } finally {
      setBusy(false);
    }
  };

  const sendContact = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const data = await call({ action: "contact", name: String(form.get("name") ?? ""), phone: String(form.get("phone") ?? "") });
      if (data.error === "invalid_phone") {
        setLines((l) => [...l, { role: "bot", text: dict.errors.phoneInvalid }]);
      } else {
        setNeedsContact(false);
        handle(data);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {fallbackNotice && (
        <div className="chat-toast" role="status">
          <p className="m-0">{m.fallback}</p>
          {whatsAppLink && (
            <a className="pill pill-small" href={whatsAppLink} target="_blank" rel="noopener noreferrer">
              {m.talk}
            </a>
          )}
        </div>
      )}

      {open && (
        <div className="chat-panel" role="dialog" aria-modal="false" aria-labelledby="chat-title" onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
          <header className="chat-header">
            <h2 id="chat-title" className="font-display">
              <Sparkle filled className="w-5 text-kd-yellow" /> {m.title}
            </h2>
            <button type="button" className="chat-close" aria-label={m.close} onClick={() => setOpen(false)}>
              ×
            </button>
          </header>

          <div className="chat-lines" ref={list} aria-live="polite">
            {lines.map((line, i) => (
              <p key={i} className={line.role === "bot" ? "chat-line chat-bot" : "chat-line chat-customer"}>
                <span className="sr-only">{line.role === "bot" ? `${m.title}: ` : `${m.you}: `}</span>
                {line.text}
              </p>
            ))}
            {busy && <p className="chat-line chat-bot form-note">{m.thinking}</p>}

            {needsContact && (
              <form className="chat-contact stack" onSubmit={sendContact}>
                <p className="m-0">{m.contactPrompt}</p>
                <input className="input" name="name" autoComplete="name" placeholder={m.contactName} aria-label={m.contactName} maxLength={100} />
                <input className="input" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder={m.contactPhone} aria-label={m.contactPhone} required />
                <button className="pill pill-small" disabled={busy}>
                  {m.contactSave}
                </button>
              </form>
            )}
          </div>

          <div className="chat-footer">
            {/* REQ-23: always visible */}
            <button type="button" className="pill pill-small pill-outline chat-talk" onClick={talkToKaydee} disabled={busy}>
              {m.talk}
            </button>
            <form className="chat-input" onSubmit={ask}>
              <input
                ref={input}
                className="input"
                value={draft}
                maxLength={500}
                placeholder={m.placeholder}
                aria-label={m.placeholder}
                onChange={(e) => setDraft(e.target.value)}
              />
              <button className="pill pill-small" disabled={busy || !draft.trim()}>
                {m.send}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

/** "Ask BakeBot" button; opens the chat from anywhere on the page. */
export function AskBakeBotButton({ className = "pill pill-outline" }: { className?: string }) {
  const { messages: m } = useI18n();
  return (
    <button type="button" className={className} onClick={openChat}>
      {m.chat.open}
    </button>
  );
}
