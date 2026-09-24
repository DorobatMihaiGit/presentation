"use client";

import { useActionState } from "react";
import { type SignInState, signIn } from "@/server/actions/auth";
import { button, field, label } from "./styles";

export function LoginForm() {
  const [state, action, pending] = useActionState<SignInState, FormData>(
    signIn,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-5">
      <label className={label}>
        Email
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          className={field}
        />
      </label>
      <label className={label}>
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={field}
        />
      </label>
      <p role="alert" className="min-h-6 text-sm text-ink">
        {state.error}
      </p>
      <button type="submit" disabled={pending} className={button}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
