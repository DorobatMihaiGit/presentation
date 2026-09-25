import { Path, Shape, ShapeGeometry } from "three";
import type { StackLayer } from "@/content/types";

/**
 * Skills lights one layer at a time: a thin glowing band around the top
 * edge of the slab (bright enough for the bloom pass). Not part of the asset
 * contract; shots find the bands by these names and skip them when absent.
 */
export const edgeObjectName = (layer: StackLayer) => `edge_${layer}` as const;

function roundedRect(path: Path, half: number, radius: number): Path {
  path.moveTo(-half + radius, -half);
  path.lineTo(half - radius, -half);
  path.quadraticCurveTo(half, -half, half, -half + radius);
  path.lineTo(half, half - radius);
  path.quadraticCurveTo(half, half, half - radius, half);
  path.lineTo(-half + radius, half);
  path.quadraticCurveTo(-half, half, -half, half - radius);
  path.lineTo(-half, -half + radius);
  path.quadraticCurveTo(-half, -half, -half + radius, -half);
  return path;
}

/**
 * A flat rounded-square ring lying in the XZ plane: `size` wide outside,
 * `band` wide, following the slab's rounded corners (`radius`).
 */
export function edgeFrameGeometry(
  size: number,
  band: number,
  radius: number,
): ShapeGeometry {
  const outer = roundedRect(new Shape(), size / 2, radius) as Shape;
  outer.holes.push(
    roundedRect(new Path(), size / 2 - band, Math.max(0, radius - band)),
  );
  return new ShapeGeometry(outer, 6).rotateX(-Math.PI / 2);
}
