"use client";

import { useLocale, useTranslations } from "next-intl";
import { ErrorPanel } from "@/components/site/ErrorPanel";

export default function LocaleError({ retry }: { retry: () => void }) {
  const t = useTranslations("Error");
  const locale = useLocale();

  return (
    <ErrorPanel
      copy={{
        title: t("title"),
        description: t("description"),
        retry: t("retry"),
        home: t("home"),
      }}
      homeHref={`/${locale}`}
      onRetry={retry}
    />
  );
}
