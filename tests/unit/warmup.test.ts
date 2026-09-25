import type { EffectComposer, Pass } from "postprocessing";
import { Material, Object3D, type WebGLRenderer } from "three";
import { describe, expect, it } from "vitest";
import { precompile, warmPasses } from "@/experience/warmup";

/** A renderer that records what precompile asks of it. */
function fakeRenderer(materials: Material[]) {
  const log: string[] = [];
  let target: unknown = null;
  const programs = new Map(
    materials.map((material, index) => [
      material,
      { currentProgram: { getUniforms: () => log.push(`wait ${index}`) } },
    ]),
  );
  const gl = {
    getRenderTarget: () => target,
    setRenderTarget: (next: unknown) => {
      target = next;
    },
    compile: () => {
      log.push(target ? "compile offscreen" : "compile screen");
      return new Set(materials);
    },
    properties: { get: (material: Material) => programs.get(material) },
  };
  return { gl: gl as unknown as WebGLRenderer, log, target: () => target };
}

describe("precompile", () => {
  it("hands over every program at once, then waits for one per task", async () => {
    const { gl, log } = fakeRenderer([new Material(), new Material()]);
    const pause = async () => {
      log.push("pause");
    };

    const count = await precompile(
      gl,
      new Object3D(),
      {} as never,
      true,
      pause,
    );

    expect(count).toBe(2);
    expect(log).toEqual([
      "compile offscreen",
      "pause",
      "wait 0",
      "pause",
      "wait 1",
    ]);
  });

  it("builds screen variants without the post chain and restores the target", async () => {
    const { gl, log, target } = fakeRenderer([new Material()]);

    await precompile(gl, new Object3D(), {} as never, false, async () => {});

    expect(log[0]).toBe("compile screen");
    expect(target()).toBeNull();
  });
});

describe("warmPasses", () => {
  it("draws each pass on its own over the hidden scene, one per task", async () => {
    const scene = new Object3D();
    const log: string[] = [];
    const passes = ["render", "bloom", "fxaa"].map((name) => ({
      name,
      enabled: name !== "fxaa",
    })) as unknown as Pass[];
    const composer = {
      passes,
      render: () =>
        log.push(
          `${passes
            .filter((pass) => pass.enabled)
            .map((pass) => pass.name)
            .join("+")} visible=${scene.visible}`,
        ),
    } as unknown as EffectComposer;

    await warmPasses(composer, scene, async () => {
      log.push("pause");
    });

    expect(log).toEqual([
      "pause",
      "render visible=false",
      "pause",
      "bloom visible=false",
      "pause",
      "fxaa visible=false",
    ]);
    expect(passes.map((pass) => pass.enabled)).toEqual([true, true, false]);
    expect(scene.visible).toBe(true);
  });
});
