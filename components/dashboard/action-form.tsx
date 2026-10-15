"use client";

import { useActionState } from "react";
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
}: {
  action: Action;
  children: (pending: boolean) => React.ReactNode;
  confirm?: string;
  className?: string;
  /** Lets inputs elsewhere on the page join this form via form="...". */
  id?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
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
    </form>
  );
}
