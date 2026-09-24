import type { Metadata } from "next";
import { CodeForm } from "@/components/admin/CodeForm";
import { panel } from "@/components/admin/styles";

export const metadata: Metadata = { title: "Two-factor sign-in" };

export default function TwoFactorPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-gutter">
      <h1 className="text-heading text-ink">Enter your authenticator code</h1>
      <div className={panel}>
        <CodeForm />
      </div>
    </main>
  );
}
