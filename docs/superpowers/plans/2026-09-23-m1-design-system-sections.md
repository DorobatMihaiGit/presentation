# M1 Design System and Sections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the M0 scaffold into the real one-page CV: a dark "The Stack" design system (Tailwind v4 tokens, two variable fonts with Romanian glyphs), six server-rendered sections (Hero, About, Skills, Experience, Projects, Contact) fed by typed EN/RO fixture content, localized UI strings, page metadata with hreflang, a JSON-LD `Person`, `sitemap.xml` and `robots.txt`. The milestone is gated by 0 axe violations and Lighthouse >= 0.95 in all four categories on `/en` and `/ro`.

**Architecture:** Everything renders on the server and is prerendered as static HTML. `cacheComponents` is switched on now, because M2 needs `'use cache'`. The sections read one view model, `Cv`, which comes from `getCv(locale)` in `src/content/get-cv.ts`. In M1 that function resolves typed fixture records, shaped like spec §4, with a per-field EN fallback. In M2 the same signature is backed by cached Drizzle queries, so the components don't change. All absolute URLs (canonical, hreflang, sitemap, robots, JSON-LD) come from one pure module, `src/lib/seo.ts`, which is given the origin from `SITE_URL`. The design tokens live in the Tailwind v4 `@theme` in `src/app/globals.css`. Each section that gets a 3D scene in M5/M6 carries a `data-scene` hook, and the hero reserves a fixed-ratio `Stage` box, so a later canvas or poster can replace it without layout shift. Motion in M1 is CSS only: hover and press states, plus one hero light sweep that is gated behind `prefers-reduced-motion: no-preference`.

