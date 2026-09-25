/**
 * `pcb_traces`: one copper trace snaking over the top of `layer_infra`, in
 * timeline order (M6 moves a light pulse along it). Pure data, so the path
 * and its UVs are unit-tested without WebGL.
 */
export type Point2 = readonly [number, number];

/** Local XZ points on the PCB top face (metres, face spans +-0.2). */
export const PCB_TRACE_PATH: readonly Point2[] = [
  [-0.17, -0.16],
  [-0.06, -0.16],
  [-0.02, -0.12],
  [-0.02, -0.05],
  [0.03, 0],
  [0.15, 0],
  [0.17, 0.02],
  [0.17, 0.09],
  [0.11, 0.15],
  [-0.1, 0.15],
  [-0.15, 0.1],
  [-0.15, 0.03],
];

export type Ribbon = {
  positions: Float32Array;
  uvs: Float32Array;
  indices: Uint16Array;
};

/**
 * Flat ribbon (one quad per segment, lying in the XZ plane at y = 0) whose
 * U coordinate runs 0 -> 1 along the path length, V across its width.
 */
export function traceRibbon(path: readonly Point2[], width: number): Ribbon {
  const lengths = [0];
  for (let i = 1; i < path.length; i += 1) {
    const [x0, z0] = path[i - 1];
    const [x1, z1] = path[i];
    lengths.push(lengths[i - 1] + Math.hypot(x1 - x0, z1 - z0));
  }
  const total = lengths[lengths.length - 1];
  const segments = path.length - 1;
  const positions = new Float32Array(segments * 4 * 3);
  const uvs = new Float32Array(segments * 4 * 2);
  const indices = new Uint16Array(segments * 6);
  const half = width / 2;

  for (let i = 0; i < segments; i += 1) {
    const [x0, z0] = path[i];
    const [x1, z1] = path[i + 1];
    const length = Math.hypot(x1 - x0, z1 - z0);
    // Unit normal in the plane, extended by half a width at both ends so
    // consecutive quads overlap at the corners.
    const nx = -(z1 - z0) / length;
    const nz = (x1 - x0) / length;
    const ex = ((x1 - x0) / length) * half;
    const ez = ((z1 - z0) / length) * half;
    const corners = [
      [x0 - ex + nx * half, z0 - ez + nz * half],
      [x0 - ex - nx * half, z0 - ez - nz * half],
      [x1 + ex + nx * half, z1 + ez + nz * half],
      [x1 + ex - nx * half, z1 + ez - nz * half],
    ];
    const u0 = lengths[i] / total;
    const u1 = lengths[i + 1] / total;
    corners.forEach(([x, z], corner) => {
      const v = (i * 4 + corner) * 3;
      positions[v] = x;
      positions[v + 1] = 0;
      positions[v + 2] = z;
      const t = (i * 4 + corner) * 2;
      uvs[t] = corner < 2 ? u0 : u1;
      uvs[t + 1] = corner % 2 === 0 ? 1 : 0;
    });
    const base = i * 4;
    indices.set(
      [base, base + 2, base + 1, base + 1, base + 2, base + 3],
      i * 6,
    );
  }
  return { positions, uvs, indices };
}
