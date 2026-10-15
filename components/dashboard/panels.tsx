"use client";

// Owner and helper dashboard panels (spec section 4 "Owner dashboard").
// Phone-first: big buttons, one card per order, actions next to the order.

import Link from "next/link";
import {
  advanceWeek,
  approveOrders,
  declineOrder,
  delayBatch,
  markCollected,
  markPaid,
  removeWeekCap,
  saveProduct,
  saveSettings,
  setWeekCap,
} from "@/app/dashboard/actions";
import { formatDay } from "@/lib/dates";
import { formatRand } from "@/lib/format";
import { dictionaries } from "@/lib/i18n";
import { maskPhone } from "@/lib/phone";
import { orderTotal, type DashboardOrder, type PaidPayment, type StaffRole } from "@/lib/dashboard/types";
import { ActionForm } from "./action-form";

const en = dictionaries.en;
const day = (iso: string) => formatDay(iso, en);

function Submit({ pending, children, outline = false }: { pending: boolean; children: React.ReactNode; outline?: boolean }) {
  return (
    <button className={`pill pill-small ${outline ? "pill-outline" : ""}`} disabled={pending}>
      {pending ? "Saving..." : children}
    </button>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="kd-card form-note" style={{ padding: 20 }}>{children}</p>;
}

// ---------------------------------------------------------------- order card

function OrderDetails({ order, role }: { order: DashboardOrder; role: StaffRole }) {
  const customer = order.customers;
  const phone = customer?.phone_number ?? "";
  const collect = order.revised_collection_date ?? order.collection_date;
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <strong className="font-display" style={{ fontSize: 18 }}>{order.order_number}</strong>
        <span className="status-pill" style={{ fontSize: 12 }}>
          {en.status.label[order.order_status]}
          {order.is_large_order ? " · large" : ""}
        </span>
      </div>
      <div>
        <b>{customer?.full_name}</b>
        {customer?.is_minor ? " (under 18, guardian agreed)" : ""} ·{" "}
        {role === "owner" ? (
          <a href={`https://wa.me/${phone.replace("+", "")}`} target="_blank" rel="noopener noreferrer">
            {phone}
          </a>
        ) : (
          maskPhone(phone)
        )}
      </div>
      <ul className="m-0 pl-5">
        {order.order_items.map((item, i) => (
          <li key={i}>
            {item.quantity} × {item.products?.flavour}
          </li>
        ))}
      </ul>
      <div className="form-note">
        {day(collect)}
        {order.revised_collection_date ? " (new date)" : ""} · {en.slots[order.collection_slot]} · {en.payment[order.payment_method]}
      </div>
      <div>
        <b>{order.is_large_order && order.quote_amount === null ? "Needs a quote" : formatRand(orderTotal(order))}</b>
        {" · "}
        {order.total_units} pops
        {order.payment_reference ? ` · ref ${order.payment_reference}` : ""}
      </div>
      {order.special_notes && (
        <p className="notice" style={{ margin: 0, padding: "8px 12px" }}>
          Note: {order.special_notes}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- approvals (owner)

export function ApprovalQueue({ orders }: { orders: DashboardOrder[] }) {
  if (orders.length === 0) return <Empty>No orders waiting. Nice!</Empty>;
  const simple = orders.filter((o) => !o.is_large_order);
  return (
    <div className="stack">
      {simple.length > 1 && (
        <ActionForm action={approveOrders} id="batch-approve-form" className="kd-card" confirm="Approve all ticked orders?">
          {(pending) => (
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <p className="m-0" style={{ flex: 1 }}>
                Tick orders below, then approve them together.
              </p>
              <Submit pending={pending}>Approve ticked</Submit>
            </div>
          )}
        </ActionForm>
      )}
      {orders.map((order) => (
        <article key={order.order_id} className="kd-card stack" style={{ padding: 20 }}>
          {simple.length > 1 && !order.is_large_order && (
            <label className="choice" style={{ alignSelf: "flex-start" }}>
              <input type="checkbox" name="order_id" value={order.order_id} form="batch-approve-form" />
              Tick for batch approval
            </label>
          )}
          <OrderDetails order={order} role="owner" />
          {order.order_status === "waitlisted" && (
            <p className="form-note m-0">On the waitlist (week was full). Approving takes it anyway.</p>
          )}
          <div className="actions-row" style={{ marginTop: 4 }}>
            <ActionForm action={approveOrders}>
              {(pending) => (
                <div style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}>
                  <input type="hidden" name="order_id" value={order.order_id} />
                  {order.is_large_order && (
                    <label className="field" style={{ maxWidth: 160 }}>
                      Quote (R)
                      <input className="input" name="quote" inputMode="decimal" required placeholder="e.g. 400" />
                    </label>
                  )}
                  <Submit pending={pending}>Approve</Submit>
                </div>
              )}
            </ActionForm>
            <ActionForm action={declineOrder} confirm={`Decline ${order.order_number}? The customer will get a polite message.`}>
              {(pending) => (
                <>
                  <input type="hidden" name="order_id" value={order.order_id} />
                  <Submit pending={pending} outline>
                    Decline
                  </Submit>
                </>
              )}
            </ActionForm>
          </div>
        </article>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- payments + collection (owner and helper)

export function PaymentsPanel({
  unpaid,
  ready,
  paid,
  role,
}: {
  unpaid: DashboardOrder[];
  ready: DashboardOrder[];
  paid: PaidPayment[];
  role: StaffRole;
}) {
  const owed = unpaid.reduce((sum, o) => sum + orderTotal(o), 0);
  return (
    <div className="stack" style={{ gap: 28 }}>
      <section className="stack">
        <h2 className="font-display" style={{ fontSize: 22, margin: 0 }}>
          Waiting for payment · {formatRand(owed)}
        </h2>
        {unpaid.length === 0 && <Empty>Everyone has paid.</Empty>}
        {unpaid.map((order) => (
          <article key={order.order_id} className="kd-card stack" style={{ padding: 20 }}>
            <OrderDetails order={order} role={role} />
            {order.payments?.payment_status === "pending_review" && (
              <p className="form-note m-0">Proof of payment uploaded: check it, then mark paid.</p>
            )}
            <ActionForm action={markPaid} confirm={`Mark ${order.order_number} as paid (${formatRand(orderTotal(order))})?`}>
              {(pending) => (
                <>
                  <input type="hidden" name="order_id" value={order.order_id} />
                  <Submit pending={pending}>Mark paid</Submit>
                </>
              )}
            </ActionForm>
          </article>
        ))}
      </section>

      <section className="stack">
        <h2 className="font-display" style={{ fontSize: 22, margin: 0 }}>Ready to collect</h2>
        {ready.length === 0 && <Empty>Nothing waiting to be collected.</Empty>}
        {ready.map((order) => (
          <article key={order.order_id} className="kd-card stack" style={{ padding: 20 }}>
            <OrderDetails order={order} role={role} />
            <div className="actions-row" style={{ marginTop: 4 }}>
              {order.payments?.payment_status !== "paid" && (
                <ActionForm action={markPaid}>
                  {(pending) => (
                    <>
                      <input type="hidden" name="order_id" value={order.order_id} />
                      <Submit pending={pending}>Paid now</Submit>
                    </>
                  )}
                </ActionForm>
              )}
              <ActionForm action={markCollected}>
                {(pending) => (
                  <>
                    <input type="hidden" name="order_id" value={order.order_id} />
                    <Submit pending={pending} outline>
                      Collected
                    </Submit>
                  </>
                )}
              </ActionForm>
            </div>
          </article>
        ))}
      </section>

      <section className="stack">
        <h2 className="font-display" style={{ fontSize: 22, margin: 0 }}>Paid recently</h2>
        {paid.length === 0 ? (
          <Empty>No payments yet.</Empty>
        ) : (
          <ul className="kd-card m-0 stack" style={{ listStyle: "none", padding: 20, gap: 8 }}>
            {paid.map((p, i) => (
              <li key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span>
                  {p.orders?.order_number} · {p.orders?.customers?.full_name}
                </span>
                <b>{formatRand(p.amount)}</b>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- batch (REQ-18 view, REQ-19)

export function BatchPanel({
  orders,
  weeks,
  week,
  role,
}: {
  orders: DashboardOrder[];
  weeks: string[];
  week: string | null;
  role: StaffRole;
}) {
  if (!week) return <Empty>No confirmed orders yet. Approved orders show up here by week.</Empty>;
  const inWeek = orders.filter((o) => o.collection_week === week);
  const toBake = inWeek.filter((o) => ["confirmed", "baking", "ready"].includes(o.order_status));
  const flavours = new Map<string, number>();
  for (const order of toBake) {
    for (const item of order.order_items) {
      const name = item.products?.flavour ?? "?";
      flavours.set(name, (flavours.get(name) ?? 0) + item.quantity);
    }
  }
  const count = (status: DashboardOrder["order_status"]) => inWeek.filter((o) => o.order_status === status).length;
  const total = [...flavours.values()].reduce((a, b) => a + b, 0);

  return (
    <div className="stack" style={{ gap: 20 }}>
      <nav className="choice-row" aria-label="Weeks">
        {weeks.map((w) => (
          <Link key={w} className={`pill pill-small ${w === week ? "" : "pill-outline"}`} href={`/dashboard?tab=batch&week=${w}`}>
            Week of {day(w)}
          </Link>
        ))}
      </nav>

      <div className="kd-card-dark">
        <p className="eyebrow" style={{ margin: 0, color: "var(--tan)" }}>Bake list</p>
        <h3 style={{ color: "var(--cream)", margin: "8px 0 18px" }}>{total} pops</h3>
        <ul className="summary-lines" style={{ minHeight: 0 }}>
          {[...flavours].map(([name, qty]) => (
            <li key={name} className="summary-line">
              <span>{name}</span>
              <strong>{qty}</strong>
            </li>
          ))}
        </ul>
        <p style={{ margin: "18px 0 0", fontSize: 14 }}>
          {count("confirmed")} confirmed · {count("baking")} baking · {count("ready")} ready · {count("collected")} collected
        </p>
      </div>

      {role === "owner" && (
        <div className="kd-card stack">
          <div className="actions-row" style={{ marginTop: 0 }}>
            <ActionForm action={advanceWeek} confirm="Move all confirmed orders for this week to baking?">
              {(pending) => (
                <>
                  <input type="hidden" name="week" value={week} />
                  <input type="hidden" name="to" value="baking" />
                  <Submit pending={pending}>Start baking ({count("confirmed")})</Submit>
                </>
              )}
            </ActionForm>
            <ActionForm action={advanceWeek} confirm="Mark this week's baking orders ready? Customers will be told.">
              {(pending) => (
                <>
                  <input type="hidden" name="week" value={week} />
                  <input type="hidden" name="to" value="ready" />
                  <Submit pending={pending}>All ready ({count("baking")})</Submit>
                </>
              )}
            </ActionForm>
          </div>
          <ActionForm action={delayBatch} confirm="Send every customer this week a new collection date?">
            {(pending) => (
              <div style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}>
                <input type="hidden" name="week" value={week} />
                <label className="field">
                  Batch delayed? New collection day
                  <input className="input" type="date" name="new_date" required />
                </label>
                <Submit pending={pending} outline>
                  Send new date
                </Submit>
              </div>
            )}
          </ActionForm>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- settings (owner)

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export function SettingsPanel({
  settings,
  caps,
  products,
}: {
  settings: { default_weekly_cap: number; large_order_threshold: number; last_school_day_isodow: number; collection_place: string } | null;
  caps: { week_start: string; unit_cap: number }[];
  products: { product_id: string; flavour: string; unit_price: number; is_available: boolean }[];
}) {
  return (
    <div className="stack" style={{ gap: 28 }}>
      <section className="kd-card stack">
        <h3>Menu</h3>
        <p className="form-note m-0">Changes show on the website straight away.</p>
        {products.map((product) => (
          <ActionForm key={product.product_id} action={saveProduct}>
            {(pending) => (
              <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
                <input type="hidden" name="product_id" value={product.product_id} />
                <b style={{ flex: "1 1 160px", alignSelf: "center" }}>{product.flavour}</b>
                <label className="field" style={{ width: 110 }}>
                  Price (R)
                  <input className="input" name="unit_price" inputMode="decimal" defaultValue={product.unit_price} required />
                </label>
                <label className="choice">
                  <input type="checkbox" name="is_available" defaultChecked={product.is_available} />
                  Available
                </label>
                <Submit pending={pending}>Save</Submit>
              </div>
            )}
          </ActionForm>
        ))}
      </section>

      <section className="kd-card stack">
        <h3>Weekly cap</h3>
        <p className="form-note m-0">
          Default is {settings?.default_weekly_cap ?? 200} pops a week. Set a different cap for a busy week (e.g. 300 for market week).
        </p>
        {caps.map((cap) => (
          <ActionForm key={cap.week_start} action={removeWeekCap}>
            {(pending) => (
              <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
                <input type="hidden" name="week_start" value={cap.week_start} />
                <span>
                  Week of {day(cap.week_start)}: <b>{cap.unit_cap}</b>
                </span>
                <Submit pending={pending} outline>
                  Remove
                </Submit>
              </div>
            )}
          </ActionForm>
        ))}
        <ActionForm action={setWeekCap}>
          {(pending) => (
            <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
              <label className="field">
                Week starting (Monday)
                <input className="input" type="date" name="week_start" required />
              </label>
              <label className="field" style={{ width: 110 }}>
                Cap
                <input className="input" type="number" name="unit_cap" min={1} required />
              </label>
              <Submit pending={pending}>Set cap</Submit>
            </div>
          )}
        </ActionForm>
      </section>

      <section className="kd-card">
        <h3>Ordering settings</h3>
        <ActionForm action={saveSettings}>
          {(pending) => (
            <div className="stack" style={{ marginTop: 14 }}>
              <label className="field">
                Collection place (shown on confirmations)
                <input className="input" name="collection_place" defaultValue={settings?.collection_place} required />
              </label>
              <div className="field-grid" style={{ marginBottom: 0 }}>
                <label className="field">
                  Default weekly cap
                  <input className="input" type="number" min={1} name="default_weekly_cap" defaultValue={settings?.default_weekly_cap} required />
                </label>
                <label className="field">
                  Large order from (pops)
                  <input className="input" type="number" min={1} name="large_order_threshold" defaultValue={settings?.large_order_threshold} required />
                </label>
                <label className="field">
                  Last school day of the week
                  <select className="input" name="last_school_day_isodow" defaultValue={settings?.last_school_day_isodow ?? 5}>
                    {WEEKDAYS.map((name, i) => (
                      <option key={name} value={i + 1}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div>
                <Submit pending={pending}>Save settings</Submit>
              </div>
            </div>
          )}
        </ActionForm>
      </section>
    </div>
  );
}
