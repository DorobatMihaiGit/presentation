import type { Metadata } from "next";
import { TwoFactorSettings } from "@/components/admin/TwoFactorSettings";
import { requireAdmin } from "@/server/auth";

export const metadata: Metadata = { title: "Security" };

export default async function SecurityPage() {
  const session = await requireAdmin();

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <h1 className="text-title text-ink">Security</h1>
      <h2 className="text-heading text-ink">Two-factor sign-in (TOTP)</h2>
      <TwoFactorSettings enabled={session.twoFactorEnabled} />
    </div>
  );
}
