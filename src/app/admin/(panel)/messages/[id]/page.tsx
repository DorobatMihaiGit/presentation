import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/admin/ActionButton";
import {
  Badge,
  EmailStatus,
  folderHref,
  Received,
} from "@/components/admin/messages";
import { deleteMessage, setMessageStatus } from "@/server/actions/messages";
import type { MessageStatus } from "@/server/admin/schemas/messages";
import { requireAdmin } from "@/server/auth";
import { getDb } from "@/server/db";
import { getMessage } from "@/server/queries/admin/messages";

export const metadata: Metadata = { title: "Message" };

const LANGUAGE = { en: "English", ro: "Romanian" } as const;

/** The status buttons offered for each status (spec §5: read/archived/spam). */
const MOVES: Record<
  MessageStatus,
  ReadonlyArray<{ status: MessageStatus; label: string }>
> = {
  new: [
    { status: "read", label: "Mark as read" },
    { status: "archived", label: "Archive" },
    { status: "spam", label: "Mark as spam" },
  ],
  read: [
    { status: "new", label: "Mark as unread" },
    { status: "archived", label: "Archive" },
    { status: "spam", label: "Mark as spam" },
  ],
  archived: [
    { status: "read", label: "Move to inbox" },
    { status: "spam", label: "Mark as spam" },
  ],
  spam: [{ status: "read", label: "Not spam" }],
};

export default async function MessagePage({
  params,
}: PageProps<"/admin/messages/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const item = await getMessage(getDb(), id);
  if (!item) {
    notFound();
  }

  const details = [
    [
      "Email",
      <a
        key="email"
        href={`mailto:${item.email}`}
        className="text-ink underline underline-offset-4"
      >
        {item.email}
      </a>,
    ],
    ["Company", item.company ?? "—"],
    ["Language", LANGUAGE[item.locale]],
    ["Received", <Received key="received" at={item.createdAt} />],
    [
      "Notification",
      <EmailStatus key="email-status" status={item.emailStatus} />,
    ],
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={folderHref(item.status)}
        className="self-start text-sm text-ink-muted underline underline-offset-4"
      >
        Back to messages
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-title text-ink">{item.name}</h1>
        <Badge>{item.status}</Badge>
      </div>
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr]">
        {details.map(([term, value]) => (
          <div key={term} className="contents">
            <dt className="text-sm text-ink-muted">{term}</dt>
            <dd className="text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="whitespace-pre-wrap rounded-panel bg-surface p-6 text-ink ring-1 ring-line">
        {item.body}
      </p>
      <div className="flex flex-wrap gap-2">
        {MOVES[item.status].map((move) => (
          <ActionButton
            key={move.status}
            action={setMessageStatus}
            fields={{ id: item.id, status: move.status }}
            label={move.label}
          />
        ))}
        <ActionButton
          action={deleteMessage}
          fields={{ id: item.id }}
          label="Delete"
          confirmMessage={`Delete the message from ${item.name}? This cannot be undone.`}
        />
      </div>
    </div>
  );
}
