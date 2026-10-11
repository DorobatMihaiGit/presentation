/**
 * Camera framing shared by the live canvas and the poster script. Each shot is
 * authored for a reference aspect (`cam_S1_landscape` 16:9, `cam_S1_portrait`
 * 828x1792). Any other viewport sees a centred "object-fit: cover" crop of the
 * reference frame, exactly like the poster <img>, so the poster-to-canvas
 * crossfade lines up at every size.
 */
export type Orientation = "landscape" | "portrait";

export const REFERENCE_SIZE: Record<
  Orientation,
  { width: number; height: number }
> = {
  landscape: { width: 1920, height: 1080 },
  portrait: { width: 828, height: 1792 },
};

/** Same rule as the CSS media query `(orientation: portrait)`. */
export function orientationOf(width: number, height: number): Orientation {
  return height >= width ? "portrait" : "landscape";
}

export type ViewOffset = {
  fullWidth: number;
  fullHeight: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Arguments for `PerspectiveCamera.setViewOffset` (camera.aspect must be the
 * reference aspect): the viewport becomes a window into a virtual
 * reference-aspect frame that covers it. The crop is centred, or keeps the
 * side where the stack is: landscape shots keep the right edge (the copy
 * is on the left), portrait shots the bottom (the copy is on top). Posters
 * use the same `object-position`.
 */
export function coverViewOffset(
  width: number,
  height: number,
  referenceAspect: number,
  anchor: "center" | "right" | "bottom" = "center",
): ViewOffset {
  if (width / height > referenceAspect) {
    const fullHeight = width / referenceAspect;
    const spare = fullHeight - height;
    return {
      fullWidth: width,
      fullHeight,
      x: 0,
      y: anchor === "bottom" ? spare : spare / 2,
      width,
      height,
    };
  }
  const fullWidth = height * referenceAspect;
  const spare = fullWidth - width;
  return {
    fullWidth,
    fullHeight: height,
    x: anchor === "right" ? spare : spare / 2,
    y: 0,
    width,
    height,
  };
}

/** Which edge of the reference frame a shot keeps (see coverViewOffset). */
export const CROP_ANCHOR: Record<Orientation, "right" | "bottom"> = {
  landscape: "right",
  portrait: "bottom",
};
