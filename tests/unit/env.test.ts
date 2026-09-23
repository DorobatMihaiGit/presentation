import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAppEnv } from "@/lib/create-app-env";

const LOCAL_DB = "postgres://cv:cv@localhost:5432/cv";
const NEON_DB =
  "postgresql://cv_owner:secret@ep-quiet-sky-a1b2c3-pooler.eu-central-1.aws.neon.tech/cv?sslmode=require&channel_binding=require";

describe("createAppEnv", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("accepts the local docker database URL", () => {
    const env = createAppEnv({ DATABASE_URL: LOCAL_DB });

    expect(env.DATABASE_URL).toBe(LOCAL_DB);
  });

  it("accepts a Neon pooled URL with query parameters", () => {
    const env = createAppEnv({ DATABASE_URL: NEON_DB });

    expect(env.DATABASE_URL).toBe(NEON_DB);
  });

  it("treats an empty NEXT_PUBLIC_ASSET_BASE as unset", () => {
    const env = createAppEnv({
      DATABASE_URL: LOCAL_DB,
      NEXT_PUBLIC_ASSET_BASE: "",
    });

    expect(env.NEXT_PUBLIC_ASSET_BASE).toBeUndefined();
  });

  it("accepts an absolute NEXT_PUBLIC_ASSET_BASE", () => {
    const env = createAppEnv({
      DATABASE_URL: LOCAL_DB,
      NEXT_PUBLIC_ASSET_BASE: "https://cdn.example.com",
    });

    expect(env.NEXT_PUBLIC_ASSET_BASE).toBe("https://cdn.example.com");
  });

  it("rejects a missing DATABASE_URL", () => {
    expect(() => createAppEnv({})).toThrow("Invalid environment variables");
  });

  it("rejects a non-postgres DATABASE_URL", () => {
    expect(() =>
      createAppEnv({ DATABASE_URL: "mysql://cv:cv@localhost:3306/cv" }),
    ).toThrow("Invalid environment variables");
  });

  it("rejects a NEXT_PUBLIC_ASSET_BASE without a scheme", () => {
    expect(() =>
      createAppEnv({
        DATABASE_URL: LOCAL_DB,
        NEXT_PUBLIC_ASSET_BASE: "cdn.example.com",
      }),
    ).toThrow("Invalid environment variables");
  });

  it("accepts an https SITE_URL", () => {
    const env = createAppEnv({
      DATABASE_URL: LOCAL_DB,
      SITE_URL: "https://cv.example.dev",
    });

    expect(env.SITE_URL).toBe("https://cv.example.dev");
  });

  it("treats an empty SITE_URL as unset", () => {
    const env = createAppEnv({ DATABASE_URL: LOCAL_DB, SITE_URL: "" });

    expect(env.SITE_URL).toBeUndefined();
  });

  it("rejects a SITE_URL without an http(s) scheme", () => {
    expect(() =>
      createAppEnv({ DATABASE_URL: LOCAL_DB, SITE_URL: "cv.example.dev" }),
    ).toThrow("Invalid environment variables");
  });

  it("refuses to expose DATABASE_URL to client code", () => {
    const env = createAppEnv({ DATABASE_URL: LOCAL_DB }, { isServer: false });

    expect(() => env.DATABASE_URL).toThrow(
      "Attempted to access a server-side environment variable on the client",
    );
  });
});
