// The error pages ship with every page's JS, so they carry only these
// strings instead of next-intl (whose client formatter costs ~6 KB gz).
// tests/unit/error-boundaries.test.tsx keeps them equal to messages/*.json.
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

/** The error pages' language and copy, from the URL's locale prefix. */
export function errorCopy(pathname: string) {
  const lang = /^\/ro(\/|$)/.test(pathname) ? "ro" : "en";
  return { lang, copy: COPY[lang] } as const;
}
