import Link from "next/link";
import { useTranslations } from "next-intl";
import type { Cv } from "@/content/types";
import { MotionToggle } from "@/experience/MotionToggle";
import { LocaleSwitcher } from "./LocaleSwitcher";

const SECTIONS = [
  "about",
  "skills",
  "experience",
  "projects",
  "contact",
] as const;

/**
 * Rendered by each page (PageShell), so it knows where it is: `path` is the
 * page below the locale ("/" = the home page), or null for a page that exists
 * in no other language (404). Section links jump within the home page and
 * lead back to it from anywhere else.
 */
export function SiteHeader({ cv, path }: { cv: Cv; path: string | null }) {
  const t = useTranslations("Nav");
  const motion = useTranslations("Motion");
  const home = path === "/";
  const link =
    "flex items-center rounded-full px-3 py-1.5 text-sm text-ink-muted transition-colors hover:bg-raised hover:text-ink pointer-coarse:min-h-11";

  return (
    <header
      id="top"
      className="absolute inset-x-0 top-0 z-10 mx-auto flex w-full max-w-content flex-wrap items-center justify-between gap-3 px-gutter pt-6"
    >
      <a
        href="#top"
        className="inline-flex items-center rounded-full py-1.5 text-sm font-semibold text-ink pointer-coarse:min-h-11"
      >
        {cv.profile.fullName.value}
      </a>
      <nav aria-label={t("label")} className="hidden md:block">
        <ul className="flex gap-1 rounded-full bg-surface p-1 ring-1 ring-line">
          {SECTIONS.map((id) => (
            <li key={id}>
              {home ? (
                <a href={`#${id}`} className={link}>
                  {t(id)}
                </a>
              ) : (
                <Link
                  href={`/${cv.locale}#${id}`}
                  transitionTypes={["nav-back"]}
                  className={link}
                >
                  {t(id)}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </nav>
      <div className="flex items-center gap-2">
        <MotionToggle
          labels={{
            label: motion("label"),
            on: motion("on"),
            off: motion("off"),
          }}
        />
        <LocaleSwitcher locale={cv.locale} path={path ?? "/"} />
      </div>
    </header>
  );
}
