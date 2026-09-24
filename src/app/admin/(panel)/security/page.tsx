import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { PasskeySettings } from "@/components/admin/PasskeySettings";
import { TwoFactorSettings } from "@/components/admin/TwoFactorSettings";
import { requireAdmin } from "@/server/auth";
import { getDb } from "@/server/db";
import { passkey } from "@/server/db/schema";

export const metadata: Metadata = { title: "Security" };

export default async function SecurityPage() {
  const session = await requireAdmin();
  const passkeys = await getDb()
    .select({ id: passkey.id, name: passkey.name })
    .from(passkey)
    .where(eq(passkey.userId, session.userId));

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <h1 className="text-title text-ink">Security</h1>
      <h2 className="text-heading text-ink">Two-factor sign-in (TOTP)</h2>
      <TwoFactorSettings enabled={session.twoFactorEnabled} />
      <h2 className="text-heading text-ink">Passkeys</h2>
      <PasskeySettings passkeys={passkeys} />
    </div>
  );
}
