import { eq, sql } from "drizzle-orm";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { deleteMessage, setMessageStatus } from "@/server/actions/messages";
import { IDLE } from "@/server/admin/action-result";
import { auditLog, message } from "@/server/db/schema";
import {
  countMessages,
  getMessage,
  listMessages,
} from "@/server/queries/admin/messages";
import { cacheModule, mocks, OWNER, setupActionDb } from "./action-mocks";
import { form } from "./form";

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

let close: () => Promise<void>;

beforeAll(async () => {
  close = await setupActionDb();
});

afterAll(async () => {
  await close();
});

type Status = "new" | "read" | "archived" | "spam";

async function addMessage(name: string, status: Status, minutesAgo: number) {
  const [row] = await mocks.db
    .insert(message)
    .values({
      name,
      email: `${name.toLowerCase()}@example.org`,
      body: `Hello from ${name}`,
      locale: "en",
      ipHash: "hash",
      status,
      emailStatus: "sent",
      createdAt: sql`now() - make_interval(mins => ${minutesAgo})`,
    })
    .returning({ id: message.id });
  return row.id;
}

let ids: Record<string, string>;

beforeEach(async () => {
  await mocks.db.delete(message);
  await mocks.db.delete(auditLog);
  ids = {
    ana: await addMessage("Ana", "new", 1),
    dan: await addMessage("Dan", "read", 30),
    old: await addMessage("Old", "archived", 60),
    bot: await addMessage("Bot", "spam", 5),
  };
  mocks.session = OWNER;
  mocks.updateTag.mockClear();
  cacheModule.refresh.mockClear();
});

describe("message queries", () => {
  it("lists new and read messages in the inbox, newest first", async () => {
    const inbox = await listMessages(mocks.db, "inbox");

    expect(inbox.map((m) => [m.name, m.status])).toEqual([
      ["Ana", "new"],
      ["Dan", "read"],
    ]);
    expect(inbox[0].preview).toBe("Hello from Ana");
  });

  it("lists archived and spam messages separately", async () => {
    expect(
      (await listMessages(mocks.db, "archived")).map((m) => m.name),
    ).toEqual(["Old"]);
    expect((await listMessages(mocks.db, "spam")).map((m) => m.name)).toEqual([
      "Bot",
    ]);
  });

  it("counts each folder and the unread messages", async () => {
    expect(await countMessages(mocks.db)).toEqual({
      inbox: 2,
      unread: 1,
      archived: 1,
      spam: 1,
    });
  });

  it("returns null for an unknown or malformed id instead of failing", async () => {
    expect(
      await getMessage(mocks.db, "00000000-0000-4000-8000-000000000000"),
    ).toBeNull();
    expect(await getMessage(mocks.db, "not-a-uuid")).toBeNull();
    expect((await getMessage(mocks.db, ids.ana))?.body).toBe("Hello from Ana");
  });
});

describe("message actions", () => {
  it("marks a message read, audits it and refreshes only the admin page", async () => {
    const result = await setMessageStatus(
      IDLE,
      form({ id: ids.ana, status: "read" }),
    );

    expect(result).toEqual({ status: "ok", message: "Marked as read." });
    const [row] = await mocks.db
      .select()
      .from(message)
      .where(eq(message.id, ids.ana));
    expect(row.status).toBe("read");
    const [entry] = await mocks.db.select().from(auditLog);
    expect(entry).toMatchObject({
      userId: OWNER.userId,
      action: "update",
      entity: "message",
      entityId: ids.ana,
      diff: { status: "read" },
    });
    expect(cacheModule.refresh).toHaveBeenCalledTimes(1);
    expect(mocks.updateTag).not.toHaveBeenCalled();
  });

  it("archives, flags as spam and moves back to the inbox", async () => {
    for (const [status, text] of [
      ["archived", "Archived."],
      ["spam", "Marked as spam."],
      ["new", "Marked as unread."],
    ] as const) {
      expect(
        await setMessageStatus(IDLE, form({ id: ids.dan, status })),
      ).toEqual({ status: "ok", message: text });
    }
    expect((await getMessage(mocks.db, ids.dan))?.status).toBe("new");
  });

  it("rejects an unknown status", async () => {
    const result = await setMessageStatus(
      IDLE,
      form({ id: ids.ana, status: "deleted" }),
    );

    expect(result).toMatchObject({ status: "error", code: 400 });
  });

  it("answers 404 for a message that no longer exists", async () => {
    const result = await setMessageStatus(
      IDLE,
      form({ id: "00000000-0000-4000-8000-000000000000", status: "read" }),
    );

    expect(result).toEqual({
      status: "error",
      code: 404,
      message: "This message no longer exists.",
    });
  });

  it("deletes a message without copying its content into the audit log", async () => {
    await expect(deleteMessage(IDLE, form({ id: ids.bot }))).rejects.toThrow(
      "NEXT_REDIRECT /admin/messages?view=spam",
    );

    expect(await getMessage(mocks.db, ids.bot)).toBeNull();
    const [entry] = await mocks.db.select().from(auditLog);
    expect(entry).toMatchObject({
      action: "delete",
      entity: "message",
      entityId: ids.bot,
      diff: null,
    });
    expect(mocks.updateTag).not.toHaveBeenCalled();
  });
});
