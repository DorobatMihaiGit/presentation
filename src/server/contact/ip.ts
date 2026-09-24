import { createHmac } from "node:crypto";

/**
 * The visitor's IP address, used only for the rate limit.
 *
 * On Vercel, `x-real-ip` and `x-forwarded-for` are set by Vercel's proxy and
 * overwrite whatever the client sent, so they can be trusted. `next start`
 * fills `x-forwarded-for` from the socket only when the request has none, so
 * on a server without a trusted proxy in front a client can pick its own
 * address and step around the limit. Without any header, all visitors share
 * one bucket ("unknown").
 */
export function clientIp(headers: Headers): string {
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "unknown";
}

/**
 * Keyed hash of an IP (HMAC-SHA256): stored instead of the address, so the
 * database never holds visitor IPs and a leaked table cannot be reversed by
 * hashing all 2^32 IPv4 addresses without the secret.
 */
export function hashIp(ip: string, secret: string): string {
  return createHmac("sha256", secret).update(`contact-ip:${ip}`).digest("hex");
}
