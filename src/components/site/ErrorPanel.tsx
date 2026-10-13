"use client";

import Link from "next/link";

export type ErrorCopy = {
  title: string;
  description: string;
  retry: string;
  home: string;
};

/** The calm fallback of the page error boundaries (public and admin). */
export function ErrorPanel({
  copy,
  homeHref,
  onRetry,
}: {
  copy: ErrorCopy;
  homeHref: string;
  onRetry: () => void;
}) {
  return (
    <main
      id="main"
      className="mx-auto flex min-h-[60svh] w-full max-w-content flex-col justify-center gap-4 px-gutter py-section"
    >
      <h1 className="text-title text-ink">{copy.title}</h1>
      <p className="text-lead text-ink-muted">{copy.description}</p>
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full bg-signal px-6 py-3 font-medium text-signal-ink"
        >
          {copy.retry}
        </button>
        <Link href={homeHref} className="text-ink underline underline-offset-4">
          {copy.home}
        </Link>
      </div>
    </main>
  );
}
