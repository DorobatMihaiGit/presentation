import type { CvRecords } from "./types";

// FIXTURE CONTENT (M1). Placeholder person, companies and projects; all links
// point at example.com. M2 seeds the database from this shape and M7 replaces
// the words with real content through the admin panel.
export const fixtures: CvRecords = {
  profile: {
    emailPublic: "hello@example.com",
    location: "Cluj-Napoca",
    countryCode: "RO",
    socials: [
      { network: "github", url: "https://example.com/alex-marin/github" },
      { network: "linkedin", url: "https://example.com/alex-marin/linkedin" },
    ],
    available: true,
    yearsExp: 9,
    i18n: {
      en: {
        fullName: "Alex Marin",
        headline:
          "Fullstack developer building fast, accessible web products from database to pixel.",
        summary:
          "I design and ship web products across the whole stack, from interface details to database schemas and deployment pipelines. I care about speed, accessibility and code the next person can change with confidence.",
        seoTitle: "Alex Marin · Fullstack Developer",
        seoDescription:
          "CV and portfolio of Alex Marin, a fullstack developer building fast, accessible web products with TypeScript, React, Next.js and Postgres.",
      },
      ro: {
        fullName: "Alex Marin",
        headline:
          "Dezvoltator fullstack care construiește produse web rapide și accesibile, de la baza de date la pixel.",
        summary:
          "Proiectez și livrez produse web pe toată stiva, de la detaliile interfeței până la scheme de baze de date și pipeline-uri de livrare. Țin la viteză, accesibilitate și cod pe care următorul om îl poate schimba cu încredere.",
        seoTitle: "Alex Marin · Dezvoltator Fullstack",
        seoDescription:
          "CV-ul și portofoliul lui Alex Marin, dezvoltator fullstack care construiește produse web rapide și accesibile cu TypeScript, React, Next.js și Postgres.",
      },
    },
  },
  experience: [
    {
      id: "ardea-health",
      company: "Ardea Health",
      url: "https://example.com/ardea-health",
      startDate: "2022-04",
      endDate: null,
      employmentType: "full_time",
      sortOrder: 1,
      isPublished: true,
      i18n: {
        en: {
          roleTitle: "Senior Fullstack Engineer",
          description:
            "Own the patient scheduling platform end to end, from the booking interface to the Postgres schema behind it.",
          highlights: [
            "Moved a PHP monolith to Next.js and Postgres without a maintenance window.",
            "Cut p95 API latency by more than half by reshaping the hottest queries.",
            "Set up Playwright end-to-end tests that now gate every release.",
          ],
        },
        ro: {
          roleTitle: "Inginer Fullstack Senior",
          description:
            "Răspund de platforma de programări pentru pacienți, de la interfața de rezervare până la schema Postgres din spatele ei.",
          highlights: [
            "Am mutat un monolit PHP pe Next.js și Postgres fără fereastră de mentenanță.",
            "Am redus latența p95 a API-ului la mai puțin de jumătate, rescriind cele mai solicitate interogări.",
            "Am introdus teste end-to-end cu Playwright care condiționează acum fiecare lansare.",
          ],
        },
      },
    },
    {
      id: "ferrum-freight",
      company: "Ferrum Freight",
      url: "https://example.com/ferrum-freight",
      startDate: "2019-09",
      endDate: "2022-03",
      employmentType: "full_time",
      sortOrder: 2,
      isPublished: true,
      i18n: {
        en: {
          roleTitle: "Fullstack Developer",
          description:
            "Built the dispatch tools used by planners to route trucks across Central Europe.",
          highlights: [
            "Shipped a live map of the fleet on top of a Node.js event stream.",
            "Designed the Postgres model for loads, stops and delivery windows.",
          ],
        },
        ro: {
          roleTitle: "Dezvoltator Fullstack",
          description:
            "Am construit instrumentele de dispecerat folosite de planificatori pentru a ruta camioane prin Europa Centrală.",
          highlights: [
            "Am livrat o hartă live a flotei peste un flux de evenimente Node.js.",
            "Am proiectat modelul Postgres pentru încărcături, opriri și ferestre de livrare.",
          ],
        },
      },
    },
    {
      id: "studio-meridian",
      company: "Studio Meridian",
      startDate: "2017-06",
      endDate: "2019-08",
      employmentType: "contract",
      sortOrder: 3,
      isPublished: true,
      i18n: {
        en: {
          roleTitle: "Frontend Developer",
          description:
            "Built marketing sites and small web apps for agency clients on tight launch dates.",
          highlights: [
            "Introduced a shared component library used across client projects.",
          ],
        },
        // No RO description on purpose: exercises the EN fallback (see tests).
        ro: {
          roleTitle: "Dezvoltator Frontend",
          highlights: [
            "Am introdus o bibliotecă de componente comune folosită în proiectele clienților.",
          ],
        },
      },
    },
    {
      id: "draft-role",
      company: "Unpublished Co",
      startDate: "2016-01",
      endDate: "2016-12",
      employmentType: "freelance",
      sortOrder: 4,
      isPublished: false,
      i18n: {
        en: {
          roleTitle: "Draft role",
          description: "Unpublished entries never render.",
          highlights: [],
        },
      },
    },
  ],
  skillCategories: [
    {
      slug: "interface",
      layer: "interface",
      i18n: { en: { name: "Interface" }, ro: { name: "Interfață" } },
    },
    {
      slug: "api",
      layer: "api",
      i18n: { en: { name: "API" }, ro: { name: "API" } },
    },
    {
      slug: "data",
      layer: "data",
      i18n: { en: { name: "Data" }, ro: { name: "Date" } },
    },
    {
      slug: "infra",
      layer: "infra",
      i18n: { en: { name: "Infrastructure" }, ro: { name: "Infrastructură" } },
    },
    {
      slug: "craft",
      layer: "craft",
      i18n: { en: { name: "Craft" }, ro: { name: "Meșteșug" } },
    },
  ],
  skills: [
    {
      slug: "typescript",
      categorySlug: "interface",
      name: "TypeScript",
      level: 5,
      years: 8,
      featured: true,
    },
    {
      slug: "react",
      categorySlug: "interface",
      name: "React",
      level: 5,
      years: 8,
      featured: true,
    },
    {
      slug: "nextjs",
      categorySlug: "interface",
      name: "Next.js",
      level: 5,
      years: 6,
      featured: true,
    },
    {
      slug: "tailwind",
      categorySlug: "interface",
      name: "Tailwind CSS",
      level: 4,
      years: 4,
      featured: false,
    },
    {
      slug: "a11y",
      categorySlug: "interface",
      name: "Accessibility",
      level: 4,
      years: 5,
      featured: false,
    },
    {
      slug: "nodejs",
      categorySlug: "api",
      name: "Node.js",
      level: 5,
      years: 8,
      featured: true,
    },
    {
      slug: "graphql",
      categorySlug: "api",
      name: "GraphQL",
      level: 4,
      years: 5,
      featured: false,
    },
    {
      slug: "zod",
      categorySlug: "api",
      name: "Zod",
      level: 4,
      years: 4,
      featured: false,
    },
    {
      slug: "auth",
      categorySlug: "api",
      name: "Auth and sessions",
      level: 4,
      years: 6,
      featured: false,
    },
    {
      slug: "postgres",
      categorySlug: "data",
      name: "PostgreSQL",
      level: 5,
      years: 8,
      featured: true,
    },
    {
      slug: "drizzle",
      categorySlug: "data",
      name: "Drizzle ORM",
      level: 4,
      years: 2,
      featured: false,
    },
    {
      slug: "redis",
      categorySlug: "data",
      name: "Redis",
      level: 3,
      years: 4,
      featured: false,
    },
    {
      slug: "docker",
      categorySlug: "infra",
      name: "Docker",
      level: 4,
      years: 6,
      featured: false,
    },
    {
      slug: "vercel",
      categorySlug: "infra",
      name: "Vercel",
      level: 4,
      years: 4,
      featured: true,
    },
    {
      slug: "github-actions",
      categorySlug: "infra",
      name: "GitHub Actions",
      level: 4,
      years: 5,
      featured: false,
    },
    {
      slug: "aws",
      categorySlug: "infra",
      name: "AWS",
      level: 3,
      years: 4,
      featured: false,
    },
    {
      slug: "testing",
      categorySlug: "craft",
      name: "Vitest and Playwright",
      level: 5,
      years: 6,
      featured: true,
    },
    {
      slug: "web-perf",
      categorySlug: "craft",
      name: "Web performance",
      level: 4,
      years: 5,
      featured: false,
    },
    {
      slug: "code-review",
      categorySlug: "craft",
      name: "Code review",
      level: 5,
      years: 7,
      featured: false,
    },
  ],
  projects: [
    {
      slug: "ledger-lens",
      liveUrl: "https://example.com/ledger-lens",
      repoUrl: "https://example.com/ledger-lens/source",
      year: 2025,
      featured: true,
      published: true,
      skills: ["nextjs", "postgres", "drizzle", "testing"],
      i18n: {
        en: {
          title: "Ledger Lens",
          summary:
            "Reconciliation dashboard that matches bank exports to invoices for small accounting firms.",
          role: "Lead developer",
          outcome: "Month-end close went from three days to one.",
        },
        ro: {
          title: "Ledger Lens",
          summary:
            "Panou de reconciliere care potrivește extrasele bancare cu facturile pentru firme mici de contabilitate.",
          role: "Dezvoltator principal",
          outcome: "Închiderea de lună a scăzut de la trei zile la una.",
        },
      },
    },
    {
      slug: "tramline",
      liveUrl: "https://example.com/tramline",
      year: 2024,
      featured: false,
      published: true,
      skills: ["react", "nodejs", "redis"],
      i18n: {
        en: {
          title: "Tramline",
          summary:
            "Installable web app with live arrival boards for city public transport.",
          role: "Solo developer",
          outcome: "Runs on one small instance for the whole city.",
        },
        ro: {
          title: "Tramline",
          summary:
            "Aplicație web instalabilă cu afișaje live ale sosirilor pentru transportul public urban.",
          role: "Dezvoltator unic",
          outcome: "Rulează pe o singură instanță mică pentru tot orașul.",
        },
      },
    },
    {
      slug: "atelier-cms",
      repoUrl: "https://example.com/atelier-cms/source",
      year: 2023,
      featured: false,
      published: true,
      skills: ["nextjs", "graphql", "postgres"],
      i18n: {
        en: {
          title: "Atelier CMS",
          summary:
            "Headless content editor for a design studio, with drafts, previews and scheduled publishing.",
          role: "Fullstack developer",
          outcome: "Editors publish without asking a developer.",
        },
        ro: {
          title: "Atelier CMS",
          summary:
            "Editor de conținut headless pentru un studio de design, cu ciorne, previzualizări și publicare programată.",
          role: "Dezvoltator fullstack",
          outcome: "Editorii publică fără să ceară ajutorul unui programator.",
        },
      },
    },
    {
      slug: "pulse-check",
      repoUrl: "https://example.com/pulse-check/source",
      year: 2022,
      featured: false,
      published: true,
      skills: ["nodejs", "postgres", "docker"],
      i18n: {
        en: {
          title: "Pulse Check",
          summary:
            "Uptime and latency monitor that alerts a team chat before customers notice.",
          role: "Backend developer",
          outcome: "Caught two outages before the first support ticket.",
        },
        ro: {
          title: "Pulse Check",
          summary:
            "Monitor de disponibilitate și latență care anunță echipa înainte să observe clienții.",
          role: "Dezvoltator backend",
          outcome: "A prins două căderi înaintea primului tichet de suport.",
        },
      },
    },
    {
      slug: "draft-project",
      year: 2026,
      featured: true,
      published: false,
      skills: [],
      i18n: {
        en: {
          title: "Draft project",
          summary: "Unpublished projects never render.",
          role: "None",
          outcome: "None",
        },
      },
    },
  ],
};
