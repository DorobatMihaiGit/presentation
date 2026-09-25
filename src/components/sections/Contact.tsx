import { useLocale, useTranslations } from "next-intl";
import { Section } from "@/components/ui/Section";
import type { Cv } from "@/content/types";
import { ContactForm, type ContactFormLabels } from "./ContactForm";

const SOCIAL_LABELS = { github: "GitHub", linkedin: "LinkedIn" } as const;

export function Contact({ cv }: { cv: Cv }) {
  const t = useTranslations("Contact");
  const locale = useLocale();
  const { profile } = cv;
  const labels: ContactFormLabels = {
    title: t("form.title"),
    name: t("form.name"),
    email: t("form.email"),
    company: t("form.company"),
    message: t("form.message"),
    submit: t("form.submit"),
    sending: t("form.sending"),
    hint: t("form.hint"),
    sent: t("form.sent"),
    honeypot: t("form.honeypot"),
    errors: {
      invalid: t("form.errors.invalid"),
      tooFast: t("form.errors.tooFast"),
      rateLimited: t("form.errors.rateLimited"),
      failed: t("form.errors.failed"),
    },
    fieldErrors: {
      required: t("form.fieldErrors.required"),
      invalid: t("form.fieldErrors.invalid"),
      tooLong: t("form.fieldErrors.tooLong"),
    },
  };

  return (
    <Section id="contact" title={t("title")} intro={t("intro")} scene="contact">
      <div className="flex flex-col gap-12 lg:w-7/12">
        <div className="grid gap-8 sm:grid-cols-2">
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
        <ContactForm locale={locale} labels={labels} />
      </div>
    </Section>
  );
}
