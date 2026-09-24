"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { deletePasskey } from "@/server/actions/passkeys";
import { ActionButton } from "./ActionButton";
import { button, field, label, panel } from "./styles";

export type PasskeyRow = { id: string; name: string | null };

/** Lists registered passkeys and adds a new one through the browser's WebAuthn prompt. */
export function PasskeySettings({ passkeys }: { passkeys: PasskeyRow[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <div className={`${panel} flex flex-col gap-4`}>
      {passkeys.length === 0 ? (
        <p className="text-ink">No passkeys yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {passkeys.map((key) => (
            <li
              key={key.id}
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <span className="text-ink">{key.name ?? "Passkey"}</span>
              <ActionButton
                action={deletePasskey}
                fields={{ id: key.id }}
                label={`Remove ${key.name ?? "passkey"}`}
                confirmMessage="Remove this passkey?"
              />
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex flex-col gap-4"
        onSubmit={async (event) => {
          event.preventDefault();
          const name = String(
            new FormData(event.currentTarget).get("name") ?? "",
          ).trim();
          setPending(true);
          setMessage("");
          const result = await authClient.passkey.addPasskey({
            name: name || "Passkey",
          });
          setPending(false);
          if (result?.error) {
            setMessage("The passkey was not added.");
            return;
          }
          setMessage("Passkey added.");
          router.refresh();
        }}
      >
        <label className={label}>
          Passkey name
          <input
            name="name"
            maxLength={60}
            placeholder="Laptop"
            className={field}
          />
        </label>
        <button type="submit" disabled={pending} className={button}>
          Add a passkey
        </button>
        <p role="status" className="min-h-6 text-sm text-ink-muted">
          {message}
        </p>
      </form>
    </div>
  );
}
