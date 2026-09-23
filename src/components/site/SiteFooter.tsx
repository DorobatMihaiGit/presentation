import { useTranslations } from "next-intl";
import type { Cv } from "@/content/types";

export function SiteFooter({ cv }: { cv: Cv }) {
  const t = useTranslations("Layout");

  return (
    <footer className="mx-auto flex w-full max-w-content flex-col gap-4 border-t px-gutter py-10 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between">
      <p>© {cv.profile.fullName.value}</p>
      <a href="#top" className="text-ink transition-colors hover:text-signal">
        {t("backToTop")}
      </a>
    </footer>
  );
}
