import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { blobImageHost } from "./src/lib/blob-host";
import { securityHeaders } from "./src/lib/security-headers";
import "./src/env";

// Admin uploads on Vercel Blob (production): their host is allowed for
// next/image and in the CSP. Locally there is none (/api/media).
const imageHost = blobImageHost({
  BLOB_PUBLIC_HOST: process.env.BLOB_PUBLIC_HOST,
  BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
});

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  cacheComponents: true,
  async headers() {
    return [
      {
        // Every route, pages, API and files alike (src/lib/security-headers.ts).
        source: "/:path*",
        headers: securityHeaders({
          dev: process.env.NODE_ENV === "development",
          imageHost,
        }),
      },
      {
        // Posters are content-hashed (scripts/posters.ts): a new image gets a new name.
        source: "/posters/:file",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
  images: {
    // Covers and portraits from the media library: the local store, or the
    // Blob store's public host in production.
    localPatterns: [{ pathname: "/api/media/**", search: "" }],
    remotePatterns: imageHost
      ? [{ protocol: "https", hostname: imageHost, pathname: "/**" }]
      : [],
  },
  experimental: {
    serverActions: {
      // Admin uploads are capped at 4 MB (src/server/media/inspect.ts) plus
      // multipart overhead; Vercel functions accept at most 4.5 MB.
      bodySizeLimit: "4.5mb",
    },
    // The CSP keeps 'unsafe-inline' for Next's inline scripts (no nonce on
    // prerendered pages); integrity attributes pin the external chunks.
    sri: { algorithm: "sha256" },
  },
};

export default withNextIntl(nextConfig);
