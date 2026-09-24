import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import "./src/env";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  cacheComponents: true,
  experimental: {
    serverActions: {
      // Admin uploads are capped at 4 MB (src/server/media/inspect.ts) plus
      // multipart overhead; Vercel functions accept at most 4.5 MB.
      bodySizeLimit: "4.5mb",
    },
  },
};

export default withNextIntl(nextConfig);
