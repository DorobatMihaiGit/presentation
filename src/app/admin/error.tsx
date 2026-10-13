"use client";

import { ErrorPanel } from "@/components/site/ErrorPanel";

export default function AdminError({ retry }: { retry: () => void }) {
  return (
    <ErrorPanel
      copy={{
        title: "Something went wrong",
        description: "This admin page did not load. Try again, or go back.",
        retry: "Try again",
        home: "Back to the admin",
      }}
      homeHref="/admin"
      onRetry={retry}
    />
  );
}
