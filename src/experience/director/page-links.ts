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
 * Anchors each Skills row to its layer: `--ax` is the layer's left-most
 * point on screen minus a gap, `--ay` its vertical middle (px, viewport).
 * globals.css places the rows with them on wide landscape screens.
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
  const half = STACK_FOOTPRINT / 2;
  for (const [layer, row] of links.rows) {
    const object = scene.getObjectByName(layerObjectName(layer));
    if (!object) {
      continue;
    }
    object.updateMatrixWorld();
    let left = Number.POSITIVE_INFINITY;
    let middle = 0;
    for (const [x, z] of CORNERS) {
      corner
        .set(x * half, LAYER_HEIGHT[layer] / 2, z * half)
        .applyMatrix4(object.matrixWorld)
        .project(camera);
      left = Math.min(left, ((corner.x + 1) / 2) * width);
      middle += ((1 - corner.y) / 2) * height;
    }
    setAnchor(row, left - GAP, middle / CORNERS.length);
  }
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