**Tech Stack:** Next.js 16.3.6 (App Router, Turbopack, `cacheComponents`), React 19.3.0, next-intl 4.14.6 (`next/root-params`), Tailwind CSS 4.3.3, `next/font/google` (Mona Sans + Martian Mono), TypeScript 7.0.2, Biome 2.5.14, Vitest 5.0.1, Playwright 1.63.0 + @axe-core/playwright 4.13.0, @lhci/cli 0.15.1 (bundles Lighthouse 12.6.1), pnpm 11.27.1, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-23-cinematic-cv-design.md` (§1 storyboard, §3 architecture, accessibility and performance budgets, §4 data model, §7 row M1, §9 verification)

## Verified facts (checked 2026-09-23 on this machine)

Every version, command and expected output below was produced by running this plan in fresh clones of `dev` under the session scratchpad, one task at a time, in order. Each red phase was run and observed, and after every task the whole suite was re-run. After Task 9, the CI command sequence passed on a fresh clone of the result (`gate=0`).

- **Repo state:** `dev` is at `9b2c097 build(ts): typecheck tests outside next build`. That commit is a `filter-branch` rewrite of `d7aedee`; `git diff d7aedee 9b2c097` is empty. `origin` is `git@github-personal:DorobatMihaiGit/presentation.git`, and `origin/dev` equals `dev`. `origin/main` is at `ba14b84`, which is GitHub's default branch, so the worktree must be cut from `dev` explicitly (`EnterWorktree`'s default base would be `main`).
- **Registry** (`npm view`): `@axe-core/playwright` 4.13.0 (2026-08-11; depends on `axe-core ~4.13.0`, and 4.13.0 is from 2026-08-05; peer `playwright-core >= 1.0.0`). `@lhci/cli` 0.15.1 (latest; it pins `lighthouse` 12.6.1, which uses `puppeteer-core ^24.10.0` and `chrome-launcher ^1.2.0`). Both install with no build scripts, so `pnpm-workspace.yaml` stays unchanged and there is no `ERR_PNPM_IGNORED_BUILDS`. `@lhci/cli` prints `[WARN] 5 deprecated subdependencies found: glob@7.2.3, inflight@1.0.6, rimraf@2.7.1, rimraf@3.0.2, uuid@8.3.2`, which is harmless. Neither package needs anything from React or Next.
- **`cacheComponents` + next-intl 4.14.6:** the next-intl maintainer closed amannn/next-intl#1493 ("Support for `cacheComponents`") because `next/root-params` in Next 16.3 is "the proper fix". next-intl.dev says a setup that reads the locale through `next/root-params` "is automatically eligible for static rendering". Next's own docs (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/next-root-params.md`) say `generateStaticParams` becomes **required** under Cache Components ("each root parameter must have at least one value or the build fails"). M0's layout already has it. Root-param getters also work inside `'use cache'` and become part of the cache key, which is what M2 needs. With the flag on, the M0 code builds with `- Cache Components enabled`. Routes change from `● /en` (SSG) to `○ /en` (static), and `/[locale]/[...rest]` becomes `◐` (Partial Prerender). All 7 M0 e2e tests still pass. APIs used and verified under the flag: `getLocale`, `getTranslations`, `useTranslations` in Server Components, `NextIntlClientProvider`, `createNavigation().Link`, and `generateMetadata` calling `getLocale`. None of them need a `<Suspense>` boundary, because nothing reads request data (`cookies()`, `headers()`, `searchParams`, `new Date()`). **No Suspense boundaries are required in M1.** `next dev` serves `/`→307 `/en`, `/en` 200, `/ro` 200, `/ro/nu-exista` 404, `/sitemap.xml` 200 and `/robots.txt` 200, with no errors in the log.
- **next-intl behaviour:** by default the proxy sends `link: <http://localhost:3100/en>; rel="alternate"; hreflang="en", …; hreflang="x-default"`, built from the request host. `alternateLinks: false` (a typed option of `defineRouting` in 4.14.6) turns that off, so hreflang has one source, `SITE_URL`. The proxy sets `NEXT_LOCALE=<locale>` on locale-prefixed responses, so a visitor who switches to `/ro` and later opens `/` lands on `/ro`. `Link` from `createNavigation` renders `hrefLang` on links to another locale. Its client part (`BaseLink`) calls `useLocale()`, so `NextIntlClientProvider` has to stay. `createTranslator` from `next-intl` resolves Romanian ICU plurals: 1 → `1 an`, 9 → `9 ani`, 20 → `20 de ani`.
- **Next metadata / file conventions:** `alternates.canonical` + `alternates.languages` render `<link rel="canonical">` and `<link rel="alternate" hrefLang="…">`. Next strips the trailing slash of a root URL in `<head>`, but `sitemap.ts` prints URLs verbatim, so `x-default` is emitted as the bare origin (`http://localhost:3100`) in both. `sitemap.ts` alternates become `<xhtml:link rel="alternate" hreflang="ro" href="…" />`. `robots.ts` output is `User-Agent: *`, `Allow: /`, `Sitemap: …/sitemap.xml`. Both are `○` static, and the proxy matcher skips them because they contain a dot. JSON-LD follows `node_modules/next/dist/docs/01-app/02-guides/json-ld.md`: a native `<script type="application/ld+json">` with `JSON.stringify(data).replace(/</g, "\\u003c")`. Biome's recommended `lint/security/noDangerouslySetInnerHtml` flags it, so the plan carries a `biome-ignore` with a reason. Next 16 no longer overrides `scroll-behavior: smooth` during navigation unless `<html data-scroll-behavior="smooth">` is set (`docs/01-app/02-guides/upgrading/version-16.md`).
- **Fonts** (`next/font/google` data + Google Fonts API + fontTools cmap check): `Mona_Sans` and `Martian_Mono` both exist with subsets `latin`, `latin-ext`, … . **ș ț ă (U+0219, U+021B, U+0103) are only in the `latin-ext` files**, while â î are in `latin`. File sizes with only the `wght` axis: Mona Sans latin 39.8 KB + latin-ext 15.5 KB, Martian Mono latin 23.5 KB + latin-ext 15.9 KB. Adding Mona Sans's `wdth` axis grows latin to 98 KB, so it is not requested. `next/font` preloads the two Mona Sans files; Martian Mono uses `preload: false`. In Chrome, `FontFace.unicodeRange` of the loaded latin-ext face contains `U+100-2BA`. The fonts are **downloaded from Google at `next build`**, so CI and Vercel builds need network access.
- **Intl (Node 24 ICU):** `month: "short", year: "numeric", timeZone: "UTC"` gives `Mar 2021` (en) and `sept. 2019` / `apr. 2022` (ro). Without `timeZone: "UTC"`, `TZ=Pacific/Honolulu` turns `2021-03` into `Feb 2021`. The unit test that pins this was checked to fail when the option is removed.
- **Tailwind 4.3.3:** `--text-<name>--line-height`, `--letter-spacing` and `--font-weight` companions are supported (`resolveWith(…, ["--line-height","--letter-spacing","--font-weight"])`). `--spacing-section` gives `py-section`, `--container-content` gives `max-w-content`, and `--color-*: initial` removes the default palette. There is no `--duration-*` theme namespace, so durations are plain custom properties used as `duration-(--motion-press)`. `aria-[current=page]:`, `motion-safe:active:scale-[0.98]` and `wrap-anywhere` all compile. `!important` in CSS triggers Biome `noImportantStyles` warnings, so reduced motion is handled with `motion-safe:` and media queries rather than a global override.
- **Contrast** (WCAG formula, all text on solid surfaces): ink `#eceef2` is 16.84 / 15.86 / 14.52 on canvas `#0b0c0f` / surface `#121419` / raised `#1a1d24`. ink-muted `#a9afba` is 8.87 / 8.36 / 7.65, ink-subtle `#8c93a0` is 6.33 / 5.96 / 5.46, and signal `#7cc5ff` is 10.51 / 9.90 / 9.07. signal-ink `#06121c` on signal is 10.16. Input borders `#646b78` are 3.44 against surface (non-text minimum is 3:1).
- **axe 4.13.0:** the final page has **0 violations** on `/en` and `/ro` at 1280×800 and 390×844. The rule set is every axe default, including best-practice rules like `region`, `landmark-unique` and `heading-order`. The unchanged M0 page also passes (4/4), so the axe spec is a gate rather than a red test. `skip-link` only matches links that are off-screen (`skipLinkMatches = isSkipLink && isOffscreen`). Chrome's accessible-name algorithm adds a space before an `sr-only` span (the name came out as `Live site : Ledger Lens`), which is why project links use an ICU `aria-label` that contains the visible text.
- **Lighthouse** (`@lhci/cli` 0.15.1 → Lighthouse 12.6.1, local `/usr/bin/google-chrome` = Chrome 153): desktop preset, 3 runs per URL, **100 / 100 / 100 / 100 on `/en` and `/ro`** (LCP 0.6 s, TBT 0 ms, CLS 0). Mobile default settings as a reference only: 97 / 100 / 100 / 100, LCP 2.5–2.6 s. Relevant audit code in 12.6.1: `canonical` only fails for invalid, relative, conflicting, cross-hreflang or root-pointing canonicals, and has no host check. `link-text` blocks `start`, `more`, `here`, `go`, `learn more`, `read more` and a few others. LHCI's `startServerCommand` server is gone afterwards (`ss` shows the port free). Without a config, `lhci autorun` exits 1 with `Unable to automatically determine the location of static site files.`
- **JS weight:** M0's `/en` already loads **143 KB gz** of modern JS for the Next 16.3 + React 19.3 runtime. That figure leaves out the 39 KB gz `noModule` polyfill, which modern browsers skip. M1 loads 147.6 KB gz, so it adds +4.5 KB. The spec's "public JS before 3D ≤ 120 KB gz" was therefore already exceeded by the framework baseline before M1 (see Decisions in the report).
- **Playwright 1.63:** `test.use({ reducedMotion: "reduce" })` is a first-class option. `getComputedStyle(el, "::after").animationName` returns `studio-sweep` normally and `none` under reduced motion. `webServer.env` is merged over `process.env`, so `DATABASE_URL` still comes from `.env.local` or the CI env.
- **Tooling quirks here:** a hook rewrites plain `git`, so commands use `/usr/bin/git`. `rtk` filters some output (for example Biome's `Checked N files` line). Prefix a command with `rtk proxy` to see the raw output shown in this plan. Compound one-liners can be rejected by the worktree guard, so each command below is on its own line.

## Global Constraints

- Exact pins only (no `^`/`~`). The M0 pins stay as they are (next 16.3.6, react/react-dom 19.3.0 "pinned `<19.4` (R3F peer)", typescript 7.0.2, @biomejs/biome 2.5.14, tailwindcss + @tailwindcss/postcss 4.3.3, next-intl 4.14.6, zod 4.6.5, @t3-oss/env-nextjs 0.13.11, vitest 5.0.1, vite 8.3.0, @playwright/test 1.63.0). New dev dependencies: `@axe-core/playwright` 4.13.0 and `@lhci/cli` 0.15.1. No other packages: no icon library, no `clsx`, no `schema-dts`.
- `next.config.ts` has `cacheComponents: true`. Nothing may read request-time data (`cookies()`, `headers()`, `searchParams`, `new Date()`, `Math.random()`) outside `'use cache'` unless it is wrapped in `<Suspense>`. M1 reads none.
- Spec §3: "messages/en.json ro.json UI strings only; CV content in DB". In M1 the CV content lives in `src/content/fixtures.ts`, typed like spec §4 ("Base table + `<entity>_i18n`", "COALESCE requested locale → `en` fallback"). Components never import fixtures directly; they only get a `Cv` from `getCv(locale)`.
- Spec §4: "layer enum (interface/api/data/infra/craft → 3D layer)", rendered top to bottom in that order.
- Spec §3: "fonts: 2 variable woff2, latin + latin-ext (Romanian ș ț ă â î)".
- Spec §3 accessibility: "SSR DOM in logical order, canvases `aria-hidden`, skip link, `lang` per locale, contrast ≥ 4.5:1 …, reduced-motion → T0, no autoplay audio".
- Spec §3 budgets: "LCP ≤ 2.0 s desktop / ≤ 2.5 s mobile, CLS < 0.05, INP < 200 ms · public JS before 3D ≤ 120 KB gz" (the JS line is already over budget at M0; see Verified facts).
- Spec §7 M1 acceptance: "Lighthouse ≥ 95 all categories; 0 axe violations; both locales". The brief adds: correct `<html lang>` on both locales.
- Visual system: one theme (dark studio, `color-scheme: dark`), one accent (`signal`), text only on solid surfaces, radii `control` 0.875rem / `panel` 1.75rem / pills `full`. Visible UI copy uses no em dash or en dash (the design-taste rule). The M0 title `Fullstack Developer — CV` goes away in Task 8.
- Out of scope for M1: 3D, R3F, GSAP, Lenis, the sequence player, the grain/vignette overlay (M5/M6); DB, auth, admin (M2); contact submission (M3; the form is static markup and cannot submit); real media assets (M4/M7).
- Routing does not change: `src/proxy.ts`, `localePrefix: "always"`, locales `en` (default) + `ro`.
- Biome is the only linter and formatter. Every file in this plan is already Biome-formatted, so `pnpm lint` must print `No fixes applied.` before each commit.
- Commits use `type(scope): subject` with a subject of at most 50 characters. **No AI attribution of any kind**: no `Co-Authored-By`, no `Claude-Session:`, no "Generated with" lines.

## Review Focus

These are inputs the spec implies that ordinary feature tests would not catch. Each one is pinned by a test in the task that owns the code:

1. **A Romanian translation is missing or blank.** This happens in M2 when an admin leaves an RO field empty. `/ro` should show the English text marked `lang="en"` (so screen readers switch voice), never a blank or a raw key. Pinned by the Task 2 unit tests (`falls back to English when the translation is blank`, `…translated list is empty`, `falls back per field, not per record`) and the Task 5 e2e test `marks English fallback text with lang=en on /ro`.
2. **The server clock is west of UTC.** Dev laptops or other hosts can run in such a zone, and `2021-03` must not render as `Feb 2021`. Pinned by the Task 2 unit test `keeps the month when the server runs west of UTC` (`TZ=Pacific/Honolulu`).
3. **CV content contains `</script>`.** Admin-editable text in M2 must not be able to break out of the JSON-LD tag. Pinned by the Task 3 unit test `cannot be used to close the script tag`.
4. **A visitor fills the contact form and presses Enter before M3 wires it.** The page must not navigate, and name or email must never end up in the URL, browser history or server logs. Pinned by the Task 6 e2e test `contact form is labelled and cannot submit before M3`.
5. **A 320 px phone meets long Romanian words, names or e-mails.** The page must never scroll sideways. Pinned by the Task 4 e2e test `has no horizontal overflow on a 320px phone`, which runs again in every later task as sections land. Headings use `overflow-wrap: break-word` and the email uses `wrap-anywhere`.

## Before you start (workspace)

1. Update the main checkout and cut the worktree from `dev` (not from `origin/HEAD`, which is `main`):

```bash
/usr/bin/git -C /home/mihai/Documents/CV pull --ff-only
/usr/bin/git -C /home/mihai/Documents/CV worktree add .claude/worktrees/m1-design-system -b feat/m1-design-system dev
```

Expected: `Preparing worktree (new branch 'feat/m1-design-system')` and `HEAD is now at 9b2c097 build(ts): typecheck tests outside next build` (or a later `dev` tip). Then call `EnterWorktree` with `path: ".claude/worktrees/m1-design-system"`. **All commands below run from the worktree root.** If this plan file is not committed on `dev`, read it from `/home/mihai/Documents/CV/docs/superpowers/plans/2026-09-23-m1-design-system-sections.md`.

2. Install the dependencies and create the local env (`next build` validates env at config load):

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm exec playwright install chromium
```

Expected: `Done in <n>s using pnpm v11.27.1`. The browser step is a no-op if `chromium-1243` is already in `~/.cache/ms-playwright`.

3. Check the baseline:

Run: `pnpm test`
Expected: `Test Files  2 passed (2)`, `Tests  9 passed (9)`.

Run: `pnpm test:e2e`
Expected: `7 passed`. Afterwards `ss -ltn | grep ':3100 '` prints nothing.

## File map

| Path | Responsibility | Task |
|---|---|---|
| `next.config.ts` | `cacheComponents: true` | 1 |
| `src/i18n/routing.ts` | adds `type Locale`; `alternateLinks: false` | 2, 3 |
| `src/content/types.ts` | spec §4 record types, `STACK_LAYERS`, `I18n<T>`, `Localized<T>`, view model `Cv` | 2 |
| `src/content/localize.ts` | `localize()` per-field EN fallback, `fallbackLang()` | 2 |
| `src/content/fixtures.ts` | typed EN/RO fixture records (placeholder person) | 2 |
| `src/content/get-cv.ts` | `resolveCv(records, locale)`, `getCv(locale)` (M2 swap point) | 2 |
| `src/lib/format.ts` | `formatYearMonth()` (UTC-pinned) | 2 |
| `src/lib/create-app-env.ts`, `src/env.ts`, `.env.example` | optional `SITE_URL` | 3 |
| `src/lib/seo.ts` | `resolveSiteUrl`, `localeUrl`, `languageAlternates`, `buildSitemap`, `buildRobots`, `personJsonLd`, `serializeJsonLd` | 3 |
| `src/site.ts` | `siteUrl` instance (env + Vercel fallback) | 3 |
| `src/app/sitemap.ts`, `src/app/robots.ts` | crawler files | 3 |
| `playwright.config.ts` | builds e2e server with `SITE_URL=http://localhost:3100` | 3 |
| `src/app/globals.css` | design tokens (`@theme`), base a11y styles, stage/slab CSS, sweep keyframes | 4 |
| `src/app/fonts.ts` | Mona Sans + Martian Mono (`latin`, `latin-ext`) | 4 |
| `src/app/[locale]/layout.tsx` | fonts, viewport, skip link, `<main>` (T4) → header/footer (T7) → content metadata (T8) | 4, 7, 8 |
| `src/app/[locale]/page.tsx` | placeholder (T4) → sections (T5, T6) → metadata + JSON-LD (T8) | 4, 5, 6, 8 |
| `src/app/[locale]/not-found.tsx` | `<section>` instead of a nested `<main>` | 4 |
| `messages/en.json`, `messages/ro.json` | UI strings, grown per task | 4–8 |
| `src/components/ui/Section.tsx` | section wrapper (`id`, `aria-labelledby`, `data-scene`) | 5 |
| `src/components/sections/{About,Skills,Experience}.tsx` | three sections | 5 |
| `src/components/ui/Stage.tsx` | reserved scene box + CSS monolith placeholder | 6 |
| `src/components/sections/{Hero,Projects,Contact}.tsx` | three sections | 6 |
| `src/i18n/navigation.ts` | `Link`, `getPathname` from `createNavigation` | 7 |
| `src/components/site/{SiteHeader,SiteFooter,LocaleSwitcher}.tsx` | banner, section nav, language switch, footer | 7 |
| `tests/unit/{content,format,seo}.test.ts`, `tests/unit/{env,messages}.test.ts` | unit tests (new / extended) | 2, 3, 5 |
| `tests/e2e/*.spec.ts` | one spec file per task + edits to `i18n-routing.spec.ts` | 3–8 |
| `lighthouserc.json`, `.gitignore`, `.github/workflows/ci.yml`, `README.md` | LHCI gate + CI job + docs | 9 |

---

### Task 1: Enable Cache Components

**Files:**
- Modify: `next.config.ts`

**Interfaces:**
- Consumes: M0 routing (`src/i18n/request.ts` reads `next/root-params`; the layout has `generateStaticParams`).
- Produces: `cacheComponents: true`. From here on, `'use cache'`, `cacheTag` and `cacheLife` are available (M2), and routes prerender as static shells.

- [ ] **Step 1: Record the current prerender mode (red)**

Run: `pnpm build`
Expected: the route table shows the locale pages as SSG, and the build never mentions Cache Components:

```
Route (app)
┌ ○ /_not-found
├   /[locale]
│ ├ ● /en
│ └ ● /ro
└ ƒ /[locale]/[...rest]
```

- [ ] **Step 2: Turn the flag on — replace `next.config.ts`**

```ts
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import "./src/env";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  cacheComponents: true,
};

export default withNextIntl(nextConfig);
```

- [ ] **Step 3: Verify the build (green)**

Run: `pnpm build`
Expected: `- Cache Components enabled`, `✓ Compiled successfully`, and:

```
Route (app)
┌ ○ /_not-found
├   /[locale]
│ ├ ◐ /[locale]
│ ├ ○ /en
│ └ ○ /ro
└   /[locale]/[...rest]
  ├ ◐ /[locale]/[...rest]
  ├ ◐ /en/[...rest]
  └ ◐ /ro/[...rest]
```

No `Route "/[locale]" used … outside of <Suspense>` error appears. next-intl reads the locale through `next/root-params`, and `generateStaticParams` provides both values.

- [ ] **Step 4: Verify behaviour is unchanged**

Run: `pnpm test`
Expected: `Tests  9 passed (9)`.

Run: `pnpm test:e2e`
Expected: `7 passed`. Afterwards `ss -ltn | grep ':3100 '` prints nothing.

- [ ] **Step 5: Commit**

```bash
/usr/bin/git add next.config.ts
/usr/bin/git commit -m "build(next): enable cache components"
```

---

### Task 2: Typed CV content model with EN fallback

**Files:**
- Create: `src/content/types.ts`, `src/content/localize.ts`, `src/content/fixtures.ts`, `src/content/get-cv.ts`, `src/lib/format.ts`
- Modify: `src/i18n/routing.ts`
- Test: `tests/unit/content.test.ts`, `tests/unit/format.test.ts`

**Interfaces:**
- Consumes: `routing` from `@/i18n/routing` (M0).
- Produces:
  - `type Locale = "en" | "ro"` exported from `@/i18n/routing` (the same union as next-intl's `AppConfig.Locale`).
  - `@/content/types`: `STACK_LAYERS = ["interface","api","data","infra","craft"] as const`; `StackLayer`; ``YearMonth = `${number}-${number}` ``; `EmploymentType`; `I18n<T> = { en: T } & { ro?: Partial<T> }`; `Localized<T> = { value: T; lang: Locale }`; `SocialLink`; the record types `ProfileRecord`, `ExperienceRecord`, `SkillCategoryRecord`, `SkillRecord`, `ProjectRecord`, `CvRecords`; and the view model `Cv` (fields below).
  - `localize<T, K extends keyof T>(i18n: I18n<T>, locale: Locale, key: K): Localized<T[K]>`. A missing value, a blank string, an empty array or an array holding a blank string all fall back to `en`.
  - `fallbackLang(text: Localized<unknown>, pageLocale: Locale): Locale | undefined` returns the `lang` attribute value for fallbacks only.
  - `resolveCv(records: CvRecords, locale: Locale): Cv` and `getCv(locale: Locale): Promise<Cv>` (the M2 swap point).
  - `formatYearMonth(value: YearMonth, locale: Locale): string` gives `"Mar 2021"` / `"sept. 2019"`.
  - `Cv` = `{ locale; profile: { fullName, headline, summary, seoTitle, seoDescription: Localized<string>; email; location; countryCode; socials; available; yearsExp }; experience: { id; company; url?; startDate; endDate: YearMonth | null; employmentType; roleTitle, description: Localized<string>; highlights: Localized<string[]> }[]; stack: { layer; name: Localized<string>; skills: { slug; name; featured }[] }[]; projects: { slug; repoUrl?; liveUrl?; year; featured; skills: string[]; title, summary, role, outcome: Localized<string> }[] }`. Only published entries are included. Experience is sorted by `sortOrder`. Projects are sorted featured first, then by year descending. The stack follows `STACK_LAYERS` order.

- [ ] **Step 1: Write the failing tests**

`tests/unit/content.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { fixtures } from "@/content/fixtures";
import { getCv, resolveCv } from "@/content/get-cv";
import { fallbackLang, localize } from "@/content/localize";
import { type CvRecords, STACK_LAYERS } from "@/content/types";

describe("localize", () => {
  const i18n = {
    en: { title: "Ledger", tags: ["a", "b"] },
    ro: { title: "Registru", tags: [] as string[] },
  };

  it("returns the requested locale when it is translated", () => {
    expect(localize(i18n, "ro", "title")).toEqual({
      value: "Registru",
      lang: "ro",
    });
  });

  it("returns English for the English locale", () => {
    expect(localize(i18n, "en", "title")).toEqual({
      value: "Ledger",
      lang: "en",
    });
  });

  it("falls back to English when the translation row is missing", () => {
    expect(localize({ en: { title: "Ledger" } }, "ro", "title")).toEqual({
      value: "Ledger",
      lang: "en",
    });
  });

  it("falls back to English when the translation is blank", () => {
    expect(
      localize(
        { en: { title: "Ledger" }, ro: { title: "   " } },
        "ro",
        "title",
      ),
    ).toEqual({ value: "Ledger", lang: "en" });
  });

  it("falls back to English when a translated list is empty", () => {
    expect(localize(i18n, "ro", "tags")).toEqual({
      value: ["a", "b"],
      lang: "en",
    });
  });

  it("marks only fallbacks with a lang attribute", () => {
    expect(fallbackLang({ value: "x", lang: "ro" }, "ro")).toBeUndefined();
    expect(fallbackLang({ value: "x", lang: "en" }, "ro")).toBe("en");
  });
});

describe("resolveCv", () => {
  it("resolves Romanian copy with diacritics", async () => {
    const cv = await getCv("ro");

    expect(cv.locale).toBe("ro");
    expect(cv.profile.headline.value).toContain("construiește");
    expect(cv.profile.headline.lang).toBe("ro");
  });

  it("falls back per field, not per record", async () => {
    const cv = await getCv("ro");
    const meridian = cv.experience.find((job) => job.id === "studio-meridian");

    expect(meridian?.roleTitle).toEqual({
      value: "Dezvoltator Frontend",
      lang: "ro",
    });
    expect(meridian?.description.lang).toBe("en");
  });

  it("drops unpublished experience and projects", async () => {
    const cv = await getCv("en");

    expect(cv.experience.map((job) => job.id)).not.toContain("draft-role");
    expect(cv.projects.map((p) => p.slug)).not.toContain("draft-project");
  });

  it("orders experience by sortOrder and projects featured-first, newest first", () => {
    const records: CvRecords = {
      ...fixtures,
      experience: fixtures.experience.toReversed(),
      projects: fixtures.projects.toReversed(),
    };
    const cv = resolveCv(records, "en");

    expect(cv.experience.map((job) => job.id)).toEqual([
      "ardea-health",
      "ferrum-freight",
      "studio-meridian",
    ]);
    expect(cv.projects.map((p) => p.slug)).toEqual([
      "ledger-lens",
      "tramline",
      "atelier-cms",
      "pulse-check",
    ]);
  });

  it("returns one stack entry per layer, top to bottom", async () => {
    const cv = await getCv("en");

    expect(cv.stack.map((entry) => entry.layer)).toEqual([...STACK_LAYERS]);
  });

  it("resolves project skill slugs to display names", async () => {
    const cv = await getCv("en");
    const ledger = cv.projects.find((p) => p.slug === "ledger-lens");

    expect(ledger?.skills).toEqual([
      "Next.js",
      "PostgreSQL",
      "Drizzle ORM",
      "Vitest and Playwright",
    ]);
  });
});

describe("fixtures", () => {
  it("maps every skill category to exactly one distinct stack layer", () => {
    const layers = fixtures.skillCategories.map((c) => c.layer).sort();

    expect(layers).toEqual([...STACK_LAYERS].sort());
  });

  it("only references skills and categories that exist", () => {
    const skillSlugs = new Set(fixtures.skills.map((s) => s.slug));
    const categorySlugs = new Set(fixtures.skillCategories.map((c) => c.slug));

    for (const skill of fixtures.skills) {
      expect(categorySlugs).toContain(skill.categorySlug);
    }
    for (const project of fixtures.projects) {
      for (const slug of project.skills) {
        expect(skillSlugs).toContain(slug);
      }
    }
  });

  it("uses unique slugs and ids", () => {
    const unique = (values: string[]) => new Set(values).size === values.length;

    expect(unique(fixtures.projects.map((p) => p.slug))).toBe(true);
    expect(unique(fixtures.skills.map((s) => s.slug))).toBe(true);
    expect(unique(fixtures.experience.map((e) => e.id))).toBe(true);
  });

  it("uses YYYY-MM dates with a start before the end", () => {
    for (const job of fixtures.experience) {
      expect(job.startDate).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
      if (job.endDate !== null) {
        expect(job.endDate).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
        expect(job.endDate >= job.startDate).toBe(true);
      }
    }
  });
});
```

`tests/unit/format.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { formatYearMonth } from "@/lib/format";

describe("formatYearMonth", () => {
  const originalTz = process.env.TZ;

  afterEach(() => {
    process.env.TZ = originalTz;
  });

  it("formats English short months", () => {
    expect(formatYearMonth("2021-03", "en")).toBe("Mar 2021");
  });

  it("formats Romanian short months", () => {
    expect(formatYearMonth("2019-09", "ro")).toBe("sept. 2019");
  });

  it("keeps the month when the server runs west of UTC", () => {
    process.env.TZ = "Pacific/Honolulu";

    expect(formatYearMonth("2021-03", "en")).toBe("Mar 2021");
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm test`
Expected: FAIL with

```
Error: Cannot find package '@/content/fixtures' imported from <worktree>/tests/unit/content.test.ts
Error: Cannot find package '@/lib/format' imported from <worktree>/tests/unit/format.test.ts
 Test Files  2 failed | 2 passed (4)
      Tests  9 passed (9)
```

- [ ] **Step 3: Export the `Locale` type — replace `src/i18n/routing.ts`**

```ts
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "ro"],
  defaultLocale: "en",
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];
```

- [ ] **Step 4: Create `src/content/types.ts`**

```ts
import type { Locale } from "@/i18n/routing";

// Shapes mirror the spec §4 data model (base table + `<entity>_i18n` rows).
// M2 replaces the fixture source with Drizzle queries that return these same
// record types, so components never change.

/** Stack layer enum; each value maps to one physical layer of the 3D monolith. */
export const STACK_LAYERS = [
  "interface",
  "api",
  "data",
  "infra",
  "craft",
] as const;
export type StackLayer = (typeof STACK_LAYERS)[number];

/** `YYYY-MM`, e.g. `2021-03`. */
export type YearMonth = `${number}-${number}`;

export type EmploymentType =
  | "full_time"
  | "part_time"
  | "contract"
  | "freelance";

/** Per-locale translatable columns. English is required; other locales may be partial. */
export type I18n<T> = { en: T } & {
  [L in Exclude<Locale, "en">]?: Partial<T>;
};

/** A resolved translatable value plus the locale it actually came from. */
export type Localized<T> = { value: T; lang: Locale };

export type SocialLink = { network: "github" | "linkedin"; url: string };

export type ProfileRecord = {
  emailPublic: string;
  location: string;
  countryCode: string;
  socials: SocialLink[];
  available: boolean;
  yearsExp: number;
  i18n: I18n<{
    fullName: string;
    headline: string;
    summary: string;
    seoTitle: string;
    seoDescription: string;
  }>;
};

export type ExperienceRecord = {
  id: string;
  company: string;
  url?: string;
  startDate: YearMonth;
  endDate: YearMonth | null;
  employmentType: EmploymentType;
  sortOrder: number;
  isPublished: boolean;
  i18n: I18n<{ roleTitle: string; description: string; highlights: string[] }>;
};

export type SkillCategoryRecord = {
  slug: string;
  layer: StackLayer;
  i18n: I18n<{ name: string }>;
};

export type SkillRecord = {
  slug: string;
  categorySlug: string;
  name: string;
  level: 1 | 2 | 3 | 4 | 5;
  years: number;
  featured: boolean;
};

export type ProjectRecord = {
  slug: string;
  repoUrl?: string;
  liveUrl?: string;
  year: number;
  featured: boolean;
  published: boolean;
  skills: string[];
  i18n: I18n<{ title: string; summary: string; role: string; outcome: string }>;
};

export type CvRecords = {
  profile: ProfileRecord;
  experience: ExperienceRecord[];
  skillCategories: SkillCategoryRecord[];
  skills: SkillRecord[];
  projects: ProjectRecord[];
};

/** Resolved, locale-specific view model consumed by the section components. */
export type Cv = {
  locale: Locale;
  profile: {
    fullName: Localized<string>;
    headline: Localized<string>;
    summary: Localized<string>;
    seoTitle: Localized<string>;
    seoDescription: Localized<string>;
    email: string;
    location: string;
    countryCode: string;
    socials: SocialLink[];
    available: boolean;
    yearsExp: number;
  };
  experience: Array<{
    id: string;
    company: string;
    url?: string;
    startDate: YearMonth;
    endDate: YearMonth | null;
    employmentType: EmploymentType;
    roleTitle: Localized<string>;
    description: Localized<string>;
    highlights: Localized<string[]>;
  }>;
  stack: Array<{
    layer: StackLayer;
    name: Localized<string>;
    skills: Array<{ slug: string; name: string; featured: boolean }>;
  }>;
  projects: Array<{
    slug: string;
    repoUrl?: string;
    liveUrl?: string;
    year: number;
    featured: boolean;
    skills: string[];
    title: Localized<string>;
    summary: Localized<string>;
    role: Localized<string>;
    outcome: Localized<string>;
  }>;
};
```

- [ ] **Step 5: Create `src/content/localize.ts`**

```ts
import type { Locale } from "@/i18n/routing";
import type { I18n, Localized } from "./types";

function isFilled(value: unknown): boolean {
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0 && value.every(isFilled);
  }
  return value !== undefined && value !== null;
}

/**
 * Reads one translatable field for `locale`, falling back to English when the
 * translation is missing or blank (same rule as M2's `COALESCE(ro, en)`).
 */
export function localize<T, K extends keyof T>(
  i18n: I18n<T>,
  locale: Locale,
  key: K,
): Localized<T[K]> {
  if (locale !== "en") {
    const translated = i18n[locale]?.[key];
    if (translated !== undefined && isFilled(translated)) {
      return { value: translated as T[K], lang: locale };
    }
  }
  return { value: i18n.en[key], lang: "en" };
}

/** `lang` attribute for an element showing `text` on a `pageLocale` page (only set on fallbacks). */
export function fallbackLang(
  text: Localized<unknown>,
  pageLocale: Locale,
): Locale | undefined {
  return text.lang === pageLocale ? undefined : text.lang;
}
```

- [ ] **Step 6: Create `src/content/fixtures.ts`**

The Studio Meridian RO entry leaves `description` out on purpose, and the draft entries are unpublished on purpose. Both are exercised by the tests.

```ts
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
```

- [ ] **Step 7: Create `src/content/get-cv.ts`**

```ts
import type { Locale } from "@/i18n/routing";
import { fixtures } from "./fixtures";
import { localize } from "./localize";
import { type Cv, type CvRecords, STACK_LAYERS } from "./types";

/** Resolves raw records into the locale-specific view model the sections render. */
export function resolveCv(records: CvRecords, locale: Locale): Cv {
  const { profile } = records;
  const skillName = new Map(records.skills.map((s) => [s.slug, s.name]));

  return {
    locale,
    profile: {
      fullName: localize(profile.i18n, locale, "fullName"),
      headline: localize(profile.i18n, locale, "headline"),
      summary: localize(profile.i18n, locale, "summary"),
      seoTitle: localize(profile.i18n, locale, "seoTitle"),
      seoDescription: localize(profile.i18n, locale, "seoDescription"),
      email: profile.emailPublic,
      location: profile.location,
      countryCode: profile.countryCode,
      socials: profile.socials,
      available: profile.available,
      yearsExp: profile.yearsExp,
    },
    experience: records.experience
      .filter((job) => job.isPublished)
      .toSorted((a, b) => a.sortOrder - b.sortOrder)
      .map((job) => ({
        id: job.id,
        company: job.company,
        url: job.url,
        startDate: job.startDate,
        endDate: job.endDate,
        employmentType: job.employmentType,
        roleTitle: localize(job.i18n, locale, "roleTitle"),
        description: localize(job.i18n, locale, "description"),
        highlights: localize(job.i18n, locale, "highlights"),
      })),
    stack: STACK_LAYERS.flatMap((layer) =>
      records.skillCategories
        .filter((category) => category.layer === layer)
        .map((category) => ({
          layer,
          name: localize(category.i18n, locale, "name"),
          skills: records.skills
            .filter((skill) => skill.categorySlug === category.slug)
            .map(({ slug, name, featured }) => ({ slug, name, featured })),
        })),
    ),
    projects: records.projects
      .filter((project) => project.published)
      .toSorted(
        (a, b) => Number(b.featured) - Number(a.featured) || b.year - a.year,
      )
      .map((project) => ({
        slug: project.slug,
        repoUrl: project.repoUrl,
        liveUrl: project.liveUrl,
        year: project.year,
        featured: project.featured,
        skills: project.skills.flatMap((slug) => skillName.get(slug) ?? []),
        title: localize(project.i18n, locale, "title"),
        summary: localize(project.i18n, locale, "summary"),
        role: localize(project.i18n, locale, "role"),
        outcome: localize(project.i18n, locale, "outcome"),
      })),
  };
}

/**
 * CV content for one locale. Async on purpose: M2 swaps the fixture source for
 * cached Drizzle queries (`'use cache'` + `cacheTag('cv')`) behind this signature.
 */
export async function getCv(locale: Locale): Promise<Cv> {
  return resolveCv(fixtures, locale);
}
```

- [ ] **Step 8: Create `src/lib/format.ts`**

```ts
import type { YearMonth } from "@/content/types";
import type { Locale } from "@/i18n/routing";

/**
 * Formats `YYYY-MM` as a short month + year (`Mar 2021`, `mar. 2021`).
 * Pinned to UTC so the month never shifts with the server's time zone.
 */
export function formatYearMonth(value: YearMonth, locale: Locale): string {
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `pnpm test`
Expected: `Test Files  4 passed (4)`, `Tests  28 passed (28)`.

Run: `pnpm typecheck`
Expected: `✓ Types generated successfully`, exit 0 (both the `src` and `tests` projects).

Run: `rtk proxy pnpm lint`
Expected: `Checked 32 files in <n>ms. No fixes applied.`

- [ ] **Step 10: Commit**

```bash
/usr/bin/git add src/i18n/routing.ts src/content src/lib/format.ts tests/unit/content.test.ts tests/unit/format.test.ts
/usr/bin/git commit -m "feat(content): add cv fixtures with en fallback"
```

---

### Task 3: Site URL, sitemap, robots and SEO builders

**Files:**
- Create: `src/lib/seo.ts`, `src/site.ts`, `src/app/sitemap.ts`, `src/app/robots.ts`, `tests/unit/seo.test.ts`, `tests/e2e/crawlers.spec.ts`
- Modify: `src/lib/create-app-env.ts`, `src/env.ts`, `.env.example`, `src/i18n/routing.ts`, `playwright.config.ts`, `tests/unit/env.test.ts`

**Interfaces:**
- Consumes: `getCv`, `Cv`, `Locale`, `routing` (Task 2); `createAppEnv` (M0).
- Produces:
  - `RuntimeEnv.SITE_URL?: string`. `env.SITE_URL` is an optional http(s) URL; empty means unset, and it is server-only.
  - `@/lib/seo` (pure, unit-tested):
    - `resolveSiteUrl({ siteUrl?, vercelProductionHost? }): string` returns an origin with no trailing slash. Precedence: `SITE_URL`, then `https://$VERCEL_PROJECT_PRODUCTION_URL`, then `http://localhost:3000`.
    - `localeUrl(siteUrl, locale, pathname = "/"): string` returns `…/ro` or `…/en/projects/x`.
    - `languageAlternates(siteUrl, pathname = "/"): Record<"en" | "ro" | "x-default", string>`. `x-default` is the detecting root (the bare origin for `/`).
    - `buildSitemap(siteUrl): MetadataRoute.Sitemap` and `buildRobots(siteUrl): MetadataRoute.Robots`.
    - `personJsonLd(cv: Cv, siteUrl): object` returns a schema.org `Person`; `jobTitle` and `worksFor` come from the current role.
    - `serializeJsonLd(data: unknown): string` returns JSON with every `<` written as `\u003c`.
  - `siteUrl` from `@/site` (app code only; it imports `@/env`).
  - `/sitemap.xml` and `/robots.txt`. The proxy no longer sends a hreflang `Link` header.
  - The e2e server is built with `SITE_URL=http://localhost:3100`.

- [ ] **Step 1: Add the failing env tests**

In `tests/unit/env.test.ts`, insert these three tests directly before the existing `it("refuses to expose DATABASE_URL to client code", …)` test:

```ts
  it("accepts an https SITE_URL", () => {
    const env = createAppEnv({
      DATABASE_URL: LOCAL_DB,
      SITE_URL: "https://cv.example.dev",
    });

    expect(env.SITE_URL).toBe("https://cv.example.dev");
  });

  it("treats an empty SITE_URL as unset", () => {
    const env = createAppEnv({ DATABASE_URL: LOCAL_DB, SITE_URL: "" });

    expect(env.SITE_URL).toBeUndefined();
  });

  it("rejects a SITE_URL without an http(s) scheme", () => {
    expect(() =>
      createAppEnv({ DATABASE_URL: LOCAL_DB, SITE_URL: "cv.example.dev" }),
    ).toThrow("Invalid environment variables");
  });
```

- [ ] **Step 2: Write the failing SEO unit tests `tests/unit/seo.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { getCv } from "@/content/get-cv";
import {
  buildRobots,
  buildSitemap,
  languageAlternates,
  localeUrl,
  personJsonLd,
  resolveSiteUrl,
  serializeJsonLd,
} from "@/lib/seo";

const SITE = "https://cv.example.dev";

describe("resolveSiteUrl", () => {
  it("prefers SITE_URL and drops a trailing slash", () => {
    expect(
      resolveSiteUrl({
        siteUrl: "https://cv.example.dev/",
        vercelProductionHost: "cv.vercel.app",
      }),
    ).toBe(SITE);
  });

  it("uses the Vercel production host when SITE_URL is unset", () => {
    expect(resolveSiteUrl({ vercelProductionHost: "cv.vercel.app" })).toBe(
      "https://cv.vercel.app",
    );
  });

  it("falls back to the local dev server", () => {
    expect(resolveSiteUrl({})).toBe("http://localhost:3000");
  });
});

describe("locale URLs", () => {
  it("builds the home URL without a trailing slash", () => {
    expect(localeUrl(SITE, "ro")).toBe("https://cv.example.dev/ro");
  });

  it("builds nested paths", () => {
    expect(localeUrl(SITE, "en", "/projects/ledger-lens")).toBe(
      "https://cv.example.dev/en/projects/ledger-lens",
    );
  });

  it("lists every locale plus x-default", () => {
    expect(languageAlternates(SITE)).toEqual({
      en: "https://cv.example.dev/en",
      ro: "https://cv.example.dev/ro",
      "x-default": "https://cv.example.dev",
    });
  });
});

describe("sitemap and robots", () => {
  it("lists each locale home with hreflang alternates", () => {
    const sitemap = buildSitemap(SITE);

    expect(sitemap.map((entry) => entry.url)).toEqual([
      "https://cv.example.dev/en",
      "https://cv.example.dev/ro",
    ]);
    for (const entry of sitemap) {
      expect(entry.alternates?.languages).toEqual(languageAlternates(SITE));
    }
  });

  it("allows crawling and points at the sitemap", () => {
    expect(buildRobots(SITE)).toEqual({
      rules: { userAgent: "*", allow: "/" },
      sitemap: "https://cv.example.dev/sitemap.xml",
    });
  });
});

describe("personJsonLd", () => {
  it("describes the person in the page locale", async () => {
    const data = personJsonLd(await getCv("ro"), SITE);

    expect(data).toMatchObject({
      "@context": "https://schema.org",
      "@type": "Person",
      "@id": "https://cv.example.dev/#person",
      name: "Alex Marin",
      jobTitle: "Inginer Fullstack Senior",
      url: "https://cv.example.dev/ro",
      email: "mailto:hello@example.com",
      address: { addressLocality: "Cluj-Napoca", addressCountry: "RO" },
      worksFor: { "@type": "Organization", name: "Ardea Health" },
      knowsLanguage: ["en", "ro"],
    });
    expect(data.knowsAbout).toContain("PostgreSQL");
    expect(data.sameAs).toHaveLength(2);
  });

  it("omits jobTitle and worksFor when no role is current", async () => {
    const cv = await getCv("en");
    const data = personJsonLd(
      {
        ...cv,
        experience: cv.experience.filter((job) => job.endDate !== null),
      },
      SITE,
    );

    expect(data).not.toHaveProperty("jobTitle");
    expect(data).not.toHaveProperty("worksFor");
  });
});

describe("serializeJsonLd", () => {
  it("cannot be used to close the script tag", () => {
    const json = serializeJsonLd({
      name: "</script><script>alert(1)</script>",
    });

    expect(json).not.toContain("</script>");
    expect(JSON.parse(json)).toEqual({
      name: "</script><script>alert(1)</script>",
    });
  });
});
```

- [ ] **Step 3: Write the failing e2e spec `tests/e2e/crawlers.spec.ts`**

```ts
import { expect, test } from "@playwright/test";

const ORIGIN = "http://localhost:3100";

test("sitemap lists both locales with hreflang alternates", async ({
  request,
}) => {
  const response = await request.get("/sitemap.xml");
  const body = await response.text();

  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/xml");
  expect(body).toContain(`<loc>${ORIGIN}/en</loc>`);
  expect(body).toContain(`<loc>${ORIGIN}/ro</loc>`);
  expect(body).toContain(
    `<xhtml:link rel="alternate" hreflang="ro" href="${ORIGIN}/ro" />`,
  );
  expect(body).toContain(
    `<xhtml:link rel="alternate" hreflang="x-default" href="${ORIGIN}" />`,
  );
});

test("robots.txt allows crawling and points at the sitemap", async ({
  request,
}) => {
  const response = await request.get("/robots.txt");
  const body = await response.text();

  expect(response.status()).toBe(200);
  expect(body).toContain("Allow: /");
  expect(body).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
});

test("pages do not repeat hreflang in a Link header", async ({ request }) => {
  const response = await request.get("/en");

  expect(response.status()).toBe(200);
  expect(response.headers().link ?? "").not.toContain("hreflang");
});
```

- [ ] **Step 4: Build the e2e server with a known origin — replace `playwright.config.ts`**

```ts
import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `next build && next start --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
    // Canonical URLs, hreflang, sitemap and JSON-LD are baked at build time.
    env: { SITE_URL: baseURL },
  },
});
```

- [ ] **Step 5: Run the tests to verify they fail**

Run: `pnpm test`
Expected: FAIL with

```
     × accepts an https SITE_URL
     × rejects a SITE_URL without an http(s) scheme
