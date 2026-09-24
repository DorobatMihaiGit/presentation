import { passkeyClient } from "@better-auth/passkey/client";
import { createAuthClient } from "better-auth/react";

/**
 * Browser-side Better Auth client, used only by admin components that need
 * WebAuthn in the browser (passkey sign-in and registration). Everything else
 * goes through server actions.
 */
export const authClient = createAuthClient({ plugins: [passkeyClient()] });
