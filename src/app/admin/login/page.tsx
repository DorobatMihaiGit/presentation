import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/LoginForm";
import { panel } from "@/components/admin/styles";
import { getAdminSession } from "@/server/auth";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getAdminSession()) {
    redirect("/admin");
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-gutter">
      <h1 className="text-heading text-ink">Sign in to the admin</h1>
      <div className={panel}>
        <LoginForm />
      </div>
    </main>
  );
}
