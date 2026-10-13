"use client";

import { usePathname } from "next/navigation";
import { ErrorPanel } from "@/components/site/ErrorPanel";
import { errorCopy } from "@/lib/error-copy";

// No next-intl here: the boundary ships with every page (src/lib/error-copy.ts).
export default function LocaleError({ retry }: { retry: () => void }) {
  const { lang, copy } = errorCopy(usePathname());

  return <ErrorPanel copy={copy} homeHref={`/${lang}`} onRetry={retry} />;
}
