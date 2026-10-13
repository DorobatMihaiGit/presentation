// The global error page cannot use next-intl, and global-error ships with
// every page's JS, so it carries only these strings (messages/*.json "Error";
// tests/unit/error-boundaries.test.tsx keeps them in sync).
const COPY = {
  en: {
    title: "Something went wrong",
    description:
      "This part of the page did not load. Trying again usually helps.",
    retry: "Try again",
    home: "Back to the home page",
  },
  ro: {
    title: "Ceva nu a mers",
    description:
      "Această parte a paginii nu s-a încărcat. De obicei ajută să încerci din nou.",
    retry: "Încearcă din nou",
    home: "Înapoi la pagina principală",
  },
} as const;

/** The global error page's language and copy, from the URL's locale prefix. */
export function globalErrorCopy(pathname: string) {
  const lang = /^\/ro(\/|$)/.test(pathname) ? "ro" : "en";
  return { lang, copy: COPY[lang] } as const;
}
