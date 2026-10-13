import { expect, type Page } from "@playwright/test";

// Records every Content-Security-Policy violation a page reports, both the
// securitypolicyviolation events and the console errors Chromium prints.

declare global {
  interface Window {
    __csp: string[];
  }
}

export async function watchCsp(page: Page): Promise<() => Promise<void>> {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /Content Security Policy/i.test(message.text())
    ) {
      consoleErrors.push(message.text());
    }
  });
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener("securitypolicyviolation", (event) => {
      window.__csp.push(
        `${event.violatedDirective} ${event.blockedURI} ${event.sourceFile}:${event.lineNumber}`,
      );
    });
  });
  return async () => {
    const events = await page.evaluate(() => window.__csp ?? []);
    expect([...events, ...consoleErrors]).toEqual([]);
  };
}

// Spec §7 (M8): the hardening headers every route sends (next.config.ts).
const EXPECTED = {
  "strict-transport-security": "max-age=63072000; includeSubDomains; preload",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-frame-options": "DENY",
  "cross-origin-opener-policy": "same-origin",
};

export function expectSecurityHeaders(headers: Record<string, string>) {
  expect(headers).toMatchObject(EXPECTED);
  const csp = headers["content-security-policy"] ?? "";
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("upgrade-insecure-requests");
  expect(csp).not.toContain("unsafe-eval");
  const permissions = headers["permissions-policy"] ?? "";
  for (const feature of [
    "camera",
    "microphone",
    "geolocation",
    "payment",
    "usb",
    "interest-cohort",
    "browsing-topics",
  ]) {
    expect(permissions).toContain(`${feature}=()`);
  }
}
