"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import type { Locale } from "@/i18n/routing";
import { sendContactMessage } from "@/server/actions/contact";
import {
  CONTACT_IDLE,
  type ContactField,
  type ContactFieldError,
  type ContactState,
  HONEYPOT_FIELD,
} from "@/server/contact/state";

/**
 * Every visible string, translated on the server by <Contact>, so next-intl
 * stays out of the public client bundle.
 */
export type ContactFormLabels = {
  title: string;
  name: string;
  email: string;
  company: string;
  message: string;
  submit: string;
  sending: string;
  hint: string;
  sent: string;
  honeypot: string;
  errors: Record<"invalid" | "tooFast" | "rateLimited" | "failed", string>;
  fieldErrors: Record<ContactFieldError, string>;
};

const fieldClass =
  "mt-2 w-full rounded-control bg-canvas px-4 py-3 text-ink ring-1 ring-line-strong aria-invalid:ring-signal";

function statusText(
  state: ContactState,
  pending: boolean,
  labels: ContactFormLabels,
): string {
  if (pending) {
    return labels.sending;
  }
  if (state.status === "sent") {
    return labels.sent;
  }
  if (state.status === "error") {
    return labels.errors[state.reason];
  }
  return labels.hint;
}

export function ContactForm({
  locale,
  labels,
}: {
  locale: Locale;
  labels: ContactFormLabels;
}) {
  const [state, formAction, pending] = useActionState(
    sendContactMessage,
    CONTACT_IDLE,
  );
  const formRef = useRef<HTMLFormElement>(null);
  // When the form became usable; the server refuses anything sent within 3 s.
  const openedAt = useRef<number | null>(null);

  useEffect(() => {
    openedAt.current = performance.now();
  }, []);

  useEffect(() => {
    if (state.status === "sent") {
      formRef.current?.reset();
    }
  }, [state]);

  const errorFor = (field: ContactField) =>
    state.status === "error" && state.reason === "invalid"
      ? state.fieldErrors[field]
      : undefined;

  /** id, name and the ARIA wiring to the field's error text. */
  const fieldProps = (field: ContactField) => ({
    id: `contact-${field}`,
    name: field,
    "aria-invalid": errorFor(field) ? true : undefined,
    "aria-describedby": `contact-${field}-error`,
    className: fieldClass,
  });

  const fieldError = (field: ContactField) => {
    const error = errorFor(field);
    return (
      <span
        id={`contact-${field}-error`}
        className="mt-1 block text-sm text-signal"
      >
        {error ? labels.fieldErrors[error] : ""}
      </span>
    );
  };

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const elapsed =
          openedAt.current === null ? 0 : performance.now() - openedAt.current;
        data.set("elapsedMs", String(Math.round(elapsed)));
        startTransition(() => formAction(data));
      }}
      aria-labelledby="contact-form-title"
      className="relative flex flex-col gap-5 rounded-panel bg-surface p-6 ring-1 ring-line md:col-span-7 md:p-8"
    >
      <h3 id="contact-form-title" className="text-heading text-ink">
        {labels.title}
      </h3>
      <input type="hidden" name="locale" value={locale} />
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="text-sm text-ink-muted">
          {labels.name}
          <input
            {...fieldProps("name")}
            type="text"
            autoComplete="name"
            required
            maxLength={100}
          />
          {fieldError("name")}
        </label>
        <label className="text-sm text-ink-muted">
          {labels.email}
          <input
            {...fieldProps("email")}
            type="email"
            autoComplete="email"
            required
            maxLength={254}
          />
          {fieldError("email")}
        </label>
      </div>
      <label className="text-sm text-ink-muted">
        {labels.company}
        <input
          {...fieldProps("company")}
          type="text"
          autoComplete="organization"
          maxLength={100}
        />
        {fieldError("company")}
      </label>
      <label className="text-sm text-ink-muted">
        {labels.message}
        <textarea
          {...fieldProps("message")}
          className={`${fieldClass} resize-y`}
          rows={5}
          required
          maxLength={5000}
        />
        {fieldError("message")}
      </label>
      {/* Honeypot: off screen, out of the tab order, hidden from assistive technology. */}
      <div
        aria-hidden="true"
        className="absolute top-0 -left-[9999px] h-px w-px overflow-hidden"
      >
        <label>
          {labels.honeypot}
          <input
            type="text"
            name={HONEYPOT_FIELD}
            tabIndex={-1}
            autoComplete="off"
          />
        </label>
      </div>
      <p role="status" className="text-sm text-ink-muted">
        {statusText(state, pending, labels)}
      </p>
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-signal px-6 py-3 font-medium text-signal-ink disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? labels.sending : labels.submit}
      </button>
    </form>
  );
}
