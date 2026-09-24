"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { secondaryButton } from "./styles";

export function PasskeySignIn() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        disabled={pending}
        className={secondaryButton}
        onClick={async () => {
          setPending(true);
          setError("");
          const result = await authClient.signIn.passkey();
          if (result?.error) {
            setError(
              "Passkey sign-in did not complete. Try again or use your password.",
            );
            setPending(false);
            return;
          }
          // Full navigation so the new session cookie is sent with the request.
          window.location.assign("/admin");
        }}
      >
        Sign in with a passkey
      </button>
      <p role="status" className="min-h-6 text-sm text-ink">
        {error}
      </p>
    </div>
  );
}
