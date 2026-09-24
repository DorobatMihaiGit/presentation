import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { upsertAdmin } from "@/server/auth/admin";
import { type Auth, createAuth } from "@/server/auth/create-auth";
import { passkey, session, user } from "@/server/db/schema";
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

/** Signs in through the real endpoint and returns the Cookie header a browser would send. */
async function signIn(): Promise<Headers> {
  const response = await auth.api.signInEmail({
    body: { email: ADMIN, password: PASSWORD },
    asResponse: true,
  });
  const cookie = response.headers
    .getSetCookie()
    .map((header) => header.split(";")[0])
    .join("; ");
  return new Headers({ cookie });
}

describe("passkeys", () => {
  it("offers WebAuthn registration bound to the site's origin", async () => {
    const response = await auth.api.signInEmail({
      body: { email: ADMIN, password: PASSWORD },
      asResponse: true,
    });
    const cookie = response.headers
      .getSetCookie()
      .map((header) => header.split(";")[0])
      .join("; ");

    const options = await auth.api.generatePasskeyRegistrationOptions({
      headers: new Headers({ cookie }),
    });

    expect(options.rp).toEqual({ id: "localhost", name: "CV admin" });
    expect(options.user.name).toBe(ADMIN);
  });

  it("adding a passkey needs a sign-in from the last 15 minutes", async () => {
    const stale = await signIn();
    const current = await auth.api.getSession({ headers: stale });
    await db
      .update(session)
      .set({ createdAt: new Date(Date.now() - 16 * 60 * 1000) })
      .where(eq(session.id, current?.session.id ?? ""));

    const refused = await auth.api.generatePasskeyRegistrationOptions({
      headers: stale,
      asResponse: true,
    });
    expect(refused.status).toBe(403);
    expect(await refused.json()).toMatchObject({ code: "SESSION_NOT_FRESH" });

    const allowed = await auth.api.generatePasskeyRegistrationOptions({
      headers: await signIn(),
      asResponse: true,
    });
    expect(allowed.status).toBe(200);
  });

  it("`admin:create --reset-2fa` removes every passkey (lost laptop)", async () => {
    const [owner] = await db.select().from(user).where(eq(user.email, ADMIN));
    await db.insert(passkey).values({
      id: "pk-1",
      name: "Old laptop",
      publicKey: "public-key",
      userId: owner.id,
      credentialID: "credential-1",
      counter: 0,
      deviceType: "singleDevice",
      backedUp: false,
    });

    await upsertAdmin(auth, {
      email: ADMIN,
      password: PASSWORD,
      name: "Owner",
      adminEmail: ADMIN,
      resetSecondFactors: { db },
    });

    expect(await db.select().from(passkey)).toEqual([]);
  });
});
