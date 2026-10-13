import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VercelInsights } from "@/components/site/VercelInsights";

afterEach(() => {
  vi.unstubAllEnvs();
});

function children(element: ReactElement | null) {
  const props = element?.props as { children?: ReactElement[] } | undefined;
  return (props?.children ?? []).map((child) => child.type);
}

describe("VercelInsights", () => {
  it("renders nothing off Vercel (local, CI, e2e, LHCI)", () => {
    vi.stubEnv("VERCEL", "");
    expect(VercelInsights()).toBeNull();
  });

  it("renders analytics and speed insights in a Vercel build", () => {
    vi.stubEnv("VERCEL", "1");
    expect(children(VercelInsights())).toEqual([Analytics, SpeedInsights]);
  });
});
