"use client";

import Link from "next/link";
// The customer's private status page (gap 4, D-028). The token is read from
// the URL fragment and posted to /api/orders/status, so it never reaches the
// server in a URL. Shows the in-app messages that stand in for WhatsApp until
// Meta approval (spec 7.5).

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { Sparkle } from "@/components/kd/sparkle";
import { formatDay, sastDate } from "@/lib/dates";
import { formatRand } from "@/lib/format";
import { format, type Messages } from "@/lib/i18n";
import { rememberOrder, type OrderSummary } from "@/lib/orders/client";
import { compressImage } from "@/lib/compress-image";
import { whatsAppLink } from "@/lib/site";

type Load =
  | { state: "loading" }
  | { state: "not_found" }
  | { state: "unavailable" }
  | { state: "ready"; order: OrderSummary; token: string };

const STEPS = ["pending", "confirmed", "baking", "ready", "collected"] as const;

export function OrderStatus() {
  const { messages: m } = useI18n();
  const params = useParams<{ orderNumber: string }>();
  const orderNumber = decodeURIComponent(params.orderNumber ?? "");
  const [load, setLoad] = useState<Load>({ state: "loading" });

  useEffect(() => {
    const token = window.location.hash.slice(1);
    let cancelled = false;
    fetch("/api/orders/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_number: orderNumber, token }),
    })
      .then(async (response) => {
        if (cancelled) return;
        if (response.ok) {
          const order: OrderSummary = await response.json();
          rememberOrder(order.order_number, token);
          setLoad({ state: "ready", order, token });
        } else {
          setLoad({ state: response.status === 404 ? "not_found" : "unavailable" });
        }
      })
      .catch(() => !cancelled && setLoad({ state: "unavailable" }));
    return () => {
      cancelled = true;
    };
  }, [orderNumber]);

  return (
    <main id="main" className="order-section" style={{ minHeight: "70vh" }}>
      <div className="container-kd" style={{ maxWidth: 760 }}>
        <p className="eyebrow">{m.status.title}</p>
        <h1 className="font-display" style={{ fontSize: "clamp(36px, 8vw, 56px)", margin: "0 0 24px" }}>
          {orderNumber}
        </h1>

        {load.state === "loading" && <p className="kd-card">{m.status.loading}</p>}
        {load.state === "not_found" && <p className="kd-card">{m.status.notFound}</p>}
        {load.state === "unavailable" && <p className="kd-card">{m.status.unavailable}</p>}
        {load.state === "ready" && (
          <OrderDetails
            m={m}
            order={load.order}
            token={load.token}
            onUpdate={(order) => setLoad({ state: "ready", order: { ...load.order, ...order }, token: load.token })}
          />
        )}

        <div className="actions-row">
          {whatsAppLink && (
            <a className="pill" href={whatsAppLink} target="_blank" rel="noopener noreferrer">
              {m.status.talk}
            </a>
          )}
          <Link className="pill pill-outline" href="/">
            {m.status.backHome}
          </Link>
        </div>
      </div>
    </main>
  );
}

