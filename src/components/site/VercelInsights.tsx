import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

/**
 * Vercel Web Analytics and Speed Insights: cookie-less, loaded after the
 * page. Only builds on Vercel render them; locally, in CI, e2e and LHCI
 * their script would 404 under /_vercel and cost Best Practices points.
 */
export function VercelInsights() {
  if (process.env.VERCEL !== "1") {
    return null;
  }
  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