Error: Cannot find package '@/lib/seo' imported from <worktree>/tests/unit/seo.test.ts
AssertionError: expected undefined to be 'https://cv.example.dev' // Object.is equality
AssertionError: expected [Function] to throw an error
 Test Files  2 failed | 3 passed (5)
      Tests  2 failed | 29 passed (31)
```

Run: `pnpm exec playwright test tests/e2e/crawlers.spec.ts`
Expected: `3 failed`. Two fail with `Expected: 200` / `Received: 404` (sitemap and robots don't exist yet). The Link header test fails with `Expected substring: not "hreflang"` and `Received string: "<http://localhost:3100/en>; rel=\"alternate\"; hreflang=\"en\", …`.

- [ ] **Step 6: Add `SITE_URL` to the env schema — replace `src/lib/create-app-env.ts`**

```ts
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export type RuntimeEnv = {
  DATABASE_URL?: string;
  SITE_URL?: string;
  NEXT_PUBLIC_ASSET_BASE?: string;
};

export function createAppEnv(
  runtimeEnv: RuntimeEnv,
  options: { isServer?: boolean } = {},
) {
  return createEnv({
    server: {
      DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
      SITE_URL: z.url({ protocol: /^https?$/ }).optional(),
    },
    client: {
      NEXT_PUBLIC_ASSET_BASE: z.url().optional(),
    },
    runtimeEnv: {
      DATABASE_URL: runtimeEnv.DATABASE_URL,
      SITE_URL: runtimeEnv.SITE_URL,
      NEXT_PUBLIC_ASSET_BASE: runtimeEnv.NEXT_PUBLIC_ASSET_BASE,
    },
    emptyStringAsUndefined: true,
    isServer: options.isServer,
  });
}
```

