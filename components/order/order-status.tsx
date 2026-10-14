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
import { whatsAppLink } from "@/lib/site";

type Load =
  | { state: "loading" }
  | { state: "not_found" }
  | { state: "unavailable" }
  | { state: "ready"; order: OrderSummary };

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
          setLoad({ state: "ready", order });
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
        {load.state === "ready" && <OrderDetails m={m} order={load.order} />}

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

function OrderDetails({ m, order }: { m: Messages; order: OrderSummary }) {
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
              {m.status.bank}: {order.bank_details}
            </small>
          )}
        </div>
        <p className="form-note">
          {m.status.phone}: {order.phone_masked}
        </p>
      </div>

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
                  {template ? format(template, message.params ?? {}) : message.template}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
