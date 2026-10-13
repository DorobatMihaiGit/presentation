import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { LOCAL_MEDIA_DIR, readLocalMedia } from "@/server/media/store";

// Open Graph cards (1200x630) for the home pages and the project pages,
// rendered by next/og at build time and again when the `cv` tag expires.

export const OG_SIZE = { width: 1200, height: 630 } as const;

// Satori reads TTF/OTF, not the woff2 next/font serves (src/app/og/OFL.txt).
const font = readFile(
  path.join(process.cwd(), "src/app/og/MonaSans-SemiBold.ttf"),
);

const COLORS = {
  canvas: "#0b0c0f",
  ink: "#eceef2",
  muted: "#a9afba",
  signal: "#7cc5ff",
};

/** A media library image as a PNG data URL Satori can draw, or null. */
export async function ogImageData(url: string): Promise<string | null> {
  try {
    const local = url.match(/^\/api\/media\/([^/?#]+)$/);
    let bytes: Buffer | null;
    if (local) {
      bytes = await readLocalMedia(LOCAL_MEDIA_DIR, local[1]);
    } else if (url.startsWith("https://")) {
      const response = await fetch(url);
      bytes = response.ok ? Buffer.from(await response.arrayBuffer()) : null;
    } else {
      bytes = null;
    }
    if (!bytes) {
      return null;
    }
    // Satori draws PNG and JPEG only; covers may be WebP or AVIF.
    const png = await sharp(bytes)
      .resize(OG_SIZE.width, OG_SIZE.height, { fit: "cover" })
      .png()
      .toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}

export type OgCard = {
  eyebrow: string;
  title: string;
  lines: string[];
  background?: string | null;
};

/** The card as PNG bytes: serializable, so it can live in a "use cache" entry. */
export async function ogPng(card: OgCard): Promise<Uint8Array> {
  return new Uint8Array(await (await renderOgCard(card)).arrayBuffer());
}

/** A route handler response for PNG bytes from ogPng. */
export function pngResponse(png: Uint8Array): Response {
  return new Response(png as BodyInit, {
    headers: { "Content-Type": "image/png" },
  });
}

export async function renderOgCard({
  eyebrow,
  title,
  lines,
  background,
}: OgCard): Promise<ImageResponse> {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        background: COLORS.canvas,
        backgroundImage:
          "radial-gradient(circle at 78% 30%, rgba(124, 197, 255, 0.22), rgba(11, 12, 15, 0) 55%)",
        color: COLORS.ink,
        fontFamily: "Mona Sans",
      }}
    >
      {background ? (
        // biome-ignore lint/performance/noImgElement: Satori draws <img>, not next/image.
        <img
          src={background}
          alt=""
          width={OG_SIZE.width}
          height={OG_SIZE.height}
          style={{ position: "absolute", top: 0, left: 0 }}
        />
      ) : null}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          width: "100%",
          height: "100%",
          padding: "72px 80px",
          ...(background
            ? {
                backgroundImage:
                  "linear-gradient(180deg, rgba(11, 12, 15, 0.15) 0%, rgba(11, 12, 15, 0.92) 70%)",
              }
            : {}),
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 28,
            color: COLORS.signal,
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 7,
              background: COLORS.signal,
            }}
          />
          {eyebrow}
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: title.length > 28 ? 64 : 80,
            lineHeight: 1.05,
            letterSpacing: -2,
          }}
        >
          {title}
        </div>
        {lines.map((line) => (
          <div
            key={line}
            style={{
              marginTop: 20,
              fontSize: 34,
              lineHeight: 1.3,
              color: COLORS.muted,
            }}
          >
            {line}
          </div>
        ))}
      </div>
    </div>,
    {
      ...OG_SIZE,
      fonts: [
        { name: "Mona Sans", data: await font, style: "normal", weight: 600 },
      ],
    },
  );
}
