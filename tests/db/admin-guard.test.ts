/// <reference types="vite/client" />
import { count } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { type AdminFormAction, IDLE } from "@/server/admin/action-result";
import { auditLog } from "@/server/db/schema";
import { seedContent } from "@/server/db/seed";
import { mocks, setupActionDb } from "./action-mocks";

vi.mock("@/server/db", () => import("./action-mocks").then((m) => m.dbModule));
vi.mock("@/server/auth", () =>
  import("./action-mocks").then((m) => m.authModule),
);
vi.mock("next/cache", () =>
  import("./action-mocks").then((m) => m.cacheModule),
);
vi.mock("next/navigation", () =>
  import("./action-mocks").then((m) => m.navigationModule),
);
vi.mock("@/server/media", () => ({ getMediaStore: () => null }));

// Every export of every module in src/server/actions/ except the two public
// ones: auth.ts (sign-in and sign-out run before there is a session) and
// contact.ts (the visitor contact form, tests/db/contact-action.test.ts). A
// module or action added later is covered without touching this test.
const modules = import.meta.glob(
  [
    "../../src/server/actions/*.ts",
    "!../../src/server/actions/auth.ts",
    "!../../src/server/actions/contact.ts",
  ],
  { eager: true },
) as Record<string, Record<string, AdminFormAction>>;
const ACTIONS = Object.values(modules).flatMap((mod) => Object.entries(mod));

let close: () => Promise<void>;

beforeAll(async () => {
  close = await setupActionDb();
  await seedContent(mocks.db);
  mocks.session = null;
});

afterAll(async () => {
  await close();
});

describe("admin server actions without a session", () => {
  it("finds the actions", () => {
    expect(ACTIONS.map(([name]) => name)).toEqual(
      expect.arrayContaining([
        "saveProfile",
        "setMessageStatus",
        "deleteMessage",
      ]),
    );
  });

  it.each(ACTIONS)(
    "%s returns 401 and changes nothing",
    async (_name, action) => {
      const data = new FormData();
      data.set("id", "ardea-health");
      data.set("slug", "ledger-lens");

      const result = await action(IDLE, data);

      expect(result).toEqual({
        status: "error",
        code: 401,
        message: "Your session has ended. Sign in again.",
      });
      const [{ value }] = await mocks.db
        .select({ value: count() })
        .from(auditLog);
      expect(value).toBe(0);
      expect(mocks.updateTag).not.toHaveBeenCalled();
    },
  );
});
