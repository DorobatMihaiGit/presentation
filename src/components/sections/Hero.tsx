import { useTranslations } from "next-intl";
import { fallbackLang } from "@/content/localize";
import type { Cv } from "@/content/types";

/**
 * Shot S1. The copy is SSR text over a full-bleed poster; once the live stage
 * is up (html[data-canvas="live"]) the poster fades to reveal the canvas behind
 * it, and the section grows to 300lvh so its sticky frame stays pinned for
 * 200lvh of scroll.
 */
export function Hero({ cv }: { cv: Cv }) {
  const t = useTranslations("Hero");
  const availability = useTranslations("Availability");
  const { profile, locale } = cv;

  return (
    <section aria-labelledby="hero-title" data-scene="hero" className="hero">
      <div className="sticky top-0 flex min-h-lvh items-center overflow-hidden">
        <div
          aria-hidden="true"
          data-stage="hero"
          className="stage hero-poster absolute inset-0"
        />
        <div aria-hidden="true" className="hero-scrim absolute inset-0" />
        <div className="relative mx-auto w-full max-w-content px-gutter pt-28 pb-16">
          <div className="md:w-7/12">
            {profile.available ? (
              <p className="inline-flex items-center gap-2 rounded-full bg-canvas/60 px-3 py-1.5 font-mono text-label uppercase text-ink-muted ring-1 ring-line">
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
                className="rounded-full bg-canvas/60 px-6 py-3 font-medium text-ink ring-1 ring-line-strong transition-colors hover:bg-raised"
              >
                {t("secondaryCta")}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
