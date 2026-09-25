/**
 * GPU tiers (spec §3, amended 2026-09-24 for the three.js-only pipeline):
 * - 0: posters and CSS only (no WebGL 2, or a software renderer)
 * - 1: light live scene (DPR 1, no transmission, no postfx)
 * - 2: reference (Intel Iris Xe, Apple M1, recent phones): DPR <= 1.5, postfx
 * - 3: discrete or pro GPUs: DPR <= 2
 * Reduced motion, Save-Data and the "Motion" toggle are handled before this
 * (src/experience/motion-preference.ts); they never reach the classifier.
 */
export type Tier = 0 | 1 | 2 | 3;

/** A tier that renders the live stage. */
export type LiveTier = Exclude<Tier, 0>;

export type GpuSignals = {
  webgl2: boolean;
  /** Unmasked WebGL renderer string, or the masked one when unavailable. */
  renderer: string;
  /** Coarse primary pointer (phones, tablets). */
  mobile: boolean;
  cores: number;
  /** navigator.deviceMemory (Chromium only), in GB. */
  memoryGb?: number;
};

const SOFTWARE = /swiftshader|llvmpipe|softpipe|software|basic render/i;
const STRONG =
  /nvidia|geforce|quadro|\brtx\b|radeon (rx|pro)|apple m\d+ (pro|max|ultra)/i;
const WEAK =
  /mali-(t\d+|g[0-5]\d)\b|adreno \(tm\) [1-5]\d\d\b|powervr|intel\(r\) (hd|uhd) graphics/i;

export function classifyTier(signals: GpuSignals): Tier {
  if (!signals.webgl2 || SOFTWARE.test(signals.renderer)) {
    return 0;
  }
  if (WEAK.test(signals.renderer)) {
    return 1;
  }
  if (signals.mobile && (signals.cores <= 4 || (signals.memoryGb ?? 8) <= 4)) {
    return 1;
  }
  if (!signals.mobile && STRONG.test(signals.renderer)) {
    return 3;
  }
  return 2;
}

/** `?tier=0..3` forces a tier (tests, poster capture, manual checks). */
export function tierOverride(search: string): Tier | null {
  const value = new URLSearchParams(search).get("tier");
  return value === "0" || value === "1" || value === "2" || value === "3"
    ? (Number(value) as Tier)
    : null;
}

/** One tier lower for a runtime downgrade; null = give up on live 3D. */
export function lowerTier(tier: LiveTier): LiveTier | null {
  return tier > 1 ? ((tier - 1) as LiveTier) : null;
}

/** Reads the signals from a throwaway WebGL 2 context (browser only). */
export function readGpuSignals(): GpuSignals {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2");
  let renderer = "";
  if (gl) {
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    renderer = String(
      gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
    );
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    webgl2: gl !== null,
    renderer,
    mobile: matchMedia("(pointer: coarse)").matches,
    cores: nav.hardwareConcurrency || 4,
    memoryGb: nav.deviceMemory,
  };
}
