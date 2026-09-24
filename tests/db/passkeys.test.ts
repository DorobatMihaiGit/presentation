import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { upsertAdmin } from "@/server/auth/admin";
import { type Auth, createAuth } from "@/server/auth/create-auth";
import { passkey, user } from "@/server/db/schema";
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
