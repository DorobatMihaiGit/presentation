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
 * reference aspect): the viewport becomes a centred window into a virtual
 * reference-aspect frame that covers it.
 */
export function coverViewOffset(
  width: number,
  height: number,
  referenceAspect: number,
): ViewOffset {
  if (width / height > referenceAspect) {
    const fullHeight = width / referenceAspect;
    return {
      fullWidth: width,
      fullHeight,
      x: 0,
      y: (fullHeight - height) / 2,
      width,
      height,
    };
  }
  const fullWidth = height * referenceAspect;
  return {
    fullWidth,
    fullHeight: height,
    x: (fullWidth - width) / 2,
    y: 0,
    width,
    height,
  };
}
