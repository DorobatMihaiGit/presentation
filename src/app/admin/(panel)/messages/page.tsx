import type { Metadata } from "next";
import Link from "next/link";
import { Badge, EmailStatus, Received } from "@/components/admin/messages";
import { secondaryButton } from "@/components/admin/styles";
import { requireAdmin } from "@/server/auth";
import { getDb } from "@/server/db";
import {
  countMessages,
  listMessages,
  MESSAGE_VIEWS,
  type MessageView,
} from "@/server/queries/admin/messages";

export const metadata: Metadata = { title: "Messages" };

const VIEWS: ReadonlyArray<{ view: MessageView; label: string }> = [
  { view: "inbox", label: "Inbox" },
  { view: "archived", label: "Archived" },
  { view: "spam", label: "Spam" },
];

export default async function MessagesPage({
  searchParams,
}: PageProps<"/admin/messages">) {
  await requireAdmin();
  const { view: requested } = await searchParams;
  const view: MessageView =
    typeof requested === "string" && requested in MESSAGE_VIEWS
      ? (requested as MessageView)
      : "inbox";
  const db = getDb();
  const [items, counts] = await Promise.all([
    listMessages(db, view),
    countMessages(db),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-title text-ink">Messages</h1>
      <nav aria-label="Folders">
        <ul className="flex flex-wrap gap-2">
          {VIEWS.map((item) => (
            <li key={item.view}>
              <Link
                href={
                  item.view === "inbox"
                    ? "/admin/messages"
                    : `/admin/messages?view=${item.view}`
                }
                aria-current={item.view === view ? "page" : undefined}
                className={`${secondaryButton} aria-[current=page]:bg-raised`}
              >
                {item.label} ({counts[item.view]})
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {items.length === 0 ? (
        <p className="text-ink-muted">No messages here.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-2 rounded-panel bg-surface p-4 ring-1 ring-line"
            >
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href={`/admin/messages/${item.id}`}
                  className={`text-ink underline underline-offset-4 ${item.status === "new" ? "font-semibold" : ""}`}
                >
                  {item.name}
                </Link>
                <span className="text-sm text-ink-muted">
                  {item.email}
                  {item.company ? ` · ${item.company}` : ""}
                </span>
                {item.status === "new" ? <Badge>New</Badge> : null}
                <EmailStatus status={item.emailStatus} quietWhenSent />
                <Received at={item.createdAt} />
              </div>
              <p className="text-sm text-ink-muted">{item.preview}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
