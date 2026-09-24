import type { ReactNode } from "react";

// Small read-only pieces shared by the inbox list and the message page.

const badge =
  "rounded-full px-2 py-0.5 font-mono text-label uppercase ring-1 ring-line-strong";

export function Badge({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "signal";
}) {
  return (
    <span
      className={`${badge} ${tone === "signal" ? "text-signal" : "text-ink-muted"}`}
    >
      {children}
    </span>
  );
}

/** Whether the owner notification went out (null: not attempted yet). */
export function EmailStatus({
  status,
  quietWhenSent = false,
}: {
  status: "sent" | "failed" | null;
  quietWhenSent?: boolean;
}) {
  if (status === "failed") {
    return <Badge tone="signal">Email failed</Badge>;
  }
  if (status === null) {
    return <Badge>Email pending</Badge>;
  }
  return quietWhenSent ? null : <Badge>Emailed</Badge>;
}

const RECEIVED = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export function Received({ at }: { at: Date }) {
  return (
    <time
      dateTime={at.toISOString()}
      className="font-mono text-label text-ink-subtle"
    >
      {RECEIVED.format(at)} UTC
    </time>
  );
}

/** The inbox folder a message with this status lives in. */
export function folderHref(status: "new" | "read" | "archived" | "spam") {
  return status === "archived" || status === "spam"
    ? `/admin/messages?view=${status}`
    : "/admin/messages";
}
