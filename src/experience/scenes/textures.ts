import { CanvasTexture, SRGBColorSpace } from "three";

/**
 * Etching for `engrave_hero`, "Mihai Dorobat — Full-stack Engineer" (owner
 * decision: a constant, not read from the admin content for now).
 * Two lines: name, then role.
 */
export const ENGRAVE_HERO_TEXT = [
  "Mihai Dorobat",
  "Full-stack Engineer",
] as const;
export const ENGRAVE_CONTACT_TEXT = ["Let's build"] as const;

function canvas(width: number, height: number) {
  const element = document.createElement("canvas");
  element.width = width;
  element.height = height;
  const context = element.getContext("2d");
  if (!context) {
    throw new Error("2D canvas unavailable");
  }
  return { element, context };
}

/** The page's Mona Sans (next/font), so the etching matches the headings. */
function sansFamily(): string {
  const family = getComputedStyle(document.documentElement)
    .getPropertyValue("--font-mona-sans")
    .trim();
  return family ? `${family}, sans-serif` : "sans-serif";
}

/** White-on-transparent text for an alpha map; line 1 large, the rest small. */
export function etchingTexture(lines: readonly string[]): CanvasTexture {
  const { element, context } = canvas(2048, 512);
  const family = sansFamily();
  context.fillStyle = "#fff";
  context.textAlign = "center";
  context.textBaseline = "middle";
  const [title, ...rest] = lines;
  context.font = `600 ${rest.length ? 196 : 240}px ${family}`;
  context.letterSpacing = "-4px";
  context.fillText(title, 1024, rest.length ? 200 : 256, 1900);
  context.font = `500 76px ${family}`;
  context.letterSpacing = "18px";
  rest.forEach((line, index) => {
    context.fillText(line.toUpperCase(), 1024, 380 + index * 90, 1900);
  });
  const texture = new CanvasTexture(element);
  texture.anisotropy = 8;
  return texture;
}

/** Solder mask, copper pours, pads and silkscreen for `layer_infra`. */
export function pcbTexture(): CanvasTexture {
  const size = 1024;
  const { element, context } = canvas(size, size);
  context.fillStyle = "#0e2419";
  context.fillRect(0, 0, size, size);

  // Deterministic pseudo-random layout (same poster every capture).
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  context.lineCap = "round";
  context.lineJoin = "round";
  for (let i = 0; i < 90; i += 1) {
    let x = Math.round(random() * 32) * 32;
    let y = Math.round(random() * 32) * 32;
    context.strokeStyle = random() > 0.2 ? "#b8733f" : "#1f5a3c";
    context.lineWidth = random() > 0.7 ? 10 : 5;
    context.beginPath();
    context.moveTo(x, y);
    for (let step = 0; step < 4; step += 1) {
      const length = 32 + Math.round(random() * 6) * 32;
      const direction = Math.floor(random() * 4);
      if (direction === 0) x += length;
      else if (direction === 1) x -= length;
      else if (direction === 2) y += length;
      else {
        x += length * 0.7;
        y += length * 0.7;
      }
      context.lineTo(x, y);
    }
    context.stroke();
    context.fillStyle = "#d4a373";
    context.beginPath();
    context.arc(x, y, 9, 0, Math.PI * 2);
    context.fill();
  }
  context.fillStyle = "#cfd8d3";
  context.font = "600 34px monospace";
  context.fillText("INFRA-04  REV C", 40, size - 40);

  const texture = new CanvasTexture(element);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}
