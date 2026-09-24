"use client";

import { startTransition, useActionState } from "react";
import { type AdminFormAction, IDLE } from "@/server/admin/action-result";
import { secondaryButton } from "./styles";

/** One-button form (delete, move) with hidden fields and an optional confirm step. */
export function ActionButton({
  action,
  fields,
  label,
  confirmMessage,
}: {
  action: AdminFormAction;
  fields: Record<string, string>;
  label: string;
  confirmMessage?: string;
}) {
  const [state, formAction, pending] = useActionState(action, IDLE);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        event.preventDefault();
        if (confirmMessage && !window.confirm(confirmMessage)) {
          return;
        }
        const data = new FormData(event.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="inline-flex items-center gap-2"
    >
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button type="submit" disabled={pending} className={secondaryButton}>
        {label}
      </button>
      {state.status === "error" ? (
        <span role="status" className="text-sm text-signal">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
