"use client";

import {
  createContext,
  type ReactNode,
  startTransition,
  useActionState,
  useContext,
} from "react";
import {
  type ActionResult,
  type AdminFormAction,
  IDLE,
} from "@/server/admin/action-result";
import { button } from "./styles";

const FormState = createContext<ActionResult>(IDLE);

/**
 * A form bound to one admin server action. Submitting keeps what was typed
 * (no automatic React form reset), shows the action's message in a live
 * region and exposes per-field errors to <FieldError>.
 */
export function ActionForm({
  action,
  submitLabel,
  children,
  className = "flex flex-col gap-6",
}: {
  action: AdminFormAction;
  submitLabel: string;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, IDLE);

  return (
    <FormState value={state}>
      <form
        action={formAction}
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          startTransition(() => formAction(data));
        }}
        className={className}
      >
        {children}
        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" disabled={pending} className={button}>
            {pending ? "Saving…" : submitLabel}
          </button>
          <p role="status" className="text-sm text-ink-muted">
            {state.status === "idle" ? "" : state.message}
          </p>
        </div>
      </form>
    </FormState>
  );
}

/**
 * The validation message for one field of the surrounding <ActionForm>.
 * Always rendered (empty when valid) so `aria-describedby` never dangles.
 */
export function FieldError({
  name,
  id = `${name}-error`,
}: {
  name: string;
  id?: string;
}) {
  const state = useContext(FormState);
  const errors = state.status === "error" ? state.fieldErrors?.[name] : null;
  return (
    <span id={id} className="mt-1 block text-sm text-signal">
      {errors?.join(" ")}
    </span>
  );
}
