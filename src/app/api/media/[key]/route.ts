import { LOCAL_MEDIA_DIR, readLocalMedia } from "@/server/media/store";

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  pdf: "application/pdf",
};

/** Serves uploads stored on the local filesystem (no Blob token: dev, tests, CI). */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/media/[key]">,
) {
  const { key } = await params;
  const body = await readLocalMedia(LOCAL_MEDIA_DIR, key);
  if (!body) {
    return new Response("Not found", { status: 404 });
  }
  const ext = key.slice(key.lastIndexOf(".") + 1);
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": CONTENT_TYPES[ext],
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
