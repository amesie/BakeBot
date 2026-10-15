"use client";

import { useActionState, useEffect, useState } from "react";
import type { ActionState } from "@/app/dashboard/actions";

type Action = (state: ActionState, form: FormData) => Promise<ActionState>;

/**
 * Form wrapper for dashboard actions: shows a pending state, an optional
 * "are you sure?" question, and the result message (announced to screen
 * readers). Built for one-handed use on a phone at break time.
 */
export function ActionForm({
  action,
  children,
  confirm,
  className,
  id,
  onResult,
}: {
  action: Action;
  children: (pending: boolean) => React.ReactNode;
  confirm?: string;
  className?: string;
  /** Lets inputs elsewhere on the page join this form via form="...". */
  id?: string;
  /** Called with each result, e.g. so a card can switch to "Approved". */
  onResult?: (state: ActionState) => void;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  useEffect(() => {
    if (state) onResult?.(state);
  }, [state, onResult]);
  return (
    <form
      action={formAction}
      className={className}
      id={id}
      onSubmit={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
    >
      {children(pending)}
      {state && (
        <p role="status" className={state.ok ? "form-note" : "field-error"} style={{ margin: "8px 0 0" }}>
          {state.message}
        </p>
      )}
      {state?.links && state.links.length > 0 && <WhatsAppLinks links={state.links} />}
    </form>
  );
}

/** One-tap WhatsApp buttons; each shows a tick once tapped. */
export function WhatsAppLinks({ links }: { links: { label: string; href: string }[] }) {
  return (
    <div className="choice-row" style={{ marginTop: 10 }}>
      {links.map((link) => (
        <WhatsAppLink key={link.href} {...link} />
      ))}
    </div>
  );
}

function WhatsAppLink({ label, href }: { label: string; href: string }) {
  const [opened, setOpened] = useState(false);
  return (
    <a
      className={`pill pill-small ${opened ? "pill-outline" : ""}`}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => setOpened(true)}
    >
      {opened ? `${label} ✓` : label}
    </a>
  );
}
