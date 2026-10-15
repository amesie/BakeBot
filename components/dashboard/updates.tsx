"use client";

// M6 dashboard pieces: BakeBot's updates for Kaydee (REQ-11, REQ-18, REQ-20),
// payment reminder buttons (REQ-16), released orders, feedback (REQ-26) and
// POPIA deletion requests (spec 7.8).

import { useSyncExternalStore } from "react";
import { deleteCustomerData } from "@/app/dashboard/actions";
import { formatDay, sastDate } from "@/lib/dates";
import { formatRand } from "@/lib/format";
import { dictionaries } from "@/lib/i18n";
import { reminderWhatsAppLink } from "@/lib/dashboard/whatsapp";
import { orderTotal, type DashboardOrder, type FeedbackRow, type OwnerUpdate } from "@/lib/dashboard/types";
import { ActionForm, WhatsAppLinks } from "./action-form";

const en = dictionaries.en;
const day = (iso: string) => formatDay(iso, en);
const noSubscribe = () => () => {};

// ---------------------------------------------------------------- BakeBot updates

function describe(update: OwnerUpdate): React.ReactNode {
  const p = update.params as Record<string, never>;
  switch (update.template) {
    case "owner_daily_summary":
      return (
        <>
          <b>{p.pending} order{p.pending === 1 ? "" : "s"} waiting for you</b>
          {p.waitlisted ? `, ${p.waitlisted} on the waitlist` : ""}
          {p.needs_quote ? `, ${p.needs_quote} need${p.needs_quote === 1 ? "s" : ""} a quote` : ""} ({p.units} pops).
        </>
      );
    case "owner_batch_summary": {
      const flavours = (p.flavours ?? []) as { flavour: string; confirmed: number | null; pending: number | null }[];
      return (
        <>
          <b>Bake list for the week of {day(p.week)}: {p.total} pops</b>
          <ul className="m-0 pl-5">
            {flavours.map((f) => (
              <li key={f.flavour}>
                {f.flavour}: {f.confirmed ?? 0} confirmed{f.pending ? ` + ${f.pending} waiting for approval` : ""}
              </li>
            ))}
          </ul>
        </>
      );
    }
    case "owner_release_summary": {
      const waiting = (p.paid_uncollected ?? []) as string[];
      return (
        <>
          <b>
            {p.released} unpaid order{p.released === 1 ? "" : "s"} released for general sale.
          </b>
          {waiting.length > 0 && ` Paid but not collected (not released, customers reminded): ${waiting.join(", ")}.`}
        </>
      );
    }
    default:
      return update.template;
  }
}

export function OwnerUpdates({ updates }: { updates: OwnerUpdate[] }) {
  if (updates.length === 0) return null;
  return (
    <section className="kd-card stack" aria-label="BakeBot updates" style={{ padding: 20 }}>
      <h2 className="font-display" style={{ fontSize: 20, margin: 0 }}>BakeBot updates</h2>
      <ul className="message-list">
        {updates.map((u, i) => (
          <li key={i}>
            <time dateTime={u.created_at}>{day(sastDate(u.created_at))}</time>
            {describe(u)}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------- REQ-16 reminder button

export function ReminderNote({ order }: { order: DashboardOrder }) {
  const origin = useSyncExternalStore(noSubscribe, () => window.location.origin, () => null);
  const reminder = order.notifications.find((n) => n.template === "payment_reminder");
  if (!reminder || order.payment_method !== "eft") return null;
  const link = origin ? reminderWhatsAppLink(order, origin) : null;
  const name = order.customers?.full_name.split(" ")[0] ?? "customer";
  return (
    <div className="stack" style={{ gap: 4 }}>
      <p className="form-note m-0">BakeBot sent a payment reminder on {day(sastDate(reminder.created_at))} (status page).</p>
      {link && <WhatsAppLinks links={[{ label: `WhatsApp ${name}: reminder`, href: link }]} />}
    </div>
  );
}

// ---------------------------------------------------------------- REQ-20 released orders

export function ReleasedOrders({ orders }: { orders: DashboardOrder[] }) {
  if (orders.length === 0) return null;
  return (
    <section className="stack">
      <h2 className="font-display" style={{ fontSize: 22, margin: 0 }}>Released for general sale</h2>
      <p className="form-note m-0">
        Not paid by the last school day, so BakeBot released these and told the customers. Sell the pops to anyone.
      </p>
      <ul className="kd-card m-0 stack" style={{ listStyle: "none", padding: 20, gap: 8 }}>
        {orders.map((o) => (
          <li key={o.order_id} style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <span>
              <b>{o.order_number}</b> · {o.customers?.full_name} ·{" "}
              {o.order_items.map((i) => `${i.quantity} ${i.products?.flavour}`).join(", ")}
            </span>
            <b>{formatRand(orderTotal(o))}</b>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------- REQ-26 feedback

export function FeedbackPanel({ feedback }: { feedback: FeedbackRow[] }) {
  if (feedback.length === 0) {
    return <p className="kd-card form-note">No feedback yet. Customers are asked the day after they collect.</p>;
  }
  const average = (pick: (f: FeedbackRow) => number | null) => {
    const values = feedback.map(pick).filter((v): v is number => v !== null);
    return values.length ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1) : "-";
  };
  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="kd-card-dark">
        <p className="eyebrow" style={{ margin: 0, color: "var(--tan)" }}>Average out of 5 · {feedback.length} reviews</p>
        <ul className="summary-lines" style={{ minHeight: 0, marginTop: 14 }}>
          {(
            [
              ["Overall", average((f) => f.rating)],
              ["Taste", average((f) => f.taste_rating)],
              ["Size", average((f) => f.size_rating)],
              ["Price", average((f) => f.price_rating)],
            ] as const
          ).map(([label, value]) => (
            <li key={label} className="summary-line">
              <span>{label}</span>
              <strong>{value}</strong>
            </li>
          ))}
        </ul>
      </div>
      <ul className="m-0 stack" style={{ listStyle: "none", padding: 0 }}>
        {feedback.map((f, i) => (
          <li key={i} className="kd-card stack" style={{ padding: 16, gap: 4 }}>
            <span>
              <b>{"★".repeat(f.rating)}</b>
              <span className="sr-only">{f.rating} out of 5</span> · {f.orders?.order_number} · {f.orders?.customers?.full_name}
            </span>
            <span className="form-note">
              Taste {f.taste_rating ?? "-"} · Size {f.size_rating ?? "-"} · Price {f.price_rating ?? "-"} ·{" "}
              {day(sastDate(f.created_at))}
            </span>
            {f.comment && <span>&ldquo;{f.comment}&rdquo;</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------- POPIA deletion request

export function DeletionRequest() {
  return (
    <section className="kd-card">
      <h3>Delete a customer&apos;s details</h3>
      <p className="form-note">
        If a customer asks KD Pops to delete their information (POPIA), enter their cell number. Their name, number and
        notes are removed straight away. Order totals stay for the records. This cannot be undone.
      </p>
      <ActionForm action={deleteCustomerData} confirm="Remove this customer's details permanently?">
        {(pending) => (
          <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
            <label className="field">
              Cell number
              <input className="input" name="phone" type="tel" inputMode="tel" placeholder="082 123 4567" required />
            </label>
            <button className="pill pill-small pill-outline" disabled={pending}>
              {pending ? "Removing..." : "Remove details"}
            </button>
          </div>
        )}
      </ActionForm>
    </section>
  );
}
