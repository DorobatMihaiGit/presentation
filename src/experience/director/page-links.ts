import { type Camera, type Object3D, Vector3 } from "three";
import { STACK_LAYERS, type StackLayer } from "@/content/types";
import {
  LAYER_HEIGHT,
  layerObjectName,
  STACK_FOOTPRINT,
} from "../scenes/stack-layout";

/** Gap (px) between a Skills row and its layer on screen. */
const GAP = 28;

/** The page elements the stage writes to (the text itself stays SSR). */
export type PageLinks = {
  /** The Skills list; its --rows (0..1) fades the anchored rows in. */
  list: HTMLElement | null;
  rows: Map<StackLayer, HTMLElement>;
  jobs: HTMLElement[];
};

export function findPageLinks(): PageLinks {
  const rows = new Map<StackLayer, HTMLElement>();
  for (const layer of STACK_LAYERS) {
    const row = document.querySelector<HTMLElement>(
      `#skills [data-layer="${layer}"]`,
    );
    if (row) rows.set(layer, row);
  }
  return {
    list: document.querySelector<HTMLElement>("#skills ol"),
    rows,
    jobs: [...document.querySelectorAll<HTMLElement>("#experience ol > li")],
  };
}

const written = new WeakMap<HTMLElement, string>();

function setAnchor(element: HTMLElement, x: number, y: number) {
  const value = `${Math.round(x)}px ${Math.round(y)}px`;
  if (written.get(element) === value) {
    return;
  }
  written.set(element, value);
  element.style.setProperty("--ax", `${Math.round(x)}px`);
  element.style.setProperty("--ay", `${Math.round(y)}px`);
}

const corner = new Vector3();
const CORNERS = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
] as const;

/**
 * Projects points of a layer's slab (x, z in -1..1 of the half footprint;
 * y in metres above its bottom face) to viewport pixels. Null when one of
 * them is behind the camera: its projection would land mirrored across the
 * screen (M6 anchored a row 158,339 px up that way).
 */
function project(
  object: Object3D,
  points: readonly (readonly [number, number, number])[],
  camera: Camera,
  width: number,
  height: number,
): [number, number][] | null {
  const half = STACK_FOOTPRINT / 2;
  const screen: [number, number][] = [];
  for (const [x, y, z] of points) {
    corner
      .set(x * half, y, z * half)
      .applyMatrix4(object.matrixWorld)
      .project(camera);
    if (Math.abs(corner.z) > 1) {
      return null;
    }
    screen.push([((corner.x + 1) / 2) * width, ((1 - corner.y) / 2) * height]);
  }
  return screen;
}

/**
 * Anchors each Skills row to its layer: `--ax` is the layer's left-most
 * point on screen minus a gap, `--ay` its vertical middle (px, viewport).
 * globals.css places the rows with them on wide landscape screens. A row
 * whose layer is partly behind the camera keeps its last anchor.
 */
export function anchorRows(
  links: PageLinks,
  scene: Object3D,
  camera: Camera,
  width: number,
  height: number,
  shown: number,
): void {
  const rows = String(Math.round(shown * 100) / 100);
  if (links.list && links.list.style.getPropertyValue("--rows") !== rows) {
    links.list.style.setProperty("--rows", rows);
  }
  for (const [layer, row] of links.rows) {
    const object = scene.getObjectByName(layerObjectName(layer));
    if (!object) {
      continue;
    }
    object.updateMatrixWorld();
    const middle = LAYER_HEIGHT[layer] / 2;
    const points = project(
      object,
      CORNERS.map(([x, z]) => [x, middle, z] as const),
      camera,
      width,
      height,
    );
    if (!points) {
      continue;
    }
    const left = Math.min(...points.map(([x]) => x));
    const y = points.reduce((sum, [, py]) => sum + py, 0) / points.length;
    setAnchor(row, left - GAP, y);
  }
}

/**
 * The whole stack's box on screen, `[x, y, width, height]` in viewport
 * pixels (every corner of every slab), or null while part of it is behind
 * the camera. The stage writes it to the layer as `data-box` for tests.
 */
export function stackBox(
  scene: Object3D,
  camera: Camera,
  width: number,
  height: number,
): [number, number, number, number] | null {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const layer of STACK_LAYERS) {
    const object = scene.getObjectByName(layerObjectName(layer));
    if (!object) {
      continue;
    }
    object.updateMatrixWorld();
    const points = project(
      object,
      CORNERS.flatMap(([x, z]) => [
        [x, 0, z] as const,
        [x, LAYER_HEIGHT[layer], z] as const,
      ]),
      camera,
      width,
      height,
    );
    if (!points) {
      return null;
    }
    for (const [x, y] of points) {
      xs.push(x);
      ys.push(y);
    }
  }
  if (xs.length === 0) {
    return null;
  }
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  return [left, top, Math.max(...xs) - left, Math.max(...ys) - top];
}

function mark(element: HTMLElement, lit: boolean) {
  if (lit !== element.hasAttribute("data-lit")) {
    element.toggleAttribute("data-lit", lit);
  }
}

/** Marks the Skills row whose layer glows and the job the pulse lights. */
export function markLit(
  links: PageLinks,
  layer: StackLayer | null,
  job: number,
): void {
  for (const [rowLayer, row] of links.rows) {
    mark(row, rowLayer === layer);
  }
  links.jobs.forEach((element, index) => {
    mark(element, index === job);
  });
}
