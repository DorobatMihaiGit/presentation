import { useTranslations } from "next-intl";
import { Section } from "@/components/ui/Section";
import type { Cv } from "@/content/types";

const SOCIAL_LABELS = { github: "GitHub", linkedin: "LinkedIn" } as const;

const fieldClass =
  "mt-2 w-full rounded-control bg-canvas px-4 py-3 text-ink ring-1 ring-line-strong";

export function Contact({ cv }: { cv: Cv }) {
  const t = useTranslations("Contact");
  const { profile } = cv;

  return (
    <Section id="contact" title={t("title")} intro={t("intro")} scene="contact">
      <div className="grid gap-12 md:grid-cols-12">
        <div className="flex flex-col gap-8 md:col-span-5">
          <div>
            <h3 className="font-mono text-label uppercase text-ink-subtle">
              {t("email")}
            </h3>
            <a
              href={`mailto:${profile.email}`}
              className="mt-2 inline-block text-heading text-ink wrap-anywhere underline decoration-line-strong underline-offset-8 transition-colors hover:decoration-signal"
            >
              {profile.email}
            </a>
          </div>
          <div>
            <h3 className="font-mono text-label uppercase text-ink-subtle">
              {t("profiles")}
            </h3>
            <ul className="mt-2 flex flex-col gap-2">
              {profile.socials.map((social) => (
                <li key={social.network}>
                  <a
                    href={social.url}
                    className="text-ink underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-signal"
                  >
                    {SOCIAL_LABELS[social.network]}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <form
          aria-labelledby="contact-form-title"
          aria-describedby="contact-form-status"
          className="flex flex-col gap-5 rounded-panel bg-surface p-6 ring-1 ring-line md:col-span-7 md:p-8"
        >
          <h3 id="contact-form-title" className="text-heading text-ink">
            {t("form.title")}
          </h3>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="text-sm text-ink-muted">
              {t("form.name")}
              <input
                name="name"
                type="text"
                autoComplete="name"
                required
                className={fieldClass}
              />
            </label>
            <label className="text-sm text-ink-muted">
              {t("form.email")}
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                className={fieldClass}
              />
            </label>
          </div>
          <label className="text-sm text-ink-muted">
            {t("form.company")}
            <input
              name="company"
              type="text"
              autoComplete="organization"
              className={fieldClass}
            />
          </label>
          <label className="text-sm text-ink-muted">
            {t("form.message")}
            <textarea
              name="message"
              rows={5}
              required
              className={`${fieldClass} resize-y`}
            />
          </label>
          <p id="contact-form-status" className="text-sm text-ink-muted">
            {t("form.pending")}
          </p>
          <button
            type="submit"
            disabled
            className="self-start rounded-full bg-signal px-6 py-3 font-medium text-signal-ink disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t("form.submit")}
          </button>
        </form>
      </div>
    </Section>
  );
}
