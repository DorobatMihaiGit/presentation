import sharp from "sharp";

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export type InspectedUpload =
  | {
      ok: true;
      kind: "image" | "document";
      mime: string;
      ext: "jpg" | "png" | "webp" | "avif" | "pdf";
      width: number | null;
      height: number | null;
      lqip: string | null;
    }
  | { ok: false; message: string };

const IMAGE_FORMATS = {
  jpeg: { mime: "image/jpeg", ext: "jpg" },
  png: { mime: "image/png", ext: "png" },
  webp: { mime: "image/webp", ext: "webp" },
  heif: { mime: "image/avif", ext: "avif" },
} as const;

/**
 * Decides what an upload really is from its bytes, never from the file name
 * or the browser's Content-Type. Allowed: JPEG, PNG, WebP, AVIF images and
 * PDF documents up to 4 MB. SVG and everything else is refused.
 */
export async function inspectUpload(bytes: Buffer): Promise<InspectedUpload> {
  if (bytes.length === 0) {
    return { ok: false, message: "The file is empty." };
  }
  if (bytes.length > MAX_UPLOAD_BYTES) {
    return { ok: false, message: "The file is larger than 4 MB." };
  }
  if (bytes.subarray(0, 5).toString("latin1") === "%PDF-") {
    return {
      ok: true,
      kind: "document",
      mime: "application/pdf",
      ext: "pdf",
      width: null,
      height: null,
      lqip: null,
    };
  }

  const metadata = await sharp(bytes)
    .metadata()
    .catch(() => null);
  if (!metadata) {
    return {
      ok: false,
      message: "Upload a JPEG, PNG, WebP, AVIF or PDF file.",
    };
  }
  const format =
    metadata.format === "heif" && metadata.compression !== "av1"
      ? undefined
      : IMAGE_FORMATS[metadata.format as keyof typeof IMAGE_FORMATS];
  if (!format || !metadata.width || !metadata.height) {
    return {
      ok: false,
      message: "Upload a JPEG, PNG, WebP, AVIF or PDF file.",
    };
  }

  const preview = await sharp(bytes)
    .rotate()
    .resize(16)
    .webp({ quality: 40 })
    .toBuffer();
  return {
    ok: true,
    kind: "image",
    mime: format.mime,
    ext: format.ext,
    width: metadata.autoOrient.width,
    height: metadata.autoOrient.height,
    lqip: `data:image/webp;base64,${preview.toString("base64")}`,
  };
}
