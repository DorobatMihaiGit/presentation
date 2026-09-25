import { describe, expect, it } from "vitest";
import {
  classifyTier,
  type GpuSignals,
  lowerTier,
  tierOverride,
} from "@/experience/gpu-tier";

const desktop = (renderer: string): GpuSignals => ({
  webgl2: true,
  renderer,
  mobile: false,
  cores: 8,
  memoryGb: 16,
});

describe("classifyTier", () => {
  it("gives the reference laptop (Intel Iris Xe) tier 2", () => {
    expect(
      classifyTier(
        desktop(
          "ANGLE (Intel, Mesa Intel(R) Iris(R) Xe Graphics (ADL GT2), OpenGL ES 3.2)",
        ),
      ),
    ).toBe(2);
  });

  it("gives discrete and pro GPUs tier 3", () => {
    expect(
      classifyTier(
        desktop("ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11)"),
      ),
    ).toBe(3);
    expect(
      classifyTier(
        desktop(
          "ANGLE (Apple, ANGLE Metal Renderer: Apple M3 Pro, Unspecified Version)",
        ),
      ),
    ).toBe(3);
  });

  it("gives an Apple M1 and older Intel graphics their own tiers", () => {
    expect(
      classifyTier(
        desktop(
          "ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)",
        ),
      ),
    ).toBe(2);
    expect(
      classifyTier(
        desktop(
          "ANGLE (Intel, Mesa Intel(R) UHD Graphics 620 (KBL GT2), OpenGL 4.6)",
        ),
      ),
    ).toBe(1);
  });

  it("puts software renderers and missing WebGL 2 on posters (tier 0)", () => {
    expect(
      classifyTier(
        desktop(
          "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)",
        ),
      ),
    ).toBe(0);
    expect(classifyTier(desktop("llvmpipe (LLVM 19.1.1, 256 bits)"))).toBe(0);
    expect(classifyTier({ ...desktop(""), webgl2: false })).toBe(0);
  });

  it("gives low-end phones tier 1 and recent phones tier 2", () => {
    const phone = (renderer: string, cores = 8, memoryGb = 8): GpuSignals => ({
      webgl2: true,
      renderer,
      mobile: true,
      cores,
      memoryGb,
    });
    expect(classifyTier(phone("Mali-G52 MC2"))).toBe(1);
    expect(classifyTier(phone("Adreno (TM) 610"))).toBe(2);
    expect(classifyTier(phone("Adreno (TM) 506"))).toBe(1);
    expect(classifyTier(phone("Apple GPU", 6, 4))).toBe(1);
    expect(classifyTier(phone("Apple GPU", 6, 8))).toBe(2);
    // A phone never gets tier 3, whatever it reports.
    expect(classifyTier(phone("NVIDIA Tegra X1"))).toBe(2);
  });
});

describe("tierOverride", () => {
  it("reads ?tier=0..3 and ignores anything else", () => {
    expect(tierOverride("?tier=2")).toBe(2);
    expect(tierOverride("?capture=hero&tier=0")).toBe(0);
    expect(tierOverride("?tier=4")).toBeNull();
    expect(tierOverride("?tier=high")).toBeNull();
    expect(tierOverride("")).toBeNull();
  });
});

describe("lowerTier", () => {
  it("steps down one tier and gives up below tier 1", () => {
    expect(lowerTier(3)).toBe(2);
    expect(lowerTier(2)).toBe(1);
    expect(lowerTier(1)).toBeNull();
  });
});
