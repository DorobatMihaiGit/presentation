import { describe, expect, it } from "vitest";
import { clientIp, hashIp } from "@/server/contact/ip";

describe("clientIp", () => {
  it("prefers x-real-ip (set by Vercel's proxy)", () => {
    const headers = new Headers({
      "x-real-ip": "198.51.100.4",
      "x-forwarded-for": "203.0.113.7",
    });

    expect(clientIp(headers)).toBe("198.51.100.4");
  });

  it("falls back to the first x-forwarded-for entry (next start sets it)", () => {
    const headers = new Headers({
      "x-forwarded-for": " 203.0.113.7 , 10.0.0.1",
    });

    expect(clientIp(headers)).toBe("203.0.113.7");
  });

  it("uses one shared bucket when no address is known", () => {
    expect(clientIp(new Headers())).toBe("unknown");
  });
});

describe("hashIp", () => {
  const SECRET = "test-secret-that-is-at-least-32-chars";

  it("is a stable keyed SHA-256 that does not contain the address", () => {
    const hash = hashIp("203.0.113.7", SECRET);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashIp("203.0.113.7", SECRET)).toBe(hash);
    expect(hash).not.toContain("203");
  });

  it("changes with the address and with the secret", () => {
    const hash = hashIp("203.0.113.7", SECRET);

    expect(hashIp("203.0.113.8", SECRET)).not.toBe(hash);
    expect(hashIp("203.0.113.7", `${SECRET}-rotated`)).not.toBe(hash);
  });
});
