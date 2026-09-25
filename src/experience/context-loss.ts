/**
 * Calls `onLost` when the canvas loses its WebGL context, until the returned
 * cleanup runs. R3F forces a context loss on the old canvas some time after
 * the stage unmounts, so a listener that outlived its stage would send a new,
 * healthy stage back to the posters.
 */
export function watchContextLoss(
  canvas: EventTarget,
  onLost: () => void,
): () => void {
  let watching = true;
  const handle = (event: Event) => {
    event.preventDefault();
    if (watching) {
      onLost();
    }
  };
  canvas.addEventListener("webglcontextlost", handle);
  return () => {
    watching = false;
    canvas.removeEventListener("webglcontextlost", handle);
  };
}
