import Link from "next/link";
import { secondaryButton } from "@/components/admin/styles";
import { signOut } from "@/server/actions/auth";
import { requireAdmin } from "@/server/auth";

const NAV = [
  { href: "/admin/profile", label: "Profile" },
  { href: "/admin/experience", label: "Experience" },
  { href: "/admin/skills", label: "Skills" },
  { href: "/admin/projects", label: "Projects" },
  { href: "/admin/media", label: "Media" },
  { href: "/admin/security", label: "Security" },
] as const;

export default async function PanelLayout({ children }: LayoutProps<"/admin">) {
  // Re-checks the session on every render; the proxy only checks the cookie exists.
  const session = await requireAdmin();

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-8 px-gutter py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <nav aria-label="Admin">
          <ul className="flex flex-wrap gap-2">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={secondaryButton}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <form action={signOut} className="flex items-center gap-3">
          <span className="text-sm text-ink-muted">{session.email}</span>
          <button type="submit" className={secondaryButton}>
            Sign out
          </button>
        </form>
      </header>
      <main id="main">{children}</main>
    </div>
  );
}
