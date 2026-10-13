// Response headers for every route (next.config.ts headers()).
//
// The CSP has no nonce: nonces force dynamic rendering, and every public page
// is prerendered (Next's CSP guide). Scripts therefore keep 'unsafe-inline'
// for Next's inline bootstrap and flight scripts; external chunks are covered
// by 'self' (and by SRI integrity attributes, see next.config.ts).

export type CspOptions = {
  /** `next dev` needs eval (React's error overlays) and the HMR socket. */
  dev?: boolean;
  /** Extra image host, e.g. the Vercel Blob store (Task 11). */
  imageHost?: string;
};

export function contentSecurityPolicy({
  dev = false,
  imageHost,
}: CspOptions = {}): string {
  const directives: [string, ...string[]][] = [
    ["default-src", "'self'"],
    [
      "script-src",
      "'self'",
      "'unsafe-inline'",
      ...(dev ? ["'unsafe-eval'"] : []),
    ],
    ["style-src", "'self'", "'unsafe-inline'"],
    [
      "img-src",
      "'self'",
      "data:",
      "blob:",
      ...(imageHost ? [`https://${imageHost}`] : []),
    ],
    ["font-src", "'self'"],
    ["connect-src", "'self'", ...(dev ? ["ws:"] : [])],
    ["media-src", "'self'"],
    ["worker-src", "'self'", "blob:"],
    ["object-src", "'none'"],
    ["base-uri", "'self'"],
    ["form-action", "'self'"],
    ["frame-ancestors", "'none'"],
  ];
  if (!dev) directives.push(["upgrade-insecure-requests"]);
  return directives.map((parts) => parts.join(" ")).join("; ");
}

export const PERMISSIONS_POLICY = [
  "camera=()",
  "microphone=()",
  "geolocation=()",
  "payment=()",
  "usb=()",
  "interest-cohort=()",
  "browsing-topics=()",
].join(", ");

export function securityHeaders(
  options: CspOptions = {},
): { key: string; value: string }[] {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(options) },
    {
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ];
}
