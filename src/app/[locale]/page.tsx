import { useTranslations } from "next-intl";

export default function HomePage() {
  const t = useTranslations("HomePage");

  return (
    <section className="mx-auto flex min-h-[70svh] w-full max-w-content flex-col justify-center gap-4 px-gutter py-section">
      <h1 className="text-title text-ink">{t("title")}</h1>
      <p className="text-lead text-ink-muted">{t("subtitle")}</p>
    </section>
  );
}
