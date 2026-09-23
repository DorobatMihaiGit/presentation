import { getLocale, getTranslations } from "next-intl/server";
import { About } from "@/components/sections/About";
import { Experience } from "@/components/sections/Experience";
import { Skills } from "@/components/sections/Skills";
import { getCv } from "@/content/get-cv";

export default async function HomePage() {
  const cv = await getCv(await getLocale());
  const t = await getTranslations("HomePage");

  return (
    <>
      <section className="mx-auto flex min-h-[70svh] w-full max-w-content flex-col justify-center gap-4 px-gutter py-section">
        <h1 className="text-title text-ink">{t("title")}</h1>
        <p className="text-lead text-ink-muted">{t("subtitle")}</p>
      </section>
      <About cv={cv} />
      <Skills cv={cv} />
      <Experience cv={cv} />
    </>
  );
}
