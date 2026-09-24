import { TOTP } from "otpauth";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { upsertAdmin } from "@/server/auth/admin";
import { type Auth, createAuth } from "@/server/auth/create-auth";
import { readAdminSession } from "@/server/auth/read-session";
import type { Db } from "@/server/db/types";
import { createTestDb } from "./test-db";

const ADMIN = "owner@example.com";
const PASSWORD = "correct-horse-battery";

let db: Db;
let close: () => Promise<void>;
let auth: Auth;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  auth = createAuth({
    db,
    secret: "test-secret-that-is-at-least-32-chars",
    baseURL: "http://localhost:3000",
    adminEmail: ADMIN,
  });
  await upsertAdmin(auth, {
    email: ADMIN,
    password: PASSWORD,
    name: "Owner",
    adminEmail: ADMIN,
  });
});

afterAll(async () => {
  await close();
});

/** Cookie header built from a response's Set-Cookie headers. */
function cookiesOf(response: Response): Headers {
  const cookie = response.headers
    .getSetCookie()
    .map((header) => header.split(";")[0])
    .join("; ");
  return new Headers({ cookie });
}

async function signIn(): Promise<{
  headers: Headers;
  body: Record<string, unknown>;
}> {
  const response = await auth.api.signInEmail({
    body: { email: ADMIN, password: PASSWORD },
    asResponse: true,
  });
  return { headers: cookiesOf(response), body: await response.json() };
}

describe("TOTP two-factor sign-in", () => {
  let totp: TOTP;

  it("enables 2FA only after the first code is confirmed", async () => {
    const { headers } = await signIn();

    const setup = await auth.api.enableTwoFactor({
      body: { password: PASSWORD, method: "totp" },
      headers,
    });
    if (setup.method !== "totp") {
      throw new Error("expected a TOTP setup");
    }
    expect(setup.backupCodes).toHaveLength(10);
    const uri = new URL(setup.totpURI);
    expect(uri.protocol).toBe("otpauth:");
    totp = new TOTP({ secret: uri.searchParams.get("secret") ?? "" });

    // Not enabled yet: a new sign-in still gets a session straight away.
    expect((await signIn()).body).not.toHaveProperty("twoFactorRedirect");

    const confirmed = await auth.api.verifyTOTP({
      body: { code: totp.generate() },
      headers,
      asResponse: true,
    });
    // Enabling 2FA rotates the session: the old cookie is revoked.
    expect(await readAdminSession(auth, headers, ADMIN)).toBeNull();
    expect(
      await readAdminSession(auth, cookiesOf(confirmed), ADMIN),
    ).toMatchObject({ twoFactorEnabled: true });
  });

  it("asks for a code after the password, and a wrong code gives no session", async () => {
    const { headers, body } = await signIn();

    expect(body).toMatchObject({
      twoFactorRedirect: true,
      twoFactorMethods: ["totp"],
    });
    expect(await readAdminSession(auth, headers, ADMIN)).toBeNull();
    await expect(
      auth.api.verifyTOTP({ body: { code: "000000" }, headers }),
    ).rejects.toThrow();
  });

  it("a correct code completes the sign-in", async () => {
    const { headers } = await signIn();

    const response = await auth.api.verifyTOTP({
      body: { code: totp.generate() },
      headers,
      asResponse: true,
    });

    expect(response.status).toBe(200);
    expect(
      await readAdminSession(auth, cookiesOf(response), ADMIN),
    ).toMatchObject({ email: ADMIN });
  });

  it("`admin:create --reset-2fa` turns it off for a lost authenticator", async () => {
    await upsertAdmin(auth, {
      email: ADMIN,
      password: PASSWORD,
      name: "Owner",
      adminEmail: ADMIN,
      resetSecondFactors: { db },
    });

    const { headers, body } = await signIn();
    expect(body).not.toHaveProperty("twoFactorRedirect");
    expect(await readAdminSession(auth, headers, ADMIN)).toMatchObject({
      twoFactorEnabled: false,
    });
  });
});
