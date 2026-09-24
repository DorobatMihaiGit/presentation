import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { sendContactMessage } from "@/server/actions/contact";
import { hashIp } from "@/server/contact/ip";
import { CONTACT_IDLE } from "@/server/contact/state";
import { message } from "@/server/db/schema";
import { seedContent } from "@/server/db/seed";
import type { Db } from "@/server/db/types";
import type { Mail } from "@/server/email/mailer";
import { cacheModule, mocks, setupActionDb } from "./action-mocks";
import { form } from "./form";

const SECRET = vi.hoisted(() => "test-secret-that-is-at-least-32-chars");
const request = vi.hoisted(() => ({ headers: new Headers() }));
const outbox = vi.hoisted(() => [] as Mail[]);

vi.mock("@/server/db", () => import("./action-mocks").then((m) => m.dbModule));
vi.mock("next/cache", () =>
  import("./action-mocks").then((m) => m.cacheModule),
);
vi.mock("next/headers", () => ({ headers: async () => request.headers }));
vi.mock("@/env", () => ({ env: { BETTER_AUTH_SECRET: SECRET } }));
vi.mock("@/site", () => ({ siteUrl: "https://cv.example.com" }));
vi.mock("@/server/email", () => ({
  getMailer: () => ({
    send: async (mail: Mail) => {
      outbox.push(mail);
      return { id: String(outbox.length) };
    },
  }),
  getMailAddresses: () => ({
    from: "contact@example.com",
    ownerInbox: "owner@example.com",
  }),
}));

let close: () => Promise<void>;
let realDb: Db;

beforeAll(async () => {
  close = await setupActionDb();
  realDb = mocks.db;
  await seedContent(mocks.db);
});

afterAll(async () => {
  await close();
});

beforeEach(async () => {
  mocks.db = realDb;
  await mocks.db.delete(message);
  outbox.length = 0;
  request.headers = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" });
});

const valid = () =>
  form({
    name: "Ana Pop",
    email: "ana@example.org",
    message: "Hello",
    locale: "en",
    elapsedMs: "5000",
  });

describe("sendContactMessage (public Server Action)", () => {
  it("needs no session and stores a keyed hash of the client IP", async () => {
    const result = await sendContactMessage(CONTACT_IDLE, valid());

    expect(result).toEqual({ status: "sent" });
    const [row] = await mocks.db.select().from(message);
    expect(row.ipHash).toBe(hashIp("203.0.113.7", SECRET));
    expect(outbox.map((mail) => mail.to)).toEqual([
      "owner@example.com",
      "ana@example.org",
    ]);
  });

  it("leaves the static public pages alone (no cache expiry, no refresh)", async () => {
    await sendContactMessage(CONTACT_IDLE, valid());

    expect(mocks.updateTag).not.toHaveBeenCalled();
    expect(cacheModule.refresh).not.toHaveBeenCalled();
  });

  it("answers failed instead of throwing when the database is down", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.db = {
      transaction: async () => {
        throw new Error("connect ECONNREFUSED 127.0.0.1:5432");
      },
    } as unknown as Db;

    const result = await sendContactMessage(CONTACT_IDLE, valid());

    expect(result).toEqual({ status: "error", reason: "failed" });
    expect(error).toHaveBeenCalled();
    expect(outbox).toEqual([]);
    error.mockRestore();
  });
});
