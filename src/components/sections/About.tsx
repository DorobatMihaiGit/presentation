import { useTranslations } from "next-intl";
import { Section } from "@/components/ui/Section";
import { fallbackLang } from "@/content/localize";
import type { Cv } from "@/content/types";

export function About({ cv }: { cv: Cv }) {
  const t = useTranslations("About");
  const availability = useTranslations("Availability");
  const { profile, locale } = cv;
  const facts = [
    { term: t("location"), value: profile.location },
    { term: t("experience"), value: t("years", { count: profile.yearsExp }) },
    { term: t("projects"), value: String(cv.projects.length) },
    {
      term: t("availability"),
      value: availability(profile.available ? "open" : "closed"),
    },
  ];

  return (
    <Section id="about" title={t("title")} scene="about">
      <div className="grid gap-12 md:grid-cols-12">
        <p
          lang={fallbackLang(profile.summary, locale)}
          className="max-w-[60ch] text-lead text-ink md:col-span-7"
        >
          {profile.summary.value}
        </p>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-8 md:col-span-4 md:col-start-9">
          {facts.map((fact) => (
            <div key={fact.term}>
              <dt className="font-mono text-label uppercase text-ink-subtle">
                {fact.term}
              </dt>
              <dd className="mt-2 text-heading text-ink">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Section>
  );
}
