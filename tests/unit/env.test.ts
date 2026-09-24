import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAppEnv } from "@/lib/create-app-env";

const LOCAL_DB = "postgres://cv:cv@localhost:5432/cv";
const NEON_DB =
  "postgresql://cv_owner:secret@ep-quiet-sky-a1b2c3-pooler.eu-central-1.aws.neon.tech/cv?sslmode=require&channel_binding=require";

// The smallest valid server env; each test overrides one variable.
const BASE = {
  DATABASE_URL: LOCAL_DB,
  BETTER_AUTH_SECRET: "test-secret-that-is-at-least-32-chars",
  ADMIN_EMAIL: "owner@example.com",
};

describe("createAppEnv", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("accepts the local docker database URL", () => {
    const env = createAppEnv(BASE);

    expect(env.DATABASE_URL).toBe(LOCAL_DB);
  });

  it("accepts a Neon pooled URL with query parameters", () => {
    const env = createAppEnv({ ...BASE, DATABASE_URL: NEON_DB });

    expect(env.DATABASE_URL).toBe(NEON_DB);
  });

  it("treats an empty NEXT_PUBLIC_ASSET_BASE as unset", () => {
    const env = createAppEnv({ ...BASE, NEXT_PUBLIC_ASSET_BASE: "" });

    expect(env.NEXT_PUBLIC_ASSET_BASE).toBeUndefined();
  });

  it("accepts an absolute NEXT_PUBLIC_ASSET_BASE", () => {
    const env = createAppEnv({
      ...BASE,
      NEXT_PUBLIC_ASSET_BASE: "https://cdn.example.com",
    });

    expect(env.NEXT_PUBLIC_ASSET_BASE).toBe("https://cdn.example.com");
  });

  it("rejects a missing DATABASE_URL", () => {
    expect(() => createAppEnv({ ...BASE, DATABASE_URL: undefined })).toThrow(
      "Invalid environment variables",
    );
  });

  it("rejects a non-postgres DATABASE_URL", () => {
    expect(() =>
      createAppEnv({
        ...BASE,
        DATABASE_URL: "mysql://cv:cv@localhost:3306/cv",
      }),
    ).toThrow("Invalid environment variables");
  });

  it("rejects a NEXT_PUBLIC_ASSET_BASE without a scheme", () => {
    expect(() =>
      createAppEnv({ ...BASE, NEXT_PUBLIC_ASSET_BASE: "cdn.example.com" }),
    ).toThrow("Invalid environment variables");
  });

  it("accepts an https SITE_URL", () => {
    const env = createAppEnv({ ...BASE, SITE_URL: "https://cv.example.dev" });

    expect(env.SITE_URL).toBe("https://cv.example.dev");
  });

  it("treats an empty SITE_URL as unset", () => {
    const env = createAppEnv({ ...BASE, SITE_URL: "" });

    expect(env.SITE_URL).toBeUndefined();
  });

  it("rejects a SITE_URL without an http(s) scheme", () => {
    expect(() => createAppEnv({ ...BASE, SITE_URL: "cv.example.dev" })).toThrow(
      "Invalid environment variables",
    );
  });

  it("rejects a BETTER_AUTH_SECRET shorter than 32 characters", () => {
    expect(() =>
      createAppEnv({ ...BASE, BETTER_AUTH_SECRET: "too-short" }),
    ).toThrow("Invalid environment variables");
  });

  it("rejects a missing ADMIN_EMAIL", () => {
    expect(() => createAppEnv({ ...BASE, ADMIN_EMAIL: "" })).toThrow(
      "Invalid environment variables",
    );
  });

  it("lower-cases ADMIN_EMAIL so the allowlist match is case-insensitive", () => {
    const env = createAppEnv({ ...BASE, ADMIN_EMAIL: "Owner@Example.COM" });

    expect(env.ADMIN_EMAIL).toBe("owner@example.com");
  });

  it("accepts a Vercel Blob token", () => {
    const env = createAppEnv({
      ...BASE,
      BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_store_secret",
    });

    expect(env.BLOB_READ_WRITE_TOKEN).toBe("vercel_blob_rw_store_secret");
  });

  it("treats an empty BLOB_READ_WRITE_TOKEN as unset (local media storage)", () => {
    const env = createAppEnv({ ...BASE, BLOB_READ_WRITE_TOKEN: "" });

    expect(env.BLOB_READ_WRITE_TOKEN).toBeUndefined();
  });

  it("runs without any mail settings (local outbox)", () => {
    const env = createAppEnv({
      ...BASE,
      RESEND_API_KEY: "",
      CONTACT_FROM_EMAIL: "",
      CONTACT_TO_EMAIL: "",
    });

    expect(env.RESEND_API_KEY).toBeUndefined();
    expect(env.CONTACT_FROM_EMAIL).toBeUndefined();
    expect(env.CONTACT_TO_EMAIL).toBeUndefined();
  });

  it("accepts a Resend key together with a sender address", () => {
    const env = createAppEnv({
      ...BASE,
      RESEND_API_KEY: "re_123456789",
      CONTACT_FROM_EMAIL: "contact@example.com",
      CONTACT_TO_EMAIL: "Inbox@Example.com",
    });

    expect(env.RESEND_API_KEY).toBe("re_123456789");
    expect(env.CONTACT_FROM_EMAIL).toBe("contact@example.com");
    expect(env.CONTACT_TO_EMAIL).toBe("inbox@example.com");
  });

  it("rejects a Resend key without a sender address", () => {
    expect(() =>
      createAppEnv({ ...BASE, RESEND_API_KEY: "re_123456789" }),
    ).toThrow("Invalid environment variables");
  });

  it("rejects a RESEND_API_KEY that does not start with re_", () => {
    expect(() =>
      createAppEnv({
        ...BASE,
        RESEND_API_KEY: "sk_live_123",
        CONTACT_FROM_EMAIL: "contact@example.com",
      }),
    ).toThrow("Invalid environment variables");
  });

  it("rejects a CONTACT_FROM_EMAIL with a display name or line break", () => {
    for (const value of [
      "CV <contact@example.com>",
      "a@example.com\r\nBcc: x@example.com",
    ]) {
      expect(() =>
        createAppEnv({ ...BASE, CONTACT_FROM_EMAIL: value }),
      ).toThrow("Invalid environment variables");
    }
  });

  it("refuses to expose RESEND_API_KEY to client code", () => {
    const env = createAppEnv(
      {
        ...BASE,
        RESEND_API_KEY: "re_123456789",
        CONTACT_FROM_EMAIL: "contact@example.com",
      },
      { isServer: false },
    );

    expect(() => env.RESEND_API_KEY).toThrow(
      "Attempted to access a server-side environment variable on the client",
    );
  });

  it("refuses to expose DATABASE_URL to client code", () => {
    const env = createAppEnv(BASE, { isServer: false });

    expect(() => env.DATABASE_URL).toThrow(
      "Attempted to access a server-side environment variable on the client",
    );
  });

  it("refuses to expose BETTER_AUTH_SECRET to client code", () => {
    const env = createAppEnv(BASE, { isServer: false });

    expect(() => env.BETTER_AUTH_SECRET).toThrow(
      "Attempted to access a server-side environment variable on the client",
    );
  });
});
