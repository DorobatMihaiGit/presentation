import { describe, expect, it } from "vitest";
import {
  deployChecks,
  EXAMPLE_AUTH_SECRET,
  parseEnvFile,
} from "@/lib/deploy-check";

const PRODUCTION = {
  DATABASE_URL: "postgres://user:pass@ep-example.eu-central-1.aws.neon.tech/cv",
  SITE_URL: "https://cv.example.com",
  BETTER_AUTH_SECRET: "c2VjcmV0LXNlY3JldC1zZWNyZXQtc2VjcmV0LXNlY3JldA==",
  ADMIN_EMAIL: "owner@example.com",
  BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_Store123_abcDEF456",
  RESEND_API_KEY: "re_123456789",
  CONTACT_FROM_EMAIL: "contact@cv.example.com",
};

const failed = (env: Record<string, string>) =>
  deployChecks(env)
    .filter((check) => !check.ok)
    .map((check) => check.name);

describe("deployChecks", () => {
  it("passes a complete production env", () => {
    expect(failed(PRODUCTION)).toEqual([]);
  });

  it("never echoes a value", () => {
    const text = JSON.stringify(
      deployChecks({ ...PRODUCTION, SITE_URL: "http://cv.example.com" }),
    );
    for (const value of Object.values(PRODUCTION)) {
      expect(text).not.toContain(value);
    }
  });

  it("requires https", () => {
    expect(
      failed({ ...PRODUCTION, SITE_URL: "http://cv.example.com" }),
    ).toEqual(["SITE_URL is https"]);
  });

  it("refuses the .env.example secret and short ones", () => {
    expect(
      failed({ ...PRODUCTION, BETTER_AUTH_SECRET: EXAMPLE_AUTH_SECRET }),
    ).toEqual(["BETTER_AUTH_SECRET is a real secret"]);
    expect(failed({ ...PRODUCTION, BETTER_AUTH_SECRET: "short" })).toEqual([
      "BETTER_AUTH_SECRET",
      "BETTER_AUTH_SECRET is a real secret",
    ]);
  });

  it("wants the sender on the site's domain when Resend is on", () => {
    expect(
      failed({ ...PRODUCTION, CONTACT_FROM_EMAIL: "me@gmail.com" }),
    ).toEqual(["CONTACT_FROM_EMAIL is on the site's domain"]);
    expect(
      failed({ ...PRODUCTION, CONTACT_FROM_EMAIL: "contact@example.com" }),
    ).toEqual(["CONTACT_FROM_EMAIL is on the site's domain"]);
  });

  it("wants an image host for Blob uploads", () => {
    expect(
      failed({ ...PRODUCTION, BLOB_READ_WRITE_TOKEN: "not-a-blob-token" }),
    ).toEqual(["Blob uploads have an image host"]);
    expect(
      failed({
        ...PRODUCTION,
        BLOB_READ_WRITE_TOKEN: "not-a-blob-token",
        BLOB_PUBLIC_HOST: "abc.public.blob.vercel-storage.com",
      }),
    ).toEqual([]);
  });

  it("reports schema errors by variable name", () => {
    const { DATABASE_URL: _, ...missing } = PRODUCTION;
    expect(failed(missing)).toEqual(["DATABASE_URL"]);
  });
});

describe("parseEnvFile", () => {
  it("reads KEY=value lines and drops quotes and comments", () => {
    expect(
      parseEnvFile(
        "# comment\nA=1\nexport B=\"two words\"\n\nC='x=y'\r\nD=\n  not a line",
      ),
    ).toEqual({ A: "1", B: "two words", C: "x=y", D: "" });
  });
});
