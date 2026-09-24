"use client";

import { useActionState } from "react";
import { type SignInState, verifySignInCode } from "@/server/actions/auth";
import { button, field, label } from "./styles";

export function CodeForm() {
  const [state, action, pending] = useActionState<SignInState, FormData>(
    verifySignInCode,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-5">
      <label className={label}>
        Authenticator code
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          className={field}
        />
      </label>
      <p role="alert" className="min-h-6 text-sm text-ink">
        {state.error}
      </p>
      <button type="submit" disabled={pending} className={button}>
        {pending ? "Checking…" : "Verify"}
      </button>
    </form>
  );
}
