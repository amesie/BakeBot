"use client";

// Customer ordering flow (spec section 4 "Customer flow", max 6 steps):
//   1 open link -> 2 consent + under-18 gate -> 3/4 details and items
//   -> 5 review and submit -> 6 acknowledgement with status link.
// Covers REQ-01 (consent), REQ-04 (capture), REQ-05 (show what is missing),
// REQ-10 (acknowledgement shown), REQ-25 (offline draft + resend).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { Sparkle } from "@/components/kd/sparkle";
import { formatDay } from "@/lib/dates";
import { formatRand } from "@/lib/format";
import { format, type Messages } from "@/lib/i18n";
import type { MenuItem } from "@/lib/menu";
import type { OrderOptions } from "@/lib/order-options";
import {
  rememberOrder,
  removeDraft,
  resendDrafts,
  saveDraft,
  sendOrder,
  type OrderSummary,
} from "@/lib/orders/client";
import { newOrderIdentity, statusPath } from "@/lib/orders/identity";
import { CONSENT_VERSION, MAX_NOTES, validateOrder, type FieldErrors, type OrderRequest } from "@/lib/orders/schema";
import { whatsAppLink } from "@/lib/site";
import { ADD_FLAVOUR_EVENT } from "./events";

type Step = "consent" | "declined" | "form" | "review" | "sending" | "queued" | "done";
type Row = { id: number; product_id: string; quantity: number };
type Slot = "second_break" | "after_school";
type Method = "cash" | "eft";

const QUANTITIES = Array.from({ length: 30 }, (_, i) => i + 1);

