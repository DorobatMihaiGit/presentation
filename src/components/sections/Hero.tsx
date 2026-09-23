import { useTranslations } from "next-intl";
import { Stage } from "@/components/ui/Stage";
import { fallbackLang } from "@/content/localize";
import type { Cv } from "@/content/types";

export function Hero({ cv }: { cv: Cv }) {
  const t = useTranslations("Hero");
  const availability = useTranslations("Availability");
  const { profile, locale } = cv;

  return (
    <section
      aria-labelledby="hero-title"
      data-scene="hero"
      className="mx-auto grid min-h-[calc(100svh-4.5rem)] w-full max-w-content grid-cols-1 items-center gap-12 px-gutter py-16 md:grid-cols-12"
    >
      <div className="md:col-span-7">
        {profile.available ? (
          <p className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-mono text-label uppercase text-ink-muted ring-1 ring-line">
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full bg-signal"
            />
            {availability("open")}
          </p>
        ) : null}
        <h1
          id="hero-title"
          lang={fallbackLang(profile.fullName, locale)}
          className="mt-6 text-display text-ink"
        >
          {profile.fullName.value}
        </h1>
        <p
          lang={fallbackLang(profile.headline, locale)}
          className="mt-6 max-w-[34ch] text-lead text-ink-muted"
        >
          {profile.headline.value}
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <a
            href="#contact"
            className="rounded-full bg-signal px-6 py-3 font-medium text-signal-ink motion-safe:transition-transform motion-safe:duration-(--motion-press) motion-safe:active:scale-[0.98]"
          >
            {t("primaryCta")}
          </a>
          <a
            href="#projects"
            className="rounded-full px-6 py-3 font-medium text-ink ring-1 ring-line-strong transition-colors hover:bg-raised"
          >
            {t("secondaryCta")}
          </a>
        </div>
      </div>
      <Stage
        scene="hero"
        className="w-full max-w-md justify-self-center md:col-span-5 md:max-w-none"
      />
    </section>
  );
}
