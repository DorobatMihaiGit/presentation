import { useTranslations } from "next-intl";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
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
      <div className="flex flex-col gap-12 lg:w-1/2">
        {profile.avatar ? (
          <OptimizedImage
            src={profile.avatar.url}
            alt={profile.avatar.alt.value}
            lang={fallbackLang(profile.avatar.alt, locale)}
            width={112}
            height={112}
            sizes="56px"
            className="size-14 rounded-full object-cover ring-1 ring-line"
          />
        ) : null}
        <p
          lang={fallbackLang(profile.summary, locale)}
          className="text-statement text-ink"
        >
          {profile.summary.value}
        </p>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-8">
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
