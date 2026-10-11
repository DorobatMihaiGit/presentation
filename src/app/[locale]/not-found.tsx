import { getLocale, getTranslations } from "next-intl/server";
import { PageShell } from "@/components/site/PageShell";
import { getCv } from "@/content/get-cv";

export default async function LocaleNotFound() {
  const cv = await getCv(await getLocale());
  const t = await getTranslations("NotFound");

  return (
    <PageShell cv={cv} path={null}>
      <section className="mx-auto flex min-h-[60svh] w-full max-w-content flex-col justify-center gap-4 px-gutter py-section">
        <h1 className="text-title text-ink">{t("title")}</h1>
        <p className="text-lead text-ink-muted">{t("description")}</p>
      </section>
    </PageShell>
  );
}
