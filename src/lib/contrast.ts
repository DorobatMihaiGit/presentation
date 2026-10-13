// WCAG 2.x contrast, used by tests/e2e/a11y.spec.ts to check the copy over
// the poster and the live canvas (spec §3: body text >= 4.5:1).

export type Rgb = [number, number, number];

/** Relative luminance of an sRGB colour (0–255 channels). */
export function luminance([r, g, b]: Rgb): number {
  const linear = (channel: number) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** Parses a computed CSS colour (`rgb(…)` / `rgba(…)`). */
export function parseRgb(css: string): Rgb {
  const match = css.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  if (!match) {
    throw new Error(`Not an rgb() colour: ${css}`);
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/**
 * The background pixel that is hardest on `text`: the `quantile` (0.95 by
 * default, so a few stray pixels do not decide) of the pixels ranked by how
 * little contrast they leave. `pixels` is RGB(A) bytes, `channels` per pixel.
 */
export function worstBackground(
  pixels: Uint8Array,
  channels: number,
  text: Rgb,
  quantile = 0.95,
): { colour: Rgb; ratio: number } {
  const samples: { colour: Rgb; ratio: number }[] = [];
  for (let i = 0; i + 2 < pixels.length; i += channels) {
    const colour: Rgb = [pixels[i], pixels[i + 1], pixels[i + 2]];
    samples.push({ colour, ratio: contrastRatio(text, colour) });
  }
  if (samples.length === 0) {
    throw new Error("No pixels");
  }
  samples.sort((a, b) => b.ratio - a.ratio);
  return samples[
    Math.min(samples.length - 1, Math.floor(quantile * samples.length))
  ];
}
