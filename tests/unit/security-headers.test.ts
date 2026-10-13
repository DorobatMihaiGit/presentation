import { describe, expect, it } from "vitest";
import {
  contentSecurityPolicy,
  PERMISSIONS_POLICY,
  securityHeaders,
} from "@/lib/security-headers";

function directives(policy: string): Map<string, string[]> {
  return new Map(
    policy.split("; ").map((part) => {
      const [name, ...values] = part.split(" ");
      return [name, values];
    }),
  );
}

describe("contentSecurityPolicy", () => {
  it("builds the production policy", () => {
    const csp = directives(contentSecurityPolicy());
    expect(csp.get("default-src")).toEqual(["'self'"]);
    expect(csp.get("script-src")).toEqual(["'self'", "'unsafe-inline'"]);
    expect(csp.get("img-src")).toEqual(["'self'", "data:", "blob:"]);
    expect(csp.get("connect-src")).toEqual(["'self'"]);
    expect(csp.get("worker-src")).toEqual(["'self'", "blob:"]);
    expect(csp.get("object-src")).toEqual(["'none'"]);
    expect(csp.get("frame-ancestors")).toEqual(["'none'"]);
    expect(csp.get("form-action")).toEqual(["'self'"]);
    expect(csp.get("base-uri")).toEqual(["'self'"]);
    expect(csp.has("upgrade-insecure-requests")).toBe(true);
  });

  it("never allows eval or a nonce in production", () => {
    const policy = contentSecurityPolicy();
    expect(policy).not.toContain("unsafe-eval");
    expect(policy).not.toContain("nonce-");
  });

  it("allows eval and the HMR socket in dev, without the https upgrade", () => {
    const csp = directives(contentSecurityPolicy({ dev: true }));
    expect(csp.get("script-src")).toContain("'unsafe-eval'");
    expect(csp.get("connect-src")).toEqual(["'self'", "ws:"]);
    expect(csp.has("upgrade-insecure-requests")).toBe(false);
  });

  it("adds the image host to img-src only", () => {
    const policy = contentSecurityPolicy({
      imageHost: "abc123.public.blob.vercel-storage.com",
    });
    const csp = directives(policy);
    expect(csp.get("img-src")).toContain(
      "https://abc123.public.blob.vercel-storage.com",
    );
    expect(policy.match(/blob\.vercel-storage/g)).toHaveLength(1);
  });
});

describe("securityHeaders", () => {
  it("sends every hardening header once", () => {
    const headers = securityHeaders();
    const keys = headers.map((header) => header.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(Object.fromEntries(headers.map((h) => [h.key, h.value]))).toEqual(
      expect.objectContaining({
        "Strict-Transport-Security":
          "max-age=63072000; includeSubDomains; preload",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "X-Frame-Options": "DENY",
        "Cross-Origin-Opener-Policy": "same-origin",
      }),
    );
  });

  it("denies the powerful features", () => {
    for (const feature of [
      "camera",
      "microphone",
      "geolocation",
      "payment",
      "usb",
      "interest-cohort",
      "browsing-topics",
    ]) {
      expect(PERMISSIONS_POLICY).toContain(`${feature}=()`);
    }
  });
});
