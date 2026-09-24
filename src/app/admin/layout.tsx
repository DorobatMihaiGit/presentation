import type { Metadata } from "next";
import { Suspense } from "react";
import { mono, sans } from "../fonts";
import "../globals.css";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin" },
  robots: { index: false, follow: false },
};

// Second root layout: /admin is English-only and outside next-intl routing.
// Every admin page reads the session cookie, so the whole tree is dynamic and
// sits behind one Suspense boundary (Cache Components requires it).
export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-dvh bg-canvas font-sans text-ink">
        <Suspense fallback={null}>{children}</Suspense>
      </body>
    </html>
  );
}
