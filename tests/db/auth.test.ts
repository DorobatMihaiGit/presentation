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
});

afterAll(async () => {
  await close();
});

/** Signs in through the real endpoint and returns the Cookie header a browser would send. */
async function signIn(email: string, password: string): Promise<Headers> {
  const response = await auth.api.signInEmail({
    body: { email, password },
    asResponse: true,
  });
  if (!response.ok) {
    throw new Error(`sign-in failed with ${response.status}`);
  }
  const cookie = response.headers
    .getSetCookie()
    .map((header) => header.split(";")[0])
    .join("; ");
  return new Headers({ cookie });
}

describe("single-owner auth", () => {
  it("creates the owner account once, then resets its password", async () => {
    expect(
      await upsertAdmin(auth, {
        email: "Owner@Example.com",
        password: PASSWORD,
        name: "Owner",
        adminEmail: ADMIN,
      }),
    ).toBe("created");

    const headers = await signIn(ADMIN, PASSWORD);
    expect(await readAdminSession(auth, headers, ADMIN)).toMatchObject({
      email: ADMIN,
      name: "Owner",
    });

    expect(
      await upsertAdmin(auth, {
        email: ADMIN,
        password: "a-brand-new-password",
        name: "Owner",
        adminEmail: ADMIN,
      }),
    ).toBe("updated");
    // The reset signs out every existing session and retires the old password.
    expect(await readAdminSession(auth, headers, ADMIN)).toBeNull();
    await expect(signIn(ADMIN, PASSWORD)).rejects.toThrow();
    await expect(signIn(ADMIN, "a-brand-new-password")).resolves.toBeInstanceOf(
      Headers,
    );
  });

  it("refuses to create any account other than ADMIN_EMAIL", async () => {
    await expect(
      upsertAdmin(auth, {
        email: "intruder@example.com",
        password: PASSWORD,
        name: "Intruder",
        adminEmail: ADMIN,
      }),
    ).rejects.toThrow(
      "Refusing to create intruder@example.com: it is not ADMIN_EMAIL.",
    );

    const ctx = await auth.$context;
    await expect(
      ctx.internalAdapter.createUser(
        { email: "intruder@example.com", name: "Intruder" },
        { method: "admin" },
      ),
    ).rejects.toThrow();
    expect(
      await ctx.internalAdapter.findUserByEmail("intruder@example.com"),
    ).toBeNull();
  });

  it("rejects passwords shorter than 12 characters", async () => {
    await expect(
      upsertAdmin(auth, {
        email: ADMIN,
        password: "short-pass",
        name: "Owner",
        adminEmail: ADMIN,
      }),
    ).rejects.toThrow("The password must be 12 to");
  });

  it("keeps public sign-up closed", async () => {
    await expect(
      auth.api.signUpEmail({
        body: {
          email: ADMIN,
          password: "another-long-password",
          name: "Owner",
        },
      }),
    ).rejects.toThrow();
  });

  it("treats a valid session for another email as signed out", async () => {
    const headers = await signIn(ADMIN, "a-brand-new-password");

    expect(await readAdminSession(auth, headers, ADMIN)).not.toBeNull();
    expect(
      await readAdminSession(auth, headers, "new-owner@example.com"),
    ).toBeNull();
  });

  it("treats a forged session cookie as signed out", async () => {
    const forged = new Headers({
      cookie: "better-auth.session_token=forged.signature",
    });

    expect(await readAdminSession(auth, forged, ADMIN)).toBeNull();
  });
});
