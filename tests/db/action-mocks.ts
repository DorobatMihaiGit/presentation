import { vi } from "vitest";
import type { AdminSession } from "@/server/auth/read-session";
import { user } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import type { MediaStore } from "@/server/media/store";
import { createTestDb } from "./test-db";

// Shared state behind the vi.mock factories in the admin action tests:
//   vi.mock("@/server/db", () => import("./action-mocks").then((m) => m.dbModule));
// Server actions then run against PGlite, a controllable session, a spy for
// updateTag and a redirect that throws like Next's does.

export const OWNER: AdminSession = {
  userId: "owner",
  email: "owner@example.com",
  name: "Owner",
};

export const mocks = {
  db: undefined as unknown as Db,
  session: null as AdminSession | null,
  media: undefined as unknown as MediaStore,
  updateTag: vi.fn(),
};

export const dbModule = { getDb: () => mocks.db };
export const authModule = { getAdminSession: async () => mocks.session };
export const cacheModule = { updateTag: mocks.updateTag };
export const navigationModule = {
  redirect: (url: string): never => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
};
export const mediaModule = { getMediaStore: () => mocks.media };

/** Fresh PGlite with the owner user row (audit_log.user_id references it). */
export async function setupActionDb(): Promise<() => Promise<void>> {
  const { db, close } = await createTestDb();
  mocks.db = db;
  await db.insert(user).values({
    id: OWNER.userId,
    name: OWNER.name,
    email: OWNER.email,
    emailVerified: true,
  });
  return close;
}
