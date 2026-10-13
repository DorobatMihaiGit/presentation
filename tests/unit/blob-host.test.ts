import { describe, expect, it } from "vitest";
import { blobImageHost } from "@/lib/blob-host";

describe("blobImageHost", () => {
  it("derives the public host from a read/write token", () => {
    expect(
      blobImageHost({
        BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_AbC123xyz_s3cr3tValue",
      }),
    ).toBe("abc123xyz.public.blob.vercel-storage.com");
  });

  it("prefers an explicit BLOB_PUBLIC_HOST", () => {
    expect(
      blobImageHost({
        BLOB_PUBLIC_HOST: "Media.Example.com",
        BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_AbC123xyz_s3cr3tValue",
      }),
    ).toBe("media.example.com");
  });

  it("gives no host without either", () => {
    expect(blobImageHost({})).toBeUndefined();
    expect(
      blobImageHost({ BLOB_PUBLIC_HOST: "", BLOB_READ_WRITE_TOKEN: "" }),
    ).toBeUndefined();
  });

  it("gives no host for a malformed token or host, without throwing", () => {
    expect(
      blobImageHost({ BLOB_READ_WRITE_TOKEN: "not-a-token" }),
    ).toBeUndefined();
    expect(
      blobImageHost({ BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_" }),
    ).toBeUndefined();
    expect(
      blobImageHost({ BLOB_PUBLIC_HOST: "https://x.example.com/" }),
    ).toBeUndefined();
  });
});