Replace `src/env.ts`:

```ts
import { createAppEnv } from "./lib/create-app-env";

export const env = createAppEnv({
  DATABASE_URL: process.env.DATABASE_URL,
  SITE_URL: process.env.SITE_URL,
  NEXT_PUBLIC_ASSET_BASE: process.env.NEXT_PUBLIC_ASSET_BASE,
});
```

Replace `.env.example`:

```dotenv
# Copy to .env.local for local development: cp .env.example .env.local

# Postgres connection string. Local default matches docker-compose.yml.
# On Vercel this is injected by the Neon integration.
DATABASE_URL=postgres://cv:cv@localhost:5432/cv

# Public origin for canonical URLs, hreflang, sitemap.xml and JSON-LD.
# Empty = the Vercel production domain on Vercel, http://localhost:3000 elsewhere.
SITE_URL=

# Optional absolute base URL for /public media (sequences, glb). Empty = same origin.
NEXT_PUBLIC_ASSET_BASE=
```

- [ ] **Step 7: Create `src/lib/seo.ts`**

```ts
import type { MetadataRoute } from "next";
import type { Cv } from "@/content/types";
import { type Locale, routing } from "@/i18n/routing";

/**
 * Public origin used for canonical URLs, hreflang, the sitemap and JSON-LD.
 * `SITE_URL` wins; on Vercel production builds the project's production domain
 * is used; local and CI fall back to the dev server.
 */
export function resolveSiteUrl(input: {
  siteUrl?: string;
  vercelProductionHost?: string;
}): string {
  const raw =
    input.siteUrl ??
    (input.vercelProductionHost
      ? `https://${input.vercelProductionHost}`
      : "http://localhost:3000");
  return new URL(raw).origin;
}

/** Absolute URL of `pathname` (always starting with `/`) in `locale`. */
export function localeUrl(
  siteUrl: string,
  locale: Locale,
  pathname = "/",
): string {
  const suffix = pathname === "/" ? "" : pathname;
  return `${siteUrl}/${locale}${suffix}`;
}

/** hreflang map for one page: every locale plus `x-default` (the detecting root). */
export function languageAlternates(
  siteUrl: string,
  pathname = "/",
): Record<Locale | "x-default", string> {
  const entries = routing.locales.map(
    (locale) => [locale, localeUrl(siteUrl, locale, pathname)] as const,
  );
  return {
    ...(Object.fromEntries(entries) as Record<Locale, string>),
    "x-default": pathname === "/" ? siteUrl : `${siteUrl}${pathname}`,
  };
}

export function buildSitemap(siteUrl: string): MetadataRoute.Sitemap {
  return routing.locales.map((locale) => ({
    url: localeUrl(siteUrl, locale),
    changeFrequency: "monthly",
    priority: 1,
    alternates: { languages: languageAlternates(siteUrl) },
  }));
}

export function buildRobots(siteUrl: string): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}

/** schema.org `Person` for the home page of `cv.locale`. */
export function personJsonLd(cv: Cv, siteUrl: string) {
  const { profile } = cv;
  const current = cv.experience.find((job) => job.endDate === null);

  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${siteUrl}/#person`,
    name: profile.fullName.value,
    description: profile.summary.value,
    url: localeUrl(siteUrl, cv.locale),
    email: `mailto:${profile.email}`,
    address: {
      "@type": "PostalAddress",
      addressLocality: profile.location,
      addressCountry: profile.countryCode,
    },
    sameAs: profile.socials.map((social) => social.url),
    knowsAbout: cv.stack.flatMap((layer) =>
      layer.skills.filter((s) => s.featured).map((s) => s.name),
    ),
    knowsLanguage: [...routing.locales],
    ...(current
      ? {
          jobTitle: current.roleTitle.value,
          worksFor: { "@type": "Organization", name: current.company },
        }
      : {}),
  };
}

/** JSON for an inline `<script type="application/ld+json">`; `<` is escaped so content cannot close the tag. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
```

- [ ] **Step 8: Create the app instance and the crawler routes**

`src/site.ts`:

```ts
import { env } from "@/env";
import { resolveSiteUrl } from "@/lib/seo";

export const siteUrl = resolveSiteUrl({
  siteUrl: env.SITE_URL,
  vercelProductionHost: process.env.VERCEL_PROJECT_PRODUCTION_URL,
});
```

`src/app/sitemap.ts`:

```ts
import type { MetadataRoute } from "next";
import { buildSitemap } from "@/lib/seo";
import { siteUrl } from "@/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return buildSitemap(siteUrl);
}
```

`src/app/robots.ts`:

```ts
import type { MetadataRoute } from "next";
import { buildRobots } from "@/lib/seo";
import { siteUrl } from "@/site";

export default function robots(): MetadataRoute.Robots {
  return buildRobots(siteUrl);
}
```

- [ ] **Step 9: Stop the duplicate hreflang header — replace `src/i18n/routing.ts`**

```ts
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "ro"],
  defaultLocale: "en",
  localePrefix: "always",
  // hreflang is emitted by page metadata and the sitemap (one source, based on SITE_URL).
  alternateLinks: false,
});

export type Locale = (typeof routing.locales)[number];
```

- [ ] **Step 10: Run the tests to verify they pass**

Run: `pnpm test`
Expected: `Test Files  5 passed (5)`, `Tests  42 passed (42)`.

Run: `pnpm test:e2e`
Expected: `10 passed`. Afterwards `ss -ltn | grep ':3100 '` prints nothing.

Run: `pnpm build`
Expected: the route table now also lists `├ ○ /robots.txt` and `└ ○ /sitemap.xml`.

Run: `pnpm typecheck`
Expected: `✓ Types generated successfully`, exit 0.

Run: `rtk proxy pnpm lint`
Expected: `Checked 38 files in <n>ms. No fixes applied.`

- [ ] **Step 11: Commit**

```bash
/usr/bin/git add .env.example playwright.config.ts src/app/robots.ts src/app/sitemap.ts src/env.ts src/i18n/routing.ts src/lib/create-app-env.ts src/lib/seo.ts src/site.ts tests/e2e/crawlers.spec.ts tests/unit/env.test.ts tests/unit/seo.test.ts
/usr/bin/git commit -m "feat(seo): add site url, sitemap and robots"
```

---

### Task 4: Design tokens, fonts, page skeleton and the axe gate

**Files:**
- Create: `src/app/fonts.ts`, `tests/e2e/a11y.spec.ts`, `tests/e2e/design-system.spec.ts`
- Modify: `package.json`, `pnpm-lock.yaml`, `src/app/globals.css` (full rewrite), `src/app/[locale]/layout.tsx`, `src/app/[locale]/page.tsx`, `src/app/[locale]/not-found.tsx`, `messages/en.json`, `messages/ro.json`

**Interfaces:**
- Consumes: M0 `Metadata` / `HomePage` / `NotFound` messages.
- Produces:
  - Tailwind tokens used by every later task:
    - colours `canvas`, `surface`, `raised`, `line`, `line-strong`, `ink`, `ink-muted`, `ink-subtle`, `signal`, `signal-ink`, plus the decorative materials `glass`, `titanium`, `ceramic`, `pcb`, `base`
    - type `text-display`, `text-title`, `text-heading`, `text-lead`, `text-label`
    - radii `rounded-control`, `rounded-panel`
    - spacing `px-gutter`, `py-section`; width `max-w-content`
    - easings `ease-out-quint`, `ease-studio`
    - motion custom properties `--motion-press`, `--motion-quick`, `--motion-sweep`
    - fonts `font-sans` (Mona Sans), `font-mono` (Martian Mono)
  - CSS component classes `.stage` and `.slab`, the `[data-layer=…]` rule that sets `--layer-tint`, and the `@keyframes studio-sweep`. These are used by Tasks 5 and 6.
  - The layout renders `<a href="#main">` (skip link) and `<main id="main" tabIndex={-1}>`. Pages must not render their own `<main>`.
  - Message key `Layout.skipToContent`.
  - The axe gate `tests/e2e/a11y.spec.ts` (`/en` and `/ro` × desktop and phone), which runs in every later task.

- [ ] **Step 1: Add the axe dependency**

```bash
pnpm add -D -E @axe-core/playwright@4.13.0
```

Expected: `+ @axe-core/playwright 4.13.0`, `Done in <n>s using pnpm v11.27.1`, and no `ERR_PNPM_IGNORED_BUILDS`.

- [ ] **Step 2: Write the axe gate `tests/e2e/a11y.spec.ts`**

```ts
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "phone", width: 390, height: 844 },
] as const;

for (const locale of ["en", "ro"] as const) {
  for (const viewport of VIEWPORTS) {
    test(`/${locale} has no axe violations (${viewport.name})`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto(`/${locale}`);

      const { violations } = await new AxeBuilder({ page }).analyze();

      expect(
        violations.map((v) => ({
          id: v.id,
          targets: v.nodes.map((node) => node.target.join(" ")),
        })),
      ).toEqual([]);
    });
  }
}
```

- [ ] **Step 3: Write the failing design-system spec `tests/e2e/design-system.spec.ts`**

```ts
import { expect, test } from "@playwright/test";

test("skip link is the first tab stop and moves focus to main", async ({
  page,
}) => {
  await page.goto("/en");

  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();

  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/en#main");
  await expect(page.getByRole("main")).toBeFocused();
});

test("loads the latin-ext webfont subset for Romanian diacritics", async ({
  page,
}) => {
  await page.goto("/ro");

  const loadedRanges = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts]
      .filter((face) => face.status === "loaded")
      .map((face) => face.unicodeRange);
  });

  // Google's latin-ext subset starts at U+0100 and holds ș ț ă (U+0219, U+021B, U+0103).
  expect(loadedRanges.some((range) => range.includes("U+100-2BA"))).toBe(true);
});

test("has no horizontal overflow on a 320px phone", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/ro");

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
```

- [ ] **Step 4: Run both to see the starting point**

Run: `pnpm exec playwright test tests/e2e/a11y.spec.ts tests/e2e/design-system.spec.ts`
Expected: `2 failed`, `5 passed`.
- `skip link is the first tab stop and moves focus to main` fails with `Error: expect(locator).toBeFocused() failed` / `element(s) not found`.
- `loads the latin-ext webfont subset for Romanian diacritics` fails with `Expected: true` / `Received: false`, because the M0 page uses system fonts.
- The 4 axe tests and the 320 px overflow test already pass on the M0 page. From this task on, they guard every later task.

- [ ] **Step 5: Replace `src/app/globals.css` with the design tokens**

Design direction, from the design-taste-frontend, high-end-visual-design and apple-design skills. The page is a developer portfolio for recruiters and clients, told in the language of an Apple product film shot in a dark studio. Dials: variance 6, motion 3 in M1 (M5 raises it), density 4.
- **Colour.** Graphite studio neutrals with one cool accent, `signal`. There is no AI purple and no beige/brass. Every text pair is at least 4.5:1 (see Verified facts), and the material tints only colour edges.
- **Type.** Mona Sans for display and body, with negative tracking that tightens as size grows (display -0.045em, title -0.035em, heading -0.015em). Martian Mono in uppercase +0.06em for "engraved" labels: layer codes, dates and years.
- **Shape.** Controls are pills, cards use `panel` (1.75rem) and inputs use `control` (0.875rem).
- **Motion.** The easing is `ease-studio` = `cubic-bezier(0.32, 0.72, 0, 1)`, Apple's sheet curve. The press state takes 120 ms. Transform and opacity are the only animated properties. There is one 2.4 s softbox sweep on the hero plate, echoing shot S1, and it only runs under `prefers-reduced-motion: no-preference`. M1 has no entrance fades: fading text would delay LCP and give axe half-transparent text to measure.

```css
@import "tailwindcss";

/*
 * Design tokens: "The Stack", a dark studio product film.
 * One theme (dark), one accent (signal), text only on solid surfaces so
 * contrast stays measurable (every text/background pair is >= 4.5:1).
 */
@theme {
  --color-*: initial;
  --color-canvas: #0b0c0f;
  --color-surface: #121419;
  --color-raised: #1a1d24;
  --color-line: #262a32;
  --color-line-strong: #646b78;
  --color-ink: #eceef2;
  --color-ink-muted: #a9afba;
  --color-ink-subtle: #8c93a0;
  --color-signal: #7cc5ff;
  --color-signal-ink: #06121c;

  /* Stack layer materials: decorative edges only, never text. */
  --color-glass: #8fcfff;
  --color-titanium: #b7bcc6;
  --color-ceramic: #e6e1d6;
  --color-pcb: #4d9a72;
  --color-base: #555c69;

  --text-display: clamp(3.25rem, 1.75rem + 6.5vw, 7.5rem);
  --text-display--line-height: 0.92;
  --text-display--letter-spacing: -0.045em;
  --text-display--font-weight: 650;
  --text-title: clamp(2.25rem, 1.5rem + 3.2vw, 4.25rem);
  --text-title--line-height: 1;
  --text-title--letter-spacing: -0.035em;
  --text-title--font-weight: 620;
  --text-heading: clamp(1.25rem, 1.1rem + 0.6vw, 1.625rem);
  --text-heading--line-height: 1.2;
  --text-heading--letter-spacing: -0.015em;
  --text-heading--font-weight: 600;
  --text-lead: clamp(1.125rem, 1.05rem + 0.4vw, 1.375rem);
  --text-lead--line-height: 1.5;
  --text-lead--letter-spacing: -0.01em;
  --text-label: 0.75rem;
  --text-label--line-height: 1.4;
  --text-label--letter-spacing: 0.06em;

  --radius-control: 0.875rem;
  --radius-panel: 1.75rem;

  --spacing-gutter: clamp(1rem, 0.5rem + 2.5vw, 2.5rem);
  --spacing-section: clamp(6rem, 3.5rem + 9vw, 11rem);
  --container-content: 76rem;

  --ease-out-quint: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-studio: cubic-bezier(0.32, 0.72, 0, 1);
  --default-transition-duration: 220ms;
  --default-transition-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
}

@theme inline {
  --font-sans: var(--font-mona-sans), ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-martian-mono), ui-monospace, monospace;
}

:root {
  --motion-press: 120ms;
  --motion-quick: 220ms;
  --motion-sweep: 2400ms;
}

@layer base {
  html {
    color-scheme: dark;
    background-color: var(--color-canvas);
    color: var(--color-ink);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  *,
  ::before,
  ::after {
    border-color: var(--color-line);
  }

  ::selection {
    background-color: var(--color-signal);
    color: var(--color-signal-ink);
  }

  :focus-visible {
    outline: 2px solid var(--color-signal);
    outline-offset: 3px;
  }

  /* Long Romanian words and names must wrap, never scroll the page sideways. */
  h1,
  h2,
  h3 {
    overflow-wrap: break-word;
    text-wrap: balance;
  }

  @media (prefers-reduced-motion: no-preference) {
    html {
      scroll-behavior: smooth;
    }
  }
}

@layer components {
  /* Stack layer tints for data-layer="interface|api|data|infra|craft". */
  [data-layer="interface"] {
    --layer-tint: var(--color-glass);
  }
  [data-layer="api"] {
    --layer-tint: var(--color-titanium);
  }
  [data-layer="data"] {
    --layer-tint: var(--color-ceramic);
  }
  [data-layer="infra"] {
    --layer-tint: var(--color-pcb);
  }
  [data-layer="craft"] {
    --layer-tint: var(--color-base);
  }

  /* Reserved box for a future 3D scene or frame sequence (M5); a CSS studio plate until then. */
  .stage {
    position: relative;
    overflow: hidden;
    border-radius: var(--radius-panel);
    background:
      radial-gradient(
        70% 55% at 60% 30%,
        color-mix(in oklab, var(--color-signal) 14%, transparent),
        transparent 70%
      ),
      radial-gradient(90% 60% at 50% 115%, var(--color-raised), transparent 70%),
      var(--color-surface);
    box-shadow: inset 0 0 0 1px var(--color-line);
  }

  .slab {
    height: 12%;
    border-radius: var(--radius-control);
    background:
      linear-gradient(
        180deg,
        color-mix(in oklab, var(--layer-tint) 28%, transparent),
        transparent 65%
      ),
      var(--color-raised);
    box-shadow:
      inset 0 1px 0 color-mix(in oklab, var(--layer-tint) 45%, transparent),
      0 24px 40px -28px var(--color-canvas);
  }

  /* One softbox sweep across the plate on load, like the S1 light pass. */
  @media (prefers-reduced-motion: no-preference) {
    .stage::after {
      content: "";
      position: absolute;
      inset: -20% auto -20% -60%;
      width: 45%;
      background: linear-gradient(
        100deg,
        transparent,
        color-mix(in oklab, var(--color-ink) 9%, transparent),
        transparent
      );
      transform: translateX(0) skewX(-12deg);
      animation: studio-sweep var(--motion-sweep) var(--ease-studio) 300ms
        forwards;
      pointer-events: none;
    }
  }
}

@keyframes studio-sweep {
  to {
    transform: translateX(420%) skewX(-12deg);
  }
}
```

- [ ] **Step 6: Create `src/app/fonts.ts`**

```ts
import { Martian_Mono, Mona_Sans } from "next/font/google";

// Two variable fonts, latin + latin-ext (Romanian ș ț ă live in latin-ext).
// Only the wght axis is requested: the wdth axis more than doubles the files.
export const sans = Mona_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-mona-sans",
  display: "swap",
});

