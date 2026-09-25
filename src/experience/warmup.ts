import type { EffectComposer } from "postprocessing";
import {
  type Camera,
  type Object3D,
  type WebGLRenderer,
  WebGLRenderTarget,
} from "three";

type ProgramOf = { currentProgram?: { getUniforms: () => unknown } };

/**
 * Resolves in a new task after the next frame: the browser paints and
 * handles input in between, and the GPU process gets a frame's time to build
 * the programs already handed to it.
 */
export function nextTask(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => setTimeout(resolve, 0)),
  );
}

/**
 * Compiles the scene's shader programs before its first frame, without one
 * long task. Browsers without KHR_parallel_shader_compile (ANGLE on Vulkan
 * here) block on every program at its first draw: about 100 ms for the stack
 * on the Iris Xe. `compile()` only hands the programs to the GPU process,
 * which builds them in the background; then each program is waited for in
 * its own task, so a task blocks for one program at most. `offscreen` builds
 * the variants used when the scene renders into the post chain's buffer
 * (linear output, no renderer tone mapping) instead of the screen.
 */
export async function precompile(
  gl: WebGLRenderer,
  scene: Object3D,
  camera: Camera,
  offscreen: boolean,
  pause: () => Promise<void> = nextTask,
): Promise<number> {
  const target = offscreen ? new WebGLRenderTarget(1, 1) : null;
  const previous = gl.getRenderTarget();
  gl.setRenderTarget(target);
  const materials = gl.compile(scene, camera);
  gl.setRenderTarget(previous);
  target?.dispose();
  for (const material of materials) {
    await pause();
    (gl.properties.get(material) as ProgramOf).currentProgram?.getUniforms();
  }
  return materials.size;
}

/**
 * Compiles the post chain's own programs, one pass per task: each pass draws
 * once on its own (the others switched off) over the hidden scene.
 */
export async function warmPasses(
  composer: EffectComposer,
  scene: Object3D,
  pause: () => Promise<void> = nextTask,
): Promise<void> {
  const { passes } = composer;
  const enabled = passes.map((pass) => pass.enabled);
  for (const pass of passes) {
    await pause();
    for (const other of passes) {
      other.enabled = other === pass;
    }
    scene.visible = false;
    composer.render(0);
    scene.visible = true;
  }
  passes.forEach((pass, index) => {
    pass.enabled = enabled[index];
  });
}
