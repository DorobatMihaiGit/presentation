import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import "./src/env";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  cacheComponents: true,
  async headers() {
    // Posters are content-hashed (scripts/posters.ts): a new image gets a new name.
    return [
      {
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
  experimental: {
    serverActions: {
      // Admin uploads are capped at 4 MB (src/server/media/inspect.ts) plus
      // multipart overhead; Vercel functions accept at most 4.5 MB.
      bodySizeLimit: "4.5mb",
    },
  },
};

export default withNextIntl(nextConfig);