export function OrderSection({ menu, options }: { menu: MenuItem[]; options: OrderOptions }) {
  const { messages: m, language } = useI18n();
  const prices = useMemo(() => new Map(menu.map((item) => [item.product_id, item])), [menu]);

  const [step, setStep] = useState<Step>("consent");
  const [consent, setConsent] = useState(false);
  const [isMinor, setIsMinor] = useState<boolean | null>(null);
  const [guardian, setGuardian] = useState(false);

  const firstProduct = menu[0]?.product_id ?? "";
  const [rows, setRows] = useState<Row[]>(firstProduct ? [{ id: 1, product_id: firstProduct, quantity: 1 }] : []);
  const nextRowId = useRef(2);
  const [date, setDate] = useState(options.collection_dates[0] ?? "");
  const [slot, setSlot] = useState<Slot>("second_break");
  const [method, setMethod] = useState<Method>("cash");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [placed, setPlaced] = useState<{ order: OrderSummary; token: string } | null>(null);
  const [queueState, setQueueState] = useState<"waiting" | "sending" | "failed">("waiting");

  // The same id and token are reused for every retry of this order (REQ-09).
  const identity = useRef<ReturnType<typeof newOrderIdentity> | null>(null);
  const errorSummary = useRef<HTMLDivElement>(null);
  const resending = useRef(false);

  // Merge rows of the same flavour for the summary and the request.
  const lines = useMemo(() => {
    const totals = new Map<string, number>();
    for (const row of rows) totals.set(row.product_id, (totals.get(row.product_id) ?? 0) + row.quantity);
    return [...totals].flatMap(([product_id, quantity]) => {
      const item = prices.get(product_id);
      return item ? [{ product_id, quantity, flavour: item.flavour, line: quantity * item.unit_price }] : [];
    });
  }, [rows, prices]);
  const totalUnits = lines.reduce((sum, line) => sum + line.quantity, 0);
  const total = lines.reduce((sum, line) => sum + line.line, 0);
  const isLarge = totalUnits > options.large_order_threshold;

  // ------------------------------------------------------------ menu "Add to order"
  useEffect(() => {
    const onAdd = (event: Event) => {
      const productId = (event as CustomEvent<string>).detail;
      if (!prices.has(productId)) return;
      setRows((current) => {
        if (current.length === 1 && current[0].quantity === 1 && current[0].product_id === firstProduct) {
          return [{ ...current[0], product_id: productId }];
        }
        const existing = current.find((row) => row.product_id === productId);
        if (existing) {
          return current.map((row) => (row === existing ? { ...row, quantity: Math.min(row.quantity + 1, 30) } : row));
        }
        return [...current, { id: nextRowId.current++, product_id: productId, quantity: 1 }];
      });
    };
    window.addEventListener(ADD_FLAVOUR_EVENT, onAdd);
    return () => window.removeEventListener(ADD_FLAVOUR_EVENT, onAdd);
  }, [prices, firstProduct]);

  // ------------------------------------------------------------ REQ-25 resend drafts
  const onPlaced = useCallback((order: OrderSummary, token: string) => {
    setPlaced({ order, token });
    setStep((current) => (current === "queued" || current === "sending" ? "done" : current));
  }, []);

  // A draft the server rejected while it waited (e.g. the week closed): back
  // to the form with the reasons.
  const onRejected = useCallback((rejected: FieldErrors) => {
    identity.current = null;
    setErrors(rejected);
    setStep((current) => (current === "queued" ? "form" : current));
  }, []);

  const flushDrafts = useCallback(async () => {
    if (resending.current) return;
    resending.current = true;
    setQueueState("sending");
    try {
      await resendDrafts(onPlaced, onRejected);
    } finally {
      resending.current = false;
      setQueueState("failed"); // only shown if the order is still queued
    }
  }, [onPlaced, onRejected]);

  useEffect(() => {
    // Drafts left from an earlier visit go out as soon as the page is online.
    if (navigator.onLine) void flushDrafts();
    window.addEventListener("online", flushDrafts);
    return () => window.removeEventListener("online", flushDrafts);
  }, [flushDrafts]);

  // ------------------------------------------------------------ helpers
  const buildRequest = (): OrderRequest => {
    identity.current ??= newOrderIdentity();
    return {
      ...identity.current,
      full_name: name,
      phone,
      language,
      consent_given: consent as true,
      consent_version: CONSENT_VERSION,
      is_minor: isMinor ?? false,
      guardian_consent: guardian,
      items: lines.map(({ product_id, quantity }) => ({ product_id, quantity })),
      collection_date: date,
      collection_slot: slot,
      payment_method: method,
      special_notes: notes.trim() || undefined,
    };
  };

  const showErrors = (next: FieldErrors) => {
    setErrors(next);
    requestAnimationFrame(() => errorSummary.current?.focus());
  };

  const goToReview = () => {
    const checked = validateOrder(buildRequest());
    if (!checked.ok) return showErrors(checked.errors);
    setErrors({});
    setStep("review");
  };

  const placeOrder = async () => {
    const request = buildRequest();
    await saveDraft(request); // on the phone before it leaves (REQ-25)
    setStep("sending");

    const result = navigator.onLine ? await sendOrder(request) : ({ kind: "offline" } as const);
    if (result.kind === "placed") {
      await removeDraft(request.order_id);
      rememberOrder(result.order.order_number, request.access_token);
      setPlaced({ order: result.order, token: request.access_token });
      setStep("done");
    } else if (result.kind === "invalid") {
      await removeDraft(request.order_id);
      if (result.errors.order_id === "conflict") identity.current = null;
      setStep("form");
      showErrors(result.errors);
    } else {
      setQueueState("waiting");
      setStep("queued");
      if (navigator.onLine) void flushDrafts();
    }
  };

  const startAgain = () => {
    identity.current = null;
    setPlaced(null);
    setRows(firstProduct ? [{ id: nextRowId.current++, product_id: firstProduct, quantity: 1 }] : []);
    setNotes("");
    setErrors({});
    setStep("form");
  };

  const errorText = (field: string) => {
    const code = errors[field];
    if (!code) return undefined;
    if (field === "phone" && code === "invalid") return m.errors.phoneInvalid;
    return m.errors[code];
  };

  // ------------------------------------------------------------ render
  const consentOk = consent && isMinor !== null && (!isMinor || guardian);
  const showSummary = step === "consent" || step === "form" || step === "review";

  return (
    <section className="order-section" id="order" aria-labelledby="order-title">
      <div className="container-kd">
        <div className="section-heading" style={{ alignItems: "center", display: "flex" }}>
          <div>
            <p className="eyebrow">{m.order.eyebrow}</p>
            <h2 id="order-title">{m.order.title}</h2>
          </div>
          <Sparkle className="w-[60px] flex-none text-kd-orange" />
        </div>

        <div className="order-layout" style={showSummary ? undefined : { gridTemplateColumns: "1fr" }}>
          <div aria-live="polite">
            {step === "consent" && (
              <ConsentCard
                m={m}
                consent={consent}
                setConsent={setConsent}
                isMinor={isMinor}
                setIsMinor={setIsMinor}
                guardian={guardian}
                setGuardian={setGuardian}
                canContinue={consentOk}
                onContinue={() => setStep("form")}
                onDecline={() => setStep("declined")}
              />
            )}

            {step === "declined" && (
              <div className="kd-card stack">
                <p className="form-note" style={{ color: "var(--brown)", fontSize: 16 }}>
                  {isMinor && !guardian && consent ? m.consent.guardianNeeded : m.consent.declined}
                </p>
                <div className="actions-row">
                  {whatsAppLink && (
                    <a className="pill" href={whatsAppLink} target="_blank" rel="noopener noreferrer">
                      {m.status.talk}
                    </a>
                  )}
                  <button type="button" className="pill pill-outline" onClick={() => setStep("consent")}>
                    {m.consent.back}
                  </button>
                </div>
              </div>
            )}

            {step === "form" && (
              <form
                className="kd-card"
                noValidate
                onSubmit={(event) => {
                  event.preventDefault();
                  goToReview();
                }}
              >
                <div className="form-card-header">
                  <span className="number-badge" aria-hidden="true">02</span>
                  <div>
                    <h3>{m.form.step}</h3>
                    <p>{m.form.hint}</p>
                  </div>
                </div>

                <ErrorSummary m={m} errors={errors} innerRef={errorSummary} />

                <fieldset className="flavour-rows" style={{ border: 0, margin: 0, padding: 0 }}>
                  <legend className="sr-only">{m.errors.fields.items}</legend>
                  {rows.map((row, index) => {
                    const flavour = prices.get(row.product_id)?.flavour ?? "";
                    return (
                      <div className="flavour-row" key={row.id}>
                        <label className="field">
                          <span className="field-label">
                            {m.form.flavour} {rows.length > 1 ? index + 1 : ""}
                          </span>
                          <select
                            className="input"
                            value={row.product_id}
                            aria-invalid={Boolean(errors.items)}
                            onChange={(event) =>
                              setRows((current) =>
                                current.map((r) => (r.id === row.id ? { ...r, product_id: event.target.value } : r)),
                              )
                            }
                          >
                            {menu.map((item) => (
                              <option key={item.product_id} value={item.product_id}>
                                {item.flavour} · {formatRand(item.unit_price)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="field">
                          <span className="field-label">{m.form.quantity}</span>
                          <select
                            className="input"
                            value={row.quantity}
                            onChange={(event) =>
                              setRows((current) =>
                                current.map((r) => (r.id === row.id ? { ...r, quantity: Number(event.target.value) } : r)),
                              )
                            }
                          >
                            {QUANTITIES.map((q) => (
                              <option key={q} value={q}>
                                {q}
                              </option>
                            ))}
                          </select>
                        </label>
                        {rows.length > 1 ? (
                          <button
                            type="button"
                            className="remove-row"
                            aria-label={format(m.form.remove, { flavour })}
                            onClick={() => setRows((current) => current.filter((r) => r.id !== row.id))}
                          >
                            ×
                          </button>
                        ) : (
                          <span />
                        )}
                      </div>
                    );
                  })}
                </fieldset>
                {errors.items && <p className="field-error">{errorText("items")}</p>}

                <button
                  type="button"
                  className="text-button add-row"
                  onClick={() =>
                    setRows((current) => [
                      ...current,
                      { id: nextRowId.current++, product_id: menu[current.length % menu.length]?.product_id ?? firstProduct, quantity: 1 },
                    ])
                  }
                >
                  <span className="icon-circle" aria-hidden="true">＋</span> {m.form.addRow}
                </button>

                <div className="field-grid">
                  <Field label={m.form.day} error={errorText("collection_date")} id="collection_date">
                    <select
                      id="collection_date"
                      className="input"
                      value={date}
                      onChange={(event) => setDate(event.target.value)}
                      aria-invalid={Boolean(errors.collection_date)}
                    >
                      {options.collection_dates.length === 0 && <option value="">{m.form.chooseDay}</option>}
                      {options.collection_dates.map((d) => (
                        <option key={d} value={d}>
                          {formatDay(d, m)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={m.form.slot} error={errorText("collection_slot")} id="collection_slot">
                    <select
                      id="collection_slot"
                      className="input"
                      value={slot}
                      onChange={(event) => setSlot(event.target.value as Slot)}
                    >
                      {options.slots.map((s) => (
                        <option key={s} value={s}>
                          {m.slots[s]}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={m.form.payment} error={errorText("payment_method")} id="payment_method">
                    <select
                      id="payment_method"
                      className="input"
                      value={method}
                      onChange={(event) => setMethod(event.target.value as Method)}
                    >
                      <option value="cash">{m.payment.cash}</option>
                      <option value="eft">{m.payment.eft}</option>
                    </select>
                  </Field>
                  <Field label={m.form.name} error={errorText("full_name")} id="full_name">
                    <input
                      id="full_name"
                      className="input"
                      autoComplete="name"
                      maxLength={100}
                      value={name}
                      placeholder={m.form.namePlaceholder}
                      aria-invalid={Boolean(errors.full_name)}
                      onChange={(event) => setName(event.target.value)}
                    />
                  </Field>
                  <Field label={m.form.phone} error={errorText("phone")} id="phone">
                    <input
                      id="phone"
                      className="input"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      value={phone}
                      placeholder={m.form.phonePlaceholder}
                      aria-invalid={Boolean(errors.phone)}
                      onChange={(event) => setPhone(event.target.value)}
                    />
                  </Field>
                </div>

                <Field
                  label={
                    <>
                      {m.form.notes} <em>{m.form.optional}</em>
                    </>
                  }
                  error={errorText("special_notes")}
                  id="special_notes"
                >
                  <textarea
                    id="special_notes"
                    className="input"
                    rows={3}
                    maxLength={MAX_NOTES}
                    value={notes}
                    placeholder={m.form.notesPlaceholder}
                    onChange={(event) => setNotes(event.target.value)}
                  />
                </Field>

                <div className="stack" style={{ marginTop: 18, gap: 8 }}>
                  {isLarge && <p className="form-note">{format(m.form.largeNote, { threshold: options.large_order_threshold })}</p>}
                  <p className="form-note">{m.form.cutoff}</p>
                </div>

                <button className="pill" style={{ width: "100%", marginTop: 22 }} disabled={lines.length === 0}>
                  {m.form.review} <span aria-hidden="true">→</span>
                </button>
              </form>
            )}

            {(step === "review" || step === "sending") && (
              <div className="kd-card">
                <div className="form-card-header">
                  <span className="number-badge" aria-hidden="true">03</span>
                  <div>
                    <h3>{m.review.step}</h3>
                    <p>{m.review.hint}</p>
                  </div>
                </div>
                <div className="success-recap" style={{ marginTop: 0, maxWidth: "none" }}>
                  {lines.map((line) => (
                    <div key={line.product_id}>
                      <span>
                        {line.quantity} × {line.flavour}
                      </span>
                      <strong>{formatRand(line.line)}</strong>
                    </div>
                  ))}
                  <div className="success-total">
                    <span>{m.summary.total}</span>
                    <strong>{formatRand(total)}</strong>
                  </div>
                </div>
                {isLarge && <p className="form-note" style={{ marginTop: 12 }}>{format(m.form.largeNote, { threshold: options.large_order_threshold })}</p>}
                <div className="collection-ticket" style={{ maxWidth: "none" }}>
                  <span>{m.review.collection}</span>
                  <strong>
                    {date ? formatDay(date, m) : ""} · {m.slots[slot]}
                  </strong>
                  <small>
                    {m.review.payment}: {m.payment[method]}
                  </small>
                </div>
                <div className="collection-ticket" style={{ maxWidth: "none", marginTop: 0 }}>
                  <span>{m.review.contact}</span>
                  <strong>{name.trim()}</strong>
                  <small>{phone.trim()}</small>
                </div>
                <div className="actions-row">
                  <button type="button" className="pill" onClick={placeOrder} disabled={step === "sending"}>
                    {step === "sending" ? m.review.placing : m.review.place} <span aria-hidden="true">→</span>
                  </button>
                  <button
                    type="button"
                    className="pill pill-outline"
                    onClick={() => setStep("form")}
                    disabled={step === "sending"}
                  >
                    {m.review.edit}
                  </button>
                </div>
              </div>
            )}

            {step === "queued" && (
              <div className="kd-card success-card" role="status">
                <div className="success-icon">
                  <Sparkle filled />
                </div>
                <h3>{m.queued.title}</h3>
                <p className="success-intro">{m.queued.body}</p>
                {queueState !== "waiting" && (
                  <p className="form-note">{queueState === "failed" ? m.queued.failed : m.queued.retrying}</p>
                )}
                {queueState === "failed" && whatsAppLink && (
                  <a className="pill pill-outline" style={{ marginTop: 16 }} href={whatsAppLink} target="_blank" rel="noopener noreferrer">
                    {m.status.talk}
                  </a>
                )}
              </div>
            )}

            {step === "done" && placed && <DoneCard m={m} placed={placed} onAnother={startAgain} />}
          </div>

          {showSummary && (
            <aside className="kd-card-dark summary-card" aria-label={m.summary.title}>
              <div className="summary-top">
                <p className="eyebrow">{m.summary.eyebrow}</p>
                <span>{format(m.summary.pops, { count: totalUnits })}</span>
              </div>
              <h3>{m.summary.title}</h3>
              <ul className="summary-lines">
                {lines.length > 0 ? (
                  lines.map((line) => (
                    <li className="summary-line" key={line.product_id}>
                      <span>
                        <b>{line.quantity}×</b> {line.flavour}
                      </span>
                      <strong>{formatRand(line.line)}</strong>
                    </li>
                  ))
                ) : (
                  <li>{m.summary.empty}</li>
                )}
              </ul>
              <div className="summary-total">
                <span>{m.summary.total}</span>
                <strong>{formatRand(total)}</strong>
              </div>
              <div className="summary-note">
                <Sparkle filled />
                <p>
                  {m.summary.note}
                  <br />
                  {m.summary.payNote}
                </p>
              </div>
            </aside>
          )}
        </div>
      </div>
    </section>
  );
}

// -------------------------------------------------------------------- pieces

function Field({
  label,
  error,
  id,
  children,
}: {
  label: React.ReactNode;
  error?: string;
  id: string;
  children: React.ReactElement;
}) {
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {children}
      {error && (
        <span className="field-error" id={`${id}-error`}>
          {error}
        </span>
      )}
    </div>
  );
}

function ErrorSummary({
  m,
  errors,
  innerRef,
}: {
  m: Messages;
  errors: FieldErrors;
  innerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const fields = Object.keys(errors) as (keyof Messages["errors"]["fields"])[];
  if (fields.length === 0) return null;
  return (
    <div className="error-summary" role="alert" tabIndex={-1} ref={innerRef}>
      <p>{m.form.errorSummary}</p>
      <ul>
        {fields.map((field) => {
          const code = errors[field]!;
          const message = field === "phone" && code === "invalid" ? m.errors.phoneInvalid : m.errors[code];
          return (
            <li key={field}>
              {m.errors.fields[field] ?? field}: {message}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ConsentCard(props: {
  m: Messages;
  consent: boolean;
  setConsent: (v: boolean) => void;
  isMinor: boolean | null;
  setIsMinor: (v: boolean) => void;
  guardian: boolean;
  setGuardian: (v: boolean) => void;
  canContinue: boolean;
  onContinue: () => void;
  onDecline: () => void;
}) {
  const { m } = props;
  const blockedMinor = props.isMinor === true && !props.guardian;
  return (
    <div className="kd-card">
      <div className="form-card-header">
        <span className="number-badge" aria-hidden="true">01</span>
        <div>
          <h3>{m.consent.step}</h3>
          <p>{m.consent.intro}</p>
        </div>
      </div>
      <div className="stack">
        <p className="notice" style={{ margin: 0 }}>{m.consent.bakebot}</p>
        <div className="notice">
          <strong>{m.consent.popiaTitle}</strong>
          {m.consent.popia}
        </div>
        <label className="choice">
          <input type="checkbox" checked={props.consent} onChange={(event) => props.setConsent(event.target.checked)} />
          {m.consent.agree}
        </label>
        <fieldset style={{ border: 0, margin: 0, padding: 0 }} className="stack">
          <legend className="field-label" style={{ fontWeight: 700, marginBottom: 8 }}>
            {m.consent.under18}
          </legend>
          <div className="choice-row">
            <label className="choice">
              <input type="radio" name="is_minor" checked={props.isMinor === true} onChange={() => props.setIsMinor(true)} />
              {m.consent.yes}
            </label>
            <label className="choice">
              <input type="radio" name="is_minor" checked={props.isMinor === false} onChange={() => props.setIsMinor(false)} />
              {m.consent.no}
            </label>
          </div>
          {props.isMinor === true && (
            <label className="choice">
              <input type="checkbox" checked={props.guardian} onChange={(event) => props.setGuardian(event.target.checked)} />
              {m.consent.guardian}
            </label>
          )}
        </fieldset>
        {blockedMinor && props.consent && <p className="form-note">{m.consent.guardianNeeded}</p>}
      </div>
      <div className="actions-row">
        <button type="button" className="pill" disabled={!props.canContinue} onClick={props.onContinue}>
          {m.consent.continue} <span aria-hidden="true">→</span>
        </button>
        <button type="button" className="pill pill-outline" onClick={props.onDecline}>
          {m.consent.dontAgree}
        </button>
      </div>
    </div>
  );
}

function DoneCard({
  m,
  placed,
  onAnother,
}: {
  m: Messages;
  placed: { order: OrderSummary; token: string };
  onAnother: () => void;
}) {
  const { order, token } = placed;
  const [copied, setCopied] = useState(false);
  const path = statusPath(order.order_number, token);
  const intro =
    order.order_status === "waitlisted" ? m.done.waitlisted : order.is_large_order ? m.done.quote : m.done.pending;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(new URL(path, window.location.origin).toString());
      setCopied(true);
    } catch {}
  };

  return (
    <div className="kd-card success-card" role="status">
      <div className="success-icon">
        <Sparkle filled />
      </div>
      <p className="eyebrow">{m.done.eyebrow}</p>
      <h3>{m.done.title}</h3>
      <p className="success-intro">{format(intro, { name: order.first_name })}</p>
      <p style={{ margin: "18px 0 0" }}>
        <span className="eyebrow" style={{ display: "block", margin: 0 }}>{m.done.number}</span>
        <strong className="order-number">{order.order_number}</strong>
      </p>
      <div className="success-recap">
        {order.items.map((item) => (
          <div key={item.flavour}>
            <span>
              {item.quantity} × {item.flavour}
            </span>
            <strong>{formatRand(item.line_total)}</strong>
          </div>
        ))}
        <div className="success-total">
          <span>{m.summary.total}</span>
          <strong>{order.is_large_order && order.quote_amount === null ? m.status.quoteWaiting : formatRand(order.total_amount)}</strong>
        </div>
      </div>
      <div className="collection-ticket">
        <span>{m.review.collection}</span>
        <strong>
          {formatDay(order.collection_date, m)} · {m.slots[order.collection_slot]}
        </strong>
        <small>{m.payment[order.payment_method]}</small>
      </div>
      <p className="form-note">{m.done.saveLink}</p>
      <div className="actions-row" style={{ justifyContent: "center" }}>
        <a className="pill" href={path}>
          {m.done.statusLink} <span aria-hidden="true">→</span>
        </a>
        <button type="button" className="pill pill-outline" onClick={copy}>
          {copied ? m.done.copied : m.done.copy}
        </button>
      </div>
      <button type="button" className="text-button" style={{ marginTop: 16 }} onClick={onAnother}>
        {m.done.another}
      </button>
    </div>
  );
}