function OrderDetails({
  m,
  order,
  token,
  onUpdate,
}: {
  m: Messages;
  order: OrderSummary;
  token: string;
  onUpdate: (order: OrderSummary) => void;
}) {
  const reached = STEPS.indexOf(order.order_status as (typeof STEPS)[number]);
  const showProgress = reached >= 0;

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="kd-card stack">
        <p style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{format(m.status.hello, { name: order.first_name })}</p>
        <p style={{ margin: 0 }}>
          <span className="status-pill">{m.status.label[order.order_status]}</span>
        </p>
        {showProgress && (
          <ol className="status-steps" aria-label={m.status.progress}>
            {STEPS.map((step, i) => (
              <li key={step} data-done={i <= reached} aria-current={i === reached ? "step" : undefined}>
                {m.status.steps[step]}
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="kd-card">
        <h2 className="font-display" style={{ fontSize: 22, margin: "0 0 8px" }}>{m.status.items}</h2>
        <div className="success-recap" style={{ marginTop: 0, maxWidth: "none" }}>
          {order.items.map((item) => (
            <div key={item.flavour}>
              <span>
                {item.quantity} × {item.flavour}
              </span>
              <strong>{formatRand(item.line_total)}</strong>
            </div>
          ))}
          <div className="success-total">
            <span>{m.status.total}</span>
            <strong>
              {order.is_large_order && order.quote_amount === null ? m.status.quoteWaiting : formatRand(order.total_amount)}
            </strong>
          </div>
        </div>

        <div className="collection-ticket" style={{ maxWidth: "none" }}>
          <span>{m.status.collection}</span>
          <strong>
            {formatDay(order.revised_collection_date ?? order.collection_date, m)} · {m.slots[order.collection_slot]}
          </strong>
          {order.revised_collection_date && (
            <small>
              {m.status.revised}: {formatDay(order.revised_collection_date, m)}
            </small>
          )}
          {order.collection_place && (
            <small>
              {m.status.place}: {order.collection_place}
            </small>
          )}
        </div>

        <div className="collection-ticket" style={{ maxWidth: "none", marginTop: 0 }}>
          <span>{m.status.payment}</span>
          <strong>
            {m.payment[order.payment_method]} · {m.status.paymentLabel[order.payment_status]}
          </strong>
          {order.payment_reference && (
            <small>
              {m.status.reference}: <b>{order.payment_reference}</b>
            </small>
          )}
          {order.payment_method === "eft" && order.payment_reference && <small>{m.status.useReference}</small>}
          {order.bank_details && (
            <small>
              {m.status.bank}:<br />
              <span style={{ whiteSpace: "pre-line" }}>{order.bank_details}</span>
            </small>
          )}
        </div>
        <p className="form-note">
          {m.status.phone}: {order.phone_masked}
        </p>
        {order.payment_reference && (
          // REQ-14: invoice PDF; the token goes in the request body, not the URL.
          <form method="post" action="/api/orders/invoice">
            <input type="hidden" name="order_number" value={order.order_number} />
            <input type="hidden" name="token" value={token} />
            <button className="pill pill-small pill-outline">{m.status.invoice}</button>
          </form>
        )}
      </div>

      {order.payment_method === "eft" && order.payment_reference && order.payment_status !== "paid" && (
        <ProofUpload m={m} order={order} token={token} onUpdate={onUpdate} />
      )}

      {order.can_give_feedback && <FeedbackForm m={m} order={order} token={token} />}

      {order.messages.length > 0 && (
        <div className="kd-card">
          <h2 className="font-display" style={{ fontSize: 22, margin: "0 0 14px", display: "flex", gap: 10, alignItems: "center" }}>
            <Sparkle filled className="w-5 text-kd-orange" /> {m.status.updates}
          </h2>
          <ul className="message-list">
            {order.messages.map((message, i) => {
              const template = m.templates[message.template as keyof Messages["templates"]];
              return (
                <li key={i}>
                  <time dateTime={message.created_at}>{formatDay(sastDate(message.created_at), m)}</time>
                  {template ? format(template, readableParams(message.params ?? {}, m)) : message.template}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Turn stored message values (dates, slots, amounts) into words. */
function readableParams(params: Record<string, string>, m: Messages): Record<string, string> {
  const out = { ...params };
  if (params.date) out.date = formatDay(params.date, m);
  if (params.slot && params.slot in m.slots) out.slot = m.slots[params.slot as keyof Messages["slots"]];
  if (params.amount !== undefined) out.amount = formatRand(params.amount);
  return out;
}

// REQ-15: proof of payment for approved EFT orders.
function ProofUpload({
  m,
  order,
  token,
  onUpdate,
}: {
  m: Messages;
  order: OrderSummary;
  token: string;
  onUpdate: (order: OrderSummary) => void;
}) {
  const [state, setState] = useState<"idle" | "sending" | "done">(
    order.payment_status === "pending_review" ? "done" : "idle",
  );
  const [error, setError] = useState<string | null>(null);

  const send = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input = event.currentTarget.elements.namedItem("file") as HTMLInputElement;
    const original = input.files?.[0];
    if (!original) return setError(m.status.proofBadType);
    setError(null);
    setState("sending");

    const file = await compressImage(original);
    if (file.size > 4 * 1024 * 1024) {
      setState("idle");
      return setError(m.status.proofTooLarge);
    }
    const body = new FormData();
    body.set("order_number", order.order_number);
    body.set("token", token);
    body.set("file", file);
    try {
      const response = await fetch("/api/payments/proof", { method: "POST", body });
      if (response.ok) {
        onUpdate(await response.json());
        input.value = "";
        return setState("done");
      }
      const { error: code } = await response.json().catch(() => ({ error: "" }));
      setState("idle");
      setError(
        code === "too_large" ? m.status.proofTooLarge
        : code === "bad_type" ? m.status.proofBadType
        : code === "already_paid" ? m.status.proofPaid
        : m.status.proofFailed,
      );
    } catch {
      setState("idle");
      setError(m.status.proofFailed);
    }
  };

  return (
    <form className="kd-card stack" onSubmit={send}>
      <h2 className="font-display" style={{ fontSize: 22, margin: 0 }}>{m.status.proofTitle}</h2>
      {state === "done" ? (
        <>
          <p className="m-0" role="status">{m.status.proofDone}</p>
          <p className="form-note m-0">{m.status.proofAgain}</p>
        </>
      ) : (
        <p className="form-note m-0">{m.status.proofHint}</p>
      )}
      <div className="field">
        <label className="field-label" htmlFor="proof-file">{m.status.proofFile}</label>
        <input id="proof-file" name="file" className="input" type="file" accept="image/*,application/pdf" />
      </div>
      {error && <p className="field-error m-0" role="alert">{error}</p>}
      <div>
        <button className="pill pill-small" disabled={state === "sending"}>
          {state === "sending" ? m.status.proofSending : m.status.proofSend}
        </button>
      </div>
    </form>
  );
}

// REQ-26: taste, size and price, the day after collection.
function FeedbackForm({ m, order, token }: { m: Messages; order: OrderSummary; token: string }) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "failed">("idle");
  const scores = [
    ["rating", m.status.feedbackOverall],
    ["taste", m.status.feedbackTaste],
    ["size", m.status.feedbackSize],
    ["price", m.status.feedbackPrice],
  ] as const;

  const send = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const score = (name: string) => (form.get(name) ? Number(form.get(name)) : undefined);
    setState("sending");
    try {
      const response = await fetch("/api/orders/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_number: order.order_number,
          token,
          rating: score("rating"),
          taste: score("taste"),
          size: score("size"),
          price: score("price"),
          comment: String(form.get("comment") ?? "") || undefined,
        }),
      });
      setState(response.ok || response.status === 409 ? "done" : "failed");
    } catch {
      setState("failed");
    }
  };

  if (state === "done") {
    return (
      <p className="kd-card m-0" role="status">
        {m.status.feedbackThanks}
      </p>
    );
  }

  return (
    <form className="kd-card stack" onSubmit={send}>
      <h2 className="font-display" style={{ fontSize: 22, margin: 0 }}>{m.status.feedbackTitle}</h2>
      <p className="form-note m-0">{m.status.feedbackScale}</p>
      {scores.map(([name, label]) => (
        <fieldset key={name} style={{ border: 0, margin: 0, padding: 0 }}>
          <legend className="field-label" style={{ fontWeight: 700, marginBottom: 6 }}>{label}</legend>
          <div className="choice-row">
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} className="choice" style={{ minWidth: 52, justifyContent: "center" }}>
                <input type="radio" name={name} value={n} required={name === "rating"} />
                {n}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <div className="field">
        <label className="field-label" htmlFor="feedback-comment">{m.status.feedbackComment}</label>
        <textarea id="feedback-comment" name="comment" className="input" rows={3} maxLength={500} />
      </div>
      {state === "failed" && <p className="field-error m-0" role="alert">{m.status.feedbackFailed}</p>}
      <div>
        <button className="pill pill-small" disabled={state === "sending"}>
          {m.status.feedbackSend}
        </button>
      </div>
    </form>
  );
}
