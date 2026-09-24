"use client";

import { useActionState } from "react";
import {
  confirmTwoFactor,
  disableTwoFactor,
  startTwoFactor,
  type TwoFactorState,
} from "@/server/actions/two-factor";
import { IDLE } from "@/server/admin/action-result";
import { button, field, label, panel } from "./styles";

function Message({ state }: { state: TwoFactorState }) {
  return (
    <p role="status" className="min-h-6 text-sm text-ink-muted">
      {state.status === "ok" || state.status === "error" ? state.message : ""}
    </p>
  );
}

/** Turn TOTP on (password, then scan, then first code) or off (password). */
export function TwoFactorSettings({ enabled }: { enabled: boolean }) {
  const [setup, start, starting] = useActionState(startTwoFactor, IDLE);
  const [confirmed, confirm, confirming] = useActionState(
    confirmTwoFactor,
    IDLE,
  );
  const [disabled, disable, disabling] = useActionState(disableTwoFactor, IDLE);

  if (enabled || confirmed.status === "ok") {
    return (
      <div className={`${panel} flex flex-col gap-4`}>
        <p className="text-ink">Two-factor sign-in is on.</p>
        {disabled.status === "ok" ? (
          <Message state={disabled} />
        ) : (
          <form action={disable} className="flex flex-col gap-4">
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
            <button type="submit" disabled={disabling} className={button}>
              Turn off two-factor sign-in
            </button>
            <Message state={disabled} />
          </form>
        )}
      </div>
    );
  }

  if (setup.status === "setup") {
    return (
      <div className={`${panel} flex flex-col gap-4`}>
        <p className="text-ink">
          Add this key to your authenticator app, then enter the code it shows.
        </p>
        <p>
          <span className={label}>Setup key</span>
          <code
            data-testid="totp-secret"
            className="mt-1 block font-mono text-ink wrap-anywhere"
          >
            {setup.secret}
          </code>
        </p>
        <details>
          <summary className="text-sm text-ink-muted">
            Backup codes (store them offline)
          </summary>
          <ul className="mt-2 grid grid-cols-2 gap-1 font-mono text-sm text-ink">
            {setup.backupCodes.map((code) => (
              <li key={code}>{code}</li>
            ))}
          </ul>
        </details>
        <form action={confirm} className="flex flex-col gap-4">
          <label className={label}>
            Code from the app
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
          <button type="submit" disabled={confirming} className={button}>
            Turn on two-factor sign-in
          </button>
          <Message state={confirmed} />
        </form>
      </div>
    );
  }

  return (
    <form action={start} className={`${panel} flex flex-col gap-4`}>
      <p className="text-ink">Two-factor sign-in is off.</p>
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
      <button type="submit" disabled={starting} className={button}>
        Set up an authenticator app
      </button>
      <Message state={setup} />
    </form>
  );
}
