import { useTranslations } from "next-intl";
import { Section } from "@/components/ui/Section";
import { fallbackLang } from "@/content/localize";
import type { Cv } from "@/content/types";

export function Skills({ cv }: { cv: Cv }) {
  const t = useTranslations("Skills");

  return (
    <Section id="skills" title={t("title")} intro={t("intro")} scene="skills">
      <ol className="flex flex-col gap-3">
        {cv.stack.map((entry, index) => (
          <li
            key={entry.layer}
            data-layer={entry.layer}
            className="grid gap-5 rounded-panel bg-surface p-6 shadow-[inset_3px_0_0_var(--layer-tint)] ring-1 ring-line md:grid-cols-12 md:items-center md:p-8"
          >
            <div className="md:col-span-4">
              <p className="font-mono text-label uppercase text-ink-subtle">
                {t("layer", { index: index + 1 })} ·{" "}
                {t(`materials.${entry.layer}`)}
              </p>
              <h3
                lang={fallbackLang(entry.name, cv.locale)}
                className="mt-2 text-heading text-ink"
              >
                {entry.name.value}
              </h3>
            </div>
            <ul className="flex flex-wrap gap-2 md:col-span-8">
              {entry.skills.map((skill) => (
                <li
                  key={skill.slug}
                  className={`rounded-full bg-raised px-3 py-1.5 text-sm ring-1 ${skill.featured ? "text-ink ring-line-strong" : "text-ink-muted ring-line"}`}
                >
                  {skill.name}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </Section>
  );
}
