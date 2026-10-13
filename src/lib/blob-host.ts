// The public host of the Vercel Blob store that admin uploads live on, for
// images.remotePatterns (next.config.ts) and the CSP's img-src.
// Public Blob URLs look like https://<storeId>.public.blob.vercel-storage.com/…
// and read/write tokens like vercel_blob_rw_<storeId>_<secret> (@vercel/blob
// 2.8.0 reads the store id the same way).

const HOSTNAME =
  /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

export function isHostname(value: string): boolean {
  return HOSTNAME.test(value);
}

/** The explicit BLOB_PUBLIC_HOST, else the host derived from the token, else nothing. */
export function blobImageHost(env: {
  BLOB_PUBLIC_HOST?: string;
  BLOB_READ_WRITE_TOKEN?: string;
}): string | undefined {
  const explicit = env.BLOB_PUBLIC_HOST?.trim().toLowerCase();
  if (explicit) {
    return isHostname(explicit) ? explicit : undefined;
  }
  const token = env.BLOB_READ_WRITE_TOKEN?.trim();
  const match = token?.match(/^vercel_blob_rw_([A-Za-z0-9]+)_[A-Za-z0-9]+$/);
  return match
    ? `${match[1].toLowerCase()}.public.blob.vercel-storage.com`
    : undefined;
}
