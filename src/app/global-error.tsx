"use client";

import { globalErrorCopy } from "@/lib/global-error-copy";

// Replaces the root layouts when they fail, so no stylesheet, font or
// next-intl provider is available: inline styles, copy picked from the URL.
export default function GlobalError({ retry }: { retry: () => void }) {
  const { lang, copy } = globalErrorCopy(
    typeof location === "undefined" ? "/" : location.pathname,
  );

  return (
    <html lang={lang}>
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: "#0b0c0f",
          color: "#eceef2",
          fontFamily: "system-ui, sans-serif",
          padding: "2rem",
        }}
      >
        <title>{copy.title}</title>
        <main style={{ maxWidth: "36rem" }}>
          <h1 style={{ fontSize: "2rem", margin: "0 0 1rem" }}>{copy.title}</h1>
          <p style={{ color: "#a9afba", lineHeight: 1.5 }}>
            {copy.description}
          </p>
          <p style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
            <button
              type="button"
              onClick={retry}
              style={{
                borderRadius: "999px",
                border: 0,
                padding: "0.75rem 1.5rem",
                background: "#7cc5ff",
                color: "#06121c",
                font: "inherit",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {copy.retry}
            </button>
            {/* A full page load: the client router is what failed. */}
            <a href={`/${lang}`} style={{ color: "inherit" }}>
              {copy.home}
            </a>
          </p>
        </main>
      </body>
    </html>
  );
}