// Labels only (dates, layer codes), never the LCP text, so it is not preloaded.
export const mono = Martian_Mono({
  subsets: ["latin", "latin-ext"],
  variable: "--font-martian-mono",
  display: "swap",
  preload: false,
});
```

- [ ] **Step 7: Add the skip-link string**

Add this top-level key to `messages/en.json`, directly before `"NotFound"`:

```json
  "Layout": {
    "skipToContent": "Skip to content"
  },
```

Add the same key to `messages/ro.json`, directly before `"NotFound"`:

```json
  "Layout": {
    "skipToContent": "Sari la conținut"
  },
```

- [ ] **Step 8: Replace `src/app/[locale]/layout.tsx`**

The layout now owns the single `<main>` landmark. `<main>` takes focus when the skip link is used (`tabIndex={-1}`), and the outline is hidden only for that programmatic focus.

```tsx
import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { mono, sans } from "../fonts";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");

  return {
    title: t("title"),
    description: t("description"),
  };
}

export const viewport: Viewport = {
  themeColor: "#0b0c0f",
  colorScheme: "dark",
};

export default async function LocaleLayout({
  children,
}: LayoutProps<"/[locale]">) {
  const locale = await getLocale();
  const t = await getTranslations("Layout");

  return (
    <html
      lang={locale}
      data-scroll-behavior="smooth"
      className={`${sans.variable} ${mono.variable}`}
    >
      <body className="min-h-dvh bg-canvas font-sans text-ink">
        <a
          href="#main"
          className="sr-only rounded-full bg-signal px-5 py-3 font-medium text-signal-ink focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50"
        >
          {t("skipToContent")}
        </a>
        <NextIntlClientProvider>
          <main id="main" tabIndex={-1} className="focus:outline-none">
            {children}
          </main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 9: Stop pages from nesting a second `<main>`**

Replace `src/app/[locale]/page.tsx`. This is still the M0 placeholder, restyled with tokens; Task 5 replaces it.

```tsx
import { useTranslations } from "next-intl";

export default function HomePage() {
  const t = useTranslations("HomePage");

  return (
    <section className="mx-auto flex min-h-[70svh] w-full max-w-content flex-col justify-center gap-4 px-gutter py-section">
      <h1 className="text-title text-ink">{t("title")}</h1>
      <p className="text-lead text-ink-muted">{t("subtitle")}</p>
    </section>
  );
}
```

Replace `src/app/[locale]/not-found.tsx`:

```tsx
import { useTranslations } from "next-intl";

export default function LocaleNotFound() {
  const t = useTranslations("NotFound");

  return (
    <section className="mx-auto flex min-h-[60svh] w-full max-w-content flex-col justify-center gap-4 px-gutter py-section">
      <h1 className="text-title text-ink">{t("title")}</h1>
      <p className="text-lead text-ink-muted">{t("description")}</p>
    </section>
  );
}
```

- [ ] **Step 10: Run the tests to verify they pass**

Run: `pnpm test:e2e`
Expected: `17 passed`: 7 routing, 3 crawlers, 4 axe and 3 design-system. Afterwards `ss -ltn | grep ':3100 '` prints nothing.

Run: `pnpm test`
Expected: `Tests  42 passed (42)`.

Run: `pnpm typecheck`
Expected: `✓ Types generated successfully`, exit 0.

Run: `rtk proxy pnpm lint`
Expected: `Checked 41 files in <n>ms. No fixes applied.`

- [ ] **Step 11: Commit**

```bash
/usr/bin/git add package.json pnpm-lock.yaml messages src/app tests/e2e/a11y.spec.ts tests/e2e/design-system.spec.ts
/usr/bin/git status --short
/usr/bin/git commit -m "feat(ui): add studio design tokens and fonts"
```

`git status --short` must list only staged (`A`/`M`) paths before the commit.

---

### Task 5: About, Skills (the stack) and Experience sections

**Files:**
- Create: `src/components/ui/Section.tsx`, `src/components/sections/About.tsx`, `src/components/sections/Skills.tsx`, `src/components/sections/Experience.tsx`, `tests/e2e/about-skills-experience.spec.ts`
- Modify: `messages/en.json`, `messages/ro.json`, `src/app/[locale]/page.tsx`, `tests/unit/messages.test.ts`

**Interfaces:**
- Consumes: `getCv`, `Cv`, `fallbackLang` (Task 2); `formatYearMonth` (Task 2); tokens and `[data-layer]` tints (Task 4).
- Produces:
  - `Section({ id, title, intro?, scene?, children })` renders `<section id aria-labelledby="{id}-title" data-scene>` with an `h2#{id}-title`. `type SceneId = "hero" | "about" | "skills" | "experience" | "contact"`.
  - `About({ cv })` → `section#about`, `Skills({ cv })` → `section#skills` (an `ol` of 5 `li[data-layer]`), `Experience({ cv })` → `section#experience`.
  - Message namespaces `Availability.{open,closed}`, `About.*` (ICU plural `years`), `Skills.*` (`materials.<layer>`), `Experience.*` (`employmentType.<type>`).

- [ ] **Step 1: Add the failing plural tests — replace `tests/unit/messages.test.ts`**

```ts
import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import ro from "../../messages/ro.json";

function keyPaths(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) {
    return [prefix];
  }
  return Object.entries(value).flatMap(([key, child]) =>
    keyPaths(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe("messages", () => {
  it("ro.json defines exactly the keys of en.json", () => {
    expect(keyPaths(ro).sort()).toEqual(keyPaths(en).sort());
  });

  it("pluralises years in English", () => {
    const t = createTranslator({ locale: "en", messages: en });

    expect(t("About.years", { count: 1 })).toBe("1 year");
    expect(t("About.years", { count: 9 })).toBe("9 years");
  });

  it("pluralises years with Romanian one/few/other forms", () => {
    const t = createTranslator({ locale: "ro", messages: ro });

    expect(t("About.years", { count: 1 })).toBe("1 an");
    expect(t("About.years", { count: 9 })).toBe("9 ani");
    expect(t("About.years", { count: 20 })).toBe("20 de ani");
  });
});
```

- [ ] **Step 2: Write the failing e2e spec `tests/e2e/about-skills-experience.spec.ts`**

```ts
import { expect, test } from "@playwright/test";

test("pluralises years of experience in Romanian", async ({ page }) => {
  await page.goto("/ro");

  await expect(
    page.getByRole("region", { name: "Despre" }).getByText("9 ani"),
  ).toBeVisible();
});

test("shows the five stack layers top to bottom", async ({ page }) => {
  await page.goto("/en");

  const layers = page.locator("#skills ol > li");
  await expect(layers).toHaveCount(5);
  expect(
    await layers.evaluateAll((items) =>
      items.map((item) => item.getAttribute("data-layer")),
    ),
  ).toEqual(["interface", "api", "data", "infra", "craft"]);
  await expect(layers.first().getByRole("heading")).toHaveText("Interface");
});

test("formats experience dates per locale", async ({ page }) => {
  await page.goto("/ro");

  await expect(
    page
      .getByRole("region", { name: "Experiență" })
      .getByText("apr. 2022 - Prezent"),
  ).toBeVisible();
});

test("marks English fallback text with lang=en on /ro", async ({ page }) => {
  await page.goto("/ro");

  await expect(
    page.getByText(
      "Built marketing sites and small web apps for agency clients on tight launch dates.",
    ),
  ).toHaveAttribute("lang", "en");
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `pnpm test`
Expected: FAIL. next-intl logs ``IntlError: MISSING_MESSAGE: Could not resolve `About.years` in messages for locale `en` `` and then:

```
     × pluralises years in English
     × pluralises years with Romanian one/few/other forms
AssertionError: expected 'About.years' to be '1 year' // Object.is equality
```

Run: `pnpm exec playwright test tests/e2e/about-skills-experience.spec.ts`
Expected: `4 failed`, each with `Error: expect(locator)… failed` because the sections don't exist yet.

- [ ] **Step 4: Add the section strings**

Add these top-level keys to `messages/en.json`, directly before `"NotFound"`:

```json
  "Availability": {
    "open": "Open to new projects",
    "closed": "Not taking new projects"
  },
  "About": {
    "title": "About",
    "location": "Based in",
    "experience": "Experience",
    "years": "{count, plural, one {# year} other {# years}}",
    "projects": "Shipped projects",
    "availability": "Availability"
  },
  "Skills": {
    "title": "The stack",
    "intro": "Five layers, from the interface people touch to the craft that holds it together.",
    "layer": "Layer {index}",
    "materials": {
      "interface": "Glass",
      "api": "Titanium",
      "data": "Ceramic",
      "infra": "Circuit board",
      "craft": "Base plate"
    }
  },
  "Experience": {
    "title": "Experience",
    "present": "Present",
    "employmentType": {
      "full_time": "Full-time",
      "part_time": "Part-time",
      "contract": "Contract",
      "freelance": "Freelance"
    }
  },
```

Add these to `messages/ro.json`, directly before `"NotFound"`:

```json
  "Availability": {
    "open": "Disponibil pentru proiecte noi",
    "closed": "Nu preiau proiecte noi"
  },
  "About": {
    "title": "Despre",
    "location": "Locație",
    "experience": "Experiență",
    "years": "{count, plural, one {# an} few {# ani} other {# de ani}}",
    "projects": "Proiecte livrate",
    "availability": "Disponibilitate"
  },
  "Skills": {
    "title": "Stiva",
    "intro": "Cinci straturi, de la interfața pe care o atinge omul până la meșteșugul care le ține laolaltă.",
    "layer": "Stratul {index}",
    "materials": {
      "interface": "Sticlă",
      "api": "Titan",
      "data": "Ceramică",
      "infra": "Placă de circuit",
      "craft": "Placă de bază"
    }
  },
  "Experience": {
    "title": "Experiență",
    "present": "Prezent",
    "employmentType": {
      "full_time": "Normă întreagă",
      "part_time": "Normă parțială",
      "contract": "Contract",
      "freelance": "Freelance"
    }
  },
```

The Romanian `years` message uses all three CLDR plural forms (`one`, `few`, `other`). `20 de ani` needs the `de`.

- [ ] **Step 5: Create `src/components/ui/Section.tsx`**

```tsx
import type { ReactNode } from "react";

export type SceneId = "hero" | "about" | "skills" | "experience" | "contact";

type SectionProps = {
  id: string;
  title: string;
  intro?: string;
  /** 3D/sequence scene this section will host from M5 on. */
  scene?: SceneId;
  children: ReactNode;
};

export function Section({ id, title, intro, scene, children }: SectionProps) {
  const titleId = `${id}-title`;

  return (
    <section
      id={id}
      aria-labelledby={titleId}
      data-scene={scene}
      className="py-section"
    >
      <div className="mx-auto w-full max-w-content px-gutter">
        <h2 id={titleId} className="text-title text-ink">
          {title}
        </h2>
        {intro ? (
          <p className="mt-5 max-w-[60ch] text-lead text-ink-muted">{intro}</p>
        ) : null}
        <div className="mt-12 md:mt-16">{children}</div>
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Create `src/components/sections/About.tsx`**

```tsx
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
```

- [ ] **Step 7: Create `src/components/sections/Skills.tsx`**

The layers render top to bottom as an ordered list. Each row takes its material edge colour from `data-layer` (Task 4 CSS). The layer code and material sit in one mono label; the middle dot is the only separator on the line.

```tsx
import { useTranslations } from "next-intl";
import { Section } from "@/components/ui/Section";
import { fallbackLang } from "@/content/localize";
import type { Cv } from "@/content/types";

export function Skills({ cv }: { cv: Cv }) {
  const t = useTranslations("Skills");

  return (
    <Section id="skills" title={t("title")} intro={t("intro")} scene="skills">
      <ol className="flex flex-col gap-3">
        {cv.stack.map((entry, index) => (
          <li
            key={entry.layer}
            data-layer={entry.layer}
            className="grid gap-5 rounded-panel bg-surface p-6 shadow-[inset_3px_0_0_var(--layer-tint)] ring-1 ring-line md:grid-cols-12 md:items-center md:p-8"
          >
            <div className="md:col-span-4">
              <p className="font-mono text-label uppercase text-ink-subtle">
                {t("layer", { index: index + 1 })} ·{" "}
                {t(`materials.${entry.layer}`)}
              </p>
              <h3
                lang={fallbackLang(entry.name, cv.locale)}
                className="mt-2 text-heading text-ink"
              >
                {entry.name.value}
              </h3>
            </div>
            <ul className="flex flex-wrap gap-2 md:col-span-8">
              {entry.skills.map((skill) => (
                <li
                  key={skill.slug}
                  className={`rounded-full bg-raised px-3 py-1.5 text-sm ring-1 ${skill.featured ? "text-ink ring-line-strong" : "text-ink-muted ring-line"}`}
                >
                  {skill.name}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </Section>
  );
}
```

- [ ] **Step 8: Create `src/components/sections/Experience.tsx`**

```tsx
import { useTranslations } from "next-intl";
import { Section } from "@/components/ui/Section";
import { fallbackLang } from "@/content/localize";
import type { Cv } from "@/content/types";
import { formatYearMonth } from "@/lib/format";

export function Experience({ cv }: { cv: Cv }) {
  const t = useTranslations("Experience");
  const { locale } = cv;

  return (
    <Section id="experience" title={t("title")} scene="experience">
      <ol className="flex flex-col gap-4">
        {cv.experience.map((job) => (
          <li
            key={job.id}
            className="grid gap-4 rounded-panel bg-surface p-6 ring-1 ring-line md:grid-cols-12 md:gap-8 md:p-8"
          >
            <p className="font-mono text-label uppercase text-ink-subtle md:col-span-3">
              <time dateTime={job.startDate}>
                {formatYearMonth(job.startDate, locale)}
              </time>
              {" - "}
              {job.endDate ? (
                <time dateTime={job.endDate}>
                  {formatYearMonth(job.endDate, locale)}
                </time>
              ) : (
                t("present")
              )}
            </p>
            <div className="md:col-span-9">
              <h3
                lang={fallbackLang(job.roleTitle, locale)}
                className="text-heading text-ink"
              >
                {job.roleTitle.value}
              </h3>
              <p className="mt-1 text-ink-muted">
                {job.company} · {t(`employmentType.${job.employmentType}`)}
              </p>
              <p
                lang={fallbackLang(job.description, locale)}
                className="mt-4 max-w-[65ch] text-ink-muted"
              >
                {job.description.value}
              </p>
              {job.highlights.value.length > 0 ? (
                <ul
                  lang={fallbackLang(job.highlights, locale)}
                  className="mt-4 flex max-w-[65ch] list-disc flex-col gap-2 pl-5 text-ink-muted marker:text-ink-subtle"
                >
                  {job.highlights.value.map((highlight) => (
                    <li key={highlight}>{highlight}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}
```

- [ ] **Step 9: Render the sections — replace `src/app/[locale]/page.tsx`**

The M0 heading block stays until Task 6 brings the hero, so the page keeps exactly one `h1`.

```tsx
import { getLocale, getTranslations } from "next-intl/server";
import { About } from "@/components/sections/About";
import { Experience } from "@/components/sections/Experience";
import { Skills } from "@/components/sections/Skills";
import { getCv } from "@/content/get-cv";

export default async function HomePage() {
  const cv = await getCv(await getLocale());
  const t = await getTranslations("HomePage");

  return (
    <>
      <section className="mx-auto flex min-h-[70svh] w-full max-w-content flex-col justify-center gap-4 px-gutter py-section">
        <h1 className="text-title text-ink">{t("title")}</h1>
        <p className="text-lead text-ink-muted">{t("subtitle")}</p>
      </section>
      <About cv={cv} />
      <Skills cv={cv} />
      <Experience cv={cv} />
    </>
  );
}
```

- [ ] **Step 10: Run the tests to verify they pass**

Run: `pnpm test`
Expected: `Test Files  5 passed (5)`, `Tests  44 passed (44)`.

Run: `pnpm test:e2e`
Expected: `21 passed` (the axe gate included). Afterwards `ss -ltn | grep ':3100 '` prints nothing.

Run: `pnpm typecheck`
Expected: `✓ Types generated successfully`, exit 0. A typo in a message key, for example `t("materials.pcb")`, would fail here, because `src/global.ts` types keys from `messages/en.json`.

Run: `rtk proxy pnpm lint`
Expected: `Checked 46 files in <n>ms. No fixes applied.`

- [ ] **Step 11: Commit**

```bash
/usr/bin/git add messages "src/app/[locale]/page.tsx" src/components tests/e2e/about-skills-experience.spec.ts tests/unit/messages.test.ts
/usr/bin/git commit -m "feat(sections): add about, stack and experience"
```

---

### Task 6: Hero, Projects and Contact sections

**Files:**
- Create: `src/components/ui/Stage.tsx`, `src/components/sections/Hero.tsx`, `src/components/sections/Projects.tsx`, `src/components/sections/Contact.tsx`, `tests/e2e/hero-projects-contact.spec.ts`
- Modify: `messages/en.json`, `messages/ro.json`, `src/app/[locale]/page.tsx`, `tests/e2e/i18n-routing.spec.ts`

**Interfaces:**
- Consumes: `Section`, `SceneId` (Task 5); `Cv`, `fallbackLang`, `STACK_LAYERS` (Task 2); `.stage`, `.slab`, `studio-sweep`, `--motion-press` (Task 4); `Availability.open` (Task 5).
- Produces:
  - `Stage({ scene, className? })` renders `div[aria-hidden][data-stage=scene].stage.aspect-[4/5]` with 5 `div.slab[data-layer]`. This is the box M5 fills with the S1 poster and canvas.
  - `Hero({ cv })` → `section[aria-labelledby=hero-title][data-scene=hero]` with the page's only `h1`. Its CTAs point at `#contact` and `#projects`.
  - `Projects({ cv })` → `section#projects`. The first card spans the full width and the rest are thirds. Each link has an accessible name like `Live site: {title}` / `Source code: {title}`.
  - `Contact({ cv })` → `section#contact` with a mailto link, profile links and `form[aria-labelledby=contact-form-title]`. The form has labelled `name`, `email`, `company` and `message` fields, and its **submit button is `disabled`**. That blocks implicit (Enter-key) submission until M3 adds the server action.
  - Message namespaces `Hero.*`, `Projects.*` (with ICU `liveLabel` / `sourceLabel`) and `Contact.*`. The `HomePage` namespace is removed.

- [ ] **Step 1: Write the failing e2e spec `tests/e2e/hero-projects-contact.spec.ts`**

```ts
import { expect, test } from "@playwright/test";

test("renders the hero and five sections in order (en)", async ({ page }) => {
  await page.goto("/en");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Alex Marin",
  );
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "About",
    "The stack",
    "Experience",
    "Selected work",
    "Let's build",
  ]);
});

test("renders the hero and five sections in order (ro)", async ({ page }) => {
  await page.goto("/ro");

  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "Despre",
    "Stiva",
    "Experiență",
    "Proiecte alese",
    "Hai să construim",
  ]);
});

test("hero calls to action lead to the contact and work sections", async ({
  page,
}) => {
  await page.goto("/en");
  const hero = page.getByRole("region", { name: "Alex Marin" });

  await expect(hero.getByRole("link", { name: "Contact" })).toHaveAttribute(
    "href",
    "#contact",
  );
  await expect(hero.getByRole("link", { name: "Work" })).toHaveAttribute(
    "href",
    "#projects",
  );
  await expect(page.locator("#contact")).toHaveCount(1);
  await expect(page.locator("#projects")).toHaveCount(1);
});

test("lists published projects only, with descriptive link names", async ({
  page,
}) => {
  await page.goto("/en");
  const work = page.getByRole("region", { name: "Selected work" });

  await expect(work.getByRole("heading", { level: 3 })).toHaveText([
    "Ledger Lens",
    "Tramline",
    "Atelier CMS",
    "Pulse Check",
  ]);
  await expect(
    work.getByRole("link", { name: "Live site: Ledger Lens" }),
  ).toHaveAttribute("href", "https://example.com/ledger-lens");
});

test("contact form is labelled and cannot submit before M3", async ({
  page,
}) => {
  await page.goto("/en");
  const form = page.getByRole("form", { name: "Send a message" });

  await expect(form.getByLabel("Name")).toHaveAttribute("autocomplete", "name");
  await expect(form.getByLabel("Email")).toHaveAttribute("type", "email");
  await expect(form.getByLabel("Company (optional)")).toBeVisible();
  await expect(form.getByLabel("Message")).toBeVisible();
  await expect(
    form.getByRole("button", { name: "Send message" }),
  ).toBeDisabled();

  await form.getByLabel("Name").fill("Ana Pop");
  await form.getByLabel("Name").press("Enter");
  await expect(page).toHaveURL("/en");
});

test("plays the studio light sweep once", async ({ page }) => {
  await page.goto("/en");

  const stage = page.locator('[data-stage="hero"]');
  await expect(stage).toBeVisible();
  const sweep = await stage.evaluate(
    (el) => getComputedStyle(el, "::after").animationName,
  );
  expect(sweep).toBe("studio-sweep");
});

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("skips the light sweep", async ({ page }) => {
    await page.goto("/en");

    const stage = page.locator('[data-stage="hero"]');
    await expect(stage).toBeVisible();
    const sweep = await stage.evaluate(
      (el) => getComputedStyle(el, "::after").animationName,
    );
    expect(sweep).toBe("none");
  });
});
```

- [ ] **Step 2: Point the M0 routing tests at the new hero — replace `tests/e2e/i18n-routing.spec.ts`**

The page `h1` becomes the person's name, and Romanian copy is now proven by the hero headline (with ș, ă). Titles change in Task 8.

```ts
import { expect, test } from "@playwright/test";

test.describe("locale routing", () => {
  test("redirects / to /en for an English browser", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL("/en");
  });

  test("serves /en with lang=en and English copy", async ({ page }) => {
    const response = await page.goto("/en");

    expect(response?.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(
      page.getByRole("heading", { level: 1, name: "Alex Marin" }),
    ).toBeVisible();
    await expect(page).toHaveTitle("Fullstack Developer — CV");
  });

  test("serves /ro with lang=ro and Romanian diacritics intact", async ({
    page,
  }) => {
    const response = await page.goto("/ro");

    expect(response?.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("lang", "ro");
    await expect(
      page.getByText(
        "Dezvoltator fullstack care construiește produse web rapide și accesibile, de la baza de date la pixel.",
      ),
    ).toBeVisible();
  });

  test("returns 404 for an unsupported locale", async ({ page }) => {
    const response = await page.goto("/de");

    expect(response?.status()).toBe(404);
  });

  test("returns a localized 404 below a valid locale", async ({ page }) => {
    const response = await page.goto("/ro/nu-exista");

    expect(response?.status()).toBe(404);
    await expect(page.locator("html")).toHaveAttribute("lang", "ro");
    await expect(
      page.getByRole("heading", { name: "Pagina nu a fost găsită" }),
    ).toBeVisible();
  });

  test("returns 404 for a file path the proxy skips", async ({ page }) => {
    const response = await page.goto("/missing.txt");

    expect(response?.status()).toBe(404);
  });
});

test.describe("locale detection", () => {
  test.use({ locale: "ro-RO" });

  test("redirects / to /ro for a Romanian browser", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL("/ro");
  });
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `pnpm exec playwright test tests/e2e/hero-projects-contact.spec.ts tests/e2e/i18n-routing.spec.ts`
Expected: `9 failed`, `5 passed`. All 7 new tests fail (`toHaveText`, `toHaveAttribute` or `toBeVisible` failed), and so do `serves /en with lang=en and English copy` and `serves /ro with lang=ro and Romanian diacritics intact`. The five redirect and 404 tests still pass.

- [ ] **Step 4: Update the strings**

In both `messages/en.json` and `messages/ro.json`, delete the `"HomePage"` key. Then add these top-level keys to `messages/en.json`, directly before `"NotFound"`. Key order does not matter, because Task 8 replaces both files with their final ordered form.

```json
  "Hero": {
    "primaryCta": "Contact",
    "secondaryCta": "Work"
  },
  "Projects": {
    "title": "Selected work",
    "role": "Role",
    "outcome": "Outcome",
    "live": "Live site",
    "source": "Source code",
    "liveLabel": "Live site: {title}",
    "sourceLabel": "Source code: {title}"
  },
  "Contact": {
    "title": "Let's build",
    "intro": "Tell me about the product you are building. I reply within two working days.",
    "email": "Email",
    "profiles": "Profiles",
    "form": {
      "title": "Send a message",
      "name": "Name",
      "email": "Email",
      "company": "Company (optional)",
      "message": "Message",
      "submit": "Send message",
      "pending": "The form opens soon. Until then, email me directly."
    }
  },
```

The same keys for `messages/ro.json`:

```json
  "Hero": {
    "primaryCta": "Contact",
    "secondaryCta": "Proiecte"
  },
  "Projects": {
    "title": "Proiecte alese",
    "role": "Rol",
    "outcome": "Rezultat",
    "live": "Site live",
    "source": "Cod sursă",
    "liveLabel": "Site live: {title}",
    "sourceLabel": "Cod sursă: {title}"
  },
  "Contact": {
    "title": "Hai să construim",
    "intro": "Spune-mi despre produsul la care lucrezi. Răspund în două zile lucrătoare.",
    "email": "Email",
    "profiles": "Profiluri",
    "form": {
      "title": "Trimite un mesaj",
      "name": "Nume",
      "email": "Email",
      "company": "Companie (opțional)",
      "message": "Mesaj",
      "submit": "Trimite mesajul",
      "pending": "Formularul se deschide în curând. Până atunci, scrie-mi direct pe email."
    }
  },
```

- [ ] **Step 5: Create `src/components/ui/Stage.tsx`**

```tsx
import { STACK_LAYERS } from "@/content/types";
import type { SceneId } from "./Section";

type StageProps = {
  scene: SceneId;
  className?: string;
};

/**
 * Decorative placeholder that reserves the box a scene will occupy in M5
 * (fixed aspect ratio, so swapping in a canvas or poster causes no layout shift).
 */
export function Stage({ scene, className = "" }: StageProps) {
  return (
    <div
      aria-hidden="true"
      data-stage={scene}
      className={`stage flex aspect-[4/5] flex-col justify-center gap-[3%] px-[14%] ${className}`}
    >
      {STACK_LAYERS.map((layer) => (
        <div key={layer} data-layer={layer} className="slab" />
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Create `src/components/sections/Hero.tsx`**

The hero has at most four text elements: the availability pill (a real status, so its dot is semantic), the name, the headline and the CTAs. The text sits on solid canvas, so axe can measure its contrast; the gradient lives only inside the `aria-hidden` stage.

```tsx
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
```

- [ ] **Step 7: Create `src/components/sections/Projects.tsx`**

The cards use a nested shell/core layout ("double bezel"). The links carry an `aria-label` that starts with the visible text (WCAG 2.5.3). A visually hidden suffix would render as `Live site : Ledger Lens` in Chrome.

```tsx
import { useTranslations } from "next-intl";
import { Section } from "@/components/ui/Section";
import { fallbackLang } from "@/content/localize";
import type { Cv } from "@/content/types";

export function Projects({ cv }: { cv: Cv }) {
  const t = useTranslations("Projects");
  const { locale } = cv;

  return (
    <Section id="projects" title={t("title")}>
      <ul className="grid gap-4 md:grid-cols-6">
        {cv.projects.map((project, index) => (
          <li
            key={project.slug}
            className={index === 0 ? "md:col-span-6" : "md:col-span-2"}
          >
            <article className="h-full rounded-panel bg-surface p-1.5 ring-1 ring-line">
              <div className="flex h-full flex-col rounded-[calc(var(--radius-panel)-0.375rem)] bg-raised p-6 shadow-[inset_0_1px_0_var(--color-line)] md:p-8">
                <p className="font-mono text-label uppercase text-ink-subtle">
                  {project.year}
                </p>
                <h3
                  lang={fallbackLang(project.title, locale)}
                  className="mt-3 text-heading text-ink"
                >
                  {project.title.value}
                </h3>
                <p
                  lang={fallbackLang(project.summary, locale)}
                  className="mt-3 max-w-[60ch] text-ink-muted"
                >
                  {project.summary.value}
                </p>
                <dl className="mt-6 grid gap-3 text-sm">
                  <div>
                    <dt className="font-mono text-label uppercase text-ink-subtle">
                      {t("role")}
                    </dt>
                    <dd
                      lang={fallbackLang(project.role, locale)}
                      className="mt-1 text-ink"
                    >
                      {project.role.value}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-mono text-label uppercase text-ink-subtle">
                      {t("outcome")}
                    </dt>
                    <dd
                      lang={fallbackLang(project.outcome, locale)}
                      className="mt-1 text-ink"
                    >
                      {project.outcome.value}
                    </dd>
                  </div>
                </dl>
                <ul className="mt-6 flex flex-wrap gap-2">
                  {project.skills.map((skill) => (
                    <li
                      key={skill}
                      className="rounded-full bg-surface px-3 py-1 text-sm text-ink-muted ring-1 ring-line"
                    >
                      {skill}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto flex flex-wrap gap-x-6 gap-y-2 pt-6 text-sm font-medium">
                  {project.liveUrl ? (
                    <a
                      href={project.liveUrl}
                      aria-label={t("liveLabel", {
                        title: project.title.value,
                      })}
                      className="text-signal underline-offset-4 hover:underline"
                    >
                      {t("live")}
                    </a>
                  ) : null}
                  {project.repoUrl ? (
                    <a
                      href={project.repoUrl}
                      aria-label={t("sourceLabel", {
                        title: project.title.value,
                      })}
                      className="text-signal underline-offset-4 hover:underline"
                    >
                      {t("source")}
                    </a>
                  ) : null}
                </div>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </Section>
  );
}
```

- [ ] **Step 8: Create `src/components/sections/Contact.tsx`**

The form has no `action` and a `disabled` submit button. Per the HTML spec, implicit submission does nothing when the default button is disabled, so pressing Enter cannot put form data into a GET URL. M3 replaces this with the server action.

```tsx
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
```

- [ ] **Step 9: Compose the page — replace `src/app/[locale]/page.tsx`**

```tsx
import { getLocale } from "next-intl/server";
import { About } from "@/components/sections/About";
import { Contact } from "@/components/sections/Contact";
import { Experience } from "@/components/sections/Experience";
import { Hero } from "@/components/sections/Hero";
import { Projects } from "@/components/sections/Projects";
import { Skills } from "@/components/sections/Skills";
import { getCv } from "@/content/get-cv";

export default async function HomePage() {
  const cv = await getCv(await getLocale());

  return (
    <>
      <Hero cv={cv} />
      <About cv={cv} />
      <Skills cv={cv} />
      <Experience cv={cv} />
      <Projects cv={cv} />
      <Contact cv={cv} />
    </>
  );
}
```

- [ ] **Step 10: Run the tests to verify they pass**

Run: `pnpm test:e2e`
Expected: `28 passed`. Afterwards `ss -ltn | grep ':3100 '` prints nothing.

Run: `pnpm test`
Expected: `Tests  44 passed (44)`.

Run: `pnpm typecheck`
Expected: `✓ Types generated successfully`, exit 0.

Run: `rtk proxy pnpm lint`
Expected: `Checked 51 files in <n>ms. No fixes applied.`

- [ ] **Step 11: Commit**

```bash
/usr/bin/git add messages "src/app/[locale]/page.tsx" src/components tests/e2e/hero-projects-contact.spec.ts tests/e2e/i18n-routing.spec.ts
/usr/bin/git commit -m "feat(sections): add hero, work and contact"
```

---

### Task 7: Header (section nav, language switch) and footer

**Files:**
- Create: `src/i18n/navigation.ts`, `src/components/site/LocaleSwitcher.tsx`, `src/components/site/SiteHeader.tsx`, `src/components/site/SiteFooter.tsx`, `tests/e2e/header-footer.spec.ts`
- Modify: `messages/en.json`, `messages/ro.json`, `src/app/[locale]/layout.tsx`

**Interfaces:**
- Consumes: `getCv`, `Cv` (Task 2); `routing`, `Locale` (Tasks 2–3); the section ids `about`, `skills`, `experience`, `projects`, `contact` (Tasks 5–6); tokens (Task 4).
- Produces:
  - `Link` and `getPathname` from `@/i18n/navigation` (`createNavigation(routing)`). Link to another locale with `<Link href="/" locale="ro">`; it renders `hrefLang` and the proxy keeps `NEXT_LOCALE` in sync.
  - `LocaleSwitcher({ locale })` renders `nav[aria-label=Language|Limbă]` with one link per locale. Each link text is in its own language (`lang` set), and the current locale has `aria-current="page"`.
  - `SiteHeader({ cv })` renders `header#top` with the name link, `nav[aria-label=Sections|Secțiuni]` (hidden below `md`) and the `LocaleSwitcher`. `SiteFooter({ cv })` renders `footer` with a "Back to top" link to `#top`.
  - Message namespaces `Nav.*`, `LocaleSwitcher.*` and `Layout.backToTop`.
  - The layout now calls `getCv(locale)` once and passes `cv` to the header and footer.

- [ ] **Step 1: Write the failing e2e spec `tests/e2e/header-footer.spec.ts`**

```ts
import { expect, test } from "@playwright/test";

test("exposes banner, footer and both navigations", async ({ page }) => {
  await page.goto("/en");

  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.getByRole("contentinfo")).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Sections" }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Language" }),
  ).toBeVisible();
});

test("every section link points at a section on the page", async ({ page }) => {
  await page.goto("/en");

  const hrefs = await page
    .getByRole("navigation", { name: "Sections" })
    .getByRole("link")
    .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  expect(hrefs).toEqual([
    "#about",
    "#skills",
    "#experience",
    "#projects",
    "#contact",
  ]);
  for (const href of hrefs) {
    await expect(page.locator(`section${href}`)).toHaveCount(1);
  }
});

test("switching language keeps the choice for the next visit to /", async ({
  page,
}) => {
  await page.goto("/en");

  const romanian = page
    .getByRole("navigation", { name: "Language" })
    .getByRole("link", { name: "Română" });
  await expect(romanian).toBeVisible();
  await romanian.click();
  await expect(page).toHaveURL("/ro");
  await expect(page.locator("html")).toHaveAttribute("lang", "ro");
  await expect(
    page
      .getByRole("navigation", { name: "Limbă" })
      .getByRole("link", { name: "Română" }),
  ).toHaveAttribute("aria-current", "page");

  await page.goto("/");
  await expect(page).toHaveURL("/ro");
});

test("footer links back to the top of the page", async ({ page }) => {
  await page.goto("/ro");

  await expect(
    page.getByRole("contentinfo").getByRole("link", { name: "Înapoi sus" }),
  ).toHaveAttribute("href", "#top");
  await expect(page.getByRole("banner")).toHaveAttribute("id", "top");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec playwright test tests/e2e/header-footer.spec.ts`
Expected: `4 failed`, with `Error: expect(locator).toBeVisible() failed`, `element(s) not found` and `Error: expect(received).toEqual(expected) // deep equality`.

- [ ] **Step 3: Add the strings**

In `messages/en.json`, replace the `"Layout"` key and add `"Nav"` and `"LocaleSwitcher"` right after it:

```json
  "Layout": {
    "skipToContent": "Skip to content",
    "backToTop": "Back to top"
  },
  "Nav": {
    "label": "Sections",
    "about": "About",
    "skills": "Stack",
    "experience": "Experience",
    "projects": "Work",
    "contact": "Contact"
  },
  "LocaleSwitcher": {
    "label": "Language",
    "en": "English",
    "ro": "Română"
  },
```

In `messages/ro.json`, do the same:

```json
  "Layout": {
    "skipToContent": "Sari la conținut",
    "backToTop": "Înapoi sus"
  },
  "Nav": {
    "label": "Secțiuni",
    "about": "Despre",
    "skills": "Stiva",
    "experience": "Experiență",
    "projects": "Proiecte",
    "contact": "Contact"
  },
  "LocaleSwitcher": {
    "label": "Limbă",
    "en": "English",
    "ro": "Română"
  },
```

The locale names are the same in both files on purpose: each language is shown in its own language.

- [ ] **Step 4: Create `src/i18n/navigation.ts`**

```ts
import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

export const { Link, getPathname } = createNavigation(routing);
```

- [ ] **Step 5: Create `src/components/site/LocaleSwitcher.tsx`**

M1 has one page per locale, so `href="/"` is correct. When M6 adds `/projects/[slug]`, this switcher needs the current pathname through a client `usePathname()`.

```tsx
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { type Locale, routing } from "@/i18n/routing";

export function LocaleSwitcher({ locale }: { locale: Locale }) {
  const t = useTranslations("LocaleSwitcher");

  return (
    <nav aria-label={t("label")}>
      <ul className="flex gap-1 rounded-full bg-surface p-1 ring-1 ring-line">
        {routing.locales.map((target) => (
          <li key={target}>
            <Link
              href="/"
              locale={target}
              lang={target}
              aria-current={target === locale ? "page" : undefined}
              className="block rounded-full px-3 py-1.5 text-sm text-ink-muted transition-colors hover:text-ink aria-[current=page]:bg-raised aria-[current=page]:text-ink"
            >
              {t(target)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 6: Create `src/components/site/SiteHeader.tsx`**

The header is not sticky in M1, which avoids overlap and layout shift. M5 decides chrome behaviour together with Lenis.

```tsx
import { useTranslations } from "next-intl";
import type { Cv } from "@/content/types";
import { LocaleSwitcher } from "./LocaleSwitcher";

const SECTIONS = [
  "about",
  "skills",
  "experience",
  "projects",
  "contact",
] as const;

export function SiteHeader({ cv }: { cv: Cv }) {
  const t = useTranslations("Nav");

  return (
    <header
      id="top"
      className="mx-auto flex w-full max-w-content items-center justify-between gap-6 px-gutter pt-6"
    >
      <a
        href="#top"
        className="rounded-full py-1.5 text-sm font-semibold text-ink"
      >
        {cv.profile.fullName.value}
      </a>
      <nav aria-label={t("label")} className="hidden md:block">
        <ul className="flex gap-1 rounded-full bg-surface p-1 ring-1 ring-line">
          {SECTIONS.map((id) => (
            <li key={id}>
              <a
                href={`#${id}`}
                className="block rounded-full px-3 py-1.5 text-sm text-ink-muted transition-colors hover:bg-raised hover:text-ink"
              >
                {t(id)}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <LocaleSwitcher locale={cv.locale} />
    </header>
  );
}
```

- [ ] **Step 7: Create `src/components/site/SiteFooter.tsx`**

The footer has no year, because `new Date()` would make the prerender dynamic under Cache Components.

```tsx
import { useTranslations } from "next-intl";
import type { Cv } from "@/content/types";

export function SiteFooter({ cv }: { cv: Cv }) {
  const t = useTranslations("Layout");

  return (
    <footer className="mx-auto flex w-full max-w-content flex-col gap-4 border-t px-gutter py-10 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between">
      <p>© {cv.profile.fullName.value}</p>
      <a href="#top" className="text-ink transition-colors hover:text-signal">
        {t("backToTop")}
      </a>
    </footer>
  );
}
```

- [ ] **Step 8: Render them — replace `src/app/[locale]/layout.tsx`**

```tsx
import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { getCv } from "@/content/get-cv";
import { routing } from "@/i18n/routing";
import { mono, sans } from "../fonts";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");

  return {
    title: t("title"),
    description: t("description"),
  };
}

export const viewport: Viewport = {
  themeColor: "#0b0c0f",
  colorScheme: "dark",
};

export default async function LocaleLayout({
  children,
}: LayoutProps<"/[locale]">) {
  const locale = await getLocale();
  const cv = await getCv(locale);
  const t = await getTranslations("Layout");

  return (
    <html
      lang={locale}
      data-scroll-behavior="smooth"
      className={`${sans.variable} ${mono.variable}`}
    >
      <body className="min-h-dvh bg-canvas font-sans text-ink">
        <a
          href="#main"
          className="sr-only rounded-full bg-signal px-5 py-3 font-medium text-signal-ink focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50"
        >
          {t("skipToContent")}
        </a>
        <NextIntlClientProvider>
          <SiteHeader cv={cv} />
          <main id="main" tabIndex={-1} className="focus:outline-none">
            {children}
          </main>
          <SiteFooter cv={cv} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `pnpm test:e2e`
Expected: `32 passed`. Afterwards `ss -ltn | grep ':3100 '` prints nothing.

Run: `pnpm test`
Expected: `Tests  44 passed (44)`.

Run: `pnpm typecheck`
Expected: `✓ Types generated successfully`, exit 0.

Run: `rtk proxy pnpm lint`
Expected: `Checked 56 files in <n>ms. No fixes applied.`

- [ ] **Step 10: Commit**

```bash
/usr/bin/git add messages "src/app/[locale]/layout.tsx" src/components/site src/i18n/navigation.ts tests/e2e/header-footer.spec.ts
/usr/bin/git commit -m "feat(ui): add header, language switch and footer"
```

---

### Task 8: Page metadata, hreflang and the JSON-LD `Person`

**Files:**
- Create: `tests/e2e/metadata.spec.ts`
- Modify: `src/app/[locale]/layout.tsx`, `src/app/[locale]/page.tsx`, `messages/en.json`, `messages/ro.json`, `tests/e2e/i18n-routing.spec.ts`

**Interfaces:**
- Consumes: `siteUrl` (`@/site`), `localeUrl`, `languageAlternates`, `personJsonLd`, `serializeJsonLd` (Task 3); `getCv` (Task 2).
- Produces:
  - Layout `generateMetadata` sets `metadataBase: new URL(siteUrl)`, `title` = `profile.seoTitle`, `description` = `profile.seoDescription`. These are localized content, and they also cover the localized 404 pages.
  - Page `generateMetadata` sets `alternates.canonical` = `localeUrl(siteUrl, locale)`, `alternates.languages` = `languageAlternates(siteUrl)` (`en`, `ro`, `x-default`), and Open Graph `type: "profile"`, `url`, `siteName`, `title`, `description`, `locale` (`en_US` / `ro_RO`).
  - The page renders `<script type="application/ld+json">` with the `Person`.
  - The `Metadata` message namespace is removed, so the title comes from content. The M0 `Fullstack Developer — CV` title goes away.

- [ ] **Step 1: Write the failing e2e spec `tests/e2e/metadata.spec.ts`**

```ts
import { expect, test } from "@playwright/test";

const ORIGIN = "http://localhost:3100";

test("declares canonical and hreflang alternates for /ro", async ({ page }) => {
  await page.goto("/ro");

  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    `${ORIGIN}/ro`,
  );
  const alternates = await page
    .locator('link[rel="alternate"][hreflang]')
    .evaluateAll((links) =>
      links.map((link) => [
        link.getAttribute("hreflang"),
        link.getAttribute("href"),
      ]),
    );
  expect(alternates).toEqual([
    ["en", `${ORIGIN}/en`],
    ["ro", `${ORIGIN}/ro`],
    ["x-default", ORIGIN],
  ]);
  await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute(
    "content",
    "ro_RO",
  );
});

test("uses the localized SEO description", async ({ page }) => {
  await page.goto("/ro");

  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    /^CV-ul și portofoliul lui Alex Marin/,
  );
});

test("embeds a Person JSON-LD matching the visible name", async ({ page }) => {
  await page.goto("/en");

  const script = page.locator('script[type="application/ld+json"]');
  await expect(script).toHaveCount(1);
  const json = await script.textContent();
  const person = JSON.parse(json ?? "{}");

  expect(person).toMatchObject({
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${ORIGIN}/#person`,
    url: `${ORIGIN}/en`,
    jobTitle: "Senior Fullstack Engineer",
  });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(person.name);
});
```

- [ ] **Step 2: Expect the content titles — replace `tests/e2e/i18n-routing.spec.ts`**

```ts
import { expect, test } from "@playwright/test";

test.describe("locale routing", () => {
  test("redirects / to /en for an English browser", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL("/en");
  });

  test("serves /en with lang=en and English copy", async ({ page }) => {
    const response = await page.goto("/en");

    expect(response?.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(
      page.getByRole("heading", { level: 1, name: "Alex Marin" }),
    ).toBeVisible();
    await expect(page).toHaveTitle("Alex Marin · Fullstack Developer");
  });

  test("serves /ro with lang=ro and Romanian diacritics intact", async ({
    page,
  }) => {
    const response = await page.goto("/ro");

    expect(response?.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("lang", "ro");
    await expect(page).toHaveTitle("Alex Marin · Dezvoltator Fullstack");
    await expect(
      page.getByText(
        "Dezvoltator fullstack care construiește produse web rapide și accesibile, de la baza de date la pixel.",
      ),
    ).toBeVisible();
  });

  test("returns 404 for an unsupported locale", async ({ page }) => {
    const response = await page.goto("/de");

    expect(response?.status()).toBe(404);
  });

  test("returns a localized 404 below a valid locale", async ({ page }) => {
    const response = await page.goto("/ro/nu-exista");

    expect(response?.status()).toBe(404);
    await expect(page.locator("html")).toHaveAttribute("lang", "ro");
    await expect(
      page.getByRole("heading", { name: "Pagina nu a fost găsită" }),
    ).toBeVisible();
  });

  test("returns 404 for a file path the proxy skips", async ({ page }) => {
    const response = await page.goto("/missing.txt");

    expect(response?.status()).toBe(404);
  });
});

test.describe("locale detection", () => {
  test.use({ locale: "ro-RO" });

  test("redirects / to /ro for a Romanian browser", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL("/ro");
  });
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `pnpm exec playwright test tests/e2e/metadata.spec.ts tests/e2e/i18n-routing.spec.ts`
Expected: `5 failed`, `5 passed`. The 3 metadata tests fail, for example `Expected: "http://localhost:3100/ro"` for the canonical. The two copy tests fail with:

```
    Expected: "Alex Marin · Fullstack Developer"
    Received: "Fullstack Developer — CV"
    Expected: "Alex Marin · Dezvoltator Fullstack"
    Received: "Dezvoltator Fullstack — CV"
```

- [ ] **Step 4: Content-driven title and `metadataBase` — replace `src/app/[locale]/layout.tsx`**

```tsx
import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { getCv } from "@/content/get-cv";
import { routing } from "@/i18n/routing";
import { siteUrl } from "@/site";
import { mono, sans } from "../fonts";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const cv = await getCv(await getLocale());

  return {
    metadataBase: new URL(siteUrl),
    title: cv.profile.seoTitle.value,
    description: cv.profile.seoDescription.value,
  };
}

export const viewport: Viewport = {
  themeColor: "#0b0c0f",
  colorScheme: "dark",
};

export default async function LocaleLayout({
  children,
}: LayoutProps<"/[locale]">) {
  const locale = await getLocale();
  const cv = await getCv(locale);
  const t = await getTranslations("Layout");

  return (
    <html
      lang={locale}
      data-scroll-behavior="smooth"
      className={`${sans.variable} ${mono.variable}`}
    >
      <body className="min-h-dvh bg-canvas font-sans text-ink">
        <a
          href="#main"
          className="sr-only rounded-full bg-signal px-5 py-3 font-medium text-signal-ink focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50"
        >
          {t("skipToContent")}
        </a>
        <NextIntlClientProvider>
          <SiteHeader cv={cv} />
          <main id="main" tabIndex={-1} className="focus:outline-none">
            {children}
          </main>
          <SiteFooter cv={cv} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 5: Alternates, Open Graph and JSON-LD — replace `src/app/[locale]/page.tsx`**

The `biome-ignore` is required: `lint/security/noDangerouslySetInnerHtml` is in Biome's recommended set. Next's JSON-LD guide uses exactly this pattern, and `serializeJsonLd` escapes `<` (tested in Task 3).

```tsx
import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { About } from "@/components/sections/About";
import { Contact } from "@/components/sections/Contact";
import { Experience } from "@/components/sections/Experience";
import { Hero } from "@/components/sections/Hero";
import { Projects } from "@/components/sections/Projects";
import { Skills } from "@/components/sections/Skills";
import { getCv } from "@/content/get-cv";
import {
  languageAlternates,
  localeUrl,
  personJsonLd,
  serializeJsonLd,
} from "@/lib/seo";
import { siteUrl } from "@/site";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const { profile } = await getCv(locale);
  const url = localeUrl(siteUrl, locale);

  return {
    alternates: { canonical: url, languages: languageAlternates(siteUrl) },
    openGraph: {
      type: "profile",
      url,
      siteName: profile.fullName.value,
      title: profile.seoTitle.value,
      description: profile.seoDescription.value,
      locale: locale === "ro" ? "ro_RO" : "en_US",
    },
  };
}

export default async function HomePage() {
  const cv = await getCv(await getLocale());

  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: serializeJsonLd escapes "<", so content cannot close the tag.
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(personJsonLd(cv, siteUrl)),
        }}
      />
      <Hero cv={cv} />
      <About cv={cv} />
      <Skills cv={cv} />
      <Experience cv={cv} />
      <Projects cv={cv} />
      <Contact cv={cv} />
    </>
  );
}
```

- [ ] **Step 6: Drop the M0 metadata strings — replace both message files with their final form**

`messages/en.json`:

```json
{
  "Layout": {
    "skipToContent": "Skip to content",
    "backToTop": "Back to top"
  },
  "Nav": {
    "label": "Sections",
    "about": "About",
    "skills": "Stack",
    "experience": "Experience",
    "projects": "Work",
    "contact": "Contact"
  },
  "LocaleSwitcher": {
    "label": "Language",
    "en": "English",
    "ro": "Română"
  },
  "Availability": {
    "open": "Open to new projects",
    "closed": "Not taking new projects"
  },
  "Hero": {
    "primaryCta": "Contact",
    "secondaryCta": "Work"
  },
  "About": {
    "title": "About",
    "location": "Based in",
    "experience": "Experience",
    "years": "{count, plural, one {# year} other {# years}}",
    "projects": "Shipped projects",
    "availability": "Availability"
  },
  "Skills": {
    "title": "The stack",
    "intro": "Five layers, from the interface people touch to the craft that holds it together.",
    "layer": "Layer {index}",
    "materials": {
      "interface": "Glass",
      "api": "Titanium",
      "data": "Ceramic",
      "infra": "Circuit board",
      "craft": "Base plate"
    }
  },
  "Experience": {
    "title": "Experience",
    "present": "Present",
    "employmentType": {
      "full_time": "Full-time",
      "part_time": "Part-time",
      "contract": "Contract",
      "freelance": "Freelance"
    }
  },
  "Projects": {
    "title": "Selected work",
    "role": "Role",
    "outcome": "Outcome",
    "live": "Live site",
    "source": "Source code",
    "liveLabel": "Live site: {title}",
    "sourceLabel": "Source code: {title}"
  },
  "Contact": {
    "title": "Let's build",
    "intro": "Tell me about the product you are building. I reply within two working days.",
    "email": "Email",
    "profiles": "Profiles",
    "form": {
      "title": "Send a message",
      "name": "Name",
      "email": "Email",
      "company": "Company (optional)",
      "message": "Message",
      "submit": "Send message",
      "pending": "The form opens soon. Until then, email me directly."
    }
  },
  "NotFound": {
    "title": "Page not found",
    "description": "The page you are looking for does not exist."
  }
}
```

`messages/ro.json`:

```json
{
  "Layout": {
    "skipToContent": "Sari la conținut",
    "backToTop": "Înapoi sus"
  },
  "Nav": {
    "label": "Secțiuni",
    "about": "Despre",
    "skills": "Stiva",
    "experience": "Experiență",
    "projects": "Proiecte",
    "contact": "Contact"
  },
  "LocaleSwitcher": {
    "label": "Limbă",
    "en": "English",
    "ro": "Română"
  },
  "Availability": {
    "open": "Disponibil pentru proiecte noi",
    "closed": "Nu preiau proiecte noi"
  },
  "Hero": {
    "primaryCta": "Contact",
    "secondaryCta": "Proiecte"
  },
  "About": {
    "title": "Despre",
    "location": "Locație",
    "experience": "Experiență",
    "years": "{count, plural, one {# an} few {# ani} other {# de ani}}",
    "projects": "Proiecte livrate",
    "availability": "Disponibilitate"
  },
  "Skills": {
    "title": "Stiva",
    "intro": "Cinci straturi, de la interfața pe care o atinge omul până la meșteșugul care le ține laolaltă.",
    "layer": "Stratul {index}",
    "materials": {
      "interface": "Sticlă",
      "api": "Titan",
      "data": "Ceramică",
      "infra": "Placă de circuit",
      "craft": "Placă de bază"
    }
  },
  "Experience": {
    "title": "Experiență",
    "present": "Prezent",
    "employmentType": {
      "full_time": "Normă întreagă",
      "part_time": "Normă parțială",
      "contract": "Contract",
      "freelance": "Freelance"
    }
  },
  "Projects": {
    "title": "Proiecte alese",
    "role": "Rol",
    "outcome": "Rezultat",
    "live": "Site live",
    "source": "Cod sursă",
    "liveLabel": "Site live: {title}",
    "sourceLabel": "Cod sursă: {title}"
  },
  "Contact": {
    "title": "Hai să construim",
    "intro": "Spune-mi despre produsul la care lucrezi. Răspund în două zile lucrătoare.",
    "email": "Email",
    "profiles": "Profiluri",
    "form": {
      "title": "Trimite un mesaj",
      "name": "Nume",
      "email": "Email",
      "company": "Companie (opțional)",
      "message": "Mesaj",
      "submit": "Trimite mesajul",
      "pending": "Formularul se deschide în curând. Până atunci, scrie-mi direct pe email."
    }
  },
  "NotFound": {
    "title": "Pagina nu a fost găsită",
    "description": "Pagina pe care o cauți nu există."
  }
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm test:e2e`
Expected: `35 passed`. Afterwards `ss -ltn | grep ':3100 '` prints nothing.

Run: `pnpm test`
Expected: `Test Files  5 passed (5)`, `Tests  44 passed (44)` (the parity test confirms both message files have the same keys).

Run: `pnpm typecheck`
Expected: `✓ Types generated successfully`, exit 0.

Run: `rtk proxy pnpm lint`
Expected: `Checked 57 files in <n>ms. No fixes applied.`

- [ ] **Step 8: Commit**

```bash
/usr/bin/git add messages "src/app/[locale]/layout.tsx" "src/app/[locale]/page.tsx" tests/e2e/i18n-routing.spec.ts tests/e2e/metadata.spec.ts
/usr/bin/git commit -m "feat(seo): add hreflang metadata and json-ld"
```

---

### Task 9: Lighthouse CI gate, CI job and docs

**Files:**
- Create: `lighthouserc.json`
- Modify: `package.json`, `pnpm-lock.yaml`, `.gitignore`, `.github/workflows/ci.yml`, `README.md`

**Interfaces:**
- Consumes: the finished page (Tasks 1–8); `pnpm build` output.
- Produces:
  - Script `lhci` = `lhci autorun`. It needs a prior `pnpm build`, starts `next start --port 3200`, runs Lighthouse (desktop preset) 3 times each on `/en` and `/ro`, and fails if any category scores below 0.95. Reports go to `.lighthouseci/reports/` (git-ignored). Nothing is uploaded to external storage.
  - The CI job `lighthouse` ("Lighthouse (desktop)") runs on the same triggers as the other jobs and uploads reports as an artifact.

- [ ] **Step 1: Add the dependency and the script**

```bash
pnpm add -D -E @lhci/cli@0.15.1
```

Expected: `+ @lhci/cli 0.15.1`, `Done in <n>s using pnpm v11.27.1`, plus a harmless `[WARN] 5 deprecated subdependencies found: glob@7.2.3, inflight@1.0.6, rimraf@2.7.1, rimraf@3.0.2, uuid@8.3.2`.

In `package.json`, replace the `"scripts"` object with:

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "next typegen && tsc --noEmit && tsc --noEmit -p tests",
    "lint": "biome check",
    "format": "biome format --write",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "lhci": "lhci autorun"
  },
```

- [ ] **Step 2: Run it without a config to see it fail**

Run: `pnpm lhci`
Expected: exit 1 with `⚠️   Configuration file not found` and then:

```
ERROR:
Unable to automatically determine the location of static site files.
```

- [ ] **Step 3: Ignore the report directory**

Append to `.gitignore`:

```gitignore

# lighthouse ci
.lighthouseci/
```

- [ ] **Step 4: Create `lighthouserc.json`**

Desktop preset: M1's acceptance is ">= 95 all categories". The spec's mobile gate (perf >= 90) belongs to M8. The server is `next start` called directly (not through `pnpm`), so LHCI can stop it; see the M0 note about pnpm process groups.

```json
{
  "ci": {
    "collect": {
      "startServerCommand": "next start --port 3200",
      "startServerReadyPattern": "Ready in",
      "url": ["http://localhost:3200/en", "http://localhost:3200/ro"],
      "numberOfRuns": 3,
      "settings": {
        "preset": "desktop"
      }
    },
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.95 }],
        "categories:accessibility": ["error", { "minScore": 0.95 }],
        "categories:best-practices": ["error", { "minScore": 0.95 }],
        "categories:seo": ["error", { "minScore": 0.95 }]
      }
    },
    "upload": {
      "target": "filesystem",
      "outputDir": ".lighthouseci/reports"
    }
  }
}
```

- [ ] **Step 5: Run the gate locally**

Run: `pnpm build`
Expected: `✓ Compiled successfully` and the route table from Task 3.

Run: `pnpm lhci`
Expected: exit 0. Output includes `✅  Chrome installation found`, `Running Lighthouse 3 time(s) on http://localhost:3200/en`, `Running Lighthouse 3 time(s) on http://localhost:3200/ro`, `Checking assertions against 2 URL(s), 6 total run(s)`, `All results processed!` and `Done running autorun.`, with no assertion failures. Measured on 2026-09-23: 100 / 100 / 100 / 100 on both URLs. Afterwards `ss -ltn | grep ':3200 '` prints nothing.

To read the scores: `node -e 'for (const r of require("./.lighthouseci/reports/manifest.json")) if (r.isRepresentativeRun) console.log(r.url, JSON.stringify(r.summary))'`
Expected: `http://localhost:3200/en {"performance":1,"accessibility":1,"best-practices":1,"seo":1}` and the same line for `/ro`.

- [ ] **Step 6: Add the CI job**

Append this job to the end of `.github/workflows/ci.yml` (under `jobs:`, after `e2e`). GitHub's `ubuntu-24.04` runner ships Google Chrome, which LHCI finds on its own. `SITE_URL` makes the canonical URLs match the audited origin.

```yaml
  lighthouse:
    name: Lighthouse (desktop)
    runs-on: ubuntu-24.04
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v7
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v7
        with:
          node-version-file: package.json
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
        env:
          SITE_URL: http://localhost:3200
      - run: pnpm lhci
      - if: always()
        uses: actions/upload-artifact@v7
        with:
          name: lighthouse-reports
          path: .lighthouseci/reports/
          retention-days: 7
```

Run: `/home/mihai/go/bin/actionlint .github/workflows/ci.yml; echo "exit=$?"`
Expected: no findings, `exit=0`.

- [ ] **Step 7: Document the new pieces in `README.md`**

In the Scripts table, replace the `pnpm typecheck` and `pnpm test:e2e` rows, and add the `pnpm lhci` row after them:

```markdown
| `pnpm typecheck` | `next typegen`, then `tsc --noEmit` for `src` and `tests` (TypeScript 7) |
```

```markdown
| `pnpm test:e2e` | Playwright e2e (`tests/e2e`, incl. axe); builds and serves on port 3100 |
| `pnpm lhci` | Lighthouse CI, desktop preset, on port 3200; asserts >= 0.95 in all 4 categories. Run `pnpm build` first |
```

Append at the end of the file:

```markdown

## Site URL

Canonical URLs, hreflang links, `sitemap.xml`, `robots.txt` and the JSON-LD
`Person` use `SITE_URL` (see `.env.example`). Unset, Vercel builds use the
project's production domain and everything else uses `http://localhost:3000`.
These URLs are baked in at `next build`, so set `SITE_URL` before building.

## Content

M1 renders fixture content from `src/content/fixtures.ts` (placeholder person,
example.com links). M2 moves it to Postgres behind the same `getCv(locale)`.
```

Run: `rtk proxy pnpm lint`
Expected: `Checked 58 files in <n>ms. No fixes applied.`

- [ ] **Step 8: Commit**

```bash
/usr/bin/git add .github/workflows/ci.yml .gitignore README.md lighthouserc.json package.json pnpm-lock.yaml
/usr/bin/git status --short
/usr/bin/git commit -m "ci(lhci): gate lighthouse at 95 on desktop"
```

`git status --short` must print only staged paths. `.lighthouseci/`, `.next/`, `test-results/` and `playwright-report/` are ignored.

- [ ] **Step 9: Run the full CI sequence on a fresh clone (M1 acceptance)**

This proves the committed branch passes without any local-only files. Put it in a script (the worktree guard rejects long compound one-liners). Replace `<scratch>` with the session scratchpad directory:

```bash
cat > <scratch>/m1-gate.sh <<'EOF'
#!/usr/bin/env bash
set -e
REPO="$1"
CI_DIR="$(mktemp -d)/cv-ci"
/usr/bin/git clone -q --branch feat/m1-design-system "$REPO" "$CI_DIR"
cd "$CI_DIR"
export CI=1 DATABASE_URL=postgres://cv:cv@localhost:5432/cv NEXT_TELEMETRY_DISABLED=1
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
SITE_URL=http://localhost:3200 pnpm build
pnpm lhci
echo "gate=0"
cd /
rm -rf "$CI_DIR"
EOF
chmod +x <scratch>/m1-gate.sh
<scratch>/m1-gate.sh "$(/usr/bin/git rev-parse --path-format=absolute --git-common-dir)"
```

Expected, in order: `✓ Types generated successfully`; `Checked 58 files … No fixes applied.`; `Tests  44 passed (44)`; the Task 3 route table; `35 passed` plus `::notice title=🎭 Playwright Run Summary::  35 passed`; `Checking assertions against 2 URL(s), 6 total run(s)`, `All results processed!`; and finally `gate=0`. Afterwards `ss -ltn | grep -E ':(3100|3200) '` prints nothing.

This covers the M1 acceptance: **Lighthouse >= 95 in all four categories** (LHCI assertions), **0 axe violations on /en and /ro** (`a11y.spec.ts`), **both locales render** and **correct `<html lang>`** (`i18n-routing.spec.ts`).

- [ ] **Step 10: Optional visual check (manual, real GPU)**

With `pnpm build` and `node_modules/.bin/next start --port 3000` running, open `http://localhost:3000/ro` in Chrome (claude-in-chrome is fine). Check the hero at 1440×900 and 390×844, the stack rows, the project cards and the contact form, then stop the server. There is no pass/fail beyond the automated gates. This step is for the reviewer's eye on the "dark studio product film" look.

Merging `feat/m1-design-system` into `dev` and deciding when to push follow the Overseer flow: **never push unprompted**. Pushing `dev` starts the three CI jobs (`check`, `e2e`, `lighthouse`).

---

## Self-review

- **Spec coverage (§7 M1 row + brief):**
  - Design system (tokens, two variable fonts with latin-ext, contrast, focus, CSS-only motion): Task 4. Reduced motion: Task 6 test.
  - Six DOM sections with fixture content: Task 2 (typed fixtures shaped like §4, EN fallback), Task 5 (About, Skills, Experience), Task 6 (Hero, Projects, Contact).
  - next-intl UI strings EN/RO: Tasks 4–8, with the M0 parity test plus Romanian plural tests.
  - Metadata: Task 8. hreflang: Task 3 (sitemap, no duplicate header) and Task 8 (`<head>`). JSON-LD `Person`: Task 3 (builder, escaping) and Task 8 (render). `sitemap.ts` / `robots.ts`: Task 3.
  - `cacheComponents`: Task 1.
  - Acceptance: Lighthouse >= 95 in all 4 categories is Task 9 (LHCI local + CI job). 0 axe violations on /en and /ro is the Task 4 gate, re-run in every task. Both locales and `<html lang>` are covered by `i18n-routing.spec.ts` (M0, updated in Tasks 6 and 8).
  - §3 accessibility (skip link, `lang` per locale, landmarks, `aria-hidden` decorative stage, logical SSR order): Tasks 4, 6 and 7.
  - "Sections reserve layout space for later pinned 3D": `data-scene` hooks (Tasks 5–6) and the fixed-ratio `Stage` box (Task 6).
  - Out-of-scope items stay out: no R3F/GSAP/Lenis, no DB, no form action, no media.
- **Deliberate deviations:**
  - The grain/vignette overlay (spec L2) is deferred to M5. A full-viewport overlay makes axe and Lighthouse report every text node's contrast as "incomplete", and that would hide real contrast bugs.
  - LHCI runs the desktop preset in CI. Mobile (97 measured) becomes a gate in M8, as the spec says.
  - The header is not sticky yet.
  - The Martian Mono font is not preloaded.
  - `schema-dts` is not used; a small typed builder is enough.
  - The spec's `components/sections/*` path is kept. `src/content/*` stands in for M2's `server/queries/*` until then.
- **Placeholder scan:** no TBD or TODO. Every code step has the complete file, or the exact inserted block plus its anchor. `<worktree>`, `<n>` and `<scratch>` appear only where paths or timings vary by machine.
- **Name consistency:** `Locale`, `STACK_LAYERS`, `I18n`, `Localized`, `Cv`, `localize`, `fallbackLang`, `resolveCv`, `getCv`, `formatYearMonth`, `resolveSiteUrl`, `localeUrl`, `languageAlternates`, `buildSitemap`, `buildRobots`, `personJsonLd`, `serializeJsonLd`, `siteUrl`, `Section`, `SceneId`, `Stage`, `Hero`, `About`, `Skills`, `Experience`, `Projects`, `Contact`, `SiteHeader`, `SiteFooter`, `LocaleSwitcher`, `Link`. The section ids (`about`, `skills`, `experience`, `projects`, `contact`) and ports 3100 (e2e) and 3200 (LHCI) are the same in every task where they appear.
- **Review Focus:** all five items have tests in the owning tasks (T2 unit ×4, T3 unit, T4 e2e overflow, T5 e2e `lang=en`, T6 e2e Enter-key).
