import { Object3D, PerspectiveCamera } from "three";
import { describe, expect, it } from "vitest";
import { STACK_LAYERS } from "@/content/types";
import {
  anchorRows,
  type PageLinks,
  stackBox,
} from "@/experience/director/page-links";
import { layerObjectName, stackLayout } from "@/experience/scenes/stack-layout";

/** The five slabs, closed, and a camera 1.2 m in front of the stack. */
function studio(cameraZ = 1.2) {
  const scene = new Object3D();
  for (const placement of stackLayout()) {
    const slab = new Object3D();
    slab.name = placement.name;
    slab.position.y = placement.y;
    scene.add(slab);
  }
  const camera = new PerspectiveCamera(30, 16 / 9, 0.01, 30);
  camera.position.set(0, 0.12, cameraZ);
  camera.lookAt(0, 0.12, 0);
  camera.updateMatrixWorld();
  return { scene, camera };
}

/** A Skills row: just the style calls anchorRows makes. */
function fakeRow() {
  const values = new Map<string, string>();
  return {
    values,
    style: {
      setProperty: (name: string, value: string) => values.set(name, value),
      getPropertyValue: (name: string) => values.get(name) ?? "",
    },
  } as unknown as HTMLElement & { values: Map<string, string> };
}

describe("stackBox", () => {
  it("is the stack's box on screen, in viewport pixels", () => {
    const { scene, camera } = studio();
    const box = stackBox(scene, camera, 1920, 1080);

    expect(box).not.toBeNull();
    const [x, y, width, height] = box ?? [0, 0, 0, 0];
    // Centred in front of the camera, a little taller than wide at 1.2 m.
    expect(x + width / 2).toBeCloseTo(960, -1);
    expect(y + height / 2).toBeGreaterThan(400);
    expect(width).toBeGreaterThan(400);
    expect(width).toBeLessThan(1000);
    expect(height).toBeGreaterThan(200);
  });

  it("has no box while part of the stack is behind the camera", () => {
    const { scene, camera } = studio(0.1);

    expect(stackBox(scene, camera, 1920, 1080)).toBeNull();
  });
});

describe("anchorRows", () => {
  it("leaves a row where it was while its layer is behind the camera", () => {
    // M6 wrote --ay: -158339px here, and a jump to the end of the page grew
    // it by 13,000 px of empty scroll.
    const { scene, camera } = studio(0.1);
    const rows = new Map(STACK_LAYERS.map((layer) => [layer, fakeRow()]));
    const links: PageLinks = { list: fakeRow(), rows, jobs: [] };

    anchorRows(links, scene, camera, 1920, 1080, 1);

    for (const layer of STACK_LAYERS) {
      expect(
        (rows.get(layer) as unknown as { values: Map<string, string> }).values
          .size,
        layerObjectName(layer),
      ).toBe(0);
    }
  });

  it("anchors every row next to its layer when the stack is in view", () => {
    const { scene, camera } = studio();
    const rows = new Map(STACK_LAYERS.map((layer) => [layer, fakeRow()]));

    anchorRows(
      { list: fakeRow(), rows, jobs: [] },
      scene,
      camera,
      1920,
      1080,
      1,
    );

    const ay = STACK_LAYERS.map((layer) =>
      Number.parseInt(
        (
          rows.get(layer) as unknown as { values: Map<string, string> }
        ).values.get("--ay") ?? "",
        10,
      ),
    );
    // Glass on top: rows go down the screen from interface to craft.
    expect(ay).toEqual([...ay].sort((a, b) => a - b));
  });
});
