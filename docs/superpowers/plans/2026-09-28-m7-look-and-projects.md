# M7 Look and Project Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the site's look and give every project a page of its own. (1) The owner types the real EN/RO content into the admin, so every field the owner needs must be both editable there and shown on the public site: project covers and case studies (markdown) and links, the CV PDF, the headshot and the company links. (2) Each published project gets a static, cached, bilingual page `/[locale]/projects/[slug]` with metadata, hreflang, a sitemap entry and JSON-LD; opening it from the Projects grid is a View Transition (the page slides forward, the card's cover morphs into the page's; "All work" slides back), with no animation for reduced motion, **Motion** off or browsers without View Transitions. (3) The 3D stage survives the trip: Next 16.3 keeps the home page in a hidden `<Activity>` while a project page is open, which left M6's stage with a lost WebGL context; it now lets go of the GPU and comes back fresh. (4) Layout and framing: the stack stays on screen and clear of the copy on every laptop between 16:9 and 3:2 and on phones (M6's notes: About's text 8 px from the lifted glass at 1280 px, the base plate on the bottom edge at 1366x768, "The stack" on two lines, About's yaw reading smaller than 30°, and a Skills row anchored behind the camera that made the page 13,000 px longer). (5) Look-dev on the real GPU: a studio background that meets the page without a seam, 4x MSAA against the dotted edges, a circuit board with copper that reflects and FR4 edges, one soft highlight on the glass, wider bevels, a stronger key and rim light, a clean contact shadow. (6) Phones: thumb-sized controls, the hero copy above the finished stack, no sideways scrolling. Everything M6 guaranteed still holds, measured again on this Intel Iris Xe.

**Architecture:** Content: `loadCvRecords` also reads the media table; `resolveCv` turns cover, avatar, CV PDF and case study into the view model (`MediaImage`, `MediaFile`, `body`). Project pages live in `src/app/[locale]/projects/[slug]/page.tsx` (reads `getCv`, so they are prerendered and expire with the `cv` tag); `src/lib/project-pages.ts` and `src/lib/seo.ts` hold the pure parts (params, neighbours, sitemap, JSON-LD). Every page renders its own header and `<main>` through `PageShell`, so the header knows where it is without reading the URL at runtime (the HTML stays fully static); `PageShell` wraps `<main>` in the page-level `<ViewTransition>` (`DirectionalTransition`), and the cover is a named one (`CoverTransition`). `StageLoader` resets the stage when its page is hidden; the `Director` starts a fresh stage on the section on screen (`settleMotion`). The stage writes the stack's screen box to `.stage-layer[data-box]`, which the framing tests read. Look-dev stays in `src/experience/scenes` and `postfx` (a new pure `scenes/studio.ts`). No new runtime dependency.

**Tech Stack:** Next.js 16.3.6 (App Router, `cacheComponents`, `<Activity>` route caching), React 19.3.0 (`<ViewTransition>`, `addTransitionType` via `next/link`'s `transitionTypes`), next-intl 4.14.6, react-markdown 10.1.0, `next/image`, three 0.186.0, @react-three/fiber 9.8.0, postprocessing 6.39.5, n8ao 2.0.1, gsap 3.15.0, lenis 1.3.26, zustand 5.0.15, Drizzle 0.45.3 + Postgres 18 (PGlite 0.5.8 in tests), Vitest 5.0.1, Playwright 1.63.0 + @axe-core/playwright 4.13.0, @lhci/cli 0.15.1, Biome 2.5.14, TypeScript 7.0.2, pnpm 11.27.1.

**Spec:** `docs/superpowers/specs/2026-09-23-cinematic-cv-design.md` (§1 storyboard: Projects "detail route `/[locale]/projects/[slug]` with View Transition"; §3 render layers, tiers, realism techniques, budgets, accessibility; the 2026-09-24 amendment "three.js only"; §4 data model: project cover/body, profile avatar/CV PDF; §7 M7 row: final look-dev, posters recaptured, real content through the admin; §8 risks). The M5 and M6 plans (`docs/superpowers/plans/2026-09-25-*.md`) and their code are the base; this plan keeps their format and building blocks.

## Verified facts (checked 2026-09-28 on this machine)

Every command and expected output below comes from running this plan in a scratch clone of `dev`, one task at a time and in order: the task's tests first and the red run observed, then the implementation and its checks, then one commit per task, including the GPU poster recapture. After Task 10 the gate script passed on a fresh clone of the result (`gate=0`). One change came late: Task 4's `browser back …` test gained its wait for a running slide (fact 5) when the replay reached Task 7, where it failed once; the line went into Task 4's commit, the test then passed 60 of 60 times on Task 7's code, and Task 8's full run and the gate ran with it. Task 4's red run was observed before that line existed (it only waits; the failure it shows is the same). The database was a throwaway `postgres:18-alpine` container on port 5546; the plan itself uses the repo's `docker compose` Postgres on port 5432.

Machine: Intel Iris Xe (ADL GT2) through ANGLE on Vulkan (Mesa), headless Chromium 153.0.8010.12 from Playwright 1.63.0, Node 24.0.0, pnpm 11.27.1. Versions are the lockfile's: Next 16.3.6, React 19.3.0, next-intl 4.14.6, react-markdown 10.1.0, three 0.186.0, @react-three/fiber 9.8.0, postprocessing 6.39.5, lenis 1.3.26, Vitest 5.0.1, Biome 2.5.14, TypeScript 7.0.2, @lhci/cli 0.15.1.

**Baseline (`dev` at `eb9e0ae`).** `Test Files  40 passed (40)`, `Tests  294 passed (294)`; `101 passed` e2e; `/en: 149.9 KB gz before 3D`, `lazy: 3 chunk(s), 315.7 KB gz`, `tier 3: +1 chunk, 81.7 KB gz`.

**Next 16.3 and React 19.3**

1. With `cacheComponents`, Next keeps the page you navigate away from in a hidden `<Activity>`: `display: none`, its effects cleaned up, its state kept, at most three routes. On the home page that ran R3F's cleanup (the WebGL context is forced lost) while `StageLoader` kept its "live" state: back on `/en` the canvas was dead, `data-canvas` stayed `"loading"` and no poster showed. Observed on the GPU with `?tier=1`, fixed in Task 4.
2. There is no `experimental.viewTransition` flag in 16.3.6 (the config type has none); `<ViewTransition>` comes from `react`, and `next/link`'s `transitionTypes` prop tags the navigation (`addTransitionType`) without a flag.
3. A `<ViewTransition>` enters and exits only as the outermost node of what the route swaps. Placed inside the page's new `<main>` it never fired (recorded `document.startViewTransition` calls ran no `nav-*` animation); wrapping `<main>` itself works.
4. A navigation started before Next has prefetched the target's page segment still happens, but the page arrives in a later commit without the transition types: no slide. The prefetch response carries the request header `next-router-segment-prefetch` ending in `__PAGE__`; the e2e tests wait for it (`prefetched()`). Links prefetch as they scroll into view, which a visitor's scrolling to the grid does long before a click.
5. A browser back (`popstate`) never animates. React commits it synchronously when it can, and Chrome restores the scroll position natively (no script scrolls: `window.scrollTo`, `scroll`, `scrollBy`, `Element.scrollIntoView`, `scrollTo` and the `scrollTop` setter were wrapped and none was called). **Back pressed while the forward slide is still running** lands at the end of the home page instead of the grid: at 1280x720, 19 of 24 backs pressed right after the URL changed ended at 6263 (the bottom of the page) instead of the saved 4714; in a second probe the 5 of 12 backs that missed all had a transition running when back was pressed; waiting until `document.activeViewTransition` is gone, 12 of 12 probes and 60 of 60 test runs ended on the grid. A reader presses back after reading, so Task 4's test waits for the slide to end; see Open questions.
6. M6's CSS `scroll-behavior: smooth` made Chrome's restore on a browser back glide through every section to the grid (recorded scroll positions all the way down). Removed in Task 4.
7. `useSelectedLayoutSegment()` and `usePathname()` in the locale layout suspend while Cache Components prerenders: the static HTML carries the Suspense fallback and the real header arrives in a streamed `<template>`, which React 19.3 reveals up to 300 ms later (`$RT+300`). `header-footer.spec.ts` turned flaky on `/en#about` hrefs. Hence `PageShell` (Task 2).
8. Cache Components refuses an empty `generateStaticParams`; a slug it did not list renders on first request and is then cached like the others (Task 2's admin e2e creates one). With no project the page gets the placeholder slug `_` (a 404; the admin only accepts lowercase letters, digits and dashes).
9. Project pages are fully static: after `pnpm build` the `.meta` files of `/en/projects/<slug>` have no `postponed` key (like `/en`), while `[slug].meta` has one (the shell for later slugs).
10. `import { getImageProps } from "next/image"` (or `Image`) puts `next/image`'s client component into the page's JavaScript: +5.5 KB gz on `/en`. Calling `getImgProps` from `next/dist/shared/lib/get-img-props` with `next/dist/shared/lib/image-loader` and `process.env.__NEXT_IMAGE_OPTS` (the config Next inlines) gives the same `<img>` attributes with no client code (`OptimizedImage`, Task 2; its unit test fails first if a Next upgrade moves these internals). `preload` replaces the deprecated `priority`. `/api/media/*` URLs need `images.localPatterns: [{ pathname: "/api/media/**", search: "" }]`.
11. react-markdown 10.1.0 renders raw HTML as text unless `skipHtml` is set (then it drops it); its `defaultUrlTransform` keeps only `http`, `https`, `irc`, `ircs`, `mailto` and `xmpp` URLs, so `javascript:` becomes an empty `href`.

**three.js and the GPU**

12. The post chain's AgX tone mapping turns M6's clear colour `#0b0c0f` into `#030305` on screen (measured on the GPU). A JavaScript port of three's AgX reproduces that measurement, and maps the linear colour `(0.0072, 0.00745, 0.00879)` to `#0b0c0f` (Task 7's `studio.test.ts`). Tier 1 renders without the post chain, and clears are never tone mapped.
13. The dotted glass and edge-glow lines are aliased sub-pixel highlights; FXAA does not join them, `EffectComposer({ multisampling: 4 })` does. `perf:local` stays at 60 fps at every stop on every tier with it (Task 9, gate).
14. `RoundedBoxGeometry` keeps `BoxGeometry`'s six groups in the order +x, −x, +y, −y, +z, −z, so a material array puts the PCB print on the top face only. three reads roughness from a map's green channel, metalness from blue (and `alphaMap` from green).
15. M6's `stepSpring` returns early when `dt` is 0, which a new stage's first frame has: `stepMotion(..., snap = true)` could not place a fresh stage. Hence `settleMotion` (Task 4).
16. Poster captures on this GPU are deterministic: re-running a task's poster step on the same code produced byte-identical files (every poster name matched the first run's hash).

**Tests and tools**

17. Playwright runs the admin spec *files* in parallel workers; the project's `fullyParallel: false` only orders tests inside one file. Two files that uploaded and deleted "their" media by file name removed each other's uploads. Hence `tests/e2e/media-library.ts` (Task 5).
18. Two M5 tests are timing-sensitive and not changed by M7: `poster.spec.ts › the 3D chunk is requested only after the LCP` failed once in a normal run of this replay (`Expected: > 1004`, `Received: 972.1`: a later, larger LCP candidate came after the chunk request) and `motion.spec.ts › the visitor can still turn motion on` failed under `--repeat-each=3`. Every other full run in this replay passed them; see Open questions.
19. Headless Chromium on SwiftShader (the e2e default) draws a few frames per second: the e2e framing checks use capture mode (the posters' exact framing), and the stage tests wait up to 60 s for "live".

**The look, before and after** (GPU captures at every stop, 1920x1080 and 1440x900, `?capture=` framing):

- Before: the stage's rectangle is darker than the page (`#030305` on `#0b0c0f`); the glass slab's far edges and the glowing edge bands are rows of dots; the glass shows two highlights; the circuit board's sides repeat its top print as orange streaks and its copper looks like plastic; the lighting is flat from the front; a square outline shows on the floor around the contact shadow; at 16:10 and 3:2 the stack is cut at the right edge and runs under the copy (About's text 8 px from the lifted glass at 1280 px, Contact's form over a third of the stack); About's turn reads as almost frontal; at 1366 px "The stack" wraps.
- After: the stage meets the page with no visible edge; every bevel has one continuous highlight line; the board's edge is dark FR4 with three thin copper lines and its traces reflect like metal; key and rim light model the slabs; the contact shadow fades out with no outline; the stack sits in the right half of every laptop screen from 1280x720 to 1920x1080 with at least 32 px to the copy; About shows a clear three-quarter view with the glass lifted; on phones the whole stack sits under the hero's copy.

## Global Constraints

- Exact pins, no new dependency. Everything M7 needs is installed: `react-markdown` 10.1.0 (M2, admin preview), `next/image`, React's `<ViewTransition>` (in Next's React 19.3 canary and in `react` 19.3.0 itself). Still not used: `@react-three/drei`, `@react-three/postprocessing`, `detect-gpu`, `maath`, Theatre.js, KTX2/Basis, `remark-gfm`, `rehype-raw`.
- Owner decisions for M7 (2026-09-28), binding: the owner enters the real EN/RO content in the admin; M7 writes and imports no content, and the fixtures stay the placeholder "Alex Marin". The engraving stays the constant "Mihai Dorobat — Full-stack Engineer". Posters are recaptured on the GPU after every change to the scene code (the source-hash test enforces it). All four focus areas: materials and light, typography and layout, project pages with View Transitions, mobile.
- Owner decision 2026-09-24, binding: no Blender, all 3D procedural three.js; asset contract v1 names (`layer_interface` … `layer_craft`, `engrave_hero`, `engrave_contact`, `led_status`, `pcb_traces`) unchanged; new helper objects stay optional for shots.
- Spec §3, verbatim: "L1 DOM — all text SSR, semantic (SEO, a11y, LCP)." "canvases `aria-hidden` … reduced-motion → T0". Project pages carry no 3D.
- Budgets (spec §3 and the brief): public JS before 3D ≤ 160 KB gz on `/en`, `/ro` **and** a project page; the lazy 3D chunks of a live tier-2 page ≤ 350 KB gz; tier 3's own chunk ≤ 100 KB gz on top; detail maps ≤ 256 KB on disk; posters: what one visitor downloads ≤ 400 KB; `/en`, `/ro` and every project page stay `○` (static).
- Acceptance (brief): tier 2 60 fps at every stop, no long task while scrolling and no task over 100 ms while the stage mounts (M6's budgets) on this Iris Xe (`pnpm perf:local`); tab memory < 400 MB; LHCI ≥ 95 on `/en`, `/ro` and a project page; all 101 existing e2e green plus new ones; axe clean on the new pages; a project with a cover, a case study and links edited in the admin shows on its public page, and editing it again refreshes the page (`updateTag`).
- View Transitions: shared element = the cover (titles do not morph, see Deviations); no animation with `prefers-reduced-motion`, with **Motion** off, or without `document.startViewTransition`; a browser back never animates (React skips `popstate`).
- Phones: interactive controls ≥ 44 x 44 CSS px on a coarse pointer (links inside running text excepted); no horizontal scroll at 320, 360 and 390 px.
- Self-host everything the page loads at runtime; covers and the headshot come from the media library through Next's image optimizer (`OptimizedImage`, Task 2) with `images.localPatterns: [{ pathname: "/api/media/**", search: "" }]`; Vercel Blob `remotePatterns` are M9.
- Biome is the only linter/formatter; `rtk proxy pnpm lint` prints `No fixes applied.` before each commit, with no warnings.
- Commits `type(scope): subject`, subject ≤ 50 characters, **no AI attribution of any kind**. The owner's real address never enters a committed file: before each commit `/usr/bin/git diff --cached | grep -cF "$(grep ^ADMIN_EMAIL= .env.local | cut -d= -f2)"` must print `0`.
- Port 3020 is the owner's dev server: never use it. Ports here: 3100 (e2e), 3200 (LHCI), 3300 (`perf:local`), 3400 (`assets:posters`).
- Out of scope (M8+): a project video (the media library takes images and PDFs only), images inside case studies, experience logos (no admin field), Blob `remotePatterns` (M9), CSP and security headers (M8).

## Review Focus

Inputs the spec implies that ordinary feature tests would miss. Each one is pinned by a test in the task that owns the code:

1. **Coming back from a project page.** Next keeps the home page in a hidden `<Activity>`; its effects run their cleanup, R3F forces the WebGL context lost, and M6's stage then stayed on "loading" with a dead canvas: no 3D and no posters until a reload. Pinned by Task 4's e2e `after a project page › the stage lets go of the GPU and comes back live` (also asserts the new stage starts on the section on screen) and the perf test `three trips to a project page and back keep the stage smooth and lean` (Task 9).
2. **Laptops between 16:9 and 3:2, and phones.** The shots are authored for 16:9 and cropped like `object-fit: cover`: a 16:10 or 3:2 screen cut the stack at the right edge, and the copy columns ran into it. Pinned by Task 6's `tests/e2e/framing.spec.ts` (six laptop sizes, four stops) and Task 8's `the hero's copy sits above the finished stack` at 390x844 and 360x800.
3. **No View Transitions, reduced motion, Motion off.** Navigation must work and nothing may move. Pinned by Task 3's `browsers without View Transitions still navigate`, `with reduced motion › pages swap without animating` and `the Motion switch turns page transitions off too`.
4. **Content that arrives after the build.** A project the owner creates later has no prerendered page; an edit must reach the static page and the sitemap. Pinned by Task 2's admin e2e `a cover, a case study and links from the admin reach the project page` (a new slug, an edit, the sitemap) and the 404s for drafts, unknown slugs and the empty-build placeholder.
5. **Hostile or sloppy markdown.** Raw HTML, `javascript:` links and images in a case study. Pinned by the same admin e2e (no `script`, no raw `<b>`, the `javascript:` link neutralised) and `CaseStudy`'s react-markdown settings.

Also covered: admin spec files run in parallel Playwright workers, so tests that upload media find and delete their own files by media id (`tests/e2e/media-library.ts`, Task 5), and `scripts/e2e-db.ts` clears uploads a failed run left behind.

## Before you start (workspace)

1. Update the main checkout and cut the worktree from `dev`:

```bash
/usr/bin/git -C /home/mihai/Documents/CV pull --ff-only
/usr/bin/git -C /home/mihai/Documents/CV worktree add .claude/worktrees/m7 -b feat/m7-look-and-projects dev
```

Expected: `Preparing worktree (new branch 'feat/m7-look-and-projects')` and `HEAD is now at eb9e0ae docs: document scenes, textures and journey perf` (or a later `dev` tip). Then call `EnterWorktree` with `path: ".claude/worktrees/m7"`. **All commands below run from the worktree root.** If this plan file is not committed on `dev`, read it from `/home/mihai/Documents/CV/docs/superpowers/plans/2026-09-28-m7-look-and-projects.md`.

2. Install, create the local env, start Postgres, prepare the database:

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
docker compose up -d --wait
pnpm db:migrate
pnpm db:seed
pnpm exec playwright install chromium
```

In `.env.local`, set `ADMIN_EMAIL=<owner email>` (the Overseer supplies it; it never goes into a committed file).

Expected: `Done in <n>s using pnpm v11.27.1`; `Container cv-db-1  Healthy`; `migrations applied`; `seeded CV content` (or `skipped: CV content already exists (use --reset to replace it)`).

3. Check the baseline:

Run: `rtk proxy pnpm test`
Expected: `Test Files  40 passed (40)`, `Tests  294 passed (294)`.

Run: `pnpm test:e2e`
Expected: `101 passed`, with `/en: 149.9 KB gz before 3D`, `lazy: 3 chunk(s), 315.7 KB gz`, `tier 3: +1 chunk, 81.7 KB gz`. Afterwards `ss -ltn | grep ':3100 '` prints nothing.

4. Tasks 4, 6, 7 and 8 recapture posters, and Task 9 measures, on this machine's GPU (Intel Iris Xe). Check headless Chromium reaches it, exactly as in M5 and M6:

```bash
mkdir -p .data
cat > .data/webgl-probe.mjs <<'EOF'
import { chromium } from "@playwright/test";
const browser = await chromium.launch({ args: ["--use-angle=vulkan", "--enable-features=Vulkan", "--enable-gpu"] });
const page = await browser.newPage();
console.log(await page.evaluate(() => {
  const gl = document.createElement("canvas").getContext("webgl2");
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  return gl.getParameter(info.UNMASKED_RENDERER_WEBGL);
}));
console.log(browser.version());
await browser.close();
EOF
node .data/webgl-probe.mjs
rm .data/webgl-probe.mjs
```

Expected: `ANGLE (Intel, Vulkan 1.4.318 (Intel(R) Iris(R) Xe Graphics (ADL GT2) (0x000046A6)), Intel open-source Mesa driver)` and `153.0.8010.12`. Where this prints `SwiftShader`, use `POSTERS_SOFTWARE=1 pnpm assets:posters` (slower, slightly different bytes) and expect `pnpm perf:local` to skip.

**The poster step.** Every task that edits `src/experience/{Stage.tsx,director,postfx,scenes}` makes the committed posters stale (`tests/unit/posters.test.ts › were captured from the current scene code`). Such a task ends with:

```bash
pnpm build
pnpm assets:posters
```

Expected: `wrote 48 files and src/experience/posters.json`. When the picture did not change, `/usr/bin/git status --short public/posters src/experience/posters.json` lists only ` M src/experience/posters.json` (the GPU capture is byte-identical, only `sourceHash` moves); each task says what to expect.

**Code blocks.** New files are shown complete; changes to existing files are the exact commit diff of the replayed run (their `index` lines name scratch blobs and can be ignored). Apply a diff by hand, or save it and run `/usr/bin/git apply <file>`. Within a task, apply the test files first (the red run), then the rest.

**Running single e2e specs.** `pnpm exec playwright test <spec> --project=public` builds the app and runs one public spec (about 3 minutes, most of it the build). Admin specs depend on the public project, so `pnpm exec playwright test tests/e2e/admin-<name>.spec.ts` runs every public spec first; add `--project=admin --no-deps` to run only the admin specs named.

## File map

| Path | Responsibility | Task |
| --- | --- | --- |
| `src/content/{types,resolve-cv}.ts`, `src/server/queries/cv.ts` | `MediaImageRecord`, `MediaFile`, `MediaImage`; project `cover` + `body`, profile `avatar` + `cvPdf` in the view model (media table read with the CV) | 1 |
| `src/server/queries/admin/projects.ts`, `src/app/admin/(panel)/projects/page.tsx` | `PROJECT_TEXT_FIELDS` (the "RO missing" badge counts the case study) | 1 |
| `src/app/[locale]/projects/[slug]/page.tsx` | the project page: `generateStaticParams`, `generateMetadata`, JSON-LD, facts, cover, case study, neighbours | 2 (3) |
| `src/lib/project-pages.ts`, `src/lib/seo.ts`, `src/app/sitemap.ts` | `NO_PROJECT`, `staticProjectParams`, `findProject`, `neighbours`; `projectPath`, `buildSitemap(siteUrl, slugs)`, `projectJsonLd` | 2 |
| `src/components/projects/{ProjectCover,CaseStudy,ProjectLinks,ProjectNav}.tsx`, `src/components/ui/OptimizedImage.tsx` | cover through `OptimizedImage`, safe markdown, live/source links, previous/next | 2 (3) |
| `src/components/site/{PageShell,SiteHeader,LocaleSwitcher,SiteFooter}.tsx`, `src/app/[locale]/{layout,page,not-found}.tsx` | each page renders its header and `<main>`; section links and the language switch know the page (`path`) | 2 (3, 8) |
| `next.config.ts`, `messages/{en,ro}.json`, `src/app/globals.css` | `images.localPatterns`; `Project`, `Projects.open`, `Cv` strings; case study and backdrop styles | 2, 3, 5 |
| `src/components/motion/DirectionalTransition.tsx`, `src/components/projects/CoverTransition.tsx`, `src/components/sections/Projects.tsx`, `src/app/globals.css` | page slide (`nav-forward`/`nav-back`), cover morph, card links, VT CSS with reduced motion and Motion off | 3 |
| `src/experience/MotionToggle.tsx` | mirrors the preference to `html[data-motion]` on every page | 3 (8) |
| `src/experience/StageLoader.tsx`, `src/experience/director/{Director.tsx,motion.ts}`, `src/experience/scroll/loop.ts`, `src/app/[locale]/layout.tsx`, `src/app/globals.css` | stage reset on hide, `settleMotion` on a fresh stage, Lenis anchors, no CSS smooth scroll, canvas fade-in | 4 |
| `src/components/sections/{CvDownload,Hero,Contact,About,Experience}.tsx`, `src/lib/format.ts`, `scripts/e2e-db.ts` | CV download, headshot, company links, `formatFileSize`; e2e uploads reset | 5 |
| `src/experience/director/{framing,journey,shots,page-links,JourneyShot}.ts(x)`, `src/components/{sections/{Hero,About,Contact},ui/Section}.tsx`, `src/app/globals.css` | crop anchored to the stack's side, new camera keys and About yaw, `stackBox` + `data-box`, rows never behind the camera, half-width copy, one-line Skills title | 6 (8) |
| `src/experience/scenes/{studio.ts,StudioLights.tsx,materials.ts,textures.ts,StackModel.tsx}`, `src/experience/{Stage.tsx,postfx/Effects.tsx}` | tone-mapped studio background, contact shadow, softboxes, FR4 edges + PCB surface map, glass, bevels, 4x MSAA, dithering | 7 |
| `src/components/site/*`, `src/components/sections/{Hero,Contact}.tsx`, `src/experience/MotionToggle.tsx`, `src/app/globals.css` | 44 px controls on coarse pointers, press feedback, portrait hero copy on top, deeper portrait scrim | 8 |
| `tests/perf/journey.perf.ts`, `lighthouserc.json` | round-trip perf test; LHCI on a project page | 9 |
| `tests/unit/{project-pages,page-links,studio}.test.ts` (new), `tests/unit/{seo,motion,framing,journey,shots,stack-model,format}.test.ts`, `tests/db/{cv-queries,admin-projects}.test.ts` | unit and database tests | 1–8 |
| `tests/e2e/{projects,view-transitions,framing,mobile}.spec.ts`, `tests/e2e/media-library.ts` (new), `tests/e2e/{admin-projects,admin-profile,budgets,hero-projects-contact,about-skills-experience,stage,scenes}.spec.ts` | e2e | 2–8 |
| `public/posters/*`, `src/experience/posters.json` | recaptured on the GPU | 4, 6, 7, 8 |
| `README.md` | project pages, content map, framing, look, Activity | 10 |

---

### Task 1: Covers, case studies, the CV PDF and the headshot in the CV

**Owner:** backend-engineer.

The admin already stores all of these (M2: `project.cover_media_id`, `project_i18n.body_md`, `profile.avatar_media_id`, `profile_i18n.cv_pdf_media_id`), but `loadCvRecords` never read them, so the public site could not show them. This task puts them into the view model; Tasks 2 and 5 render them.

**Files:**
- Modify: `src/content/types.ts`, `src/content/resolve-cv.ts`, `src/server/queries/cv.ts`, `src/server/queries/admin/projects.ts`, `src/app/admin/(panel)/projects/page.tsx`
- Test: `tests/db/cv-queries.test.ts`, `tests/db/admin-projects.test.ts`

**Interfaces:**
- Consumes: the M2 schema (`media`, `project`, `project_i18n`, `profile`, `profile_i18n`), `localize()`, `I18n<T>`, `Localized<T>`.
- Produces:
  - `type MediaImageRecord = { url: string; width: number; height: number; lqip: string | null; i18n: I18n<{ alt: string }> }`
  - `type MediaFile = { url: string; bytes: number }`
  - `type MediaImage = { url: string; width: number; height: number; lqip: string | null; alt: Localized<string> }`
  - records: `ProjectRecord.cover?: MediaImageRecord`, `ProjectRecord.i18n.*.body?: string`, `ProfileRecord.avatar?: MediaImageRecord`, `ProfileRecord.i18n.*.cvPdf?: MediaFile` (optional, so the M1 fixtures stay valid)
  - view model: `Cv["projects"][number].cover: MediaImage | null`, `.body: Localized<string>` (`""` without a case study); `Cv["profile"].avatar: MediaImage | null`, `.cvPdf: Localized<MediaFile> | null` (RO falls back to the EN PDF)
  - `PROJECT_TEXT_FIELDS = ["title", "summary", "role", "outcome", "bodyMd"] as const` (admin "RO missing" badge)
  - Only `kind = "image"` rows with a size become images, only `kind = "document"` rows become the PDF.

- [ ] **Step 1: Write the failing tests**

`tests/db/cv-queries.test.ts`:

```diff
diff --git a/tests/db/cv-queries.test.ts b/tests/db/cv-queries.test.ts
index ab1caa7..c5789aa 100644
--- a/tests/db/cv-queries.test.ts
+++ b/tests/db/cv-queries.test.ts
@@ -2,7 +2,13 @@ import { and, eq } from "drizzle-orm";
 import { afterAll, beforeAll, describe, expect, it } from "vitest";
 import { fixtures } from "@/content/fixtures";
 import { resolveCv } from "@/content/resolve-cv";
-import { profileI18n, projectI18n } from "@/server/db/schema";
+import {
+  media,
+  profile,
+  profileI18n,
+  project,
+  projectI18n,
+} from "@/server/db/schema";
 import { seedContent } from "@/server/db/seed";
 import type { Db } from "@/server/db/types";
 import { loadCvRecords } from "@/server/queries/cv";
@@ -110,3 +116,130 @@ describe("RO → EN fallback on database rows", () => {
     );
   });
 });
+
+describe("covers, case studies, the avatar and the CV PDF", () => {
+  const uuid = () => crypto.randomUUID();
+
+  async function addImage(alt: { en: string; ro: string }) {
+    const key = `${uuid()}.webp`;
+    const [row] = await db
+      .insert(media)
+      .values({
+        blobUrl: `/api/media/${key}`,
+        pathname: key,
+        kind: "image",
+        mime: "image/webp",
+        width: 1600,
+        height: 1000,
+        bytes: 48_000,
+        lqip: "data:image/webp;base64,UklGRg==",
+        altEn: alt.en,
+        altRo: alt.ro,
+      })
+      .returning({ id: media.id, url: media.blobUrl });
+    return row;
+  }
+
+  async function addPdf() {
+    const key = `${uuid()}.pdf`;
+    const [row] = await db
+      .insert(media)
+      .values({
+        blobUrl: `/api/media/${key}`,
+        pathname: key,
+        kind: "document",
+        mime: "application/pdf",
+        bytes: 91_000,
+      })
+      .returning({ id: media.id, url: media.blobUrl });
+    return row;
+  }
+
+  it("gives a project its cover and case study, RO falling back to EN", async () => {
+    await seedContent(db, { reset: true });
+    const cover = await addImage({ en: "The reconciliation board", ro: "" });
+    await db
+      .update(project)
+      .set({ coverMediaId: cover.id })
+      .where(eq(project.slug, "ledger-lens"));
+    await db
+      .update(projectI18n)
+      .set({ bodyMd: "## Why\n\nMonth-end took three days." })
+      .where(
+        and(
+          eq(projectI18n.projectSlug, "ledger-lens"),
+          eq(projectI18n.locale, "en"),
+        ),
+      );
+
+    const ledger = resolveCv(await loadCvRecords(db), "ro").projects.find(
+      (p) => p.slug === "ledger-lens",
+    );
+
+    expect(ledger?.cover).toEqual({
+      url: cover.url,
+      width: 1600,
+      height: 1000,
+      lqip: "data:image/webp;base64,UklGRg==",
+      alt: { value: "The reconciliation board", lang: "en" },
+    });
+    expect(ledger?.body).toEqual({
+      value: "## Why\n\nMonth-end took three days.",
+      lang: "en",
+    });
+  });
+
+  it("leaves projects without a cover or case study plain", async () => {
+    await seedContent(db, { reset: true });
+
+    const tramline = resolveCv(await loadCvRecords(db), "en").projects.find(
+      (p) => p.slug === "tramline",
+    );
+
+    expect(tramline?.cover).toBeNull();
+    expect(tramline?.body).toEqual({ value: "", lang: "en" });
+  });
+
+  it("never shows a document as a cover", async () => {
+    await seedContent(db, { reset: true });
+    const pdf = await addPdf();
+    await db
+      .update(project)
+      .set({ coverMediaId: pdf.id })
+      .where(eq(project.slug, "ledger-lens"));
+
+    const ledger = resolveCv(await loadCvRecords(db), "en").projects.find(
+      (p) => p.slug === "ledger-lens",
+    );
+
+    expect(ledger?.cover).toBeNull();
+  });
+
+  it("resolves the avatar and each locale's CV PDF, RO falling back to EN", async () => {
+    await seedContent(db, { reset: true });
+    const avatar = await addImage({ en: "Portrait", ro: "Portret" });
+    const pdf = await addPdf();
+    await db.update(profile).set({ avatarMediaId: avatar.id });
+    await db
+      .update(profileI18n)
+      .set({ cvPdfMediaId: pdf.id })
+      .where(eq(profileI18n.locale, "en"));
+
+    const ro = resolveCv(await loadCvRecords(db), "ro").profile;
+
+    expect(ro.avatar?.alt).toEqual({ value: "Portret", lang: "ro" });
+    expect(ro.cvPdf).toEqual({
+      value: { url: pdf.url, bytes: 91_000 },
+      lang: "en",
+    });
+  });
+
+  it("has no avatar or CV PDF until the owner picks them", async () => {
+    await seedContent(db, { reset: true });
+
+    const en = resolveCv(await loadCvRecords(db), "en").profile;
+
+    expect(en.avatar).toBeNull();
+    expect(en.cvPdf).toBeNull();
+  });
+});
```

`tests/db/admin-projects.test.ts`:

```diff
diff --git a/tests/db/admin-projects.test.ts b/tests/db/admin-projects.test.ts
index 73e593a..b2cb9ef 100644
--- a/tests/db/admin-projects.test.ts
+++ b/tests/db/admin-projects.test.ts
@@ -8,6 +8,7 @@ import {
   it,
   vi,
 } from "vitest";
+import { missingTranslation } from "@/content/localize";
 import { resolveCv } from "@/content/resolve-cv";
 import {
   createProject,
@@ -15,8 +16,12 @@ import {
   updateProject,
 } from "@/server/actions/projects";
 import { IDLE } from "@/server/admin/action-result";
-import { projectSkill } from "@/server/db/schema";
+import { media, projectSkill } from "@/server/db/schema";
 import { seedContent } from "@/server/db/seed";
+import {
+  listProjectsForAdmin,
+  PROJECT_TEXT_FIELDS,
+} from "@/server/queries/admin/projects";
 import { loadCvRecords } from "@/server/queries/cv";
 import { mocks, OWNER, setupActionDb } from "./action-mocks";
 import { form } from "./form";
@@ -129,4 +134,53 @@ describe("project actions", () => {
       code: 404,
     });
   });
+
+  it("publishes the cover and the case study and expires the public cache", async () => {
+    const [cover] = await mocks.db
+      .insert(media)
+      .values({
+        blobUrl: "/api/media/0b4c3f7e-2c1a-4f6e-9d55-5b7c6f1e2a90.webp",
+        pathname: "0b4c3f7e-2c1a-4f6e-9d55-5b7c6f1e2a90.webp",
+        kind: "image",
+        mime: "image/webp",
+        width: 1600,
+        height: 1000,
+        bytes: 48_000,
+        altEn: "Orbit's pass planner",
+      })
+      .returning({ id: media.id });
+
+    await expect(
+      createProject(IDLE, form({ ...PROJECT, coverMediaId: cover.id })),
+    ).rejects.toThrow("NEXT_REDIRECT /admin/projects/orbit");
+
+    const orbit = (await cv()).projects.find((p) => p.slug === "orbit");
+    expect(orbit?.cover).toMatchObject({
+      url: "/api/media/0b4c3f7e-2c1a-4f6e-9d55-5b7c6f1e2a90.webp",
+      alt: { value: "Orbit's pass planner", lang: "en" },
+    });
+    expect(orbit?.body.value).toBe("## Why\n\nBecause.");
+    expect(mocks.updateTag).toHaveBeenCalledWith("cv");
+  });
+
+  it("flags a case study that has no Romanian translation", async () => {
+    await expect(
+      createProject(
+        IDLE,
+        form({
+          ...PROJECT,
+          "ro.summary": "Panou pentru sateliți.",
+          "ro.role": "Coordonator",
+          "ro.outcome": "Lansat.",
+        }),
+      ),
+    ).rejects.toThrow("NEXT_REDIRECT");
+
+    const orbit = (await listProjectsForAdmin(mocks.db)).find(
+      (item) => item.slug === "orbit",
+    );
+    expect(missingTranslation(orbit?.en, orbit?.ro, PROJECT_TEXT_FIELDS)).toBe(
+      true,
+    );
+  });
 });
```

- [ ] **Step 2: Run them to see them fail**

Run: `rtk proxy pnpm exec vitest run tests/db/cv-queries.test.ts tests/db/admin-projects.test.ts`
Expected: `Test Files  2 failed (2)`, `Tests  7 failed | 13 passed (20)`: the five new `covers, case studies, the avatar and the CV PDF` tests (`expected undefined to be null`, `… to deeply equal …`) and both new project action tests (`expected undefined to match object`, and `TypeError: Cannot read properties of undefined (reading 'some')` from the missing `PROJECT_TEXT_FIELDS`)

- [ ] **Step 3: Read the media with the CV and resolve it**

`src/content/types.ts`:

```diff
diff --git a/src/content/types.ts b/src/content/types.ts
index 145189e..d0066b1 100644
--- a/src/content/types.ts
+++ b/src/content/types.ts
@@ -33,6 +33,19 @@ export type Localized<T> = { value: T; lang: Locale };
 
 export type SocialLink = { network: "github" | "linkedin"; url: string };
 
+/** An uploaded image (media library): MediaStore URL, intrinsic size, blur placeholder. */
+export type MediaImageRecord = {
+  url: string;
+  width: number;
+  height: number;
+  /** Tiny WebP data URL shown while the image loads. */
+  lqip: string | null;
+  i18n: I18n<{ alt: string }>;
+};
+
+/** An uploaded document (the CV PDF). */
+export type MediaFile = { url: string; bytes: number };
+
 export type ProfileRecord = {
   emailPublic: string;
   location: string;
@@ -40,12 +53,15 @@ export type ProfileRecord = {
   socials: SocialLink[];
   available: boolean;
   yearsExp: number;
+  avatar?: MediaImageRecord;
   i18n: I18n<{
     fullName: string;
     headline: string;
     summary: string;
     seoTitle: string;
     seoDescription: string;
+    /** One CV PDF per language; /ro falls back to the English one. */
+    cvPdf?: MediaFile;
   }>;
 };
 
@@ -84,7 +100,15 @@ export type ProjectRecord = {
   featured: boolean;
   published: boolean;
   skills: string[];
-  i18n: I18n<{ title: string; summary: string; role: string; outcome: string }>;
+  cover?: MediaImageRecord;
+  /** `body` is the case study (markdown); optional, like the cover. */
+  i18n: I18n<{
+    title: string;
+    summary: string;
+    role: string;
+    outcome: string;
+    body?: string;
+  }>;
 };
 
 export type CvRecords = {
@@ -95,6 +119,15 @@ export type CvRecords = {
   projects: ProjectRecord[];
 };
 
+/** A resolved image: alt text in the page's language (or English). */
+export type MediaImage = {
+  url: string;
+  width: number;
+  height: number;
+  lqip: string | null;
+  alt: Localized<string>;
+};
+
 /** Resolved, locale-specific view model consumed by the section components. */
 export type Cv = {
   locale: Locale;
@@ -110,6 +143,8 @@ export type Cv = {
     socials: SocialLink[];
     available: boolean;
     yearsExp: number;
+    avatar: MediaImage | null;
+    cvPdf: Localized<MediaFile> | null;
   };
   experience: Array<{
     id: string;
@@ -138,5 +173,8 @@ export type Cv = {
     summary: Localized<string>;
     role: Localized<string>;
     outcome: Localized<string>;
+    cover: MediaImage | null;
+    /** Markdown; empty when the project has no case study. */
+    body: Localized<string>;
   }>;
 };
```

`src/server/queries/cv.ts`:

```diff
diff --git a/src/server/queries/cv.ts b/src/server/queries/cv.ts
index b5525c7..1d831c9 100644
--- a/src/server/queries/cv.ts
+++ b/src/server/queries/cv.ts
@@ -1,9 +1,17 @@
 import { asc } from "drizzle-orm";
-import type { CvRecords, I18n, SkillRecord, YearMonth } from "@/content/types";
+import type {
+  CvRecords,
+  I18n,
+  MediaFile,
+  MediaImageRecord,
+  SkillRecord,
+  YearMonth,
+} from "@/content/types";
 import type { Locale } from "@/i18n/routing";
 import {
   experience,
   experienceI18n,
+  media,
   profile,
   profileI18n,
   project,
@@ -32,6 +40,7 @@ export async function loadCvRecords(db: Db): Promise<CvRecords> {
     projects,
     projectRows,
     projectSkills,
+    uploads,
   ] = await Promise.all([
     db.select().from(profile),
     db.select().from(profileI18n),
@@ -46,8 +55,30 @@ export async function loadCvRecords(db: Db): Promise<CvRecords> {
       .select()
       .from(projectSkill)
       .orderBy(asc(projectSkill.projectSlug), asc(projectSkill.position)),
+    db.select().from(media),
   ]);
 
+  const upload = new Map(uploads.map((row) => [row.id, row]));
+  const image = (id: string | null): MediaImageRecord | undefined => {
+    const row = id ? upload.get(id) : undefined;
+    if (row?.kind !== "image" || !row.width || !row.height) {
+      return undefined;
+    }
+    return {
+      url: row.blobUrl,
+      width: row.width,
+      height: row.height,
+      lqip: row.lqip,
+      i18n: { en: { alt: row.altEn }, ro: { alt: row.altRo } },
+    };
+  };
+  const file = (id: string | null): MediaFile | undefined => {
+    const row = id ? upload.get(id) : undefined;
+    return row?.kind === "document"
+      ? { url: row.blobUrl, bytes: row.bytes }
+      : undefined;
+  };
+
   const p = profiles[0];
   if (!p) {
     throw new Error(
@@ -63,12 +94,14 @@ export async function loadCvRecords(db: Db): Promise<CvRecords> {
       socials: p.socials,
       available: p.available,
       yearsExp: p.yearsExp,
+      avatar: image(p.avatarMediaId),
       i18n: toI18n("profile", profileRows, (row) => ({
         fullName: row.fullName,
         headline: row.headline,
         summary: row.summaryMd,
         seoTitle: row.seoTitle,
         seoDescription: row.seoDescription,
+        cvPdf: file(row.cvPdfMediaId),
       })),
     },
     experience: jobs.map((job) => ({
@@ -117,6 +150,7 @@ export async function loadCvRecords(db: Db): Promise<CvRecords> {
       skills: projectSkills
         .filter((row) => row.projectSlug === item.slug)
         .map((row) => row.skillSlug),
+      cover: image(item.coverMediaId),
       i18n: toI18n(
         `project ${item.slug}`,
         projectRows.filter((row) => row.projectSlug === item.slug),
@@ -125,6 +159,7 @@ export async function loadCvRecords(db: Db): Promise<CvRecords> {
           summary: row.summary,
           role: row.role,
           outcome: row.outcome,
+          body: row.bodyMd,
         }),
       ),
     })),
```

`src/content/resolve-cv.ts`:

```diff
diff --git a/src/content/resolve-cv.ts b/src/content/resolve-cv.ts
index a745897..8b7194e 100644
--- a/src/content/resolve-cv.ts
+++ b/src/content/resolve-cv.ts
@@ -1,11 +1,31 @@
 import type { Locale } from "@/i18n/routing";
 import { localize } from "./localize";
-import { type Cv, type CvRecords, STACK_LAYERS } from "./types";
+import {
+  type Cv,
+  type CvRecords,
+  type Localized,
+  type MediaFile,
+  type MediaImage,
+  type MediaImageRecord,
+  STACK_LAYERS,
+} from "./types";
+
+function mediaImage(
+  record: MediaImageRecord | undefined,
+  locale: Locale,
+): MediaImage | null {
+  if (!record) {
+    return null;
+  }
+  const { i18n, ...image } = record;
+  return { ...image, alt: localize(i18n, locale, "alt") };
+}
 
 /** Resolves raw records into the locale-specific view model the sections render. */
 export function resolveCv(records: CvRecords, locale: Locale): Cv {
   const { profile } = records;
   const skillName = new Map(records.skills.map((s) => [s.slug, s.name]));
+  const cvPdf = localize(profile.i18n, locale, "cvPdf");
 
   return {
     locale,
@@ -21,6 +41,8 @@ export function resolveCv(records: CvRecords, locale: Locale): Cv {
       socials: profile.socials,
       available: profile.available,
       yearsExp: profile.yearsExp,
+      avatar: mediaImage(profile.avatar, locale),
+      cvPdf: cvPdf.value ? (cvPdf as Localized<MediaFile>) : null,
     },
     experience: records.experience
       .filter((job) => job.isPublished)
@@ -52,17 +74,22 @@ export function resolveCv(records: CvRecords, locale: Locale): Cv {
       .toSorted(
         (a, b) => Number(b.featured) - Number(a.featured) || b.year - a.year,
       )
-      .map((project) => ({
-        slug: project.slug,
-        repoUrl: project.repoUrl,
-        liveUrl: project.liveUrl,
-        year: project.year,
-        featured: project.featured,
-        skills: project.skills.flatMap((slug) => skillName.get(slug) ?? []),
-        title: localize(project.i18n, locale, "title"),
-        summary: localize(project.i18n, locale, "summary"),
-        role: localize(project.i18n, locale, "role"),
-        outcome: localize(project.i18n, locale, "outcome"),
-      })),
+      .map((project) => {
+        const body = localize(project.i18n, locale, "body");
+        return {
+          slug: project.slug,
+          repoUrl: project.repoUrl,
+          liveUrl: project.liveUrl,
+          year: project.year,
+          featured: project.featured,
+          skills: project.skills.flatMap((slug) => skillName.get(slug) ?? []),
+          title: localize(project.i18n, locale, "title"),
+          summary: localize(project.i18n, locale, "summary"),
+          role: localize(project.i18n, locale, "role"),
+          outcome: localize(project.i18n, locale, "outcome"),
+          cover: mediaImage(project.cover, locale),
+          body: { value: body.value ?? "", lang: body.lang },
+        };
+      }),
   };
 }
```

`src/server/queries/admin/projects.ts` and `src/app/admin/(panel)/projects/page.tsx`:

```diff
diff --git a/src/server/queries/admin/projects.ts b/src/server/queries/admin/projects.ts
index dab40a6..c3670f8 100644
--- a/src/server/queries/admin/projects.ts
+++ b/src/server/queries/admin/projects.ts
@@ -4,6 +4,15 @@ import type { Db } from "@/server/db/types";
 import { byLocale } from "./by-locale";
 import { mediaOptions } from "./media";
 
+/** Translatable project text; a blank Romanian value gets the "RO missing" badge. */
+export const PROJECT_TEXT_FIELDS = [
+  "title",
+  "summary",
+  "role",
+  "outcome",
+  "bodyMd",
+] as const;
+
 export async function listProjectsForAdmin(db: Db) {
   const [projects, rows, skills] = await Promise.all([
     db.select().from(project).orderBy(desc(project.year), asc(project.slug)),
```

```diff
diff --git a/src/app/admin/(panel)/projects/page.tsx b/src/app/admin/(panel)/projects/page.tsx
index e5d26b0..3c811dd 100644
--- a/src/app/admin/(panel)/projects/page.tsx
+++ b/src/app/admin/(panel)/projects/page.tsx
@@ -5,7 +5,10 @@ import { button } from "@/components/admin/styles";
 import { missingTranslation } from "@/content/localize";
 import { requireAdmin } from "@/server/auth";
 import { getDb } from "@/server/db";
-import { listProjectsForAdmin } from "@/server/queries/admin/projects";
+import {
+  listProjectsForAdmin,
+  PROJECT_TEXT_FIELDS,
+} from "@/server/queries/admin/projects";
 
 export const metadata: Metadata = { title: "Projects" };
 
@@ -41,12 +44,7 @@ export default async function ProjectsPage() {
                 Draft
               </span>
             )}
-            {missingTranslation(item.en, item.ro, [
-              "title",
-              "summary",
-              "role",
-              "outcome",
-            ]) ? (
+            {missingTranslation(item.en, item.ro, PROJECT_TEXT_FIELDS) ? (
               <MissingBadge />
             ) : null}
           </li>
```

- [ ] **Step 4: Run the tests again**

Run: `rtk proxy pnpm exec vitest run tests/db/cv-queries.test.ts tests/db/admin-projects.test.ts`
Expected: `Test Files  2 passed (2)`, `Tests  20 passed (20)`

Run: `rtk proxy pnpm test`
Expected: `Test Files  40 passed (40)`, `Tests  301 passed (301)` (the fixtures still resolve to the same CV from Postgres: `renders the same en/ro CV from Postgres as from the fixtures` passes, since `toEqual` ignores the undefined cover and PDF, and `body` resolves to `""` on both sides).

Run: `rtk proxy pnpm typecheck`, then `rtk proxy pnpm lint`
Expected: `✓ Types generated successfully`, no TypeScript errors; `No fixes applied.`

- [ ] **Step 5: Commit**

```bash
/usr/bin/git add src/content src/server/queries "src/app/admin/(panel)/projects/page.tsx" tests/db
/usr/bin/git commit -m "feat(content): add covers, case studies and cv pdf"
```

---

### Task 2: A page per project

**Owner:** frontend-engineer (page, components, header); the admin e2e touches the admin only through its forms.

**Files:**
- Create: `src/app/[locale]/projects/[slug]/page.tsx`, `src/lib/project-pages.ts`, `src/components/projects/{ProjectCover,CaseStudy,ProjectLinks,ProjectNav}.tsx`, `src/components/ui/OptimizedImage.tsx`, `src/components/site/PageShell.tsx`
- Modify: `src/lib/seo.ts`, `src/app/sitemap.ts`, `next.config.ts`, `messages/en.json`, `messages/ro.json`, `src/components/site/{SiteHeader,LocaleSwitcher}.tsx`, `src/app/[locale]/{layout,page,not-found}.tsx`, `src/app/globals.css`
- Test: `tests/unit/{project-pages,optimized-image}.test.ts` (new), `tests/unit/seo.test.ts`, `tests/e2e/projects.spec.ts` (new), `tests/e2e/{admin-projects,budgets}.spec.ts`

**Interfaces:**
- Consumes: Task 1's `Cv["projects"][number]` (`cover`, `body`), `getCv(locale)`, `localeUrl`, `languageAlternates(siteUrl, pathname)`, `serializeJsonLd`, `fallbackLang`.
- Produces:
  - `src/lib/project-pages.ts`: `type Project = Cv["projects"][number]`; `NO_PROJECT = "_"`; `staticProjectParams(cv): { slug: string }[]` (never empty); `findProject(cv, slug): Project | undefined`; `neighbours(cv, slug): { previous: Project | null; next: Project | null }` (grid order, no wrap).
  - `src/lib/seo.ts`: `projectPath(slug) => "/projects/<slug>"`; `buildSitemap(siteUrl, projectSlugs = [])` (homes, then every project in both locales, each with its own alternates); `projectJsonLd(cv, project, siteUrl)` (`CreativeWork`, author = the home page's `Person` by `@id`, absolute `image`, `sameAs` = live and source links).
  - `OptimizedImage(props)` / `optimizedImageProps(props)`: next/image's `getImageProps()` output as a plain server-rendered `<img>` (see Verified facts: importing anything from `"next/image"` ships its client component); `preload` adds `<link rel="preload" as="image">` through `react-dom`'s `preload`.
  - `ProjectCover({ cover, locale, sizes, preload? })` (16:10 frame, LQIP behind), `CaseStudy({ markdown })`, `ProjectLinks({ project })` (raised above a card's stretched link, 44 px tall), `ProjectNav({ locale, previous, next })`.
  - `PageShell({ cv, path, children })`: the page's `SiteHeader` and `<main id="main">`; `path` is the page below the locale (`"/"` home, `/projects/<slug>`, `null` for a 404). `SiteHeader({ cv, path })`: section links are `#about` on the home page and `next/link`s to `/<locale>#about` elsewhere; `LocaleSwitcher({ locale, path })` keeps the page.
  - Messages: `Project.{back,role,outcome,stack,links,caseStudy,more,previous,next,title}`.
  - DOM: `article[aria-labelledby="project-title"]`, `nav[aria-label="More work"]`, `.case-study`, `.project-backdrop`.

The header used to live in the locale layout. Reading the page there needs `useSelectedLayoutSegment()` or `usePathname()`, which suspend while Cache Components prerenders (see Verified facts): the static HTML then carries a fallback header and the real one arrives in a streamed `<template>` that React reveals up to 300 ms later, so `/en`'s section links read `/en#about` for a moment and `header-footer.spec.ts` turned flaky. With `PageShell` every page renders its own header in the static HTML, and the header needs no client JavaScript.

- [ ] **Step 1: Write the failing tests**

`tests/unit/project-pages.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { fixtures } from "@/content/fixtures";
import { resolveCv } from "@/content/resolve-cv";
import {
  NO_PROJECT,
  neighbours,
  staticProjectParams,
} from "@/lib/project-pages";

const cv = resolveCv(fixtures, "en");

describe("staticProjectParams", () => {
  it("prerenders every published project", () => {
    expect(staticProjectParams(cv)).toEqual([
      { slug: "ledger-lens" },
      { slug: "tramline" },
      { slug: "atelier-cms" },
      { slug: "pulse-check" },
    ]);
  });

  it("still gives the build one param when nothing is published", () => {
    // Cache Components refuses an empty generateStaticParams; the placeholder
    // is not a valid slug, so its page is a 404 and never a real project.
    expect(staticProjectParams({ ...cv, projects: [] })).toEqual([
      { slug: NO_PROJECT },
    ]);
    expect(NO_PROJECT).not.toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });
});

describe("neighbours", () => {
  const slugs = (pair: ReturnType<typeof neighbours>) => ({
    previous: pair.previous?.slug ?? null,
    next: pair.next?.slug ?? null,
  });

  it("follows the order of the Projects grid", () => {
    expect(slugs(neighbours(cv, "tramline"))).toEqual({
      previous: "ledger-lens",
      next: "atelier-cms",
    });
  });

  it("has no previous project first and no next project last", () => {
    expect(slugs(neighbours(cv, "ledger-lens")).previous).toBeNull();
    expect(slugs(neighbours(cv, "pulse-check")).next).toBeNull();
  });

  it("knows nothing about a slug that is not published", () => {
    expect(slugs(neighbours(cv, "draft-project"))).toEqual({
      previous: null,
      next: null,
    });
  });
});
```

`tests/unit/seo.test.ts`:

```diff
diff --git a/tests/unit/seo.test.ts b/tests/unit/seo.test.ts
index 391a2e6..9b05937 100644
--- a/tests/unit/seo.test.ts
+++ b/tests/unit/seo.test.ts
@@ -7,6 +7,8 @@ import {
   languageAlternates,
   localeUrl,
   personJsonLd,
+  projectJsonLd,
+  projectPath,
   resolveSiteUrl,
   serializeJsonLd,
 } from "@/lib/seo";
@@ -67,6 +69,24 @@ describe("sitemap and robots", () => {
     }
   });
 
+  it("adds every project page in both languages with its own alternates", () => {
+    const sitemap = buildSitemap(SITE, ["ledger-lens", "tramline"]);
+
+    expect(sitemap.map((entry) => entry.url)).toEqual([
+      "https://cv.example.dev/en",
+      "https://cv.example.dev/ro",
+      "https://cv.example.dev/en/projects/ledger-lens",
+      "https://cv.example.dev/ro/projects/ledger-lens",
+      "https://cv.example.dev/en/projects/tramline",
+      "https://cv.example.dev/ro/projects/tramline",
+    ]);
+    expect(sitemap[2].alternates?.languages).toEqual({
+      en: "https://cv.example.dev/en/projects/ledger-lens",
+      ro: "https://cv.example.dev/ro/projects/ledger-lens",
+      "x-default": "https://cv.example.dev/projects/ledger-lens",
+    });
+  });
+
   it("allows crawling and points at the sitemap", () => {
     expect(buildRobots(SITE)).toEqual({
       rules: { userAgent: "*", allow: "/" },
@@ -110,6 +130,55 @@ describe("personJsonLd", () => {
   });
 });
 
+describe("projectJsonLd", () => {
+  it("describes a project page as a creative work by the person", () => {
+    const cv = resolveCv(fixtures, "ro");
+    const ledger = cv.projects[0];
+
+    expect(projectPath(ledger.slug)).toBe("/projects/ledger-lens");
+    expect(projectJsonLd(cv, ledger, SITE)).toEqual({
+      "@context": "https://schema.org",
+      "@type": "CreativeWork",
+      "@id": "https://cv.example.dev/ro/projects/ledger-lens#work",
+      name: "Ledger Lens",
+      description:
+        "Panou de reconciliere care potrivește extrasele bancare cu facturile pentru firme mici de contabilitate.",
+      url: "https://cv.example.dev/ro/projects/ledger-lens",
+      inLanguage: "ro",
+      dateCreated: "2025",
+      author: {
+        "@type": "Person",
+        "@id": "https://cv.example.dev/#person",
+        name: "Alex Marin",
+      },
+      keywords: "Next.js, PostgreSQL, Drizzle ORM, Vitest and Playwright",
+      sameAs: [
+        "https://example.com/ledger-lens",
+        "https://example.com/ledger-lens/source",
+      ],
+    });
+  });
+
+  it("points at the cover with an absolute URL", () => {
+    const cv = resolveCv(fixtures, "en");
+    const cover = {
+      url: "/api/media/0b4c3f7e-2c1a-4f6e-9d55-5b7c6f1e2a90.webp",
+      width: 1600,
+      height: 1000,
+      lqip: null,
+      alt: { value: "Board", lang: "en" as const },
+    };
+
+    expect(projectJsonLd(cv, { ...cv.projects[1], cover }, SITE)).toMatchObject(
+      {
+        image:
+          "https://cv.example.dev/api/media/0b4c3f7e-2c1a-4f6e-9d55-5b7c6f1e2a90.webp",
+        sameAs: ["https://example.com/tramline"],
+      },
+    );
+  });
+});
+
 describe("serializeJsonLd", () => {
   it("cannot be used to close the script tag", () => {
     const json = serializeJsonLd({
```

`tests/unit/optimized-image.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { optimizedImageProps } from "@/components/ui/OptimizedImage";

describe("optimizedImageProps", () => {
  // Deep imports of next's image internals: this fails first if a Next
  // upgrade moves them.
  it("points a media library upload at the image optimizer", () => {
    const image = optimizedImageProps({
      src: "/api/media/0b4c3f7e-2c1a-4f6e-9d55-5b7c6f1e2a90.webp",
      alt: "Headshot",
      width: 112,
      height: 112,
      sizes: "56px",
    });

    expect(image.src).toMatch(
      /^\/_next\/image\?url=%2Fapi%2Fmedia%2F0b4c3f7e-2c1a-4f6e-9d55-5b7c6f1e2a90\.webp&w=\d+&q=75$/,
    );
    expect(image.srcSet?.split(", ").length).toBeGreaterThan(3);
    expect(image.loading).toBe("lazy");
  });

  it("loads a preloaded image at once", () => {
    const image = optimizedImageProps({
      src: "/api/media/0b4c3f7e-2c1a-4f6e-9d55-5b7c6f1e2a90.webp",
      alt: "",
      fill: true,
      sizes: "100vw",
      preload: true,
    });

    expect(image.loading).toBeUndefined();
    expect(image.style).toMatchObject({ position: "absolute", width: "100%" });
  });
});
```

`tests/e2e/projects.spec.ts`:

```ts
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const ORIGIN = "http://localhost:3100";

test("a project has a page of its own in each language", async ({ page }) => {
  const response = await page.goto("/en/projects/ledger-lens");

  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle("Ledger Lens · Alex Marin");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Ledger Lens",
  );
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    /^Reconciliation dashboard/,
  );
  const project = page.getByRole("article");
  await expect(
    project.getByText("Month-end close went from three days to one."),
  ).toBeVisible();
  await expect(
    project.getByRole("listitem").filter({ hasText: "PostgreSQL" }),
  ).toBeVisible();
  await expect(
    project.getByRole("link", { name: "Live site: Ledger Lens" }),
  ).toHaveAttribute("href", "https://example.com/ledger-lens");

  await page.goto("/ro/projects/ledger-lens");
  await expect(page.locator("html")).toHaveAttribute("lang", "ro");
  await expect(
    page.getByText("Închiderea de lună a scăzut de la trei zile la una."),
  ).toBeVisible();
});

test("declares canonical, hreflang and a CreativeWork", async ({ page }) => {
  await page.goto("/ro/projects/tramline");

  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    `${ORIGIN}/ro/projects/tramline`,
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
    ["en", `${ORIGIN}/en/projects/tramline`],
    ["ro", `${ORIGIN}/ro/projects/tramline`],
    ["x-default", `${ORIGIN}/projects/tramline`],
  ]);
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute(
    "content",
    "article",
  );
  const json = await page
    .locator('script[type="application/ld+json"]')
    .textContent();
  expect(JSON.parse(json ?? "{}")).toMatchObject({
    "@type": "CreativeWork",
    name: "Tramline",
    url: `${ORIGIN}/ro/projects/tramline`,
    author: { "@id": `${ORIGIN}/#person` },
  });
});

test("drafts and unknown slugs are not found", async ({ page }) => {
  for (const path of [
    "/en/projects/draft-project",
    "/en/projects/no-such-project",
    "/ro/projects/_",
  ]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(404);
  }
});

test("walks the projects in grid order and back to the grid", async ({
  page,
}) => {
  await page.goto("/en/projects/tramline");
  const more = page.getByRole("navigation", { name: "More work" });

  await expect(
    more.getByRole("link", { name: /Previous.*Ledger Lens/ }),
  ).toHaveAttribute("href", "/en/projects/ledger-lens");
  await expect(
    more.getByRole("link", { name: /Next.*Atelier CMS/ }),
  ).toHaveAttribute("href", "/en/projects/atelier-cms");
  await expect(page.getByRole("link", { name: "All work" })).toHaveAttribute(
    "href",
    "/en#projects",
  );

  await page.goto("/en/projects/ledger-lens");
  await expect(more.getByRole("link", { name: /Previous/ })).toHaveCount(0);
});

test("the header leads back to the home page sections and keeps the project across languages", async ({
  page,
}) => {
  await page.goto("/en/projects/atelier-cms");

  const hrefs = await page
    .getByRole("navigation", { name: "Sections" })
    .getByRole("link")
    .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  expect(hrefs).toEqual([
    "/en#about",
    "/en#skills",
    "/en#experience",
    "/en#projects",
    "/en#contact",
  ]);

  await page
    .getByRole("navigation", { name: "Language" })
    .getByRole("link", { name: "Română" })
    .click();
  await expect(page).toHaveURL("/ro/projects/atelier-cms");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Atelier CMS",
  );
});

test("the sitemap lists every project in both languages", async ({
  request,
}) => {
  const body = await (await request.get("/sitemap.xml")).text();

  for (const slug of [
    "ledger-lens",
    "tramline",
    "atelier-cms",
    "pulse-check",
  ]) {
    expect(body).toContain(`<loc>${ORIGIN}/en/projects/${slug}</loc>`);
    expect(body).toContain(`<loc>${ORIGIN}/ro/projects/${slug}</loc>`);
  }
  expect(body).not.toContain("draft-project");
});

for (const viewport of [
  { name: "desktop", width: 1280, height: 800 },
  { name: "phone", width: 390, height: 844 },
] as const) {
  test(`a project page has no axe violations (${viewport.name})`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/ro/projects/ledger-lens");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Ledger Lens",
    );

    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(
      violations.map((v) => ({
        id: v.id,
        targets: v.nodes.map((node) => node.target.join(" ")),
      })),
    ).toEqual([]);
  });
}

test("a project page never scrolls sideways on a 320px phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/ro/projects/atelier-cms");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Atelier CMS",
  );

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
```

`tests/e2e/admin-projects.spec.ts` (a project with a cover, a case study and links, created, checked, edited and deleted through the admin):

```diff
diff --git a/tests/e2e/admin-projects.spec.ts b/tests/e2e/admin-projects.spec.ts
index 1783b9d..fc0783d 100644
--- a/tests/e2e/admin-projects.spec.ts
+++ b/tests/e2e/admin-projects.spec.ts
@@ -1,5 +1,6 @@
 import AxeBuilder from "@axe-core/playwright";
-import { expect, test } from "@playwright/test";
+import { expect, type Page, test } from "@playwright/test";
+import sharp from "sharp";
 import { signInAsOwner } from "./admin-login";
 
 test.beforeEach(async ({ page }) => {
@@ -39,6 +40,135 @@ test("a project is created with a markdown preview and published", async ({
   await expect(page).toHaveURL("/admin/projects");
 });
 
+/** Uploads a 1600x1000 PNG to the media library under `alt`. */
+async function uploadCover(page: Page, alt: { en: string; ro: string }) {
+  await page.goto("/admin/media");
+  const buffer = await sharp({
+    create: { width: 1600, height: 1000, channels: 3, background: "#27496d" },
+  })
+    .png()
+    .toBuffer();
+  await page.getByLabel(/^File/).setInputFiles({
+    name: "cover.png",
+    mimeType: "image/png",
+    buffer,
+  });
+  await page.getByLabel("Alt text (EN)", { exact: true }).fill(alt.en);
+  await page.getByLabel("Alt text (RO)", { exact: true }).fill(alt.ro);
+  await page.getByRole("button", { name: "Upload" }).click();
+  await expect(page.getByRole("status").first()).toHaveText("Uploaded.");
+}
+
+test("a cover, a case study and links from the admin reach the project page", async ({
+  page,
+  request,
+}) => {
+  await uploadCover(page, {
+    en: "The pass planner at dawn",
+    ro: "Planificatorul de treceri în zori",
+  });
+
+  await page.goto("/admin/projects/new");
+  await page.getByLabel("Slug").fill("pass-planner");
+  await page.getByLabel("Year").fill("2026");
+  await page.getByLabel("Live URL").fill("https://example.com/pass-planner");
+  await page
+    .getByLabel("Source URL")
+    .fill("https://example.com/pass-planner/source");
+  await page
+    .getByLabel("Cover image")
+    .selectOption({ label: "The pass planner at dawn" });
+  await page.getByLabel("Title (EN)").fill("Pass Planner");
+  await page.getByLabel("Summary (EN)").fill("Plans satellite passes.");
+  await page.getByLabel("Role (EN)").fill("Lead developer");
+  await page.getByLabel("Outcome (EN)").fill("Hours became minutes.");
+  await page
+    .getByLabel("Case study (EN)")
+    .fill(
+      [
+        "## Why",
+        "",
+        "Planners worked **by hand**. See [the docs](https://example.com/docs).",
+        "",
+        "[Click me](javascript:alert(1))",
+        "",
+        "<script>alert(1)</script><b>raw</b>",
+      ].join("\n"),
+    );
+  await page.getByLabel("Published").check();
+  await page.getByRole("button", { name: "Add project" }).click();
+  await expect(page).toHaveURL("/admin/projects/pass-planner");
+
+  await page.goto("/en/projects/pass-planner");
+  const project = page.getByRole("article");
+  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
+    "Pass Planner",
+  );
+  const cover = project.getByRole("img", { name: "The pass planner at dawn" });
+  await expect(cover).toBeVisible();
+  await expect
+    .poll(() =>
+      cover.evaluate((img: HTMLImageElement) =>
+        img.complete ? img.naturalWidth : 0,
+      ),
+    )
+    .toBeGreaterThan(0);
+  expect(await cover.getAttribute("src")).toContain(
+    "/_next/image?url=%2Fapi%2Fmedia%2F",
+  );
+  await expect(
+    project.getByRole("heading", { level: 2, name: "Why" }),
+  ).toBeVisible();
+  await expect(project.locator("strong")).toHaveText("by hand");
+  await expect(project.getByRole("link", { name: "the docs" })).toHaveAttribute(
+    "href",
+    "https://example.com/docs",
+  );
+  expect(
+    await project
+      .getByText("Click me")
+      .evaluate((node) => node.closest("a")?.getAttribute("href") ?? ""),
+  ).not.toContain("javascript");
+  await expect(project.locator("script, b")).toHaveCount(0);
+  await expect(project).not.toContainText("raw");
+  await expect(
+    project.getByRole("link", { name: "Live site: Pass Planner" }),
+  ).toHaveAttribute("href", "https://example.com/pass-planner");
+  await expect(
+    project.getByRole("link", { name: "Source code: Pass Planner" }),
+  ).toHaveAttribute("href", "https://example.com/pass-planner/source");
+
+  await page.goto("/ro/projects/pass-planner");
+  await expect(
+    page.getByRole("img", { name: "Planificatorul de treceri în zori" }),
+  ).toBeVisible();
+  expect(await (await request.get("/sitemap.xml")).text()).toContain(
+    "/en/projects/pass-planner</loc>",
+  );
+
+  // Editing it in the admin expires the cached page (updateTag).
+  await page.goto("/admin/projects/pass-planner");
+  await page.getByLabel("Title (EN)").fill("Pass Planner 2");
+  await page.getByRole("button", { name: "Save project" }).click();
+  await expect(page.getByRole("status").first()).toHaveText("Project saved.");
+  await page.goto("/en/projects/pass-planner");
+  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
+    "Pass Planner 2",
+  );
+
+  page.once("dialog", (dialog) => dialog.accept());
+  await page.goto("/admin/projects/pass-planner");
+  await page.getByRole("button", { name: "Delete" }).click();
+  await expect(page).toHaveURL("/admin/projects");
+  await page.goto("/admin/media");
+  page.once("dialog", (dialog) => dialog.accept());
+  await page
+    .getByRole("button", { name: /^Delete / })
+    .first()
+    .click();
+  expect((await page.goto("/en/projects/pass-planner"))?.status()).toBe(404);
+});
+
 const PATHS = [
   "/admin/projects",
   "/admin/projects/new",
```

`tests/e2e/budgets.spec.ts` (the project page gets the same 160 KB gz budget, and a 404 cannot pass for a page):

```diff
diff --git a/tests/e2e/budgets.spec.ts b/tests/e2e/budgets.spec.ts
index 07cbf81..866a5f7 100644
--- a/tests/e2e/budgets.spec.ts
+++ b/tests/e2e/budgets.spec.ts
@@ -11,14 +11,16 @@ const TIER3_BUDGET_KB = 100;
 const gzKb = (body: Buffer) => gzipSync(body, { level: 9 }).length / 1024;
 
 async function initialScripts(page: Page, path: string): Promise<string[]> {
-  const html = await (await page.request.get(path)).text();
+  const response = await page.request.get(path);
+  expect(response.status(), path).toBe(200);
+  const html = await response.text();
   return [...html.matchAll(/<script[^>]*>/g)]
     .map((match) => match[0])
     .filter((tag) => !tag.includes("noModule"))
     .flatMap((tag) => /\ssrc="([^"]+)"/.exec(tag)?.[1] ?? []);
 }
 
-for (const path of ["/en", "/ro"]) {
+for (const path of ["/en", "/ro", "/en/projects/ledger-lens"]) {
   test(`${path} loads at most ${INITIAL_BUDGET_KB} KB gz of JS before 3D`, async ({
     page,
   }) => {
```

- [ ] **Step 2: Run them to see them fail**

Run: `rtk proxy pnpm exec vitest run tests/unit/project-pages.test.ts tests/unit/seo.test.ts tests/unit/optimized-image.test.ts`
Expected: `Test Files  3 failed (3)`, `Tests  3 failed | 11 passed (14)`: `Cannot find package '@/lib/project-pages'` and `'@/components/ui/OptimizedImage'`, `projectPath is not a function`, `projectJsonLd is not a function`, and the sitemap still lists only the two home pages

Run: `pnpm exec playwright test tests/e2e/projects.spec.ts tests/e2e/budgets.spec.ts --project=public`
Expected: `9 failed`, `5 passed`: every page test in `projects.spec.ts` (no route yet: 404 pages without the title or links) and `/en/projects/ledger-lens loads at most 160 KB gz of JS before 3D` (status 404); `drafts and unknown slugs are not found` passes already; `/en: 149.9 KB gz before 3D`

- [ ] **Step 3: Pure helpers, sitemap, image options and strings**

`src/lib/project-pages.ts`:

```ts
import type { Cv } from "@/content/types";

export type Project = Cv["projects"][number];

/**
 * Stand-in slug for a build with no published project: Cache Components
 * refuses an empty `generateStaticParams`. It can never be a real slug (the
 * admin only accepts lowercase letters, digits and dashes), so its page is a
 * 404.
 */
export const NO_PROJECT = "_";

/** Every published project gets a prerendered page. */
export function staticProjectParams(cv: Cv): { slug: string }[] {
  const params = cv.projects.map(({ slug }) => ({ slug }));
  return params.length > 0 ? params : [{ slug: NO_PROJECT }];
}

export function findProject(cv: Cv, slug: string): Project | undefined {
  return cv.projects.find((project) => project.slug === slug);
}

/** The projects before and after `slug` in the order of the Projects grid. */
export function neighbours(
  cv: Cv,
  slug: string,
): { previous: Project | null; next: Project | null } {
  const index = cv.projects.findIndex((project) => project.slug === slug);
  if (index === -1) {
    return { previous: null, next: null };
  }
  return {
    previous: cv.projects[index - 1] ?? null,
    next: cv.projects[index + 1] ?? null,
  };
}
```

`src/lib/seo.ts`:

```diff
diff --git a/src/lib/seo.ts b/src/lib/seo.ts
index af6169e..3be47fd 100644
--- a/src/lib/seo.ts
+++ b/src/lib/seo.ts
@@ -43,13 +43,31 @@ export function languageAlternates(
   };
 }
 
-export function buildSitemap(siteUrl: string): MetadataRoute.Sitemap {
-  return routing.locales.map((locale) => ({
-    url: localeUrl(siteUrl, locale),
-    changeFrequency: "monthly",
-    priority: 1,
-    alternates: { languages: languageAlternates(siteUrl) },
-  }));
+/** Path of a project's case study page, below the locale. */
+export function projectPath(slug: string): string {
+  return `/projects/${slug}`;
+}
+
+/** Both locale homes, then every published project in both locales. */
+export function buildSitemap(
+  siteUrl: string,
+  projectSlugs: readonly string[] = [],
+): MetadataRoute.Sitemap {
+  const pages = [
+    { pathname: "/", priority: 1 },
+    ...projectSlugs.map((slug) => ({
+      pathname: projectPath(slug),
+      priority: 0.7,
+    })),
+  ];
+  return pages.flatMap(({ pathname, priority }) =>
+    routing.locales.map((locale) => ({
+      url: localeUrl(siteUrl, locale, pathname),
+      changeFrequency: "monthly" as const,
+      priority,
+      alternates: { languages: languageAlternates(siteUrl, pathname) },
+    })),
+  );
 }
 
 export function buildRobots(siteUrl: string): MetadataRoute.Robots {
@@ -91,6 +109,39 @@ export function personJsonLd(cv: Cv, siteUrl: string) {
   };
 }
 
+/** schema.org `CreativeWork` for a project page, authored by the home page's Person. */
+export function projectJsonLd(
+  cv: Cv,
+  project: Cv["projects"][number],
+  siteUrl: string,
+) {
+  const url = localeUrl(siteUrl, cv.locale, projectPath(project.slug));
+  const links = [project.liveUrl, project.repoUrl].filter(
+    (link): link is string => Boolean(link),
+  );
+
+  return {
+    "@context": "https://schema.org",
+    "@type": "CreativeWork",
+    "@id": `${url}#work`,
+    name: project.title.value,
+    description: project.summary.value,
+    url,
+    inLanguage: cv.locale,
+    dateCreated: String(project.year),
+    author: {
+      "@type": "Person",
+      "@id": `${siteUrl}/#person`,
+      name: cv.profile.fullName.value,
+    },
+    keywords: project.skills.join(", "),
+    ...(project.cover
+      ? { image: new URL(project.cover.url, siteUrl).href }
+      : {}),
+    ...(links.length > 0 ? { sameAs: links } : {}),
+  };
+}
+
 /** JSON for an inline `<script type="application/ld+json">`; `<` is escaped so content cannot close the tag. */
 export function serializeJsonLd(data: unknown): string {
   return JSON.stringify(data).replace(/</g, "\\u003c");
```

`src/app/sitemap.ts` (the sitemap reads `getCv`, so it is cached under the `cv` tag and refreshed by the admin like the pages):

```diff
diff --git a/src/app/sitemap.ts b/src/app/sitemap.ts
index b186d5d..9f7cc57 100644
--- a/src/app/sitemap.ts
+++ b/src/app/sitemap.ts
@@ -1,7 +1,13 @@
 import type { MetadataRoute } from "next";
+import { getCv } from "@/content/get-cv";
 import { buildSitemap } from "@/lib/seo";
 import { siteUrl } from "@/site";
 
-export default function sitemap(): MetadataRoute.Sitemap {
-  return buildSitemap(siteUrl);
+export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
+  // Slugs are the same in every locale; getCv is cached under the CV tag.
+  const { projects } = await getCv("en");
+  return buildSitemap(
+    siteUrl,
+    projects.map((project) => project.slug),
+  );
 }
```

`next.config.ts`:

```diff
diff --git a/next.config.ts b/next.config.ts
index 142b61b..a7785c6 100644
--- a/next.config.ts
+++ b/next.config.ts
@@ -20,6 +20,11 @@ const nextConfig: NextConfig = {
       },
     ];
   },
+  images: {
+    // Covers and portraits from the media library (local store). Vercel Blob
+    // URLs join as remotePatterns when production storage is set up (M9).
+    localPatterns: [{ pathname: "/api/media/**", search: "" }],
+  },
   experimental: {
     serverActions: {
       // Admin uploads are capped at 4 MB (src/server/media/inspect.ts) plus
```

`messages/en.json` and `messages/ro.json`:

```diff
diff --git a/messages/en.json b/messages/en.json
index 8f99a54..a2feff8 100644
--- a/messages/en.json
+++ b/messages/en.json
@@ -68,6 +68,18 @@
     "liveLabel": "Live site: {title}",
     "sourceLabel": "Source code: {title}"
   },
+  "Project": {
+    "back": "All work",
+    "role": "Role",
+    "outcome": "Outcome",
+    "stack": "Stack",
+    "links": "Links",
+    "caseStudy": "Case study",
+    "more": "More work",
+    "previous": "Previous",
+    "next": "Next",
+    "title": "{title} · {name}"
+  },
   "Contact": {
     "title": "Let's build",
     "intro": "Tell me about the product you are building. I reply within two working days.",
```

```diff
diff --git a/messages/ro.json b/messages/ro.json
index 74c7772..b2100d5 100644
--- a/messages/ro.json
+++ b/messages/ro.json
@@ -68,6 +68,18 @@
     "liveLabel": "Site live: {title}",
     "sourceLabel": "Cod sursă: {title}"
   },
+  "Project": {
+    "back": "Toate proiectele",
+    "role": "Rol",
+    "outcome": "Rezultat",
+    "stack": "Tehnologii",
+    "links": "Linkuri",
+    "caseStudy": "Studiu de caz",
+    "more": "Alte proiecte",
+    "previous": "Anteriorul",
+    "next": "Următorul",
+    "title": "{title} · {name}"
+  },
   "Contact": {
     "title": "Hai să construim",
     "intro": "Spune-mi despre produsul la care lucrezi. Răspund în două zile lucrătoare.",
```

- [ ] **Step 4: The image, markdown, links and neighbours components**

`src/components/ui/OptimizedImage.tsx`:

```tsx
import {
  getImgProps,
  type ImageProps,
} from "next/dist/shared/lib/get-img-props";
import type { ImageConfigComplete } from "next/dist/shared/lib/image-config";
import defaultLoader from "next/dist/shared/lib/image-loader";
import { preload } from "react-dom";

/**
 * next/image's `getImageProps()`, minus its import of next/image's client
 * component: importing anything from "next/image" makes the page ship that
 * component (5.5 KB gz on /en), even when only the server calls it. The
 * image options are the ones `next build` inlines for next/image itself.
 */
export function optimizedImageProps(props: ImageProps) {
  const { props: image } = getImgProps(props, {
    defaultLoader,
    imgConf: process.env.__NEXT_IMAGE_OPTS as unknown as ImageConfigComplete,
  });
  return image;
}

/**
 * A plain <img> with next/image's resized `srcset`, rendered on the server.
 * No blur placeholder (it would never be removed; callers put the LQIP
 * behind the image). `preload` also adds a <link rel="preload"> to <head>.
 */
export function OptimizedImage(
  props: Omit<ImageProps, "placeholder" | "blurDataURL">,
) {
  const image = optimizedImageProps(props);
  if (props.preload) {
    preload(image.src, {
      as: "image",
      imageSrcSet: image.srcSet,
      imageSizes: image.sizes,
      fetchPriority: "high",
    });
  }
  return (
    // biome-ignore lint/performance/noImgElement: next/image's srcset without its client component (see above).
    <img
      {...image}
      alt={image.alt}
      fetchPriority={props.preload ? "high" : image.fetchPriority}
    />
  );
}
```

`src/components/projects/ProjectCover.tsx`:

```tsx
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { fallbackLang } from "@/content/localize";
import type { MediaImage } from "@/content/types";
import type { Locale } from "@/i18n/routing";

/**
 * A project's cover from the media library, resized by next/image (the
 * uploads can be up to 4 MB; next.config.ts allows `/api/media/**` only).
 * Always a 16:10 frame, so the grid card and the project page crop alike;
 * the upload's tiny blurred preview shows behind it while it loads.
 */
export function ProjectCover({
  cover,
  locale,
  sizes,
  preload = false,
}: {
  cover: MediaImage;
  locale: Locale;
  sizes: string;
  /** The page's LCP image: preloaded, never lazy. */
  preload?: boolean;
}) {
  return (
    <div
      className="relative aspect-[16/10] overflow-hidden bg-raised bg-cover bg-center"
      style={cover.lqip ? { backgroundImage: `url(${cover.lqip})` } : undefined}
    >
      <OptimizedImage
        src={cover.url}
        alt={cover.alt.value}
        lang={fallbackLang(cover.alt, locale)}
        fill
        sizes={sizes}
        preload={preload}
        className="object-cover"
      />
    </div>
  );
}
```

`src/components/projects/CaseStudy.tsx`:

```tsx
import Markdown from "react-markdown";

/**
 * A project's case study, written in markdown in the admin. Raw HTML is
 * dropped (`skipHtml`), react-markdown's default URL filter keeps only
 * http(s), mailto and relative links, and images are left out: the cover is
 * the project's image. The page's h1 is the project title, so a `#` heading
 * renders as h2.
 */
export function CaseStudy({ markdown }: { markdown: string }) {
  return (
    <div className="case-study">
      <Markdown skipHtml disallowedElements={["img"]} components={{ h1: "h2" }}>
        {markdown}
      </Markdown>
    </div>
  );
}
```

`src/components/projects/ProjectLinks.tsx`:

```tsx
import { useTranslations } from "next-intl";
import type { Project } from "@/lib/project-pages";

/** "Live site" and "Source code", named after the project for screen readers. */
export function ProjectLinks({ project }: { project: Project }) {
  const t = useTranslations("Projects");
  const title = project.title.value;

  if (!project.liveUrl && !project.repoUrl) {
    return null;
  }
  return (
    <div className="flex flex-wrap gap-x-6 text-sm font-medium">
      {project.liveUrl ? (
        <a
          href={project.liveUrl}
          aria-label={t("liveLabel", { title })}
          className="inline-flex min-h-11 items-center text-signal underline-offset-4 hover:underline"
        >
          {t("live")}
        </a>
      ) : null}
      {project.repoUrl ? (
        <a
          href={project.repoUrl}
          aria-label={t("sourceLabel", { title })}
          className="inline-flex min-h-11 items-center text-signal underline-offset-4 hover:underline"
        >
          {t("source")}
        </a>
      ) : null}
    </div>
  );
}
```

`src/components/projects/ProjectNav.tsx`:

```tsx
import Link from "next/link";
import { useTranslations } from "next-intl";
import { fallbackLang } from "@/content/localize";
import type { Locale } from "@/i18n/routing";
import type { Project } from "@/lib/project-pages";
import { projectPath } from "@/lib/seo";

/** Previous and next project, in the order of the Projects grid. */
export function ProjectNav({
  locale,
  previous,
  next,
}: {
  locale: Locale;
  previous: Project | null;
  next: Project | null;
}) {
  const t = useTranslations("Project");

  if (!previous && !next) {
    return null;
  }
  const card =
    "flex min-h-24 flex-col justify-center gap-1 rounded-panel bg-surface p-6 ring-1 ring-line transition-colors hover:bg-raised";
  return (
    <nav
      aria-label={t("more")}
      className="relative mx-auto w-full max-w-content px-gutter pt-24 pb-section"
    >
      <ul className="grid gap-4 sm:grid-cols-2">
        {previous ? (
          <li>
            <Link
              href={`/${locale}${projectPath(previous.slug)}`}
              className={card}
            >
              <span className="font-mono text-label uppercase text-ink-subtle">
                <span aria-hidden="true">← </span>
                {t("previous")}
              </span>
              <span
                lang={fallbackLang(previous.title, locale)}
                className="text-heading text-ink"
              >
                {previous.title.value}
              </span>
            </Link>
          </li>
        ) : null}
        {next ? (
          <li className="sm:col-start-2">
            <Link
              href={`/${locale}${projectPath(next.slug)}`}
              className={`${card} sm:items-end sm:text-right`}
            >
              <span className="font-mono text-label uppercase text-ink-subtle">
                {t("next")}
                <span aria-hidden="true"> →</span>
              </span>
              <span
                lang={fallbackLang(next.title, locale)}
                className="text-heading text-ink"
              >
                {next.title.value}
              </span>
            </Link>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 5: Each page renders its own header and main**

`src/components/site/PageShell.tsx`:

```tsx
import type { ReactNode } from "react";
import type { Cv } from "@/content/types";
import { SiteHeader } from "./SiteHeader";

/**
 * The header and <main> of a page. Pages render it themselves (not the
 * locale layout) so the header knows which page it sits on without reading
 * the URL at runtime: the HTML stays fully static.
 */
export function PageShell({
  cv,
  path,
  children,
}: {
  cv: Cv;
  /** See SiteHeader: "/" for the home page, null for a 404. */
  path: string | null;
  children: ReactNode;
}) {
  return (
    <>
      <SiteHeader cv={cv} path={path} />
      <main id="main" tabIndex={-1} className="focus:outline-none">
        {children}
      </main>
    </>
  );
}
```

`src/components/site/SiteHeader.tsx`:

```diff
diff --git a/src/components/site/SiteHeader.tsx b/src/components/site/SiteHeader.tsx
index 777b154..9363937 100644
--- a/src/components/site/SiteHeader.tsx
+++ b/src/components/site/SiteHeader.tsx
@@ -1,3 +1,4 @@
+import Link from "next/link";
 import { useTranslations } from "next-intl";
 import type { Cv } from "@/content/types";
 import { MotionToggle } from "@/experience/MotionToggle";
@@ -11,9 +12,18 @@ const SECTIONS = [
   "contact",
 ] as const;
 
-export function SiteHeader({ cv }: { cv: Cv }) {
+/**
+ * Rendered by each page (PageShell), so it knows where it is: `path` is the
+ * page below the locale ("/" = the home page), or null for a page that exists
+ * in no other language (404). Section links jump within the home page and
+ * lead back to it from anywhere else.
+ */
+export function SiteHeader({ cv, path }: { cv: Cv; path: string | null }) {
   const t = useTranslations("Nav");
   const motion = useTranslations("Motion");
+  const home = path === "/";
+  const link =
+    "block rounded-full px-3 py-1.5 text-sm text-ink-muted transition-colors hover:bg-raised hover:text-ink";
 
   return (
     <header
@@ -30,12 +40,15 @@ export function SiteHeader({ cv }: { cv: Cv }) {
         <ul className="flex gap-1 rounded-full bg-surface p-1 ring-1 ring-line">
           {SECTIONS.map((id) => (
             <li key={id}>
-              <a
-                href={`#${id}`}
-                className="block rounded-full px-3 py-1.5 text-sm text-ink-muted transition-colors hover:bg-raised hover:text-ink"
-              >
-                {t(id)}
-              </a>
+              {home ? (
+                <a href={`#${id}`} className={link}>
+                  {t(id)}
+                </a>
+              ) : (
+                <Link href={`/${cv.locale}#${id}`} className={link}>
+                  {t(id)}
+                </Link>
+              )}
             </li>
           ))}
         </ul>
@@ -48,7 +61,7 @@ export function SiteHeader({ cv }: { cv: Cv }) {
             off: motion("off"),
           }}
         />
-        <LocaleSwitcher locale={cv.locale} />
+        <LocaleSwitcher locale={cv.locale} path={path ?? "/"} />
       </div>
     </header>
   );
```

`src/components/site/LocaleSwitcher.tsx`:

```diff
diff --git a/src/components/site/LocaleSwitcher.tsx b/src/components/site/LocaleSwitcher.tsx
index ef840d8..0904888 100644
--- a/src/components/site/LocaleSwitcher.tsx
+++ b/src/components/site/LocaleSwitcher.tsx
@@ -2,7 +2,15 @@ import { useTranslations } from "next-intl";
 import { Link } from "@/i18n/navigation";
 import { type Locale, routing } from "@/i18n/routing";
 
-export function LocaleSwitcher({ locale }: { locale: Locale }) {
+/** Links to the same page in every locale (a project stays the same project). */
+export function LocaleSwitcher({
+  locale,
+  path,
+}: {
+  locale: Locale;
+  /** The page below the locale, e.g. "/" or "/projects/tramline". */
+  path: string;
+}) {
   const t = useTranslations("LocaleSwitcher");
 
   return (
@@ -11,7 +19,7 @@ export function LocaleSwitcher({ locale }: { locale: Locale }) {
         {routing.locales.map((target) => (
           <li key={target}>
             <Link
-              href="/"
+              href={path}
               locale={target}
               lang={target}
               aria-current={target === locale ? "page" : undefined}
```

`src/app/[locale]/layout.tsx`, `src/app/[locale]/page.tsx`, `src/app/[locale]/not-found.tsx`:

```diff
diff --git a/src/app/[locale]/layout.tsx b/src/app/[locale]/layout.tsx
index ae4191f..50cddee 100644
--- a/src/app/[locale]/layout.tsx
+++ b/src/app/[locale]/layout.tsx
@@ -2,7 +2,6 @@ import type { Metadata, Viewport } from "next";
 import { NextIntlClientProvider } from "next-intl";
 import { getLocale, getTranslations } from "next-intl/server";
 import { SiteFooter } from "@/components/site/SiteFooter";
-import { SiteHeader } from "@/components/site/SiteHeader";
 import { getCv } from "@/content/get-cv";
 import { routing } from "@/i18n/routing";
 import { siteUrl } from "@/site";
@@ -49,10 +48,8 @@ export default async function LocaleLayout({
           {t("skipToContent")}
         </a>
         <NextIntlClientProvider>
-          <SiteHeader cv={cv} />
-          <main id="main" tabIndex={-1} className="focus:outline-none">
-            {children}
-          </main>
+          {/* Each page renders its own header and <main> (PageShell). */}
+          {children}
           <SiteFooter cv={cv} />
         </NextIntlClientProvider>
       </body>
```

```diff
diff --git a/src/app/[locale]/page.tsx b/src/app/[locale]/page.tsx
index a59e68a..0b337aa 100644
--- a/src/app/[locale]/page.tsx
+++ b/src/app/[locale]/page.tsx
@@ -6,6 +6,7 @@ import { Experience } from "@/components/sections/Experience";
 import { Hero } from "@/components/sections/Hero";
 import { Projects } from "@/components/sections/Projects";
 import { Skills } from "@/components/sections/Skills";
+import { PageShell } from "@/components/site/PageShell";
 import { getCv } from "@/content/get-cv";
 import { StageLoader } from "@/experience/StageLoader";
 import {
@@ -38,7 +39,7 @@ export default async function HomePage() {
   const cv = await getCv(await getLocale());
 
   return (
-    <>
+    <PageShell cv={cv} path="/">
       <script
         type="application/ld+json"
         // biome-ignore lint/security/noDangerouslySetInnerHtml: serializeJsonLd escapes "<", so content cannot close the tag.
@@ -53,6 +54,6 @@ export default async function HomePage() {
       <Experience cv={cv} />
       <Projects cv={cv} />
       <Contact cv={cv} />
-    </>
+    </PageShell>
   );
 }
```

```diff
diff --git a/src/app/[locale]/not-found.tsx b/src/app/[locale]/not-found.tsx
index d9f37b5..324ad88 100644
--- a/src/app/[locale]/not-found.tsx
+++ b/src/app/[locale]/not-found.tsx
@@ -1,12 +1,17 @@
-import { useTranslations } from "next-intl";
+import { getLocale, getTranslations } from "next-intl/server";
+import { PageShell } from "@/components/site/PageShell";
+import { getCv } from "@/content/get-cv";
 
-export default function LocaleNotFound() {
-  const t = useTranslations("NotFound");
+export default async function LocaleNotFound() {
+  const cv = await getCv(await getLocale());
+  const t = await getTranslations("NotFound");
 
   return (
-    <section className="mx-auto flex min-h-[60svh] w-full max-w-content flex-col justify-center gap-4 px-gutter py-section">
-      <h1 className="text-title text-ink">{t("title")}</h1>
-      <p className="text-lead text-ink-muted">{t("description")}</p>
-    </section>
+    <PageShell cv={cv} path={null}>
+      <section className="mx-auto flex min-h-[60svh] w-full max-w-content flex-col justify-center gap-4 px-gutter py-section">
+        <h1 className="text-title text-ink">{t("title")}</h1>
+        <p className="text-lead text-ink-muted">{t("description")}</p>
+      </section>
+    </PageShell>
   );
 }
```

- [ ] **Step 6: The project page and its styles**

`src/app/[locale]/projects/[slug]/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { CaseStudy } from "@/components/projects/CaseStudy";
import { ProjectCover } from "@/components/projects/ProjectCover";
import { ProjectLinks } from "@/components/projects/ProjectLinks";
import { ProjectNav } from "@/components/projects/ProjectNav";
import { PageShell } from "@/components/site/PageShell";
import { getCv } from "@/content/get-cv";
import { fallbackLang } from "@/content/localize";
import type { Localized } from "@/content/types";
import type { Locale } from "@/i18n/routing";
import {
  findProject,
  neighbours,
  staticProjectParams,
} from "@/lib/project-pages";
import {
  languageAlternates,
  localeUrl,
  projectJsonLd,
  projectPath,
  serializeJsonLd,
} from "@/lib/seo";
import { siteUrl } from "@/site";

export async function generateStaticParams({
  params,
}: {
  params: { locale: string };
}) {
  return staticProjectParams(await getCv(params.locale as Locale));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/projects/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const locale = await getLocale();
  const cv = await getCv(locale);
  const project = findProject(cv, slug);
  if (!project) {
    return {};
  }
  const t = await getTranslations("Project");
  const path = projectPath(slug);
  const url = localeUrl(siteUrl, locale, path);
  const title = t("title", {
    title: project.title.value,
    name: cv.profile.fullName.value,
  });

  return {
    title,
    description: project.summary.value,
    alternates: {
      canonical: url,
      languages: languageAlternates(siteUrl, path),
    },
    openGraph: {
      type: "article",
      url,
      siteName: cv.profile.fullName.value,
      title,
      description: project.summary.value,
      locale: locale === "ro" ? "ro_RO" : "en_US",
      ...(project.cover
        ? {
            images: [
              {
                url: new URL(project.cover.url, siteUrl).href,
                width: project.cover.width,
                height: project.cover.height,
                alt: project.cover.alt.value,
              },
            ],
          }
        : {}),
    },
  };
}

/**
 * A project's case study: title, facts and links, the cover, the markdown
 * body and the neighbouring projects. Static like the home page (one page
 * per published project and locale, cached under the CV tag); no 3D here.
 */
export default async function ProjectPage({
  params,
}: PageProps<"/[locale]/projects/[slug]">) {
  const { slug } = await params;
  const locale = await getLocale();
  const cv = await getCv(locale);
  const project = findProject(cv, slug);
  if (!project) {
    notFound();
  }
  const t = await getTranslations("Project");
  const { previous, next } = neighbours(cv, slug);
  const lang = (text: Localized<unknown>) => fallbackLang(text, locale);

  return (
    <PageShell cv={cv} path={projectPath(slug)}>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: serializeJsonLd escapes "<", so content cannot close the tag.
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(projectJsonLd(cv, project, siteUrl)),
        }}
      />
      <article aria-labelledby="project-title">
        <div aria-hidden="true" className="project-backdrop" />
        <header className="relative mx-auto w-full max-w-content px-gutter pt-36 md:pt-40">
          <Link
            href={`/${locale}#projects`}
            className="-ml-1 inline-flex min-h-11 items-center gap-2 px-1 font-mono text-label uppercase text-ink-muted transition-colors hover:text-ink"
          >
            <span aria-hidden="true">←</span>
            {t("back")}
          </Link>
          <p className="mt-8 font-mono text-label uppercase text-ink-subtle">
            {project.year}
          </p>
          <h1
            id="project-title"
            lang={lang(project.title)}
            className="mt-4 max-w-[20ch] text-title text-ink"
          >
            {project.title.value}
          </h1>
          <p
            lang={lang(project.summary)}
            className="mt-6 max-w-[60ch] text-lead text-ink-muted"
          >
            {project.summary.value}
          </p>
          <dl className="mt-12 grid gap-8 border-t pt-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="font-mono text-label uppercase text-ink-subtle">
                {t("role")}
              </dt>
              <dd lang={lang(project.role)} className="mt-2 text-ink">
                {project.role.value}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-label uppercase text-ink-subtle">
                {t("outcome")}
              </dt>
              <dd lang={lang(project.outcome)} className="mt-2 text-ink">
                {project.outcome.value}
              </dd>
            </div>
            {project.skills.length > 0 ? (
              <div>
                <dt className="font-mono text-label uppercase text-ink-subtle">
                  {t("stack")}
                </dt>
                <dd className="mt-2">
                  <ul className="flex flex-wrap gap-2">
                    {project.skills.map((skill) => (
                      <li
                        key={skill}
                        className="rounded-full bg-surface px-3 py-1 text-sm text-ink-muted ring-1 ring-line"
                      >
                        {skill}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            ) : null}
            {project.liveUrl || project.repoUrl ? (
              <div>
                <dt className="font-mono text-label uppercase text-ink-subtle">
                  {t("links")}
                </dt>
                <dd className="mt-1">
                  <ProjectLinks project={project} />
                </dd>
              </div>
            ) : null}
          </dl>
        </header>
        {project.cover ? (
          <figure className="relative mx-auto mt-16 w-full max-w-content px-gutter">
            <div className="overflow-hidden rounded-panel ring-1 ring-line">
              <ProjectCover
                cover={project.cover}
                locale={locale}
                sizes="(min-width: 76rem) 76rem, 100vw"
                preload
              />
            </div>
          </figure>
        ) : null}
        {project.body.value ? (
          <section
            aria-label={t("caseStudy")}
            lang={lang(project.body)}
            className="relative mx-auto mt-16 w-full max-w-content px-gutter"
          >
            <CaseStudy markdown={project.body.value} />
          </section>
        ) : null}
        <ProjectNav locale={locale} previous={previous} next={next} />
      </article>
    </PageShell>
  );
}
```

`src/app/globals.css`:

```diff
diff --git a/src/app/globals.css b/src/app/globals.css
index 3ccc277..c1b563e 100644
--- a/src/app/globals.css
+++ b/src/app/globals.css
@@ -261,6 +261,109 @@ html[data-canvas="poster"] .section-poster {
   }
 }
 
+/*
+ * Project pages (M7). A quiet studio light behind the header instead of the
+ * 3D stage, and the case study's markdown.
+ */
+.project-backdrop {
+  position: absolute;
+  inset: 0 0 auto;
+  height: 40rem;
+  pointer-events: none;
+  background: radial-gradient(
+    60% 70% at 72% 0%,
+    color-mix(in oklab, var(--color-signal) 9%, transparent),
+    transparent 70%
+  );
+}
+
+.case-study {
+  max-width: 68ch;
+  color: var(--color-ink-muted);
+  font-size: 1.0625rem;
+  line-height: 1.7;
+}
+
+.case-study > * + * {
+  margin-top: 1.25em;
+}
+
+.case-study :is(h2, h3, h4) {
+  margin-top: 2.25em;
+  color: var(--color-ink);
+  font-weight: 600;
+  line-height: 1.25;
+  letter-spacing: -0.015em;
+  text-wrap: balance;
+}
+
+.case-study h2 {
+  font-size: var(--text-heading);
+}
+
+.case-study :is(h3, h4) {
+  font-size: 1.125rem;
+}
+
+.case-study > :first-child {
+  margin-top: 0;
+}
+
+.case-study :is(strong, b) {
+  color: var(--color-ink);
+  font-weight: 600;
+}
+
+.case-study a {
+  color: var(--color-signal);
+  text-decoration: underline;
+  text-underline-offset: 0.2em;
+}
+
+.case-study ul {
+  list-style: disc;
+  padding-left: 1.25em;
+}
+
+.case-study ol {
+  list-style: decimal;
+  padding-left: 1.25em;
+}
+
+.case-study li + li {
+  margin-top: 0.5em;
+}
+
+.case-study li::marker {
+  color: var(--color-ink-subtle);
+}
+
+.case-study blockquote {
+  border-left: 2px solid var(--color-line-strong);
+  padding-left: 1em;
+  color: var(--color-ink);
+}
+
+.case-study code {
+  border-radius: 0.375rem;
+  background: var(--color-surface);
+  padding: 0.1em 0.35em;
+  font-family: var(--font-mono);
+  font-size: 0.875em;
+}
+
+.case-study pre {
+  overflow-x: auto;
+  border-radius: var(--radius-control);
+  background: var(--color-surface);
+  padding: 1rem;
+}
+
+.case-study pre code {
+  background: none;
+  padding: 0;
+}
+
 /* Poster capture (scripts/posters.ts): only the canvas is visible. */
 html[data-capture] body {
   visibility: hidden;
```

- [ ] **Step 7: Run the tests again**

Run: `rtk proxy pnpm test`, `rtk proxy pnpm typecheck`, `rtk proxy pnpm lint`
Expected: `Test Files  42 passed (42)`, `Tests  311 passed (311)`; lint `Checked 266 files in <n>ms. No fixes applied.`; no TypeScript errors.

Run: `pnpm build`
Expected: the route table lists `│ ├ ○ /en/projects/ledger-lens` and `│ └ ◐ [+8 more paths]` under `/[locale]/projects/[slug]`; `.next/server/app/{en,ro}/projects/{ledger-lens,tramline,atelier-cms,pulse-check}.html` exist and their `.meta` files have no `postponed` key (fully static, like `/en`), while `[slug].meta` has one (the shell for slugs published after the build).

Run: `pnpm test:e2e`
Expected: `/en: 149.5 KB gz before 3D`, `/ro: 149.5 KB gz before 3D`, `/en/projects/ledger-lens: 146.2 KB gz before 3D`, `lazy: 3 chunk(s), 315.7 KB gz`, `tier 3: +1 chunk, 81.7 KB gz`, the two `contact: … failed Error: EEXIST …` lines M3's outage test always prints, then `112 passed` (the 101 + 11)

- [ ] **Step 8: Commit**

```bash
/usr/bin/git add messages next.config.ts src tests
/usr/bin/git commit -m "feat(projects): add a page per project"
```

---

### Task 3: View Transitions between the grid and the project pages

**Owner:** frontend-engineer.

Opening a project is hierarchical navigation (list to detail), so the page slides: forward into a project and to the next one, back to the grid and to the previous one (vercel-react-view-transitions: type-keyed `nav-forward`/`nav-back`). The one shared element is the cover: it morphs from the card into the page's cover and back. Titles do not morph (see Deviations). The old page leaves fast (150 ms fade) and the new one arrives after it (210 ms fade plus a 60 px, 400 ms slide on M6's `--ease-studio`); the morph runs 400 ms with a light blur in the middle, which hides the raster jump between the two cover sizes (emil-design-eng: blur bridges a crossfade).

**Files:**
- Create: `src/components/motion/DirectionalTransition.tsx`, `src/components/projects/CoverTransition.tsx`
- Modify: `src/components/site/PageShell.tsx`, `src/components/sections/Projects.tsx`, `src/components/projects/{ProjectLinks,ProjectNav}.tsx`, `src/components/site/SiteHeader.tsx`, `src/app/[locale]/projects/[slug]/page.tsx`, `src/experience/MotionToggle.tsx`, `messages/{en,ro}.json`, `src/app/globals.css`
- Test: `tests/e2e/view-transitions.spec.ts` (new), `tests/e2e/{hero-projects-contact,admin-projects}.spec.ts`

**Interfaces:**
- Consumes: Task 2's `PageShell`, `ProjectCover`, `ProjectLinks`, `ProjectNav`, `projectPath`; M5's `useMotion()` (`true | false | null` before hydration).
- Produces:
  - `DirectionalTransition({ children })`: `<ViewTransition enter/exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }} default="none">`.
  - `CoverTransition({ slug, children })`: `<ViewTransition name={\`project-cover-${slug}\`} share="morph" default="none">`.
  - Link types: the card title and "Next" use `transitionTypes={["nav-forward"]}`; "All work", "Previous" and the header's section links on a project page use `["nav-back"]`.
  - `html[data-motion="on" | "off"]`, set by `MotionToggle` on every page once hydrated (Task 4's tests and Task 3's CSS read it).
  - Card DOM: the title is `h3 > a[href="/<locale>/projects/<slug>"]`, stretched over the card with `after:absolute after:inset-0`; `ProjectLinks` sits above it (`relative z-10`); a `View project →` cue (`Projects.open`, `aria-hidden`).
  - CSS: `--vt-exit`, `--vt-enter`, `--vt-move`; keyframes `vt-fade`, `vt-slide`, `vt-blur`.

Facts this task builds on (see Verified facts): Next 16.3.6 has no `experimental.viewTransition` flag, `next/link`'s `transitionTypes` works without one; a `<ViewTransition>` only enters and exits when it is the page's outermost node, so it wraps `<main>` in `PageShell` (inside `<main>` it never fired); a browser back never animates; a click before Next has prefetched the page still navigates, but without the types, so without the slide; a transition can be skipped when another starts (the page hidden in `<Activity>` renders in the background).

- [ ] **Step 1: Write the failing tests**

`tests/e2e/view-transitions.spec.ts` (records every `document.startViewTransition` with its types and the animations it ran; `hydrated()` and `prefetched()` keep the clicks from racing Next):

```ts
import { expect, type Page, test } from "@playwright/test";

// Project pages open with a View Transition (React <ViewTransition>, types
// from next/link's transitionTypes). Each startViewTransition call is
// recorded with the view-transition animations it ran, or as skipped when
// the browser dropped it (a later transition started first).

type Run = {
  types: string[];
  ready: boolean;
  skipped: boolean;
  animations: { name: string; ms: number }[];
};

declare global {
  interface Window {
    __transitions: Run[];
  }
}

async function recordTransitions(page: Page) {
  await page.addInitScript(() => {
    window.__transitions = [];
    const start = document.startViewTransition?.bind(document);
    if (!start) return;
    document.startViewTransition = ((update: never) => {
      const run: Run = {
        types: [...((update as { types?: string[] })?.types ?? [])],
        ready: false,
        skipped: false,
        animations: [],
      };
      window.__transitions.push(run);
      const transition = start(update);
      transition.ready.then(
        () => {
          run.animations = document
            .getAnimations()
            .filter((animation) =>
              (
                animation.effect as KeyframeEffect | null
              )?.pseudoElement?.startsWith("::view-transition"),
            )
            .map((animation) => ({
              name: `${(animation.effect as KeyframeEffect).pseudoElement} ${(animation as CSSAnimation).animationName}`,
              ms: Number(animation.effect?.getTiming().duration ?? 0),
            }));
          run.ready = true;
        },
        () => {
          run.skipped = true;
          run.ready = true;
        },
      );
      return transition;
    }) as typeof document.startViewTransition;
  });
}

/**
 * The transition a navigation tagged `type`, once its animations have
 * started (or it was skipped). Other transitions may run around it (the
 * page hidden in an <Activity> renders in the background), so it is found
 * by its type.
 */
const transitionOf = (page: Page, type: string) =>
  page
    .waitForFunction(
      (type) =>
        window.__transitions.find(
          (run) => run.ready && run.types.includes(type),
        ) ?? null,
      type,
    )
    .then((handle) => handle.jsonValue() as Promise<Run>);

/**
 * Waits for hydration: before it, a click on a link is a full page load,
 * not a client navigation. Every page's header sets html[data-motion] once
 * it has hydrated (MotionToggle).
 */
async function hydrated(page: Page) {
  await expect(page.locator("html")).toHaveAttribute("data-motion", /on|off/);
}

/**
 * Resolves once Next has prefetched `path`'s page segment (links prefetch
 * as they scroll into view). A click before it still navigates, but the
 * page arrives in a later commit, without the transition's types.
 */
function prefetched(page: Page, path: string) {
  return page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === path &&
      (
        response.request().headers()["next-router-segment-prefetch"] ?? ""
      ).endsWith("__PAGE__"),
  );
}

async function openLedgerLens(page: Page) {
  const ready = prefetched(page, "/en/projects/ledger-lens");
  await page.goto("/en");
  await hydrated(page);
  await page.locator("#projects").scrollIntoViewIfNeeded();
  await ready;
  await page
    .locator("#projects")
    .getByRole("link", { name: "Ledger Lens", exact: true })
    .click();
  await expect(page).toHaveURL("/en/projects/ledger-lens");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Ledger Lens",
  );
}

test("a project opens with a forward slide and closes with a backward one", async ({
  page,
}) => {
  await recordTransitions(page);
  await openLedgerLens(page);

  const forward = await transitionOf(page, "nav-forward");
  expect(forward.types).toEqual(["nav-forward"]);
  expect(forward.skipped).toBe(false);
  expect(forward.animations).toContainEqual(
    expect.objectContaining({
      name: expect.stringMatching(/new\(.+\) vt-slide$/),
    }),
  );
  expect(Math.max(...forward.animations.map((a) => a.ms))).toBeGreaterThan(0);

  await page.getByRole("link", { name: "All work" }).click();
  await expect(page).toHaveURL("/en#projects");
  const back = await transitionOf(page, "nav-back");
  expect(back.types).toEqual(["nav-back"]);
  await expect(page.locator("#projects")).toBeInViewport();
});

test("the next project slides in from the right", async ({ page }) => {
  await recordTransitions(page);
  const ready = prefetched(page, "/en/projects/atelier-cms");
  await page.goto("/en/projects/tramline");
  await hydrated(page);
  const more = page.getByRole("navigation", { name: "More work" });
  await more.scrollIntoViewIfNeeded();
  await ready;

  await more.getByRole("link", { name: /Next/ }).click();
  await expect(page).toHaveURL("/en/projects/atelier-cms");
  expect((await transitionOf(page, "nav-forward")).types).toEqual([
    "nav-forward",
  ]);
});

test("the whole card opens the project", async ({ page }) => {
  await page.goto("/en");
  await hydrated(page);
  const card = page.locator("#projects li").filter({ hasText: "Tramline" });

  // Anywhere on the card, e.g. its summary, which the title link covers.
  const summary = card.getByText("Installable web app");
  await summary.scrollIntoViewIfNeeded();
  const box = await summary.boundingBox();
  await page.mouse.click((box?.x ?? 0) + 8, (box?.y ?? 0) + 8);
  await expect(page).toHaveURL("/en/projects/tramline");
});

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("pages swap without animating", async ({ page }) => {
    await recordTransitions(page);
    await openLedgerLens(page);

    // The page still changes inside a transition, but nothing moves.
    const { animations } = await transitionOf(page, "nav-forward");
    expect(animations.filter((animation) => animation.ms > 0)).toEqual([]);
  });
});

test("the Motion switch turns page transitions off too", async ({ page }) => {
  await recordTransitions(page);
  const ready = prefetched(page, "/en/projects/ledger-lens");
  await page.goto("/en");
  const motion = page
    .getByRole("banner")
    .getByRole("button", { name: "Motion" });
  // Hydrated once it shows the stored preference (on by default).
  await expect(motion).toHaveAttribute("aria-pressed", "true");
  await motion.click();
  await expect(page.locator("html")).toHaveAttribute("data-motion", "off");

  await page.locator("#projects").scrollIntoViewIfNeeded();
  await ready;
  await page
    .locator("#projects")
    .getByRole("link", { name: "Ledger Lens", exact: true })
    .click();
  await expect(page).toHaveURL("/en/projects/ledger-lens");
  const { animations } = await transitionOf(page, "nav-forward");
  expect(animations.filter((animation) => animation.ms > 0)).toEqual([]);
});

test("browsers without View Transitions still navigate", async ({ page }) => {
  await page.addInitScript(() => {
    // biome-ignore lint/suspicious/noExplicitAny: removing a browser API on purpose
    delete (Document.prototype as any).startViewTransition;
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await openLedgerLens(page);
  await page.getByRole("link", { name: "All work" }).click();
  await expect(page).toHaveURL("/en#projects");
  expect(errors).toEqual([]);
});
```

`tests/e2e/hero-projects-contact.spec.ts` (every card title links to its page):

```diff
diff --git a/tests/e2e/hero-projects-contact.spec.ts b/tests/e2e/hero-projects-contact.spec.ts
index b18d5d4..3fdab2a 100644
--- a/tests/e2e/hero-projects-contact.spec.ts
+++ b/tests/e2e/hero-projects-contact.spec.ts
@@ -60,6 +60,9 @@ test("lists published projects only, with descriptive link names", async ({
   await expect(
     work.getByRole("link", { name: "Live site: Ledger Lens" }),
   ).toHaveAttribute("href", "https://example.com/ledger-lens");
+  await expect(
+    work.getByRole("link", { name: "Ledger Lens", exact: true }),
+  ).toHaveAttribute("href", "/en/projects/ledger-lens");
 });
 
 test("contact form is labelled", async ({ page }) => {
```

`tests/e2e/admin-projects.spec.ts` (the cover morphs between the card and the page):

```diff
diff --git a/tests/e2e/admin-projects.spec.ts b/tests/e2e/admin-projects.spec.ts
index fc0783d..b383f19 100644
--- a/tests/e2e/admin-projects.spec.ts
+++ b/tests/e2e/admin-projects.spec.ts
@@ -138,6 +138,52 @@ test("a cover, a case study and links from the admin reach the project page", as
     project.getByRole("link", { name: "Source code: Pass Planner" }),
   ).toHaveAttribute("href", "https://example.com/pass-planner/source");
 
+  // The card's cover and the page's cover are one shared element.
+  await page.addInitScript(() => {
+    const names: string[] = [];
+    (window as unknown as { __morphs: string[] }).__morphs = names;
+    const start = document.startViewTransition?.bind(document);
+    if (!start) return;
+    document.startViewTransition = ((update: never) => {
+      const transition = start(update);
+      transition.ready.then(() => {
+        for (const animation of document.getAnimations()) {
+          names.push(
+            (animation.effect as KeyframeEffect | null)?.pseudoElement ?? "",
+          );
+        }
+      });
+      return transition;
+    }) as typeof document.startViewTransition;
+  });
+  await page.goto("/en");
+  // Hydrated (MotionToggle sets it): a click before would load the page.
+  await expect(page.locator("html")).toHaveAttribute("data-motion", /on|off/);
+  const card = page.locator("#projects li").filter({ hasText: "Pass Planner" });
+  // Prefetched as it scrolls into view: the page then arrives in the same
+  // commit as the navigation, which the shared element needs.
+  const ready = page.waitForResponse(
+    (response) =>
+      new URL(response.url()).pathname === "/en/projects/pass-planner" &&
+      (
+        response.request().headers()["next-router-segment-prefetch"] ?? ""
+      ).endsWith("__PAGE__"),
+  );
+  await card.scrollIntoViewIfNeeded();
+  await ready;
+  await expect(
+    card.getByRole("img", { name: "The pass planner at dawn" }),
+  ).toBeVisible();
+  await card.getByRole("link", { name: "Pass Planner", exact: true }).click();
+  await expect(page).toHaveURL("/en/projects/pass-planner");
+  await expect
+    .poll(() =>
+      page.evaluate(
+        () => (window as unknown as { __morphs: string[] }).__morphs,
+      ),
+    )
+    .toContain("::view-transition-group(project-cover-pass-planner)");
+
   await page.goto("/ro/projects/pass-planner");
   await expect(
     page.getByRole("img", { name: "Planificatorul de treceri în zori" }),
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm test:e2e`
Expected: `7 failed`, `5 did not run` (the admin project waits for the public one), `78 passed`: `lists published projects only, with descriptive link names` (the card title is no link yet) and the six tests in `view-transitions.spec.ts` (no card link to click; on the project page `html[data-motion]` is not set yet, which `hydrated()` waits for)

- [ ] **Step 3: The two transitions**

`src/components/motion/DirectionalTransition.tsx`:

```tsx
import { type ReactNode, ViewTransition } from "react";

/**
 * Page-level View Transition for the list ↔ detail navigations: links tag
 * their navigation `nav-forward` (into a project, to the next one) or
 * `nav-back` (back to the grid, to the previous one), and the page slides
 * accordingly (globals.css). Any other navigation, a browser back included,
 * swaps the page without animating it.
 */
export function DirectionalTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition
      enter={{
        "nav-forward": "nav-forward",
        "nav-back": "nav-back",
        default: "none",
      }}
      exit={{
        "nav-forward": "nav-forward",
        "nav-back": "nav-back",
        default: "none",
      }}
      default="none"
    >
      {children}
    </ViewTransition>
  );
}
```

`src/components/projects/CoverTransition.tsx`:

```tsx
import { type ReactNode, ViewTransition } from "react";

/**
 * The project's cover is one object in the grid card and on the project
 * page: the same name on both sides makes it morph between them.
 */
export function CoverTransition({
  slug,
  children,
}: {
  slug: string;
  children: ReactNode;
}) {
  return (
    <ViewTransition name={`project-cover-${slug}`} share="morph" default="none">
      {children}
    </ViewTransition>
  );
}
```

- [ ] **Step 4: Wrap the page, the cover and the links**

`src/components/site/PageShell.tsx`:

```diff
diff --git a/src/components/site/PageShell.tsx b/src/components/site/PageShell.tsx
index 50a777c..d91e70c 100644
--- a/src/components/site/PageShell.tsx
+++ b/src/components/site/PageShell.tsx
@@ -1,11 +1,13 @@
 import type { ReactNode } from "react";
+import { DirectionalTransition } from "@/components/motion/DirectionalTransition";
 import type { Cv } from "@/content/types";
 import { SiteHeader } from "./SiteHeader";
 
 /**
  * The header and <main> of a page. Pages render it themselves (not the
  * locale layout) so the header knows which page it sits on without reading
- * the URL at runtime: the HTML stays fully static.
+ * the URL at runtime: the HTML stays fully static. <main> is what slides
+ * between pages; the header only cross-fades.
  */
 export function PageShell({
   cv,
@@ -20,9 +22,13 @@ export function PageShell({
   return (
     <>
       <SiteHeader cv={cv} path={path} />
-      <main id="main" tabIndex={-1} className="focus:outline-none">
-        {children}
-      </main>
+      {/* A <ViewTransition> only enters and exits as the page's outermost
+          node, so it wraps <main> itself. */}
+      <DirectionalTransition>
+        <main id="main" tabIndex={-1} className="focus:outline-none">
+          {children}
+        </main>
+      </DirectionalTransition>
     </>
   );
 }
```

`src/components/sections/Projects.tsx` (the whole card opens the project; a wide first card puts its cover beside the text):

```diff
diff --git a/src/components/sections/Projects.tsx b/src/components/sections/Projects.tsx
index 8ccd15d..542b6a6 100644
--- a/src/components/sections/Projects.tsx
+++ b/src/components/sections/Projects.tsx
@@ -1,8 +1,18 @@
+import Link from "next/link";
 import { useTranslations } from "next-intl";
+import { CoverTransition } from "@/components/projects/CoverTransition";
+import { ProjectCover } from "@/components/projects/ProjectCover";
+import { ProjectLinks } from "@/components/projects/ProjectLinks";
 import { Section } from "@/components/ui/Section";
 import { fallbackLang } from "@/content/localize";
 import type { Cv } from "@/content/types";
+import { projectPath } from "@/lib/seo";
 
+/**
+ * The grid of published projects, featured first. Each card opens its
+ * project page (the title link covers the whole card); the live and source
+ * links stay clickable on top of it.
+ */
 export function Projects({ cv }: { cv: Cv }) {
   const t = useTranslations("Projects");
   const { locale } = cv;
@@ -10,90 +20,105 @@ export function Projects({ cv }: { cv: Cv }) {
   return (
     <Section id="projects" title={t("title")}>
       <ul className="grid gap-4 md:grid-cols-6">
-        {cv.projects.map((project, index) => (
-          <li
-            key={project.slug}
-            className={index === 0 ? "md:col-span-6" : "md:col-span-2"}
-          >
-            <article className="h-full rounded-panel bg-surface p-1.5 ring-1 ring-line">
-              <div className="flex h-full flex-col rounded-[calc(var(--radius-panel)-0.375rem)] bg-raised p-6 shadow-[inset_0_1px_0_var(--color-line)] md:p-8">
-                <p className="font-mono text-label uppercase text-ink-subtle">
-                  {project.year}
-                </p>
-                <h3
-                  lang={fallbackLang(project.title, locale)}
-                  className="mt-3 text-heading text-ink"
+        {cv.projects.map((project, index) => {
+          const wide = index === 0;
+          return (
+            <li
+              key={project.slug}
+              className={wide ? "md:col-span-6" : "md:col-span-2"}
+            >
+              <article className="relative h-full rounded-panel bg-surface p-1.5 ring-1 ring-line transition-[box-shadow,transform] duration-(--motion-press) hover:ring-line-strong motion-safe:active:scale-[0.99]">
+                <div
+                  className={`flex h-full flex-col gap-6 rounded-[calc(var(--radius-panel)-0.375rem)] bg-raised p-6 shadow-[inset_0_1px_0_var(--color-line)] md:p-8 ${wide && project.cover ? "md:grid md:grid-cols-2 md:items-center md:gap-10" : ""}`}
                 >
-                  {project.title.value}
-                </h3>
-                <p
-                  lang={fallbackLang(project.summary, locale)}
-                  className="mt-3 max-w-[60ch] text-ink-muted"
-                >
-                  {project.summary.value}
-                </p>
-                <dl className="mt-6 grid gap-3 text-sm">
-                  <div>
-                    <dt className="font-mono text-label uppercase text-ink-subtle">
-                      {t("role")}
-                    </dt>
-                    <dd
-                      lang={fallbackLang(project.role, locale)}
-                      className="mt-1 text-ink"
+                  {project.cover ? (
+                    <CoverTransition slug={project.slug}>
+                      <div
+                        className={`overflow-hidden rounded-control ring-1 ring-line ${wide ? "md:order-last" : ""}`}
+                      >
+                        <ProjectCover
+                          cover={project.cover}
+                          locale={locale}
+                          sizes={
+                            wide
+                              ? "(min-width: 48rem) 36rem, 100vw"
+                              : "(min-width: 48rem) 24rem, 100vw"
+                          }
+                        />
+                      </div>
+                    </CoverTransition>
+                  ) : null}
+                  <div className="flex flex-1 flex-col">
+                    <p className="font-mono text-label uppercase text-ink-subtle">
+                      {project.year}
+                    </p>
+                    <h3
+                      lang={fallbackLang(project.title, locale)}
+                      className="mt-3 text-heading text-ink"
                     >
-                      {project.role.value}
-                    </dd>
-                  </div>
-                  <div>
-                    <dt className="font-mono text-label uppercase text-ink-subtle">
-                      {t("outcome")}
-                    </dt>
-                    <dd
-                      lang={fallbackLang(project.outcome, locale)}
-                      className="mt-1 text-ink"
+                      <Link
+                        href={`/${locale}${projectPath(project.slug)}`}
+                        transitionTypes={["nav-forward"]}
+                        className="after:absolute after:inset-0 after:rounded-panel focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-signal"
+                      >
+                        {project.title.value}
+                      </Link>
+                    </h3>
+                    <p
+                      lang={fallbackLang(project.summary, locale)}
+                      className="mt-3 max-w-[60ch] text-ink-muted"
                     >
-                      {project.outcome.value}
-                    </dd>
+                      {project.summary.value}
+                    </p>
+                    <dl className="mt-6 grid gap-3 text-sm">
+                      <div>
+                        <dt className="font-mono text-label uppercase text-ink-subtle">
+                          {t("role")}
+                        </dt>
+                        <dd
+                          lang={fallbackLang(project.role, locale)}
+                          className="mt-1 text-ink"
+                        >
+                          {project.role.value}
+                        </dd>
+                      </div>
+                      <div>
+                        <dt className="font-mono text-label uppercase text-ink-subtle">
+                          {t("outcome")}
+                        </dt>
+                        <dd
+                          lang={fallbackLang(project.outcome, locale)}
+                          className="mt-1 text-ink"
+                        >
+                          {project.outcome.value}
+                        </dd>
+                      </div>
+                    </dl>
+                    <ul className="mt-6 flex flex-wrap gap-2">
+                      {project.skills.map((skill) => (
+                        <li
+                          key={skill}
+                          className="rounded-full bg-surface px-3 py-1 text-sm text-ink-muted ring-1 ring-line"
+                        >
+                          {skill}
+                        </li>
+                      ))}
+                    </ul>
+                    <div className="mt-auto flex flex-wrap items-end justify-between gap-x-6 pt-6">
+                      <ProjectLinks project={project} />
+                      <span
+                        aria-hidden="true"
+                        className="ml-auto inline-flex min-h-11 items-center font-mono text-label uppercase text-ink-subtle"
+                      >
+                        {t("open")} →
+                      </span>
+                    </div>
                   </div>
-                </dl>
-                <ul className="mt-6 flex flex-wrap gap-2">
-                  {project.skills.map((skill) => (
-                    <li
-                      key={skill}
-                      className="rounded-full bg-surface px-3 py-1 text-sm text-ink-muted ring-1 ring-line"
-                    >
-                      {skill}
-                    </li>
-                  ))}
-                </ul>
-                <div className="mt-auto flex flex-wrap gap-x-6 gap-y-2 pt-6 text-sm font-medium">
-                  {project.liveUrl ? (
-                    <a
-                      href={project.liveUrl}
-                      aria-label={t("liveLabel", {
-                        title: project.title.value,
-                      })}
-                      className="text-signal underline-offset-4 hover:underline"
-                    >
-                      {t("live")}
-                    </a>
-                  ) : null}
-                  {project.repoUrl ? (
-                    <a
-                      href={project.repoUrl}
-                      aria-label={t("sourceLabel", {
-                        title: project.title.value,
-                      })}
-                      className="text-signal underline-offset-4 hover:underline"
-                    >
-                      {t("source")}
-                    </a>
-                  ) : null}
                 </div>
-              </div>
-            </article>
-          </li>
-        ))}
+              </article>
+            </li>
+          );
+        })}
       </ul>
     </Section>
   );
```

`src/components/projects/ProjectLinks.tsx`, `src/components/projects/ProjectNav.tsx`, `src/components/site/SiteHeader.tsx`:

```diff
diff --git a/src/components/projects/ProjectLinks.tsx b/src/components/projects/ProjectLinks.tsx
index 0b67e39..a1d2de8 100644
--- a/src/components/projects/ProjectLinks.tsx
+++ b/src/components/projects/ProjectLinks.tsx
@@ -1,7 +1,10 @@
 import { useTranslations } from "next-intl";
 import type { Project } from "@/lib/project-pages";
 
-/** "Live site" and "Source code", named after the project for screen readers. */
+/**
+ * "Live site" and "Source code", named after the project for screen readers.
+ * Raised above a grid card's own link, so they stay clickable.
+ */
 export function ProjectLinks({ project }: { project: Project }) {
   const t = useTranslations("Projects");
   const title = project.title.value;
@@ -10,7 +13,7 @@ export function ProjectLinks({ project }: { project: Project }) {
     return null;
   }
   return (
-    <div className="flex flex-wrap gap-x-6 text-sm font-medium">
+    <div className="relative z-10 flex flex-wrap gap-x-6 text-sm font-medium">
       {project.liveUrl ? (
         <a
           href={project.liveUrl}
```

```diff
diff --git a/src/components/projects/ProjectNav.tsx b/src/components/projects/ProjectNav.tsx
index 5b4423a..6d85b92 100644
--- a/src/components/projects/ProjectNav.tsx
+++ b/src/components/projects/ProjectNav.tsx
@@ -32,6 +32,7 @@ export function ProjectNav({
           <li>
             <Link
               href={`/${locale}${projectPath(previous.slug)}`}
+              transitionTypes={["nav-back"]}
               className={card}
             >
               <span className="font-mono text-label uppercase text-ink-subtle">
@@ -51,6 +52,7 @@ export function ProjectNav({
           <li className="sm:col-start-2">
             <Link
               href={`/${locale}${projectPath(next.slug)}`}
+              transitionTypes={["nav-forward"]}
               className={`${card} sm:items-end sm:text-right`}
             >
               <span className="font-mono text-label uppercase text-ink-subtle">
```

```diff
diff --git a/src/components/site/SiteHeader.tsx b/src/components/site/SiteHeader.tsx
index 9363937..2bac3d0 100644
--- a/src/components/site/SiteHeader.tsx
+++ b/src/components/site/SiteHeader.tsx
@@ -45,7 +45,11 @@ export function SiteHeader({ cv, path }: { cv: Cv; path: string | null }) {
                   {t(id)}
                 </a>
               ) : (
-                <Link href={`/${cv.locale}#${id}`} className={link}>
+                <Link
+                  href={`/${cv.locale}#${id}`}
+                  transitionTypes={["nav-back"]}
+                  className={link}
+                >
                   {t(id)}
                 </Link>
               )}
```

`src/app/[locale]/projects/[slug]/page.tsx`:

```diff
diff --git a/src/app/[locale]/projects/[slug]/page.tsx b/src/app/[locale]/projects/[slug]/page.tsx
index 904278e..c71318d 100644
--- a/src/app/[locale]/projects/[slug]/page.tsx
+++ b/src/app/[locale]/projects/[slug]/page.tsx
@@ -3,6 +3,7 @@ import Link from "next/link";
 import { notFound } from "next/navigation";
 import { getLocale, getTranslations } from "next-intl/server";
 import { CaseStudy } from "@/components/projects/CaseStudy";
+import { CoverTransition } from "@/components/projects/CoverTransition";
 import { ProjectCover } from "@/components/projects/ProjectCover";
 import { ProjectLinks } from "@/components/projects/ProjectLinks";
 import { ProjectNav } from "@/components/projects/ProjectNav";
@@ -114,6 +115,7 @@ export default async function ProjectPage({
         <header className="relative mx-auto w-full max-w-content px-gutter pt-36 md:pt-40">
           <Link
             href={`/${locale}#projects`}
+            transitionTypes={["nav-back"]}
             className="-ml-1 inline-flex min-h-11 items-center gap-2 px-1 font-mono text-label uppercase text-ink-muted transition-colors hover:text-ink"
           >
             <span aria-hidden="true">←</span>
@@ -185,14 +187,16 @@ export default async function ProjectPage({
         </header>
         {project.cover ? (
           <figure className="relative mx-auto mt-16 w-full max-w-content px-gutter">
-            <div className="overflow-hidden rounded-panel ring-1 ring-line">
-              <ProjectCover
-                cover={project.cover}
-                locale={locale}
-                sizes="(min-width: 76rem) 76rem, 100vw"
-                preload
-              />
-            </div>
+            <CoverTransition slug={project.slug}>
+              <div className="overflow-hidden rounded-panel ring-1 ring-line">
+                <ProjectCover
+                  cover={project.cover}
+                  locale={locale}
+                  sizes="(min-width: 76rem) 76rem, 100vw"
+                  preload
+                />
+              </div>
+            </CoverTransition>
           </figure>
         ) : null}
         {project.body.value ? (
```

`messages/en.json` and `messages/ro.json`:

```diff
diff --git a/messages/en.json b/messages/en.json
index a2feff8..c3340c6 100644
--- a/messages/en.json
+++ b/messages/en.json
@@ -66,7 +66,8 @@
     "live": "Live site",
     "source": "Source code",
     "liveLabel": "Live site: {title}",
-    "sourceLabel": "Source code: {title}"
+    "sourceLabel": "Source code: {title}",
+    "open": "View project"
   },
   "Project": {
     "back": "All work",
```

```diff
diff --git a/messages/ro.json b/messages/ro.json
index b2100d5..59e0b30 100644
--- a/messages/ro.json
+++ b/messages/ro.json
@@ -66,7 +66,8 @@
     "live": "Site live",
     "source": "Cod sursă",
     "liveLabel": "Site live: {title}",
-    "sourceLabel": "Cod sursă: {title}"
+    "sourceLabel": "Cod sursă: {title}",
+    "open": "Vezi proiectul"
   },
   "Project": {
     "back": "Toate proiectele",
```

- [ ] **Step 5: Motion off reaches the CSS, and the CSS**

`src/experience/MotionToggle.tsx` (M5 only set `html[data-motion]` from the home page's stage; project pages have none):

```diff
diff --git a/src/experience/MotionToggle.tsx b/src/experience/MotionToggle.tsx
index d260fa1..808d51a 100644
--- a/src/experience/MotionToggle.tsx
+++ b/src/experience/MotionToggle.tsx
@@ -1,5 +1,6 @@
 "use client";
 
+import { useEffect } from "react";
 import { setMotionChoice } from "./motion-preference";
 import { useMotion } from "./use-motion";
 
@@ -7,11 +8,19 @@ export type MotionToggleLabels = { label: string; on: string; off: string };
 
 /**
  * Visible "Motion" switch. Off = posters only (tier 0): no smooth scrolling,
- * no pinned hero, no 3D. The choice is kept in localStorage.
+ * no pinned hero, no 3D, no animated page transitions. The choice is kept
+ * in localStorage and mirrored to html[data-motion] on every page.
  */
 export function MotionToggle({ labels }: { labels: MotionToggleLabels }) {
+  const motion = useMotion();
   // Before hydration the state is unknown: render "off" (no motion yet).
-  const on = useMotion() === true;
+  const on = motion === true;
+
+  useEffect(() => {
+    if (motion !== null) {
+      document.documentElement.dataset.motion = motion ? "on" : "off";
+    }
+  }, [motion]);
 
   return (
     <button
```

`src/app/globals.css` (the animations live inside `prefers-reduced-motion: no-preference` and `html:not([data-motion="off"])`; reduced motion and Motion off also stop the browser's default cross-fade and morph with `animation: none`, so no `!important` is needed):

```diff
diff --git a/src/app/globals.css b/src/app/globals.css
index c1b563e..0b3e6f9 100644
--- a/src/app/globals.css
+++ b/src/app/globals.css
@@ -364,6 +364,101 @@ html[data-canvas="poster"] .section-poster {
   padding: 0;
 }
 
+/*
+ * View Transitions (M7, React <ViewTransition>): project pages slide forward
+ * and back (DirectionalTransition), the cover morphs between the grid card
+ * and the page (CoverTransition). The old page leaves quickly, the new one
+ * arrives a moment later; no motion with reduced motion or Motion off.
+ */
+:root {
+  --vt-exit: 150ms;
+  --vt-enter: 210ms;
+  --vt-move: 400ms;
+}
+
+@keyframes vt-fade {
+  from {
+    filter: blur(3px);
+    opacity: 0;
+  }
+  to {
+    filter: blur(0);
+    opacity: 1;
+  }
+}
+
+@keyframes vt-slide {
+  from {
+    translate: var(--vt-offset);
+  }
+  to {
+    translate: 0;
+  }
+}
+
+@keyframes vt-blur {
+  30% {
+    filter: blur(3px);
+  }
+}
+
+::view-transition {
+  /* Clicks during a transition reach the new page. */
+  pointer-events: none;
+}
+
+@media (prefers-reduced-motion: no-preference) {
+  html:not([data-motion="off"])::view-transition-old(.nav-forward),
+  html:not([data-motion="off"])::view-transition-old(.nav-back) {
+    animation:
+      var(--vt-exit) ease-out both vt-fade reverse,
+      var(--vt-move) var(--ease-studio) both vt-slide reverse;
+  }
+
+  html:not([data-motion="off"])::view-transition-new(.nav-forward),
+  html:not([data-motion="off"])::view-transition-new(.nav-back) {
+    animation:
+      var(--vt-enter) var(--ease-out-quint) var(--vt-exit) both vt-fade,
+      var(--vt-move) var(--ease-studio) both vt-slide;
+  }
+
+  html:not([data-motion="off"])::view-transition-group(.morph) {
+    animation-duration: var(--vt-move);
+    animation-timing-function: var(--ease-studio);
+  }
+
+  html:not([data-motion="off"])::view-transition-image-pair(.morph) {
+    animation-name: vt-blur;
+  }
+}
+
+::view-transition-old(.nav-forward),
+::view-transition-new(.nav-back) {
+  --vt-offset: -60px;
+}
+
+::view-transition-new(.nav-forward),
+::view-transition-old(.nav-back) {
+  --vt-offset: 60px;
+}
+
+/* No motion at all: the browser's own cross-fades and morphs stop too. */
+@media (prefers-reduced-motion: reduce) {
+  ::view-transition-group(*),
+  ::view-transition-image-pair(*),
+  ::view-transition-old(*),
+  ::view-transition-new(*) {
+    animation: none;
+  }
+}
+
+html[data-motion="off"]::view-transition-group(*),
+html[data-motion="off"]::view-transition-image-pair(*),
+html[data-motion="off"]::view-transition-old(*),
+html[data-motion="off"]::view-transition-new(*) {
+  animation: none;
+}
+
 /* Poster capture (scripts/posters.ts): only the canvas is visible. */
 html[data-capture] body {
   visibility: hidden;
```

- [ ] **Step 6: Run the tests again**

Run: `rtk proxy pnpm test`, `rtk proxy pnpm typecheck`, `rtk proxy pnpm lint`
Expected: `Test Files  42 passed (42)`, `Tests  311 passed (311)`; lint `Checked 269 files in <n>ms. No fixes applied.`; no TypeScript errors.

Run: `pnpm test:e2e`
Expected: `/en: 149.5 KB gz before 3D`, `/ro: 149.5 KB gz before 3D`, `/en/projects/ledger-lens: 146.3 KB gz before 3D`, `lazy: 3 chunk(s), 315.7 KB gz`, `tier 3: +1 chunk, 81.7 KB gz`, the two `contact: … failed Error: EEXIST …` lines M3's outage test always prints, then `118 passed`

Then look at it once in a real browser (`pnpm build && pnpm start`, not port 3020): open a card with a cover, press "All work", try "Next"; with the OS set to reduce motion, the pages swap without moving.

- [ ] **Step 7: Commit**

```bash
/usr/bin/git add messages src tests
/usr/bin/git commit -m "feat(projects): add view transitions to projects"
```

---

### Task 4: The stage comes back after a project page

**Owner:** frontend-engineer; the poster step may go to devops-engineer.

Next 16.3 with `cacheComponents` keeps the page you leave in a hidden React `<Activity>` (`display: none`, effects cleaned up, state kept, up to three routes). For the home page that meant: R3F's cleanup forces the WebGL context lost, `StageLoader` still holds its "live" state, and after a browser back or "All work" the page showed a dead canvas on "loading" (no 3D, no posters) until a reload. Three fixes, and two scroll fixes found on the way:

1. `StageLoader` drops the stage when hidden (a layout-effect cleanup) and turns `data-canvas="live"` back into `"loading"`, so the hero stays pinned with its poster; showing the page mounts a fresh stage.
2. A fresh stage starts on the section on screen: `settleMotion` puts the journey and pointer springs on their inputs in the first frame. Without it the camera flew from the hero to the Projects stop behind the grid. (`stepMotion`'s `snap` could not do it: `stepSpring` returns early for `dt = 0`, which the first frame has.)
3. The canvas fades in over 600 ms when it goes live (it no longer pops in mid-page).
4. M6's CSS `scroll-behavior: smooth` also animated the scroll Chrome restores on a browser back: the page glided through every section down to the grid. It is gone (with Next's `data-scroll-behavior="smooth"`); Lenis glides to the header's section links instead (`anchors: true`), so in-page links still glide with the live stage and jump without it (posters, Motion off, reduced motion).

**Files:**
- Modify: `src/experience/StageLoader.tsx`, `src/experience/director/{Director.tsx,motion.ts}`, `src/experience/scroll/loop.ts`, `src/app/[locale]/layout.tsx`, `src/app/globals.css`, `src/experience/posters.json` (poster step)
- Test: `tests/unit/motion.test.ts`, `tests/e2e/{stage,view-transitions}.spec.ts`

**Interfaces:**
- Consumes: M6's `Motion`, `MotionInputs`, `stepMotion`, `startLoop`; Task 3's `html[data-motion]`.
- Produces: `settleMotion(motion: Motion, inputs: MotionInputs): void` (journey, pointer x and y: value = input, velocity = 0); `html[data-canvas="loading"] .stage-layer canvas { opacity: 0 }` with a 600 ms opacity transition (not under `data-capture`).

- [ ] **Step 1: Write the failing tests**

`tests/unit/motion.test.ts`:

```diff
diff --git a/tests/unit/motion.test.ts b/tests/unit/motion.test.ts
index 405214c..ccad3e5 100644
--- a/tests/unit/motion.test.ts
+++ b/tests/unit/motion.test.ts
@@ -2,6 +2,7 @@ import { describe, expect, it } from "vitest";
 import {
   createMotion,
   LED_PULSE_MS,
+  settleMotion,
   stepMotion,
 } from "@/experience/director/motion";
 
@@ -61,6 +62,29 @@ describe("stepMotion", () => {
     expect(motion.journey.value).toBe(2.5);
   });
 
+  it("starts a new stage where the page is, not at the hero", () => {
+    // A reload mid-page, or back from a project page: the first frame
+    // shows the section on screen instead of flying there.
+    const motion = createMotion(0);
+    settleMotion(motion, {
+      ...still,
+      journey: 4.3,
+      pointer: { x: 0.5, y: -0.2 },
+    });
+
+    expect(motion.journey).toEqual({ value: 4.3, velocity: 0 });
+    expect(motion.pointerX.value).toBe(0.5);
+    expect(motion.pointerY.value).toBe(-0.2);
+    expect(
+      stepMotion(
+        motion,
+        { ...still, journey: 4.3, pointer: { x: 0.5, y: -0.2 } },
+        1 / 60,
+        0,
+      ),
+    ).toBe(false);
+  });
+
   it("turns the turntable only while idle, then settles on a full turn", () => {
     const motion = createMotion(0);
     for (let frame = 0; frame < 120; frame += 1) {
```

`tests/e2e/stage.spec.ts` (the stage test watches `data-journey` on every `.stage-layer` through a `MutationObserver` on `document`: init scripts run before `<html>` exists):

```diff
diff --git a/tests/e2e/stage.spec.ts b/tests/e2e/stage.spec.ts
index a4a49e7..96df026 100644
--- a/tests/e2e/stage.spec.ts
+++ b/tests/e2e/stage.spec.ts
@@ -151,3 +151,121 @@ test.describe("with reduced motion", () => {
     expect(loaded.filter((url) => !initial.has(url))).toEqual([]);
   });
 });
+
+test("with the live stage, section links glide there (Lenis)", async ({
+  page,
+}) => {
+  test.setTimeout(120_000);
+  await page.goto("/en?tier=1");
+  await expect(page.locator("html")).toHaveAttribute("data-canvas", "live", {
+    timeout: 60_000,
+  });
+  await page.evaluate(() => {
+    const seen: number[] = [];
+    (window as unknown as { __scrolls: number[] }).__scrolls = seen;
+    addEventListener("scroll", () => seen.push(Math.round(window.scrollY)));
+  });
+
+  await page
+    .getByRole("navigation", { name: "Sections" })
+    .getByRole("link", { name: "Experience" })
+    .click();
+  await expect
+    .poll(() =>
+      page.evaluate(
+        () =>
+          document.getElementById("experience")?.getBoundingClientRect().top,
+      ),
+    )
+    .toBeLessThan(2);
+  const { scrolls, end } = await page.evaluate(() => ({
+    scrolls: (window as unknown as { __scrolls: number[] }).__scrolls,
+    end: Math.round(window.scrollY),
+  }));
+  // A jump lands in one step; a glide passes through the page on its way
+  // (SwiftShader draws few frames, so only "some" positions in between).
+  expect(scrolls.filter((y) => y > 50 && y < end - 50).length).toBeGreaterThan(
+    0,
+  );
+});
+
+test.describe("after a project page", () => {
+  // Next keeps a page it leaves in a hidden <Activity>: its effects are
+  // cleaned up (R3F loses the WebGL context) and come back when it is shown.
+  test.setTimeout(120_000);
+
+  test("the stage lets go of the GPU and comes back live", async ({ page }) => {
+    // Every journey time the stage shows, from any stage instance.
+    await page.addInitScript(() => {
+      const shown: number[] = [];
+      (window as unknown as { __journeys: number[] }).__journeys = shown;
+      new MutationObserver((records) => {
+        for (const record of records) {
+          shown.push(Number((record.target as HTMLElement).dataset.journey));
+        }
+        // Init scripts run before <html> exists: watch the document.
+      }).observe(document, {
+        subtree: true,
+        attributes: true,
+        attributeFilter: ["data-journey"],
+      });
+    });
+    await page.goto("/en?tier=1");
+    const html = page.locator("html");
+    await expect(html).toHaveAttribute("data-canvas", "live", {
+      timeout: 60_000,
+    });
+
+    await page.locator("#projects").scrollIntoViewIfNeeded();
+    await page
+      .locator("#projects")
+      .getByRole("link", { name: "Tramline", exact: true })
+      .click();
+    await expect(page).toHaveURL("/en/projects/tramline");
+    // Nothing 3D while reading a project, not even hidden.
+    await expect(page.locator(".stage-layer")).toHaveCount(0);
+    await expect(html).not.toHaveAttribute("data-canvas", "live");
+
+    await page.evaluate(() => {
+      (window as unknown as { __journeys: number[] }).__journeys.length = 0;
+    });
+    await page.goBack();
+    await expect(page).toHaveURL("/en?tier=1");
+    // The stage steps back behind Projects, so its first frame is drawn
+    // (and data-canvas turns "live") once Contact brings it back.
+    await expect(page.locator(".stage-layer canvas")).toHaveCount(1, {
+      timeout: 60_000,
+    });
+    await page.locator("#contact").scrollIntoViewIfNeeded();
+    await expect(html).toHaveAttribute("data-canvas", "live", {
+      timeout: 60_000,
+    });
+    const canvases = page.locator(".stage-layer canvas");
+    await expect(canvases).toHaveCount(1);
+    expect(
+      await canvases.evaluate(
+        (canvas: HTMLCanvasElement) =>
+          canvas.getContext("webgl2")?.isContextLost() ?? true,
+      ),
+    ).toBe(false);
+    // The new stage starts at the Projects stop (T 4..5) and goes on to
+    // Contact; it never flies there from the hero behind the grid.
+    const shown = await page.evaluate(
+      () => (window as unknown as { __journeys: number[] }).__journeys,
+    );
+    expect(shown.length).toBeGreaterThan(0);
+    expect(Math.min(...shown)).toBeGreaterThanOrEqual(4);
+  });
+
+  test("the canvas fades in when it goes live", async ({ page }) => {
+    await page.goto("/en?tier=1");
+    const canvas = page.locator(".stage-layer canvas");
+    await expect(page.locator("html")).toHaveAttribute("data-canvas", "live", {
+      timeout: 60_000,
+    });
+
+    await expect(canvas).toHaveCSS("opacity", "1");
+    await expect(canvas).toHaveCSS("transition-property", "opacity");
+    await expect(canvas).toHaveCSS("transition-duration", "0.6s");
+  });
+});
```

`tests/e2e/view-transitions.spec.ts` (a browser back lands on the grid in one step; the test waits for the forward slide to end first, see Verified facts):

```diff
diff --git a/tests/e2e/view-transitions.spec.ts b/tests/e2e/view-transitions.spec.ts
index 6dead22..b33411e 100644
--- a/tests/e2e/view-transitions.spec.ts
+++ b/tests/e2e/view-transitions.spec.ts
@@ -215,3 +215,36 @@ test("browsers without View Transitions still navigate", async ({ page }) => {
   await expect(page).toHaveURL("/en#projects");
   expect(errors).toEqual([]);
 });
+
+test("browser back returns to the grid at once, without scrolling the page", async ({
+  page,
+}) => {
+  await page.goto("/en");
+  await hydrated(page);
+  const card = page
+    .locator("#projects")
+    .getByRole("link", { name: "Tramline", exact: true });
+  await card.scrollIntoViewIfNeeded();
+  await card.click();
+  await expect(page).toHaveURL("/en/projects/tramline");
+  // A reader goes back after the page has slid in. Back during the slide
+  // lands at the end of the home page instead (Verified facts).
+  await page.waitForFunction(() => !document.activeViewTransition);
+  await page.evaluate(() => {
+    const seen: number[] = [];
+    (window as unknown as { __scrolls: number[] }).__scrolls = seen;
+    addEventListener("scroll", () => seen.push(Math.round(window.scrollY)));
+  });
+
+  await page.goBack();
+  await expect(page).toHaveURL("/en");
+  await expect(card).toBeInViewport();
+  const { scrolls, end } = await page.evaluate(() => ({
+    scrolls: (window as unknown as { __scrolls: number[] }).__scrolls,
+    end: Math.round(window.scrollY),
+  }));
+  // Back at the grid in one step: no smooth scroll through the sections
+  // (M6's CSS smooth scrolling animated the restore from the top).
+  expect(end).toBeGreaterThan(1000);
+  expect(scrolls.filter((y) => y > 200 && y < end - 200)).toEqual([]);
+});
```

- [ ] **Step 2: Run them to see them fail**

Run: `rtk proxy pnpm exec vitest run tests/unit/motion.test.ts`
Expected: `Test Files  1 failed (1)`, `Tests  1 failed | 5 passed (6)`: `TypeError: settleMotion is not a function`

Run: `pnpm exec playwright test tests/e2e/stage.spec.ts tests/e2e/view-transitions.spec.ts --project=public`
Expected: `3 failed`, `13 passed`: `browser back returns to the grid at once, without scrolling the page` (the restore glides through the page), `after a project page › the canvas fades in when it goes live` (no transition on the canvas) and `after a project page › the stage lets go of the GPU and comes back live` (the hidden home page keeps its `.stage-layer`). `with the live stage, section links glide there (Lenis)` passes already: the CSS smooth scrolling this task removes did the gliding until now; the test makes sure Lenis takes over

- [ ] **Step 3: Let go of the stage while hidden, start fresh where the page is**

`src/experience/StageLoader.tsx`:

```diff
diff --git a/src/experience/StageLoader.tsx b/src/experience/StageLoader.tsx
index ebccbca..c9504bf 100644
--- a/src/experience/StageLoader.tsx
+++ b/src/experience/StageLoader.tsx
@@ -1,7 +1,7 @@
 "use client";
 
 import dynamic from "next/dynamic";
-import { useEffect, useState } from "react";
+import { useEffect, useLayoutEffect, useState } from "react";
 import { type Capture, captureFromSearch } from "./capture-mode";
 import {
   classifyTier,
@@ -29,6 +29,21 @@ export function StageLoader() {
     pinned: boolean;
   } | null>(null);
 
+  // Next keeps a page it navigates away from in a hidden <Activity>: its
+  // effects are cleaned up (R3F then forces the WebGL context lost) but its
+  // state is kept. Drop the stage while hidden, so showing the page again
+  // mounts a fresh one, and keep the hero pinned with its poster meanwhile.
+  useLayoutEffect(
+    () => () => {
+      setLive(null);
+      const root = document.documentElement;
+      if (root.dataset.canvas === "live") {
+        root.dataset.canvas = "loading";
+      }
+    },
+    [],
+  );
+
   useEffect(() => {
     if (motion === null) {
       return;
```

`src/experience/director/motion.ts` and `src/experience/director/Director.tsx`:

```diff
diff --git a/src/experience/director/motion.ts b/src/experience/director/motion.ts
index f0e9058..43151ec 100644
--- a/src/experience/director/motion.ts
+++ b/src/experience/director/motion.ts
@@ -85,6 +85,21 @@ export type MotionInputs = {
   ledPulseAt: number | null;
 };
 
+/**
+ * Puts the journey and the pointer straight on their inputs: a stage that
+ * mounts mid-page (a reload, or back from a project page) starts on the
+ * section on screen instead of flying there from the hero.
+ */
+export function settleMotion(motion: Motion, inputs: MotionInputs): void {
+  const settle = (spring: Spring, value: number) => {
+    spring.value = value;
+    spring.velocity = 0;
+  };
+  settle(motion.journey, inputs.journey);
+  settle(motion.pointerX, inputs.pointer.x);
+  settle(motion.pointerY, inputs.pointer.y);
+}
+
 /**
  * Advances every spring by `dt` seconds towards the store's inputs; `snap`
  * jumps straight there (poster capture). Returns whether anything is still
```

```diff
diff --git a/src/experience/director/Director.tsx b/src/experience/director/Director.tsx
index f90468d..c15b8a4 100644
--- a/src/experience/director/Director.tsx
+++ b/src/experience/director/Director.tsx
@@ -8,7 +8,7 @@ import { orientationOf } from "./framing";
 import { wireInputs } from "./inputs";
 import { JourneyShot } from "./JourneyShot";
 import { type JourneyFrame, journeyFrame, stopTime } from "./journey";
-import { createMotion, stepGlow, stepMotion } from "./motion";
+import { createMotion, settleMotion, stepGlow, stepMotion } from "./motion";
 import type { StageStore } from "./store";
 
 type DirectorProps = {
@@ -49,6 +49,7 @@ export function Director({
     let frames = 0;
     let shown = -1;
     let last: number | null = null;
+    let fresh = true;
     let size = three().size;
     let dpr = three().viewport.dpr;
     if (capture) {
@@ -72,6 +73,11 @@ export function Director({
           dpr = viewport.dpr;
           state.invalidate();
         }
+        if (fresh) {
+          // The first frame shows the section on screen (settleMotion).
+          settleMotion(motion, state);
+          fresh = false;
+        }
         const snap = capture !== null;
         let moving = stepMotion(motion, state, dt, performance.now(), snap);
         frame.current = journeyFrame(
```

- [ ] **Step 4: Lenis for anchors, no CSS smooth scroll, a canvas fade**

`src/experience/scroll/loop.ts`:

```diff
diff --git a/src/experience/scroll/loop.ts b/src/experience/scroll/loop.ts
index dc3ec1b..80c5a78 100644
--- a/src/experience/scroll/loop.ts
+++ b/src/experience/scroll/loop.ts
@@ -8,13 +8,15 @@ import type { StageStore } from "../director/store";
  * The page's only requestAnimationFrame loop: GSAP's ticker drives Lenis,
  * Lenis scroll events drive ScrollTrigger, and `onTick` (the director) decides
  * whether R3F renders a frame. `smooth: false` (poster capture) skips Lenis.
+ * Lenis also glides to in-page anchors (the header's section links); without
+ * the live stage they jump, like every other scroll the browser restores.
  */
 export function startLoop(
   onTick: (seconds: number) => void,
   { smooth }: { smooth: boolean },
 ): () => void {
   gsap.registerPlugin(ScrollTrigger);
-  const lenis = smooth ? new Lenis({ autoRaf: false }) : null;
+  const lenis = smooth ? new Lenis({ autoRaf: false, anchors: true }) : null;
   lenis?.on("scroll", ScrollTrigger.update);
   const tick = (seconds: number) => {
     lenis?.raf(seconds * 1000);
```

`src/app/[locale]/layout.tsx` and `src/app/globals.css`:

```diff
diff --git a/src/app/[locale]/layout.tsx b/src/app/[locale]/layout.tsx
index 50cddee..439650d 100644
--- a/src/app/[locale]/layout.tsx
+++ b/src/app/[locale]/layout.tsx
@@ -35,11 +35,7 @@ export default async function LocaleLayout({
   const t = await getTranslations("Layout");
 
   return (
-    <html
-      lang={locale}
-      data-scroll-behavior="smooth"
-      className={`${sans.variable} ${mono.variable}`}
-    >
+    <html lang={locale} className={`${sans.variable} ${mono.variable}`}>
       <body className="min-h-dvh bg-canvas font-sans text-ink">
         <a
           href="#main"
```

```diff
diff --git a/src/app/globals.css b/src/app/globals.css
index 0b3e6f9..af7bcc1 100644
--- a/src/app/globals.css
+++ b/src/app/globals.css
@@ -104,12 +104,6 @@
     overflow-wrap: break-word;
     text-wrap: balance;
   }
-
-  @media (prefers-reduced-motion: no-preference) {
-    html {
-      scroll-behavior: smooth;
-    }
-  }
 }
 
 @layer components {
@@ -188,6 +182,15 @@ main > :not(.stage-layer) {
   z-index: 1;
 }
 
+/* A stage mounted mid-page (e.g. back from a project) fades in. */
+html:not([data-capture]) .stage-layer canvas {
+  transition: opacity 600ms var(--ease-out-quint);
+}
+
+html[data-canvas="loading"] .stage-layer canvas {
+  opacity: 0;
+}
+
 html:is([data-canvas="loading"], [data-canvas="live"]) .hero {
   height: 300lvh;
 }
```

- [ ] **Step 5: Run the tests again, then the poster step**

Run: `rtk proxy pnpm test`
Expected: `Test Files  1 failed | 41 passed (42)`, `Tests  1 failed | 311 passed (312)`: only `posters.test.ts › were captured from the current scene code` (the poster step fixes it)

Run the poster step (`pnpm build`, `pnpm assets:posters`).
Expected: `wrote 48 files and src/experience/posters.json`, and `/usr/bin/git status --short public/posters src/experience/posters.json` prints only ` M src/experience/posters.json`. The pictures did not change: the director's code did, so only the source hash moves.

Run: `rtk proxy pnpm test`, `rtk proxy pnpm typecheck`, `rtk proxy pnpm lint`
Expected: `Test Files  42 passed (42)`, `Tests  312 passed (312)`; lint `Checked 269 files in <n>ms. No fixes applied.`; no TypeScript errors.

Run: `pnpm test:e2e`
Expected: `/en: 149.5 KB gz before 3D`, `/ro: 149.5 KB gz before 3D`, `/en/projects/ledger-lens: 146.3 KB gz before 3D`, `lazy: 3 chunk(s), 315.8 KB gz`, `tier 3: +1 chunk, 81.7 KB gz`, the two `contact: … failed Error: EEXIST …` lines M3's outage test always prints, then `122 passed`

- [ ] **Step 6: Commit**

```bash
/usr/bin/git add public/posters src tests
/usr/bin/git commit -m "fix(stage): come back after a project page"
```

---

### Task 5: The CV PDF, the headshot and the company links on the home page

**Owner:** frontend-engineer (sections, strings, format helper); the e2e database reset in `scripts/e2e-db.ts` is a small backend touch, reviewed with this task.

The owner can already pick a headshot and a CV PDF per language in **Profile** and a company URL in **Experience** (M2); Task 1 put them into the view model. This task shows them: a "Download CV" link in the hero and in Contact (with its size, `PDF, 89 kB`; on `/ro` without a Romanian PDF it offers the English one with `hreflang="en"`), a round 56 px headshot above About's statement, and the company name as a link in Experience. Nothing shows while a field is empty, so the fixtures render as before.

**Files:**
- Create: `src/components/sections/CvDownload.tsx`
- Modify: `src/components/sections/{Hero,Contact,About,Experience}.tsx`, `src/lib/format.ts`, `messages/{en,ro}.json`, `scripts/e2e-db.ts`
- Test: `tests/unit/format.test.ts`, `tests/e2e/media-library.ts` (new helper), `tests/e2e/{about-skills-experience,admin-profile,admin-projects}.spec.ts`

**Interfaces:**
- Consumes: Task 1's `Cv["profile"].avatar: MediaImage | null`, `.cvPdf: Localized<MediaFile> | null`, `Cv["experience"][number].url` (M1, the company site); Task 2's `OptimizedImage`.
- Produces:
  - `formatFileSize(bytes: number, locale: Locale): string` (`89 kB`, `1.4 MB`, `1,4 MB` in RO).
  - `CvDownload({ cvPdf, locale, className? })`: `a[type="application/pdf"]`, 44 px tall, text `Download CV` + `PDF, <size>`.
  - Messages: `Cv.{download,format,title}`.
  - `tests/e2e/media-library.ts`: `pngFile(name, width, height)`, `PDF_FILE`, `uploadMedia(page, file, alt: { en, ro? })`, `mediaId(page, picker, alt)`, `deleteMedia(page, id)`: admin tests upload files with unique alt texts, find their own media id in a picker and delete by id. Playwright runs admin spec *files* in parallel workers (`fullyParallel: false` only orders tests inside a file), so a test that deleted "every file called cover.png" removed another worker's upload.
  - `scripts/e2e-db.ts` also deletes every `media` row of `cv_e2e` and its file under `.data/media`, so a failed run's uploads do not linger in the pickers.

- [ ] **Step 1: Write the failing tests**

`tests/unit/format.test.ts`:

```diff
diff --git a/tests/unit/format.test.ts b/tests/unit/format.test.ts
index 237fa78..73eb353 100644
--- a/tests/unit/format.test.ts
+++ b/tests/unit/format.test.ts
@@ -1,5 +1,5 @@
 import { afterEach, describe, expect, it } from "vitest";
-import { formatYearMonth } from "@/lib/format";
+import { formatFileSize, formatYearMonth } from "@/lib/format";
 
 describe("formatYearMonth", () => {
   const originalTz = process.env.TZ;
@@ -22,3 +22,14 @@ describe("formatYearMonth", () => {
     expect(formatYearMonth("2021-03", "en")).toBe("Mar 2021");
   });
 });
+
+describe("formatFileSize", () => {
+  it("shows kilobytes without decimals", () => {
+    expect(formatFileSize(91_000, "en")).toBe("89 kB");
+  });
+
+  it("switches to megabytes with one decimal, per locale", () => {
+    expect(formatFileSize(1_500_000, "en")).toBe("1.4 MB");
+    expect(formatFileSize(1_500_000, "ro")).toBe("1,4 MB");
+  });
+});
```

`tests/e2e/media-library.ts`:

```ts
import { expect, type Page } from "@playwright/test";
import sharp from "sharp";

// Admin spec files run in parallel workers: each test uploads files with
// its own alt text and deletes only those, found by their media id.

export async function pngFile(name: string, width: number, height: number) {
  const buffer = await sharp({
    create: { width, height, channels: 3, background: "#27496d" },
  })
    .png()
    .toBuffer();
  return { name, mimeType: "image/png", buffer };
}

export const PDF_FILE = {
  name: "cv.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.4\n% e2e resume\n%%EOF\n"),
};

export async function uploadMedia(
  page: Page,
  file: { name: string; mimeType: string; buffer: Buffer },
  alt: { en: string; ro?: string },
) {
  await page.goto("/admin/media");
  await page.getByLabel(/^File/).setInputFiles(file);
  await page.getByLabel("Alt text (EN)", { exact: true }).fill(alt.en);
  await page.getByLabel("Alt text (RO)", { exact: true }).fill(alt.ro ?? "");
  await page.getByRole("button", { name: "Upload" }).click();
  await expect(page.getByRole("status").first()).toHaveText("Uploaded.");
}

/** The media id behind a picker option (its label is the alt text). */
export async function mediaId(page: Page, picker: string, alt: string) {
  const id = await page
    .getByLabel(picker, { exact: true })
    .locator("option", { hasText: alt })
    .getAttribute("value");
  expect(id).toBeTruthy();
  return id ?? "";
}

export async function deleteMedia(page: Page, id: string) {
  await page.goto("/admin/media");
  const form = page
    .locator("form")
    .filter({ has: page.locator(`input[name="id"][value="${id}"]`) })
    .filter({ has: page.getByRole("button", { name: /^Delete / }) });
  page.once("dialog", (dialog) => dialog.accept());
  await form.getByRole("button", { name: /^Delete / }).click();
  await expect(form).toHaveCount(0);
}
```

`tests/e2e/about-skills-experience.spec.ts`:

```diff
diff --git a/tests/e2e/about-skills-experience.spec.ts b/tests/e2e/about-skills-experience.spec.ts
index 61b6250..52abd34 100644
--- a/tests/e2e/about-skills-experience.spec.ts
+++ b/tests/e2e/about-skills-experience.spec.ts
@@ -40,3 +40,16 @@ test("marks English fallback text with lang=en on /ro", async ({ page }) => {
     ),
   ).toHaveAttribute("lang", "en");
 });
+
+test("links a company to its site when it has one", async ({ page }) => {
+  await page.goto("/en");
+  const experience = page.getByRole("region", { name: "Experience" });
+
+  await expect(
+    experience.getByRole("link", { name: "Ardea Health" }),
+  ).toHaveAttribute("href", "https://example.com/ardea-health");
+  await expect(experience.getByText("Studio Meridian")).toBeVisible();
+  await expect(
+    experience.getByRole("link", { name: "Studio Meridian" }),
+  ).toHaveCount(0);
+});
```

`tests/e2e/admin-profile.spec.ts` (the headshot and CV test lives here, not in a new file, because it edits the same profile as the other tests in this file and must not run beside them):

```diff
diff --git a/tests/e2e/admin-profile.spec.ts b/tests/e2e/admin-profile.spec.ts
index d81dd72..517075e 100644
--- a/tests/e2e/admin-profile.spec.ts
+++ b/tests/e2e/admin-profile.spec.ts
@@ -1,6 +1,13 @@
 import AxeBuilder from "@axe-core/playwright";
-import { expect, test } from "@playwright/test";
+import { expect, type Page, test } from "@playwright/test";
 import { signInAsOwner } from "./admin-login";
+import {
+  deleteMedia,
+  mediaId,
+  PDF_FILE,
+  pngFile,
+  uploadMedia,
+} from "./media-library";
 
 const SEEDED_RO_HEADLINE =
   "Dezvoltator fullstack care construiește produse web rapide și accesibile, de la baza de date la pixel.";
@@ -74,3 +81,67 @@ test("the profile page has no axe violations", async ({ page }) => {
 
   expect(violations.map((v) => v.id)).toEqual([]);
 });
+
+async function pick(page: Page, picks: Record<string, string>) {
+  await page.goto("/admin/profile");
+  for (const [picker, option] of Object.entries(picks)) {
+    await page
+      .getByLabel(picker, { exact: true })
+      .selectOption({ label: option });
+  }
+  await page.getByRole("button", { name: "Save profile" }).click();
+  await expect(page.getByRole("status")).toHaveText("Profile saved.");
+}
+
+test("the headshot and the CV PDF picked here show on the home page", async ({
+  page,
+  request,
+}) => {
+  await uploadMedia(page, await pngFile("headshot.png", 400, 400), {
+    en: "Owner headshot",
+  });
+  await uploadMedia(page, PDF_FILE, { en: "Owner resume (EN)" });
+  await page.goto("/admin/profile");
+  const ids = [
+    await mediaId(page, "Avatar", "Owner headshot"),
+    await mediaId(page, "CV PDF (EN)", "Owner resume (EN)"),
+  ];
+  await pick(page, {
+    Avatar: "Owner headshot",
+    "CV PDF (EN)": "Owner resume (EN)",
+  });
+
+  await page.goto("/en");
+  const download = page
+    .getByRole("region", { name: "Alex Marin" })
+    .getByRole("link", { name: /Download CV/ });
+  await expect(download).toHaveAttribute("href", /^\/api\/media\/.+\.pdf$/);
+  await expect(download).toHaveAttribute("type", "application/pdf");
+  const pdf = await request.get((await download.getAttribute("href")) ?? "");
+  expect(pdf.headers()["content-type"]).toBe("application/pdf");
+  await expect(
+    page
+      .getByRole("region", { name: "Let's build" })
+      .getByRole("link", { name: /Download CV/ }),
+  ).toBeVisible();
+  await expect(
+    page
+      .getByRole("region", { name: "About" })
+      .getByRole("img", { name: "Owner headshot" }),
+  ).toBeVisible();
+
+  // No Romanian PDF yet: /ro offers the English one and says so.
+  await page.goto("/ro");
+  await expect(
+    page
+      .getByRole("region", { name: "Alex Marin" })
+      .getByRole("link", { name: /Descarcă CV-ul/ }),
+  ).toHaveAttribute("hreflang", "en");
+
+  await pick(page, { Avatar: "None", "CV PDF (EN)": "None" });
+  await page.goto("/en");
+  await expect(page.getByRole("link", { name: /Download CV/ })).toHaveCount(0);
+  for (const id of ids) {
+    await deleteMedia(page, id);
+  }
+});
```

`tests/e2e/admin-projects.spec.ts` (now uses the helpers):

```diff
diff --git a/tests/e2e/admin-projects.spec.ts b/tests/e2e/admin-projects.spec.ts
index b383f19..496c82e 100644
--- a/tests/e2e/admin-projects.spec.ts
+++ b/tests/e2e/admin-projects.spec.ts
@@ -1,7 +1,7 @@
 import AxeBuilder from "@axe-core/playwright";
-import { expect, type Page, test } from "@playwright/test";
-import sharp from "sharp";
+import { expect, test } from "@playwright/test";
 import { signInAsOwner } from "./admin-login";
+import { deleteMedia, mediaId, pngFile, uploadMedia } from "./media-library";
 
 test.beforeEach(async ({ page }) => {
   await signInAsOwner(page);
@@ -40,35 +40,21 @@ test("a project is created with a markdown preview and published", async ({
   await expect(page).toHaveURL("/admin/projects");
 });
 
-/** Uploads a 1600x1000 PNG to the media library under `alt`. */
-async function uploadCover(page: Page, alt: { en: string; ro: string }) {
-  await page.goto("/admin/media");
-  const buffer = await sharp({
-    create: { width: 1600, height: 1000, channels: 3, background: "#27496d" },
-  })
-    .png()
-    .toBuffer();
-  await page.getByLabel(/^File/).setInputFiles({
-    name: "cover.png",
-    mimeType: "image/png",
-    buffer,
-  });
-  await page.getByLabel("Alt text (EN)", { exact: true }).fill(alt.en);
-  await page.getByLabel("Alt text (RO)", { exact: true }).fill(alt.ro);
-  await page.getByRole("button", { name: "Upload" }).click();
-  await expect(page.getByRole("status").first()).toHaveText("Uploaded.");
-}
-
 test("a cover, a case study and links from the admin reach the project page", async ({
   page,
   request,
 }) => {
-  await uploadCover(page, {
+  await uploadMedia(page, await pngFile("cover.png", 1600, 1000), {
     en: "The pass planner at dawn",
     ro: "Planificatorul de treceri în zori",
   });
 
   await page.goto("/admin/projects/new");
+  const coverId = await mediaId(
+    page,
+    "Cover image",
+    "The pass planner at dawn",
+  );
   await page.getByLabel("Slug").fill("pass-planner");
   await page.getByLabel("Year").fill("2026");
   await page.getByLabel("Live URL").fill("https://example.com/pass-planner");
@@ -206,12 +192,7 @@ test("a cover, a case study and links from the admin reach the project page", as
   await page.goto("/admin/projects/pass-planner");
   await page.getByRole("button", { name: "Delete" }).click();
   await expect(page).toHaveURL("/admin/projects");
-  await page.goto("/admin/media");
-  page.once("dialog", (dialog) => dialog.accept());
-  await page
-    .getByRole("button", { name: /^Delete / })
-    .first()
-    .click();
+  await deleteMedia(page, coverId);
   expect((await page.goto("/en/projects/pass-planner"))?.status()).toBe(404);
 });
```

- [ ] **Step 2: Run them to see them fail**

Run: `rtk proxy pnpm exec vitest run tests/unit/format.test.ts`
Expected: `Test Files  1 failed (1)`, `Tests  2 failed | 3 passed (5)`: `TypeError: formatFileSize is not a function`

Run: `pnpm exec playwright test tests/e2e/about-skills-experience.spec.ts --project=public`, then `pnpm exec playwright test tests/e2e/admin-profile.spec.ts tests/e2e/admin-projects.spec.ts --project=admin --no-deps` (`--no-deps` skips the public specs this once).
Expected: the public run: `1 failed`, `links a company to its site when it has one`; the admin run: `1 failed`, `9 passed`, `the headshot and the CV PDF picked here show on the home page` (`getByRole('region', { name: 'Alex Marin' }).getByRole('link', { name: /Download CV/ })` not found). The refactored `admin-projects.spec.ts` passes

- [ ] **Step 3: The size format, the download link, the strings**

`src/lib/format.ts`:

```diff
diff --git a/src/lib/format.ts b/src/lib/format.ts
index d5d20b5..d6790c2 100644
--- a/src/lib/format.ts
+++ b/src/lib/format.ts
@@ -13,3 +13,14 @@ export function formatYearMonth(value: YearMonth, locale: Locale): string {
     timeZone: "UTC",
   }).format(new Date(Date.UTC(year, month - 1, 1)));
 }
+
+/** A file size as the visitor reads it: `89 kB`, `1.4 MB` (`1,4 MB` in RO). */
+export function formatFileSize(bytes: number, locale: Locale): string {
+  const mb = bytes >= 1024 * 1024;
+  return new Intl.NumberFormat(locale, {
+    style: "unit",
+    unit: mb ? "megabyte" : "kilobyte",
+    unitDisplay: "short",
+    maximumFractionDigits: mb ? 1 : 0,
+  }).format(bytes / (mb ? 1024 * 1024 : 1024));
+}
```

`src/components/sections/CvDownload.tsx`:

```tsx
import { useTranslations } from "next-intl";
import type { Localized, MediaFile } from "@/content/types";
import type { Locale } from "@/i18n/routing";
import { formatFileSize } from "@/lib/format";

/**
 * The CV PDF picked in the admin. On /ro without a Romanian PDF it offers
 * the English one and marks it with hreflang.
 */
export function CvDownload({
  cvPdf,
  locale,
  className = "",
}: {
  cvPdf: Localized<MediaFile>;
  locale: Locale;
  className?: string;
}) {
  const t = useTranslations("Cv");

  return (
    <a
      href={cvPdf.value.url}
      type="application/pdf"
      hrefLang={cvPdf.lang === locale ? undefined : cvPdf.lang}
      className={`inline-flex min-h-11 items-center gap-2 underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-signal ${className}`}
    >
      {t("download")}
      <span className="font-mono text-label uppercase text-ink-subtle">
        {t("format", { size: formatFileSize(cvPdf.value.bytes, locale) })}
      </span>
    </a>
  );
}
```

`messages/en.json` and `messages/ro.json`:

```diff
diff --git a/messages/en.json b/messages/en.json
index c3340c6..1a6e7ce 100644
--- a/messages/en.json
+++ b/messages/en.json
@@ -110,6 +110,11 @@
       }
     }
   },
+  "Cv": {
+    "download": "Download CV",
+    "format": "PDF, {size}",
+    "title": "CV"
+  },
   "NotFound": {
     "title": "Page not found",
     "description": "The page you are looking for does not exist."
```

```diff
diff --git a/messages/ro.json b/messages/ro.json
index 59e0b30..bac09f2 100644
--- a/messages/ro.json
+++ b/messages/ro.json
@@ -110,6 +110,11 @@
       }
     }
   },
+  "Cv": {
+    "download": "Descarcă CV-ul",
+    "format": "PDF, {size}",
+    "title": "CV"
+  },
   "NotFound": {
     "title": "Pagina nu a fost găsită",
     "description": "Pagina pe care o cauți nu există."
```

- [ ] **Step 4: Show them in the sections**

`src/components/sections/Hero.tsx`, `Contact.tsx`, `About.tsx`, `Experience.tsx`:

```diff
diff --git a/src/components/sections/Hero.tsx b/src/components/sections/Hero.tsx
index 4ff6316..7a43f13 100644
--- a/src/components/sections/Hero.tsx
+++ b/src/components/sections/Hero.tsx
@@ -1,6 +1,7 @@
 import { useTranslations } from "next-intl";
 import { fallbackLang } from "@/content/localize";
 import type { Cv } from "@/content/types";
+import { CvDownload } from "./CvDownload";
 import { HeroPoster } from "./HeroPoster";
 
 /**
@@ -43,7 +44,7 @@ export function Hero({ cv }: { cv: Cv }) {
             >
               {profile.headline.value}
             </p>
-            <div className="mt-10 flex flex-wrap gap-3">
+            <div className="mt-10 flex flex-wrap items-center gap-3">
               <a
                 href="#contact"
                 className="rounded-full bg-signal px-6 py-3 font-medium text-signal-ink motion-safe:transition-transform motion-safe:duration-(--motion-press) motion-safe:active:scale-[0.98]"
@@ -56,6 +57,13 @@ export function Hero({ cv }: { cv: Cv }) {
               >
                 {t("secondaryCta")}
               </a>
+              {profile.cvPdf ? (
+                <CvDownload
+                  cvPdf={profile.cvPdf}
+                  locale={locale}
+                  className="ml-2 text-sm text-ink-muted hover:text-ink"
+                />
+              ) : null}
             </div>
           </div>
         </div>
```

```diff
diff --git a/src/components/sections/Contact.tsx b/src/components/sections/Contact.tsx
index cf72d53..b03b1a2 100644
--- a/src/components/sections/Contact.tsx
+++ b/src/components/sections/Contact.tsx
@@ -2,11 +2,13 @@ import { useLocale, useTranslations } from "next-intl";
 import { Section } from "@/components/ui/Section";
 import type { Cv } from "@/content/types";
 import { ContactForm, type ContactFormLabels } from "./ContactForm";
+import { CvDownload } from "./CvDownload";
 
 const SOCIAL_LABELS = { github: "GitHub", linkedin: "LinkedIn" } as const;
 
 export function Contact({ cv }: { cv: Cv }) {
   const t = useTranslations("Contact");
+  const cvText = useTranslations("Cv");
   const locale = useLocale();
   const { profile } = cv;
   const labels: ContactFormLabels = {
@@ -65,6 +67,18 @@ export function Contact({ cv }: { cv: Cv }) {
               ))}
             </ul>
           </div>
+          {profile.cvPdf ? (
+            <div>
+              <h3 className="font-mono text-label uppercase text-ink-subtle">
+                {cvText("title")}
+              </h3>
+              <CvDownload
+                cvPdf={profile.cvPdf}
+                locale={cv.locale}
+                className="mt-1 text-ink"
+              />
+            </div>
+          ) : null}
         </div>
         <ContactForm locale={locale} labels={labels} />
       </div>
```

```diff
diff --git a/src/components/sections/About.tsx b/src/components/sections/About.tsx
index e9cb2d6..427e844 100644
--- a/src/components/sections/About.tsx
+++ b/src/components/sections/About.tsx
@@ -1,4 +1,5 @@
 import { useTranslations } from "next-intl";
+import { OptimizedImage } from "@/components/ui/OptimizedImage";
 import { Section } from "@/components/ui/Section";
 import { fallbackLang } from "@/content/localize";
 import type { Cv } from "@/content/types";
@@ -20,6 +21,17 @@ export function About({ cv }: { cv: Cv }) {
   return (
     <Section id="about" title={t("title")} scene="about">
       <div className="flex flex-col gap-12 lg:w-7/12">
+        {profile.avatar ? (
+          <OptimizedImage
+            src={profile.avatar.url}
+            alt={profile.avatar.alt.value}
+            lang={fallbackLang(profile.avatar.alt, locale)}
+            width={112}
+            height={112}
+            sizes="56px"
+            className="size-14 rounded-full object-cover ring-1 ring-line"
+          />
+        ) : null}
         <p
           lang={fallbackLang(profile.summary, locale)}
           className="text-statement text-ink"
```

```diff
diff --git a/src/components/sections/Experience.tsx b/src/components/sections/Experience.tsx
index b902c32..dd8d750 100644
--- a/src/components/sections/Experience.tsx
+++ b/src/components/sections/Experience.tsx
@@ -37,7 +37,17 @@ export function Experience({ cv }: { cv: Cv }) {
                 {job.roleTitle.value}
               </h3>
               <p className="mt-1 text-ink-muted">
-                {job.company} · {t(`employmentType.${job.employmentType}`)}
+                {job.url ? (
+                  <a
+                    href={job.url}
+                    className="underline decoration-line-strong underline-offset-4 transition-colors hover:text-ink hover:decoration-signal"
+                  >
+                    {job.company}
+                  </a>
+                ) : (
+                  job.company
+                )}{" "}
+                · {t(`employmentType.${job.employmentType}`)}
               </p>
               <p
                 lang={fallbackLang(job.description, locale)}
```

- [ ] **Step 5: Reset uploads with the e2e database**

`scripts/e2e-db.ts`:

```diff
diff --git a/scripts/e2e-db.ts b/scripts/e2e-db.ts
index 9a2abb7..d16cc1a 100644
--- a/scripts/e2e-db.ts
+++ b/scripts/e2e-db.ts
@@ -3,14 +3,16 @@ import { Client } from "pg";
 import { upsertAdmin } from "@/server/auth/admin";
 import { createAuth } from "@/server/auth/create-auth";
 import { createDb } from "@/server/db/create-db";
-import { message } from "@/server/db/schema";
+import { media, message } from "@/server/db/schema";
 import { seedContent } from "@/server/db/seed";
+import { createLocalStore, LOCAL_MEDIA_DIR } from "@/server/media/store";
 import { requireEnv } from "./require-env";
 
 // Prepares the e2e database named in DATABASE_URL (playwright.config.ts points
 // it at `cv_e2e`, never the dev database): creates it if missing, applies the
 // migrations, resets the CV content to the fixtures, deletes contact messages
-// and (re)creates the owner account from ADMIN_EMAIL / ADMIN_PASSWORD.
+// and uploads (with their files) and (re)creates the owner account from
+// ADMIN_EMAIL / ADMIN_PASSWORD.
 async function main() {
   const url = new URL(requireEnv("DATABASE_URL"));
   const name = url.pathname.slice(1);
@@ -40,6 +42,15 @@ async function main() {
     await seedContent(db, { reset: true });
     // Messages from an earlier run would count against the contact rate limit.
     await db.delete(message);
+    // Uploads left by a test that failed before cleaning up would show up in
+    // the media pickers. Only this database's files are removed.
+    const uploads = await db
+      .delete(media)
+      .returning({ pathname: media.pathname });
+    const store = createLocalStore(LOCAL_MEDIA_DIR);
+    for (const { pathname } of uploads) {
+      await store.delete(pathname);
+    }
     const adminEmail = requireEnv("ADMIN_EMAIL");
     const auth = createAuth({
       db,
```

- [ ] **Step 6: Run the tests again**

Run: `rtk proxy pnpm test`, `rtk proxy pnpm typecheck`, `rtk proxy pnpm lint`
Expected: `Test Files  42 passed (42)`, `Tests  314 passed (314)`; lint `Checked 271 files in <n>ms. No fixes applied.`; no TypeScript errors.

Run: `pnpm test:e2e`
Expected: `/en: 149.5 KB gz before 3D`, `/ro: 149.5 KB gz before 3D`, `/en/projects/ledger-lens: 146.3 KB gz before 3D`, `lazy: 3 chunk(s), 315.8 KB gz`, `tier 3: +1 chunk, 81.7 KB gz`, the two `contact: … failed Error: EEXIST …` lines M3's outage test always prints, then `124 passed` (the headshot is a plain server-rendered `<img>`: the budgets do not move).

- [ ] **Step 7: Commit**

```bash
/usr/bin/git add messages scripts src tests
/usr/bin/git commit -m "feat(content): show the cv pdf, headshot and links"
```

---

### Task 6: The stack stays on screen and clear of the copy

**Owner:** frontend-engineer; the poster step may go to devops-engineer.

M6 authored every shot for 16:9 and cropped it like `object-fit: cover` around the centre. On 16:10 and 3:2 laptops that cut the stack at the right edge, and the copy columns (7/12 of the width) ran into it: About's text ended 8 px from the lifted glass at 1280 px, the base plate sat on the bottom edge at 1366x768, and Contact's form covered the stack's left third. Measured on the GPU before the change, 1280x800 to 1500x1000.

The fix, in order of effect:

1. **Crop from the right in landscape.** `coverViewOffset(..., align)` keeps the frame's right edge when the sides are cropped (`"end"`), so a narrower screen loses the empty left of the shot, never the stack. Posters crop the same way (`object-position: right center`).
2. **New camera keys** for the hero's end (T = 1), About (1.55), Skills (2.2, 2.8) and Contact (6): the stack sits in the right half with 32 px to spare from the copy and 16 px from the viewport on every size from 1280x720 to 1920x1080 (1280x800 and 1440x900 included). They were found by a search over camera positions and targets against these limits, then checked on the GPU.
3. **Copy takes the left half:** the hero, About, Contact and section intros are `lg:w-1/2` (hero `md:w-1/2`), About's facts are a 2x2 grid.
4. **About turns the stack −30° (away from the camera).** M6's +30° turned it towards the camera and read as almost frontal; −30° reads as a clear three-quarter view.
5. **Skills:** "The stack" stays on one line (`clamp(2.25rem, 1.25rem + 2.2vw, 3.5rem)` on the pinned title); a row whose layer is behind the camera keeps its place instead of flying off (M6 measured it 13,000 px below: `project()` returns `null` for points outside the clip range, and `.skills-layers` clips its overflow); `text-wrap: pretty` on paragraphs, list items and definitions.
6. **A test hook:** the stage writes the stack's screen box to `.stage-layer[data-box="x y width height"]` every frame (`stackBox`), which the framing e2e compares with the copy's boxes.

**Files:**
- Modify: `src/experience/director/{framing.ts,journey.ts,shots.ts,page-links.ts,JourneyShot.tsx}`, `src/components/sections/{Hero,About,Contact}.tsx`, `src/components/ui/Section.tsx`, `src/app/globals.css`, `public/posters/*` and `src/experience/posters.json` (poster step)
- Test: `tests/unit/page-links.test.ts` (new), `tests/unit/{framing,journey,shots}.test.ts`, `tests/e2e/framing.spec.ts` (new), `tests/e2e/scenes.spec.ts`

**Interfaces:**
- Consumes: M6's `coverViewOffset`, `JOURNEY_KEYS`, `HERO_KEYS`, `anchorRows`, `findPageLinks`, `STACK_OBJECTS`, capture mode (`?capture=<t>` puts the stage at a journey time with the posters' framing).
- Produces:
  - `coverViewOffset(width, height, referenceAspect, align: "center" | "end" = "center"): ViewOffset` (Task 8 renames `"end"` to `"right"` and adds `"bottom"`).
  - `stackBox(scene, camera, width, height): [x, y, width, height] | null` (viewport px, every corner of every slab; `null` while any corner is behind the camera).
  - `.stage-layer[data-box]`.
  - Camera keys (landscape): hero T 1 `[0.675, 0.585, 1.464]` → `[-0.477, 0.12, 0.117]`; 1.55 `[0.726, 0.74, 1.447]` → `[-0.514, 0.19, 0.067]`; 2.2 `[1.01, 0.962, 1.962]` → `[-0.61, 0.302, 0.012]`; 2.8 `[0.749, 1.042, 2.164]` → `[-0.651, 0.302, 0.014]`; 6 `[0.763, 0.315, 1.56]` → `[-0.506, 0.08, 0.092]`. About yaw `-Math.PI / 6`.

Three existing unit tests change on purpose: `shots.test.ts` (the monolith's x range in landscape is now the right half), `journey.test.ts` (About's yaw sign) and `framing.test.ts` (the new `align` argument).

- [ ] **Step 1: Write the failing tests**

`tests/unit/framing.test.ts`, `tests/unit/journey.test.ts`, `tests/unit/shots.test.ts`:

```diff
diff --git a/tests/unit/framing.test.ts b/tests/unit/framing.test.ts
index 28c5ae7..d11b70b 100644
--- a/tests/unit/framing.test.ts
+++ b/tests/unit/framing.test.ts
@@ -36,6 +36,16 @@ describe("coverViewOffset", () => {
     expect(view.y).toBe(0);
   });
 
+  it("can keep the right edge instead, like object-position: right", () => {
+    // Landscape shots put the stack right of the copy: a 16:10 or 3:2
+    // laptop loses the empty left of the frame, never the stack.
+    const view = coverViewOffset(1440, 1080, wide, "end");
+
+    expect(view.x).toBeCloseTo(480);
+    expect(view.x + view.width).toBeCloseTo(view.fullWidth);
+    expect(coverViewOffset(2560, 1080, wide, "end").y).toBeCloseTo(180);
+  });
+
   it("crops top and bottom of a wider viewport", () => {
     const view = coverViewOffset(2560, 1080, wide);
```

```diff
diff --git a/tests/unit/journey.test.ts b/tests/unit/journey.test.ts
index e3432d5..3fd1454 100644
--- a/tests/unit/journey.test.ts
+++ b/tests/unit/journey.test.ts
@@ -117,9 +117,11 @@ describe("journeyFrame", () => {
     });
   }
 
-  it("About yaws the stack 30 degrees and lifts the glass", () => {
+  it("About yaws the stack 30 degrees away and lifts the glass", () => {
     const about = journeyFrame(1.6, "landscape");
-    expect(about.yaw).toBeCloseTo(Math.PI / 6);
+    // Away from the camera: a three-quarter view (M6 turned it towards the
+    // camera, which read as barely turned).
+    expect(about.yaw).toBeCloseTo(-Math.PI / 6);
     expect(about.lift).toBeGreaterThan(0.05);
     expect(about.explode).toBe(0);
     // Focus racks to the lifted glass.
```

```diff
diff --git a/tests/unit/shots.test.ts b/tests/unit/shots.test.ts
index 72cb371..b9411f2 100644
--- a/tests/unit/shots.test.ts
+++ b/tests/unit/shots.test.ts
@@ -90,7 +90,7 @@ describe("heroFrame", () => {
 
 describe("the hero's end frame", () => {
   for (const orientation of ["landscape", "portrait"] as const) {
-    it(`shows the whole monolith (${orientation})`, () => {
+    it(`shows the whole monolith where the layout wants it (${orientation})`, () => {
       const { width, height } = REFERENCE_SIZE[orientation];
       const camera = new PerspectiveCamera(
         SHOT_FOV[orientation],
@@ -103,11 +103,17 @@ describe("the hero's end frame", () => {
       camera.lookAt(...end.target);
       camera.updateMatrixWorld();
       const half = STACK_FOOTPRINT / 2;
+      // Landscape keeps it in the right half, clear of the copy and the
+      // edge (tests/e2e/framing.spec.ts checks real screens); portrait
+      // keeps it inside the frame.
+      const [left, right] =
+        orientation === "landscape" ? [0.1, 0.96] : [-0.9, 0.9];
       for (const x of [-half, half]) {
         for (const y of [0, STACK_HEIGHT]) {
           for (const z of [-half, half]) {
             const corner = new Vector3(x, y, z).project(camera);
-            expect(Math.abs(corner.x), `x of ${x},${y},${z}`).toBeLessThan(0.9);
+            expect(corner.x, `x of ${x},${y},${z}`).toBeGreaterThan(left);
+            expect(corner.x, `x of ${x},${y},${z}`).toBeLessThan(right);
             expect(Math.abs(corner.y), `y of ${x},${y},${z}`).toBeLessThan(0.9);
           }
         }
```

`tests/unit/page-links.test.ts`:

```ts
import { Object3D, PerspectiveCamera } from "three";
import { describe, expect, it } from "vitest";
import { STACK_LAYERS } from "@/content/types";
import {
  anchorRows,
  type PageLinks,
  stackBox,
} from "@/experience/director/page-links";
import { layerObjectName, stackLayout } from "@/experience/scenes/stack-layout";

/** The five slabs, closed, and a camera 1.2 m in front of the stack. */
function studio(cameraZ = 1.2) {
  const scene = new Object3D();
  for (const placement of stackLayout()) {
    const slab = new Object3D();
    slab.name = placement.name;
    slab.position.y = placement.y;
    scene.add(slab);
  }
  const camera = new PerspectiveCamera(30, 16 / 9, 0.01, 30);
  camera.position.set(0, 0.12, cameraZ);
  camera.lookAt(0, 0.12, 0);
  camera.updateMatrixWorld();
  return { scene, camera };
}

/** A Skills row: just the style calls anchorRows makes. */
function fakeRow() {
  const values = new Map<string, string>();
  return {
    values,
    style: {
      setProperty: (name: string, value: string) => values.set(name, value),
      getPropertyValue: (name: string) => values.get(name) ?? "",
    },
  } as unknown as HTMLElement & { values: Map<string, string> };
}

describe("stackBox", () => {
  it("is the stack's box on screen, in viewport pixels", () => {
    const { scene, camera } = studio();
    const box = stackBox(scene, camera, 1920, 1080);

    expect(box).not.toBeNull();
    const [x, y, width, height] = box ?? [0, 0, 0, 0];
    // Centred in front of the camera, a little taller than wide at 1.2 m.
    expect(x + width / 2).toBeCloseTo(960, -1);
    expect(y + height / 2).toBeGreaterThan(400);
    expect(width).toBeGreaterThan(400);
    expect(width).toBeLessThan(1000);
    expect(height).toBeGreaterThan(200);
  });

  it("has no box while part of the stack is behind the camera", () => {
    const { scene, camera } = studio(0.1);

    expect(stackBox(scene, camera, 1920, 1080)).toBeNull();
  });
});

describe("anchorRows", () => {
  it("leaves a row where it was while its layer is behind the camera", () => {
    // M6 wrote --ay: -158339px here, and a jump to the end of the page grew
    // it by 13,000 px of empty scroll.
    const { scene, camera } = studio(0.1);
    const rows = new Map(STACK_LAYERS.map((layer) => [layer, fakeRow()]));
    const links: PageLinks = { list: fakeRow(), rows, jobs: [] };

    anchorRows(links, scene, camera, 1920, 1080, 1);

    for (const layer of STACK_LAYERS) {
      expect(
        (rows.get(layer) as unknown as { values: Map<string, string> }).values
          .size,
        layerObjectName(layer),
      ).toBe(0);
    }
  });

  it("anchors every row next to its layer when the stack is in view", () => {
    const { scene, camera } = studio();
    const rows = new Map(STACK_LAYERS.map((layer) => [layer, fakeRow()]));

    anchorRows(
      { list: fakeRow(), rows, jobs: [] },
      scene,
      camera,
      1920,
      1080,
      1,
    );

    const ay = STACK_LAYERS.map((layer) =>
      Number.parseInt(
        (
          rows.get(layer) as unknown as { values: Map<string, string> }
        ).values.get("--ay") ?? "",
        10,
      ),
    );
    // Glass on top: rows go down the screen from interface to craft.
    expect(ay).toEqual([...ay].sort((a, b) => a - b));
  });
});
```

`tests/e2e/framing.spec.ts` (capture mode on SwiftShader: the stack's box against the copy at four stops and six laptop sizes):

```ts
import { expect, type Page, test } from "@playwright/test";

// Where the stack sits on screen (data-box, written by the stage every
// frame) against the copy of the section it shares the screen with. Capture
// mode renders one exact journey frame, no springs, so SwiftShader needs only
// a few frames; scrolling afterwards puts the DOM where it is at that
// journey time on the live page (journeyTime's knots, measured the same way).
test.describe.configure({ timeout: 180_000 });

/** Room between the stack and any copy, and between it and the edges. */
const GAP = 32;
const MARGIN = 16;

type Rect = { left: number; top: number; right: number; bottom: number };

const STOPS = [
  { scene: "hero", p: 1, time: 1, copy: '[data-scene="hero"] :is(h1, p, a)' },
  { scene: "about", p: 0.6, time: 1.6, copy: "#about :is(h2, p, dt, dd, img)" },
  { scene: "skills", p: 0.5, time: 2.5, copy: null },
  {
    scene: "contact",
    p: 1,
    time: 6,
    copy: "#contact .section-body :is(h2, p, h3, a, form)",
  },
] as const;

const VIEWPORTS = [
  [1280, 720],
  [1280, 800],
  [1366, 768],
  [1440, 900],
  [1500, 1000],
  [1920, 1080],
] as const;

async function stackOnScreen(page: Page): Promise<Rect> {
  const value = await page.locator(".stage-layer").getAttribute("data-box");
  const [x, y, width, height] = (value ?? "").split(" ").map(Number);
  expect(width, "data-box").toBeGreaterThan(0);
  return { left: x, top: y, right: x + width, bottom: y + height };
}

/** Scrolls to journey time `time` and returns the copy's boxes. */
async function copyAt(page: Page, time: number, selector: string) {
  return page.evaluate(
    ({ time, selector }) => {
      const vh = window.innerHeight;
      const top = (id: string) =>
        (document.getElementById(id)?.getBoundingClientRect().top ?? 0) +
        window.scrollY;
      const hero = document.querySelector<HTMLElement>(".hero");
      const knots = [0, Math.max(0, (hero?.offsetHeight ?? 0) - vh)];
      for (const id of ["skills", "experience", "projects", "contact"]) {
        knots.push(Math.max(knots[knots.length - 1], top(id) - vh / 2));
      }
      knots.push(
        Math.max(
          knots[knots.length - 1],
          document.documentElement.scrollHeight - vh,
        ),
      );
      const index = Math.min(knots.length - 2, Math.floor(time));
      window.scrollTo(
        0,
        knots[index] + (time - index) * (knots[index + 1] - knots[index]),
      );
      return [...document.querySelectorAll(selector)].flatMap((element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        const box = ["FORM", "IMG"].includes(element.tagName)
          ? element.getBoundingClientRect()
          : range.getBoundingClientRect();
        return box.width > 0 && box.bottom > 0 && box.top < vh
          ? [
              {
                what: `${element.tagName} ${(element.textContent ?? "").trim().slice(0, 24)}`,
                left: box.left,
                top: box.top,
                right: box.right,
                bottom: box.bottom,
              },
            ]
          : [];
      });
    },
    { time, selector },
  );
}

for (const [width, height] of VIEWPORTS) {
  test(`at ${width}x${height} the stack stays on screen and off the copy`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    for (const stop of STOPS) {
      await page.goto(`/en?capture=${stop.scene}&p=${stop.p}`);
      await expect(page.locator("html")).toHaveAttribute(
        "data-canvas",
        "captured",
        { timeout: 90_000 },
      );
      const stack = await stackOnScreen(page);
      const where = `${stop.scene} ${JSON.stringify(stack)}`;
      expect(stack.left, where).toBeGreaterThanOrEqual(MARGIN);
      expect(stack.top, where).toBeGreaterThanOrEqual(MARGIN);
      expect(stack.right, where).toBeLessThanOrEqual(width - MARGIN);
      expect(stack.bottom, where).toBeLessThanOrEqual(height - MARGIN);
      if (stop.copy) {
        const covered = (await copyAt(page, stop.time, stop.copy)).filter(
          (copy) =>
            copy.left < stack.right + GAP &&
            copy.right > stack.left - GAP &&
            copy.top < stack.bottom + GAP &&
            copy.bottom > stack.top - GAP,
        );
        expect(
          covered.map((copy) => copy.what),
          where,
        ).toEqual([]);
      }
    }
  });
}
```

`tests/e2e/scenes.spec.ts`:

```diff
diff --git a/tests/e2e/scenes.spec.ts b/tests/e2e/scenes.spec.ts
index d7c10ce..1db501c 100644
--- a/tests/e2e/scenes.spec.ts
+++ b/tests/e2e/scenes.spec.ts
@@ -52,10 +52,27 @@ test("Skills pins the exploded stack and puts each row next to its layer", async
 for (const [width, height] of [
   [1280, 720],
   [1366, 768],
+  [1920, 1080],
 ] as const) {
   test.describe(`on a ${width}x${height} screen`, () => {
     test.use({ viewport: { width, height } });
 
+    test("the Skills title stays on one line", async ({ page }) => {
+      await goLive(page);
+      await scrollPast(page, "#skills", 0.8);
+      const title = page.locator("#skills h2");
+      await expect(title).toBeInViewport();
+
+      const lines = await title.evaluate((heading) => {
+        const range = document.createRange();
+        range.selectNodeContents(heading);
+        return new Set(
+          [...range.getClientRects()].map((rect) => Math.round(rect.top)),
+        ).size;
+      });
+      expect(lines).toBe(1);
+    });
+
     test("the Skills rows never cover the title, the intro or each other", async ({
       page,
     }) => {
```

- [ ] **Step 2: Run them to see them fail**

Run: `rtk proxy pnpm exec vitest run tests/unit/framing.test.ts tests/unit/journey.test.ts tests/unit/page-links.test.ts tests/unit/shots.test.ts`
Expected: `Test Files  4 failed (4)`, `Tests  6 failed | 38 passed (44)`: `can keep the right edge instead, like object-position: right` (`expected 240 to be close to 480`), `About yaws the stack 30 degrees away and lifts the glass` (`expected 0.5235987755982988 to be close to -0.5235987755982988`), `TypeError: stackBox is not a function` (twice), `leaves a row where it was while its layer is behind the camera` (`layer_interface: expected 2 to be +0`) and `shows the whole monolith where the layout wants it (landscape)` (`x of -0.2,0,0.2: expected -0.038… to be greater than 0.1`)

Run: `pnpm exec playwright test tests/e2e/framing.spec.ts tests/e2e/scenes.spec.ts --project=public`
Expected: `8 failed`, `9 passed`: the six `at <width>x<height> the stack stays on screen and off the copy` (`Received has value: undefined`: no `data-box` yet) and `the Skills title stays on one line` at 1366x768 and 1920x1080 (1280x720 passes already)

- [ ] **Step 3: Crop from the right, new keys, the About yaw**

`src/experience/director/framing.ts`:

```diff
diff --git a/src/experience/director/framing.ts b/src/experience/director/framing.ts
index 3f7e220..cfe8bac 100644
--- a/src/experience/director/framing.ts
+++ b/src/experience/director/framing.ts
@@ -31,13 +31,17 @@ export type ViewOffset = {
 
 /**
  * Arguments for `PerspectiveCamera.setViewOffset` (camera.aspect must be the
- * reference aspect): the viewport becomes a centred window into a virtual
- * reference-aspect frame that covers it.
+ * reference aspect): the viewport becomes a window into a virtual
+ * reference-aspect frame that covers it, centred, or with `align: "end"`
+ * against the frame's right edge when the sides are cropped (landscape
+ * shots, which keep the stack right of the copy; posters use
+ * `object-position: right` to match).
  */
 export function coverViewOffset(
   width: number,
   height: number,
   referenceAspect: number,
+  align: "center" | "end" = "center",
 ): ViewOffset {
   if (width / height > referenceAspect) {
     const fullHeight = width / referenceAspect;
@@ -54,7 +58,7 @@ export function coverViewOffset(
   return {
     fullWidth,
     fullHeight: height,
-    x: (fullWidth - width) / 2,
+    x: align === "end" ? fullWidth - width : (fullWidth - width) / 2,
     y: 0,
     width,
     height,
```

`src/experience/director/shots.ts` and `src/experience/director/journey.ts`:

```diff
diff --git a/src/experience/director/shots.ts b/src/experience/director/shots.ts
index f722e8a..51e55bd 100644
--- a/src/experience/director/shots.ts
+++ b/src/experience/director/shots.ts
@@ -89,7 +89,7 @@ export const HERO_KEYS: Record<Orientation, readonly CameraKey[]> = {
     { at: 0, position: [0.34, 0.03, 0.34], target: [0.06, 0.022, 0.19] },
     { at: 0.28, position: [0.02, 0.12, 0.42], target: [-0.02, 0.1, 0.19] },
     { at: 0.55, position: [-0.05, 0.52, 0.3], target: [-0.07, 0.25, 0.02] },
-    { at: 1, position: [0.6, 0.5, 1.1], target: [-0.34, 0.12, 0] },
+    { at: 1, position: [0.675, 0.585, 1.464], target: [-0.477, 0.12, 0.117] },
   ],
   portrait: [
     { at: 0, position: [0.3, 0.035, 0.42], target: [0.04, 0.03, 0.19] },
```

```diff
diff --git a/src/experience/director/journey.ts b/src/experience/director/journey.ts
index 7a2d335..701d780 100644
--- a/src/experience/director/journey.ts
+++ b/src/experience/director/journey.ts
@@ -89,17 +89,23 @@ export function sampleTrack(keys: readonly TrackKey[], t: number): number {
  * Skills pulls back from the exploded stack, Experience dives between the
  * layers and follows the PCB trace (see `trackPcb`), Projects retreats while
  * the stage fades out, Contact comes back to the closed stack's front face.
- * Landscape keeps the stack right of the copy; portrait keeps it centred.
+ * Landscape keeps the stack in the right half, clear of the copy (which takes
+ * the left half) on 16:9 to 3:2 screens (tests/e2e/framing.spec.ts); portrait
+ * keeps it centred.
  */
 export const JOURNEY_KEYS: Record<Orientation, readonly CameraKey[]> = {
   landscape: [
     ...HERO_KEYS.landscape,
-    { at: 1.55, position: [0.8, 0.74, 1.38], target: [-0.44, 0.19, 0] },
-    { at: 2.2, position: [1, 1.02, 1.95], target: [-0.62, 0.36, 0] },
-    { at: 2.8, position: [0.74, 1.1, 2.15], target: [-0.66, 0.36, 0] },
+    { at: 1.55, position: [0.726, 0.74, 1.447], target: [-0.514, 0.19, 0.067] },
+    { at: 2.2, position: [1.01, 0.962, 1.962], target: [-0.61, 0.302, 0.012] },
+    {
+      at: 2.8,
+      position: [0.749, 1.042, 2.164],
+      target: [-0.651, 0.302, 0.014],
+    },
     { at: 4.4, position: [2.1, 1.3, 3.4], target: [-0.3, 0.2, 0] },
     { at: 5.25, position: [0.95, 0.4, 1.65], target: [-0.52, 0.1, 0] },
-    { at: 6, position: [0.68, 0.28, 1.25], target: [-0.4, 0.08, 0] },
+    { at: 6, position: [0.763, 0.315, 1.56], target: [-0.506, 0.08, 0.092] },
   ],
   portrait: [
     ...HERO_KEYS.portrait,
@@ -112,11 +118,15 @@ export const JOURNEY_KEYS: Record<Orientation, readonly CameraKey[]> = {
   ],
 };
 
-/** Stack yaw (radians): About turns it 30°, Skills and Contact show the front. */
+/**
+ * Stack yaw (radians): About turns it 30° away from the camera (a clear
+ * three-quarter view; turning it towards the camera read as barely turned),
+ * Skills and Contact show the front.
+ */
 const YAW: readonly TrackKey[] = [
   [1, 0],
-  [1.5, Math.PI / 6],
-  [1.8, Math.PI / 6],
+  [1.5, -Math.PI / 6],
+  [1.8, -Math.PI / 6],
   [2.2, -0.35],
   [2.85, -0.2],
   [3.2, 0],
```

- [ ] **Step 4: Rows never behind the camera, the stack's box**

`src/experience/director/page-links.ts`:

```diff
diff --git a/src/experience/director/page-links.ts b/src/experience/director/page-links.ts
index 545e243..13dc3f7 100644
--- a/src/experience/director/page-links.ts
+++ b/src/experience/director/page-links.ts
@@ -52,10 +52,39 @@ const CORNERS = [
   [1, 1],
 ] as const;
 
+/**
+ * Projects points of a layer's slab (x, z in -1..1 of the half footprint;
+ * y in metres above its bottom face) to viewport pixels. Null when one of
+ * them is behind the camera: its projection would land mirrored across the
+ * screen (M6 anchored a row 158,339 px up that way).
+ */
+function project(
+  object: Object3D,
+  points: readonly (readonly [number, number, number])[],
+  camera: Camera,
+  width: number,
+  height: number,
+): [number, number][] | null {
+  const half = STACK_FOOTPRINT / 2;
+  const screen: [number, number][] = [];
+  for (const [x, y, z] of points) {
+    corner
+      .set(x * half, y, z * half)
+      .applyMatrix4(object.matrixWorld)
+      .project(camera);
+    if (Math.abs(corner.z) > 1) {
+      return null;
+    }
+    screen.push([((corner.x + 1) / 2) * width, ((1 - corner.y) / 2) * height]);
+  }
+  return screen;
+}
+
 /**
  * Anchors each Skills row to its layer: `--ax` is the layer's left-most
  * point on screen minus a gap, `--ay` its vertical middle (px, viewport).
- * globals.css places the rows with them on wide landscape screens.
+ * globals.css places the rows with them on wide landscape screens. A row
+ * whose layer is partly behind the camera keeps its last anchor.
  */
 export function anchorRows(
   links: PageLinks,
@@ -69,25 +98,72 @@ export function anchorRows(
   if (links.list && links.list.style.getPropertyValue("--rows") !== rows) {
     links.list.style.setProperty("--rows", rows);
   }
-  const half = STACK_FOOTPRINT / 2;
   for (const [layer, row] of links.rows) {
     const object = scene.getObjectByName(layerObjectName(layer));
     if (!object) {
       continue;
     }
     object.updateMatrixWorld();
-    let left = Number.POSITIVE_INFINITY;
-    let middle = 0;
-    for (const [x, z] of CORNERS) {
-      corner
-        .set(x * half, LAYER_HEIGHT[layer] / 2, z * half)
-        .applyMatrix4(object.matrixWorld)
-        .project(camera);
-      left = Math.min(left, ((corner.x + 1) / 2) * width);
-      middle += ((1 - corner.y) / 2) * height;
+    const middle = LAYER_HEIGHT[layer] / 2;
+    const points = project(
+      object,
+      CORNERS.map(([x, z]) => [x, middle, z] as const),
+      camera,
+      width,
+      height,
+    );
+    if (!points) {
+      continue;
+    }
+    const left = Math.min(...points.map(([x]) => x));
+    const y = points.reduce((sum, [, py]) => sum + py, 0) / points.length;
+    setAnchor(row, left - GAP, y);
+  }
+}
+
+/**
+ * The whole stack's box on screen, `[x, y, width, height]` in viewport
+ * pixels (every corner of every slab), or null while part of it is behind
+ * the camera. The stage writes it to the layer as `data-box` for tests.
+ */
+export function stackBox(
+  scene: Object3D,
+  camera: Camera,
+  width: number,
+  height: number,
+): [number, number, number, number] | null {
+  const xs: number[] = [];
+  const ys: number[] = [];
+  for (const layer of STACK_LAYERS) {
+    const object = scene.getObjectByName(layerObjectName(layer));
+    if (!object) {
+      continue;
+    }
+    object.updateMatrixWorld();
+    const points = project(
+      object,
+      CORNERS.flatMap(([x, z]) => [
+        [x, 0, z] as const,
+        [x, LAYER_HEIGHT[layer], z] as const,
+      ]),
+      camera,
+      width,
+      height,
+    );
+    if (!points) {
+      return null;
     }
-    setAnchor(row, left - GAP, middle / CORNERS.length);
+    for (const [x, y] of points) {
+      xs.push(x);
+      ys.push(y);
+    }
+  }
+  if (xs.length === 0) {
+    return null;
   }
+  const left = Math.min(...xs);
+  const top = Math.min(...ys);
+  return [left, top, Math.max(...xs) - left, Math.max(...ys) - top];
 }
 
 function mark(element: HTMLElement, lit: boolean) {
```

`src/experience/director/JourneyShot.tsx`:

```diff
diff --git a/src/experience/director/JourneyShot.tsx b/src/experience/director/JourneyShot.tsx
index 87c4b33..814164c 100644
--- a/src/experience/director/JourneyShot.tsx
+++ b/src/experience/director/JourneyShot.tsx
@@ -1,4 +1,4 @@
-import { useFrame } from "@react-three/fiber";
+import { useFrame, useThree } from "@react-three/fiber";
 import { type RefObject, useMemo } from "react";
 import type {
   Material,
@@ -14,7 +14,7 @@ import { STACK_OBJECTS, stackLayout } from "../scenes/stack-layout";
 import { coverViewOffset, orientationOf, REFERENCE_SIZE } from "./framing";
 import { type JourneyFrame, litJob } from "./journey";
 import type { Motion } from "./motion";
-import { anchorRows, findPageLinks, markLit } from "./page-links";
+import { anchorRows, findPageLinks, markLit, stackBox } from "./page-links";
 import { SHOT_FOV } from "./shots";
 
 /** Pointer parallax: camera orbit (rad) and rim-light swing at full tilt. */
@@ -47,6 +47,12 @@ export function JourneyShot({
   frame: RefObject<JourneyFrame>;
 }) {
   const links = useMemo(findPageLinks, []);
+  const canvas = useThree((state) => state.gl.domElement);
+  // The fixed layer around the canvas: data-box (tests, debugging).
+  const layer = useMemo(
+    () => canvas.closest<HTMLElement>(".stage-layer"),
+    [canvas],
+  );
 
   useFrame((state) => {
     const current = frame.current;
@@ -59,6 +65,7 @@ export function JourneyShot({
       width,
       height,
       reference.width / reference.height,
+      orientation === "landscape" ? "end" : "center",
     );
     camera.fov = SHOT_FOV[orientation];
     camera.aspect = reference.width / reference.height;
@@ -142,6 +149,13 @@ export function JourneyShot({
       anchorRows(links, scene, camera, width, height, current.skillRows);
     }
     markLit(links, motion.lit, litJob(current, links.jobs.length));
+
+    const box = stackBox(scene, camera, width, height)
+      ?.map(Math.round)
+      .join(" ");
+    if (layer && layer.dataset.box !== (box ?? "")) {
+      layer.dataset.box = box ?? "";
+    }
   });
 
   return null;
```

- [ ] **Step 5: Copy in the left half, one-line Skills title, posters cropped from the right**

`src/components/sections/Hero.tsx`, `About.tsx`, `Contact.tsx`, `src/components/ui/Section.tsx`:

```diff
diff --git a/src/components/sections/Hero.tsx b/src/components/sections/Hero.tsx
index 7a43f13..ff060c6 100644
--- a/src/components/sections/Hero.tsx
+++ b/src/components/sections/Hero.tsx
@@ -21,7 +21,7 @@ export function Hero({ cv }: { cv: Cv }) {
         <HeroPoster />
         <div aria-hidden="true" className="hero-scrim absolute inset-0" />
         <div className="relative mx-auto w-full max-w-content px-gutter pt-28 pb-16">
-          <div className="md:w-7/12">
+          <div className="md:w-1/2">
             {profile.available ? (
               <p className="inline-flex items-center gap-2 rounded-full bg-canvas/60 px-3 py-1.5 font-mono text-label uppercase text-ink-muted ring-1 ring-line">
                 <span
```

```diff
diff --git a/src/components/sections/About.tsx b/src/components/sections/About.tsx
index 427e844..2a0b8d1 100644
--- a/src/components/sections/About.tsx
+++ b/src/components/sections/About.tsx
@@ -20,7 +20,7 @@ export function About({ cv }: { cv: Cv }) {
 
   return (
     <Section id="about" title={t("title")} scene="about">
-      <div className="flex flex-col gap-12 lg:w-7/12">
+      <div className="flex flex-col gap-12 lg:w-1/2">
         {profile.avatar ? (
           <OptimizedImage
             src={profile.avatar.url}
@@ -38,7 +38,7 @@ export function About({ cv }: { cv: Cv }) {
         >
           {profile.summary.value}
         </p>
-        <dl className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
+        <dl className="grid grid-cols-2 gap-x-8 gap-y-8">
           {facts.map((fact) => (
             <div key={fact.term}>
               <dt className="font-mono text-label uppercase text-ink-subtle">
```

```diff
diff --git a/src/components/sections/Contact.tsx b/src/components/sections/Contact.tsx
index b03b1a2..14ab65d 100644
--- a/src/components/sections/Contact.tsx
+++ b/src/components/sections/Contact.tsx
@@ -37,7 +37,7 @@ export function Contact({ cv }: { cv: Cv }) {
 
   return (
     <Section id="contact" title={t("title")} intro={t("intro")} scene="contact">
-      <div className="flex flex-col gap-12 lg:w-7/12">
+      <div className="flex flex-col gap-12 lg:w-1/2">
         <div className="grid gap-8 sm:grid-cols-2">
           <div>
             <h3 className="font-mono text-label uppercase text-ink-subtle">
```

```diff
diff --git a/src/components/ui/Section.tsx b/src/components/ui/Section.tsx
index dc90131..20845de 100644
--- a/src/components/ui/Section.tsx
+++ b/src/components/ui/Section.tsx
@@ -34,7 +34,7 @@ export function Section({ id, title, intro, scene, children }: SectionProps) {
           {title}
         </h2>
         {intro ? (
-          <p className="mt-5 max-w-[60ch] text-lead text-ink-muted lg:w-7/12">
+          <p className="mt-5 max-w-[60ch] text-lead text-ink-muted lg:w-1/2">
             {intro}
           </p>
         ) : null}
```

`src/app/globals.css`:

```diff
diff --git a/src/app/globals.css b/src/app/globals.css
index af7bcc1..8ad7804 100644
--- a/src/app/globals.css
+++ b/src/app/globals.css
@@ -104,6 +104,11 @@
     overflow-wrap: break-word;
     text-wrap: balance;
   }
+
+  /* No one-word last lines in running text. */
+  :is(p, li, dd) {
+    text-wrap: pretty;
+  }
 }
 
 @layer components {
@@ -210,6 +215,16 @@ html[data-canvas="live"] .hero-poster {
   opacity: 0;
 }
 
+/*
+ * Posters are cropped like the live camera (framing.ts): landscape keeps the
+ * right edge of the frame, where the stack is; portrait stays centred.
+ */
+@media (orientation: landscape) {
+  :is(.hero-poster, .section-poster) img {
+    object-position: right center;
+  }
+}
+
 /* Keeps the copy readable over any frame: from the left in landscape, from the top in portrait. */
 .hero-scrim {
   background: linear-gradient(
@@ -524,7 +539,14 @@ body > footer {
     max-width: 18rem;
   }
 
+  /* "The stack" on one line in its 18rem column (M6 wrapped it at 1366px). */
+  html[data-canvas="live"] #skills > .section-body > h2 {
+    font-size: clamp(2.25rem, 1.25rem + 2.2vw, 3.5rem);
+  }
+
   html[data-canvas="live"] .skills-layers {
+    /* A row anchored off screen must never make the page scroll further. */
+    overflow: clip;
     /* Where the rows may begin: the section's left padding, 18rem, a gap. */
     --rows-start: calc(
       max(
```

- [ ] **Step 6: Run the tests again, then the poster step**

Run: `rtk proxy pnpm test`
Expected: `Test Files  1 failed | 42 passed (43)`, `Tests  1 failed | 318 passed (319)`: only `posters.test.ts › were captured from the current scene code` (the poster step fixes it)

Run the poster step (`pnpm build`, `pnpm assets:posters`).
Expected: `wrote 48 files and src/experience/posters.json`; 26 poster files are replaced (status ` D` for the old names, `??` for the new ones): about, contact, hero-end and skills in landscape, about in portrait. `hero-start` and `experience` do not change

Look at the new landscape posters (`public/posters/about-landscape-1920.*.webp`, `contact-landscape-1920.*`, `skills-landscape-1920.*`): the stack sits in the right half, About shows it turned away in three-quarter view with the glass lifted, Contact shows the whole front face.

Run: `rtk proxy pnpm test`, `rtk proxy pnpm typecheck`, `rtk proxy pnpm lint`
Expected: `Test Files  43 passed (43)`, `Tests  319 passed (319)`; lint `Checked 273 files in <n>ms. No fixes applied.`; no TypeScript errors.

Run: `pnpm test:e2e`
Expected: `/en: 149.5 KB gz before 3D`, `/ro: 149.5 KB gz before 3D`, `/en/projects/ledger-lens: 146.3 KB gz before 3D`, `lazy: 3 chunk(s), 316.1 KB gz`, `tier 3: +1 chunk, 81.7 KB gz`, the two `contact: … failed Error: EEXIST …` lines M3's outage test always prints, then `134 passed`

- [ ] **Step 7: Commit**

```bash
/usr/bin/git add public/posters src tests
/usr/bin/git commit -m "fix(layout): keep the stack clear of the copy"
```

---

### Task 7: Look-dev on materials and light

**Owner:** frontend-engineer (three.js scenes); the poster step may go to devops-engineer.

Judged on real GPU captures of every stop at 1920x1080 before and after (Iris Xe, tier 2), and one variable at a time on a scratch branch. What was wrong in M6 and what fixes it:

| Before (M6, GPU) | After | Why |
| --- | --- | --- |
| The stage's background renders `#030305` next to the page's `#0b0c0f`: a dark rectangle behind the stack | `studioBackground(tier)`: tier 2+ clears to the linear colour the post chain's AgX maps to `#0b0c0f`; tier 1 (no post chain, clears are not tone mapped) clears to `#0b0c0f` | AgX lifts nothing near black; the value comes from a port of three's AgX, checked against M6's measured `#030305` |
| Glass edges and the glowing edge bands break into rows of dots | `EffectComposer` with `multisampling: 4` | Sub-pixel highlights alias before FXAA sees them; MSAA joins them. 60 fps kept at every stop (Task 9) |
| Two highlights on the glass, the clearcoat one dotted | Glass without clearcoat, iridescence 0.3 (was 0.7) | One soft highlight reads as glass; less rainbow |
| The circuit board's sides show its top texture stretched into streaks; its copper is plastic | FR4 edge material with three copper inner layers (`pcbEdge`, 64 px texture); a surface map makes the copper traces metal and the solder mask not (`metalnessMap`/`roughnessMap`) | `RoundedBoxGeometry` keeps `BoxGeometry`'s six face groups, so the top face (+y) gets its own material |
| Hard, thin edges | Bevels 10 mm on glass, 8 mm on metal, 5 segments | Wider bevels catch the softboxes |
| Flat front light, weak rim | Softboxes: overhead 2.6, key 6, rim 3.5 (the wall stays 0.6: lower turns the titanium's front face black at Contact) | A stronger key and rim model the slabs |
| The contact shadow's plane shows a stepped square outline on the floor | `contactShadow(x, z)`: an analytic shadow (smoothstep over 13 cm around the footprint, exactly 0 at the plane's border) in a 256 px `DataTexture`, anisotropy 8, and output dithering | M6 blurred a square whose faint tail reached the border; 8-bit gradients band without dithering |

Titanium's parameters were tried and left alone (its front face went black at Contact).

**Files:**
- Create: `src/experience/scenes/studio.ts`
- Modify: `src/experience/scenes/{StudioLights.tsx,materials.ts,textures.ts,StackModel.tsx}`, `src/experience/postfx/Effects.tsx`, `src/experience/Stage.tsx`, `public/posters/*` and `src/experience/posters.json` (poster step)
- Test: `tests/unit/studio.test.ts` (new), `tests/unit/stack-model.test.ts`

**Interfaces:**
- Consumes: M6's `Tier`, `createStackMaterials`, `createStackTextures`, `StudioLights`, `Effects`, `StackModel`.
- Produces:
  - `src/experience/scenes/studio.ts`: `PAGE_CANVAS = "#0b0c0f"`, `studioBackground(tier: Tier): Color`, `SHADOW_PLANE = 0.8`, `contactShadow(x: number, z: number): number`.
  - `StackMaterials.pcbEdge: MeshPhysicalMaterial`; textures `pcbSurface` (G = roughness, B = metalness, as three reads them) and `pcbEdge`; `layerMaterials(materials, layer): Material | Material[]` (six materials for `infra`: `[edge, edge, top, edge, edge, edge]`).
  - `StudioLights({ tier })` (was no props).
  - `BEVEL = { glass: 0.01, metal: 0.008, segments: 5 }` in `StackModel.tsx`.

- [ ] **Step 1: Write the failing tests**

`tests/unit/studio.test.ts` (ports three's AgX to check the background lands on the page colour, and checks the shadow is 0 along the whole border):

```ts
import { describe, expect, it } from "vitest";
import {
  contactShadow,
  PAGE_CANVAS,
  SHADOW_PLANE,
  studioBackground,
} from "@/experience/scenes/studio";

// three r186's AgXToneMapping (tonemapping_pars_fragment.glsl.js), which the
// tier 2+ post chain applies to every pixel, the studio background included.
// GLSL mat3(a, b, c) takes columns: out[row] = a[row]*v0 + b[row]*v1 + c[row]*v2.
type Mat3 = readonly (readonly [number, number, number])[];
const mul = (m: Mat3, v: number[]) =>
  [0, 1, 2].map(
    (row) => m[0][row] * v[0] + m[1][row] * v[1] + m[2][row] * v[2],
  );
const SRGB_TO_REC2020: Mat3 = [
  [0.6274, 0.0691, 0.0164],
  [0.3293, 0.9195, 0.088],
  [0.0433, 0.0113, 0.8956],
];
const REC2020_TO_SRGB: Mat3 = [
  [1.6605, -0.1246, -0.0182],
  [-0.5876, 1.1329, -0.1006],
  [-0.0728, -0.0083, 1.1187],
];
const INSET: Mat3 = [
  [0.856627153315983, 0.137318972929847, 0.11189821299995],
  [0.0951212405381588, 0.761241990602591, 0.0767994186031903],
  [0.0482516061458583, 0.101439036467562, 0.811302368396859],
];
const OUTSET: Mat3 = [
  [1.1271005818144368, -0.1413297634984383, -0.14132976349843826],
  [-0.11060664309660323, 1.157823702216272, -0.11060664309660294],
  [-0.016493938717834573, -0.016493938717834257, 1.2519364065950405],
];
const MIN_EV = -12.47393;
const MAX_EV = 4.026069;
const sigmoid = (x: number) => {
  const x2 = x * x;
  const x4 = x2 * x2;
  return (
    15.5 * x4 * x2 -
    40.14 * x4 * x +
    31.96 * x4 -
    6.868 * x2 * x +
    0.4298 * x2 +
    0.1191 * x -
    0.00232
  );
};
function agx(linear: number[]): number[] {
  let c = mul(INSET, mul(SRGB_TO_REC2020, linear));
  c = c.map((v) =>
    Math.min(
      1,
      Math.max(0, (Math.log2(Math.max(v, 1e-10)) - MIN_EV) / (MAX_EV - MIN_EV)),
    ),
  );
  c = mul(OUTSET, c.map(sigmoid)).map((v) => Math.max(0, v) ** 2.2);
  return mul(REC2020_TO_SRGB, c).map((v) => Math.min(1, Math.max(0, v)));
}
const toSrgb8 = (linear: number) =>
  Math.round(
    (linear <= 0.0031308
      ? linear * 12.92
      : 1.055 * linear ** (1 / 2.4) - 0.055) * 255,
  );
const hex8 = (hex: string) =>
  [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16));

describe("studioBackground", () => {
  it("lands on the page colour after the post chain's AgX (tier 2 and 3)", () => {
    // M6 cleared to the page colour itself, which AgX darkened to #030305:
    // a visible seam wherever the page and the stage met.
    for (const tier of [2, 3] as const) {
      const { r, g, b } = studioBackground(tier);
      const shown = agx([r, g, b]).map(toSrgb8);
      hex8(PAGE_CANVAS).forEach((channel, index) => {
        expect(Math.abs(shown[index] - channel)).toBeLessThanOrEqual(1);
      });
    }
  });

  it("is the page colour itself at tier 1 (no post chain, clears are not tone mapped)", () => {
    expect(`#${studioBackground(1).getHexString()}`).toBe(PAGE_CANVAS);
  });

  it("the port above matches what M6 measured on screen", () => {
    const page = hex8(PAGE_CANVAS).map((channel) => {
      const s = channel / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    expect(agx(page).map(toSrgb8)).toEqual([0x03, 0x03, 0x05]);
  });
});

describe("contactShadow", () => {
  it("is darkest under the footprint and gone 15 cm beyond it", () => {
    expect(contactShadow(0, 0)).toBe(1);
    expect(contactShadow(0.2, 0)).toBeGreaterThan(0.5);
    expect(contactShadow(0.26, 0)).toBeGreaterThan(0);
    expect(contactShadow(0.35, 0)).toBe(0);
    expect(contactShadow(0.3, 0.3)).toBe(0);
  });

  it("is exactly 0 all along the plane's border (no outline on the floor)", () => {
    const edge = SHADOW_PLANE / 2;
    for (let step = -10; step <= 10; step += 1) {
      const along = (step / 10) * edge;
      expect(contactShadow(edge, along)).toBe(0);
      expect(contactShadow(along, -edge)).toBe(0);
    }
  });
});
```

`tests/unit/stack-model.test.ts`:

```diff
diff --git a/tests/unit/stack-model.test.ts b/tests/unit/stack-model.test.ts
index cc21dea..d4c47fb 100644
--- a/tests/unit/stack-model.test.ts
+++ b/tests/unit/stack-model.test.ts
@@ -5,6 +5,7 @@ import { edgeFrameGeometry, edgeObjectName } from "@/experience/scenes/edges";
 import {
   createStackMaterials,
   injectPulse,
+  layerMaterials,
 } from "@/experience/scenes/materials";
 import {
   jobChipU,
@@ -98,6 +99,8 @@ describe("traceRibbon (pcb_traces)", () => {
 describe("createStackMaterials", () => {
   const textures = {
     pcb: new Texture(),
+    pcbSurface: new Texture(),
+    pcbEdge: new Texture(),
     etchHero: new Texture(),
     etchContact: new Texture(),
   };
@@ -117,6 +120,34 @@ describe("createStackMaterials", () => {
     expect(glass.roughness).toBeGreaterThan(0.1);
   });
 
+  it("keeps a single, soft highlight on the glass (no clearcoat lobe)", () => {
+    // A 0.04-rough clearcoat drew razor-thin highlights that broke into
+    // dots along the far edges.
+    const glass = createStackMaterials(2, textures, maps).layers.interface;
+    expect(glass.clearcoat).toBe(0);
+    expect(glass.iridescence).toBeLessThanOrEqual(0.3);
+  });
+
+  it("makes the board's copper metal and its solder mask not", () => {
+    const { layers } = createStackMaterials(2, textures, maps);
+    expect(layers.infra.map).toBe(textures.pcb);
+    expect(layers.infra.metalnessMap).toBe(textures.pcbSurface);
+    expect(layers.infra.roughnessMap).toBe(textures.pcbSurface);
+  });
+
+  it("prints the board on its top face only, FR4 on the edges", () => {
+    const materials = createStackMaterials(2, textures, maps);
+    const faces = layerMaterials(materials, "infra");
+    // BoxGeometry groups: +x, -x, +y (top), -y, +z, -z.
+    expect(Array.isArray(faces) && faces.length).toBe(6);
+    expect((faces as unknown[])[2]).toBe(materials.layers.infra);
+    expect(
+      (faces as unknown[]).filter((face) => face === materials.pcbEdge),
+    ).toHaveLength(5);
+    expect(materials.pcbEdge.map).toBe(textures.pcbEdge);
+    expect(layerMaterials(materials, "api")).toBe(materials.layers.api);
+  });
+
   it("fakes the glass at tier 1 (no transmission pass)", () => {
     const glass = createStackMaterials(1, textures, maps).layers.interface;
     expect(glass.transmission).toBe(0);
```

- [ ] **Step 2: Run them to see them fail**

Run: `rtk proxy pnpm exec vitest run tests/unit/studio.test.ts tests/unit/stack-model.test.ts`
Expected: `Test Files  2 failed (2)`, `Tests  3 failed | 15 passed (18)`: `Cannot find package '@/experience/scenes/studio'`, `keeps a single, soft highlight on the glass (no clearcoat lobe)` (`expected 1 to be +0`), `makes the board's copper metal and its solder mask not` (`expected null to be { Object (isTexture, uuid, ...) }`) and `prints the board on its top face only, FR4 on the edges` (`TypeError: layerMaterials is not a function`)

- [ ] **Step 3: The studio: background and contact shadow**

`src/experience/scenes/studio.ts`:

```ts
import { Color, LinearSRGBColorSpace } from "three";
import type { Tier } from "../gpu-tier";

/** The page's background (globals.css --color-canvas). */
export const PAGE_CANVAS = "#0b0c0f";

/**
 * The linear colour the tier 2+ post chain's AgX tone mapping turns into
 * PAGE_CANVAS on screen (tests/unit/studio.test.ts ports AgX to check it).
 */
const TONE_MAPPED_CANVAS = [0.0072, 0.00745, 0.00879] as const;

/**
 * The studio behind the stack, so the stage meets the page without a seam:
 * tier 2+ tone-maps it in the post chain; tier 1 clears to it directly, and
 * clears are never tone mapped.
 */
export function studioBackground(tier: Tier): Color {
  return tier >= 2
    ? new Color().setRGB(...TONE_MAPPED_CANVAS, LinearSRGBColorSpace)
    : new Color(PAGE_CANVAS);
}

/** Side of the contact shadow's floor plane (m): the stack plus 0.2 m around. */
export const SHADOW_PLANE = 0.8;

/**
 * Darkness of the monolith's contact shadow at floor point (x, z), metres
 * from the stack's centre: 1 under the 0.4 m footprint, fading out over the
 * next 12 cm, exactly 0 long before the plane's border (M6 blurred a square
 * whose faint tail reached the border: a stepped outline on a lit floor).
 */
export function contactShadow(x: number, z: number): number {
  const half = 0.2 - 0.02;
  const outside =
    Math.hypot(
      Math.max(Math.abs(x) - half, 0),
      Math.max(Math.abs(z) - half, 0),
    ) - 0.02;
  const t = Math.min(1, Math.max(0, (outside + 0.01) / 0.13));
  const fade = 1 - t * t * (3 - 2 * t);
  return fade * fade;
}
```

`src/experience/scenes/StudioLights.tsx` and `src/experience/Stage.tsx`:

```diff
diff --git a/src/experience/scenes/StudioLights.tsx b/src/experience/scenes/StudioLights.tsx
index 6d4c71d..059ec43 100644
--- a/src/experience/scenes/StudioLights.tsx
+++ b/src/experience/scenes/StudioLights.tsx
@@ -1,15 +1,19 @@
 import { useThree } from "@react-three/fiber";
 import { useEffect, useMemo } from "react";
 import {
-  CanvasTexture,
   Color,
+  DataTexture,
   DoubleSide,
+  LinearFilter,
+  LinearMipmapLinearFilter,
   Mesh,
   MeshBasicMaterial,
   PlaneGeometry,
   PMREMGenerator,
   Scene,
 } from "three";
+import type { Tier } from "../gpu-tier";
+import { contactShadow, SHADOW_PLANE, studioBackground } from "./studio";
 
 type Softbox = {
   position: [number, number, number];
@@ -29,21 +33,21 @@ const SOFTBOXES: Softbox[] = [
     position: [0, 3, 0.6],
     rotation: [Math.PI / 2, 0, 0],
     scale: [3.2, 1.6],
-    intensity: 2.2,
+    intensity: 2.6,
   },
   // Key strip, front left: the one the sweep drags across
   {
     position: [-2.4, 1.1, 2.2],
     rotation: [0, Math.PI / 4, 0],
     scale: [0.7, 3.6],
-    intensity: 5,
+    intensity: 6,
   },
-  // Cool rim, back right
+  // Cool rim, back right: the bright line along the far edges
   {
     position: [2.6, 0.8, -1.6],
     rotation: [0, -Math.PI / 1.6, 0],
     scale: [0.5, 3],
-    intensity: 2.4,
+    intensity: 3.5,
     color: "#cfe6ff",
   },
   // Floor bounce
@@ -93,19 +97,35 @@ function studioScene(): Scene {
 /** Name of the contact shadow; shots turn it with the stack. */
 export const STACK_SHADOW = "stack_shadow";
 
-/** Soft square falloff, baked once: the monolith's contact shadow. */
-function shadowTexture(): CanvasTexture {
+/** The contact shadow as an alpha map (three reads its green channel). */
+function shadowTexture(): DataTexture {
   const size = 256;
-  const element = document.createElement("canvas");
-  element.width = size;
-  element.height = size;
-  const context = element.getContext("2d");
-  if (context) {
-    context.filter = "blur(18px)";
-    context.fillStyle = "#fff";
-    context.fillRect(size * 0.22, size * 0.22, size * 0.56, size * 0.56);
+  const data = new Uint8Array(size * size * 4);
+  for (let row = 0; row < size; row += 1) {
+    for (let column = 0; column < size; column += 1) {
+      const value = Math.round(
+        255 *
+          contactShadow(
+            ((column + 0.5) / size - 0.5) * SHADOW_PLANE,
+            ((row + 0.5) / size - 0.5) * SHADOW_PLANE,
+          ),
+      );
+      data.fill(
+        value,
+        (row * size + column) * 4,
+        (row * size + column) * 4 + 3,
+      );
+      data[(row * size + column) * 4 + 3] = 255;
+    }
   }
-  return new CanvasTexture(element);
+  const texture = new DataTexture(data, size, size);
+  texture.generateMipmaps = true;
+  texture.minFilter = LinearMipmapLinearFilter;
+  texture.magFilter = LinearFilter;
+  // The hero's macro shot looks along the floor.
+  texture.anisotropy = 8;
+  texture.needsUpdate = true;
+  return texture;
 }
 
 /**
@@ -113,10 +133,11 @@ function shadowTexture(): CanvasTexture {
  * PMREM environment map (like three's RoomEnvironment). Shots rotate it
  * (`scene.environmentRotation`) to sweep the reflections.
  */
-export function StudioLights() {
+export function StudioLights({ tier }: { tier: Tier }) {
   const gl = useThree((state) => state.gl);
   const scene = useThree((state) => state.scene);
   const shadow = useMemo(shadowTexture, []);
+  const background = useMemo(() => studioBackground(tier), [tier]);
 
   useEffect(() => () => shadow.dispose(), [shadow]);
 
@@ -140,20 +161,21 @@ export function StudioLights() {
 
   return (
     <>
-      <color attach="background" args={["#0b0c0f"]} />
+      <color attach="background" args={[background]} />
       <mesh
         name={STACK_SHADOW}
         rotation-x={-Math.PI / 2}
         position-y={0.0002}
         renderOrder={-1}
       >
-        <planeGeometry args={[0.62, 0.62]} />
+        <planeGeometry args={[SHADOW_PLANE, SHADOW_PLANE]} />
         <meshBasicMaterial
           color="#000000"
           alphaMap={shadow}
           transparent
           opacity={0.85}
           depthWrite={false}
+          dithering
         />
       </mesh>
     </>
```

```diff
diff --git a/src/experience/Stage.tsx b/src/experience/Stage.tsx
index 653887a..100ae73 100644
--- a/src/experience/Stage.tsx
+++ b/src/experience/Stage.tsx
@@ -183,7 +183,7 @@ export default function Stage({
           whenIdle(next);
         }}
       >
-        {step >= STEP.environment ? <StudioLights /> : null}
+        {step >= STEP.environment ? <StudioLights tier={tier} /> : null}
         {step >= STEP.model ? (
           <StackModel
             tier={tier}
```

- [ ] **Step 4: Materials, textures, bevels**

`src/experience/scenes/textures.ts`:

```diff
diff --git a/src/experience/scenes/textures.ts b/src/experience/scenes/textures.ts
index 02f9285..169fe58 100644
--- a/src/experience/scenes/textures.ts
+++ b/src/experience/scenes/textures.ts
@@ -51,11 +51,40 @@ export function etchingTexture(lines: readonly string[]): CanvasTexture {
   return texture;
 }
 
+type PcbPalette = {
+  mask: string;
+  copper: string;
+  inner: string;
+  pad: string;
+  print: string;
+};
+
+/** What the board looks like (the colour map). */
+const PCB_COLOURS: PcbPalette = {
+  mask: "#0e2419",
+  copper: "#b8733f",
+  inner: "#1f5a3c",
+  pad: "#d4a373",
+  print: "#cfd8d3",
+};
+
+/**
+ * What it is made of, in three's channels: green = roughness, blue =
+ * metalness. Exposed copper is smooth metal; mask and print are not.
+ */
+const PCB_SURFACE: PcbPalette = {
+  mask: "rgb(0,150,0)",
+  copper: "rgb(0,80,255)",
+  inner: "rgb(0,140,0)",
+  pad: "rgb(0,70,255)",
+  print: "rgb(0,170,0)",
+};
+
 /** Solder mask, copper pours, pads and silkscreen for `layer_infra`. */
-export function pcbTexture(): CanvasTexture {
+function drawPcb(palette: PcbPalette): HTMLCanvasElement {
   const size = 1024;
   const { element, context } = canvas(size, size);
-  context.fillStyle = "#0e2419";
+  context.fillStyle = palette.mask;
   context.fillRect(0, 0, size, size);
 
   // Deterministic pseudo-random layout (same poster every capture).
@@ -70,7 +99,7 @@ export function pcbTexture(): CanvasTexture {
   for (let i = 0; i < 90; i += 1) {
     let x = Math.round(random() * 32) * 32;
     let y = Math.round(random() * 32) * 32;
-    context.strokeStyle = random() > 0.2 ? "#b8733f" : "#1f5a3c";
+    context.strokeStyle = random() > 0.2 ? palette.copper : palette.inner;
     context.lineWidth = random() > 0.7 ? 10 : 5;
     context.beginPath();
     context.moveTo(x, y);
@@ -87,17 +116,45 @@ export function pcbTexture(): CanvasTexture {
       context.lineTo(x, y);
     }
     context.stroke();
-    context.fillStyle = "#d4a373";
+    context.fillStyle = palette.pad;
     context.beginPath();
     context.arc(x, y, 9, 0, Math.PI * 2);
     context.fill();
   }
-  context.fillStyle = "#cfd8d3";
+  context.fillStyle = palette.print;
   context.font = "600 34px monospace";
   context.fillText("INFRA-04  REV C", 40, size - 40);
+  return element;
+}
 
-  const texture = new CanvasTexture(element);
+/** The board's top face (colour). */
+export function pcbTexture(): CanvasTexture {
+  const texture = new CanvasTexture(drawPcb(PCB_COLOURS));
   texture.colorSpace = SRGBColorSpace;
   texture.anisotropy = 8;
   return texture;
 }
+
+/** Roughness (green) and metalness (blue) of the same layout, pixel for pixel. */
+export function pcbSurfaceTexture(): CanvasTexture {
+  const texture = new CanvasTexture(drawPcb(PCB_SURFACE));
+  texture.anisotropy = 8;
+  return texture;
+}
+
+/**
+ * The board's cut edges: dark FR4 with the thin copper of its inner layers.
+ * M6 wrapped the top face's traces round the sides, as streaks.
+ */
+export function pcbEdgeTexture(): CanvasTexture {
+  const { element, context } = canvas(64, 64);
+  context.fillStyle = "#0c1712";
+  context.fillRect(0, 0, 64, 64);
+  context.fillStyle = "#6b4a2e";
+  for (const y of [15, 31, 47]) {
+    context.fillRect(0, y, 64, 1.5);
+  }
+  const texture = new CanvasTexture(element);
+  texture.colorSpace = SRGBColorSpace;
+  return texture;
+}
```

`src/experience/scenes/materials.ts`:

```diff
diff --git a/src/experience/scenes/materials.ts b/src/experience/scenes/materials.ts
index 2bd5f46..505f99a 100644
--- a/src/experience/scenes/materials.ts
+++ b/src/experience/scenes/materials.ts
@@ -19,6 +19,8 @@ export type PulseUniforms = {
 
 export type StackMaterials = {
   layers: Record<StackLayer, MeshPhysicalMaterial>;
+  /** The circuit board's four cut edges and its underside (FR4). */
+  pcbEdge: MeshPhysicalMaterial;
   copper: MeshPhysicalMaterial;
   pulse: PulseUniforms;
   etchHero: MeshStandardMaterial;
@@ -84,6 +86,8 @@ export function createStackMaterials(
   tier: Tier,
   textures: {
     pcb: Texture;
+    pcbSurface: Texture;
+    pcbEdge: Texture;
     etchHero: Texture;
     etchContact: Texture;
   },
@@ -120,12 +124,12 @@ export function createStackMaterials(
         attenuationDistance: 1.2,
         transparent: !transmissive,
         opacity: transmissive ? 1 : 0.55,
-        iridescence: 0.7,
+        // A hint of thin-film colour; no clearcoat: its second, 0.04-rough
+        // highlight broke into dots along the far edges.
+        iridescence: 0.3,
         iridescenceIOR: 1.3,
         iridescenceThicknessRange: [140, 420],
         specularIntensity: 1,
-        clearcoat: 1,
-        clearcoatRoughness: 0.04,
       }),
       api: new MeshPhysicalMaterial({
         color: "#d3d8e0",
@@ -143,10 +147,14 @@ export function createStackMaterials(
         clearcoatRoughness: 0.35,
         clearcoatRoughnessMap: smudge,
       }),
+      // Copper that reflects like metal, a solder mask that does not
+      // (the surface map sets both, per pixel).
       infra: new MeshPhysicalMaterial({
         map: textures.pcb,
-        metalness: 0.15,
-        roughness: 0.55,
+        metalnessMap: textures.pcbSurface,
+        roughnessMap: textures.pcbSurface,
+        metalness: 1,
+        roughness: 1,
         clearcoat: 0.4,
         clearcoatRoughness: 0.3,
       }),
@@ -161,6 +169,13 @@ export function createStackMaterials(
         clearcoatRoughness: 0.2,
       }),
     },
+    pcbEdge: new MeshPhysicalMaterial({
+      map: textures.pcbEdge,
+      metalness: 0,
+      roughness: 0.6,
+      clearcoat: 0.25,
+      clearcoatRoughness: 0.45,
+    }),
     copper,
     pulse,
     etchHero: etching(textures.etchHero),
@@ -174,8 +189,25 @@ export function createStackMaterials(
   };
 }
 
+/**
+ * A layer's material(s): the circuit board prints its texture on the top
+ * face only (RoundedBoxGeometry keeps BoxGeometry's face groups: +x, -x, +y,
+ * -y, +z, -z); every other slab is one material all round.
+ */
+export function layerMaterials(
+  materials: StackMaterials,
+  layer: StackLayer,
+): Material | Material[] {
+  if (layer !== "infra") {
+    return materials.layers[layer];
+  }
+  const edge = materials.pcbEdge;
+  return [edge, edge, materials.layers.infra, edge, edge, edge];
+}
+
 export function disposeMaterials(materials: StackMaterials): void {
   const all: Material[] = [
+    materials.pcbEdge,
     ...Object.values(materials.layers),
     materials.copper,
     materials.etchHero,
```

`src/experience/scenes/StackModel.tsx`:

```diff
diff --git a/src/experience/scenes/StackModel.tsx b/src/experience/scenes/StackModel.tsx
index fb78d90..1729353 100644
--- a/src/experience/scenes/StackModel.tsx
+++ b/src/experience/scenes/StackModel.tsx
@@ -13,7 +13,11 @@ import { STACK_LAYERS, type StackLayer } from "@/content/types";
 import type { Tier } from "../gpu-tier";
 import surfaceMapManifest from "../textures.json";
 import { edgeFrameGeometry, edgeObjectName } from "./edges";
-import { createStackMaterials, disposeMaterials } from "./materials";
+import {
+  createStackMaterials,
+  disposeMaterials,
+  layerMaterials,
+} from "./materials";
 import {
   jobChipU,
   PCB_TRACE_PATH,
@@ -35,6 +39,8 @@ import {
   ENGRAVE_CONTACT_TEXT,
   ENGRAVE_HERO_TEXT,
   etchingTexture,
+  pcbEdgeTexture,
+  pcbSurfaceTexture,
   pcbTexture,
 } from "./textures";
 
@@ -64,6 +70,12 @@ const ASSET_BASE = (process.env.NEXT_PUBLIC_ASSET_BASE ?? "").replace(
 const HALF = STACK_FOOTPRINT / 2;
 const SURFACE = 0.0008;
 
+/**
+ * Edge radius (m) and its segments: wide enough for the softboxes to draw a
+ * clean highlight line along every edge, even from across the room.
+ */
+const BEVEL = { glass: 0.01, metal: 0.008, segments: 5 } as const;
+
 function createGeometries() {
   const layers = Object.fromEntries(
     Object.entries(LAYER_HEIGHT).map(([layer, height]) => [
@@ -72,8 +84,8 @@ function createGeometries() {
         STACK_FOOTPRINT,
         height,
         STACK_FOOTPRINT,
-        4,
-        layer === "interface" ? 0.008 : 0.005,
+        BEVEL.segments,
+        layer === "interface" ? BEVEL.glass : BEVEL.metal,
       ).translate(0, height / 2, 0),
     ]),
   ) as Record<StackLayer, RoundedBoxGeometry>;
@@ -125,6 +137,8 @@ function ProceduralStack({ tier, onReady, jobs }: StackModelProps) {
   const textures = useMemo(
     () => ({
       pcb: pcbTexture(),
+      pcbSurface: pcbSurfaceTexture(),
+      pcbEdge: pcbEdgeTexture(),
       etchHero: etchingTexture(ENGRAVE_HERO_TEXT),
       etchContact: etchingTexture(ENGRAVE_CONTACT_TEXT),
     }),
@@ -175,7 +189,7 @@ function ProceduralStack({ tier, onReady, jobs }: StackModelProps) {
           name={name}
           position-y={y}
           geometry={geometries.layers[layer]}
-          material={materials.layers[layer]}
+          material={layerMaterials(materials, layer)}
         >
           <mesh
             name={edgeObjectName(layer)}
```

- [ ] **Step 5: MSAA and dithering**

`src/experience/postfx/Effects.tsx`:

```diff
diff --git a/src/experience/postfx/Effects.tsx b/src/experience/postfx/Effects.tsx
index 76bff52..7161664 100644
--- a/src/experience/postfx/Effects.tsx
+++ b/src/experience/postfx/Effects.tsx
@@ -19,8 +19,10 @@ export type Tier3Module = typeof import("./tier3");
  * @react-three/postprocessing bundle also ships every effect). The composer
  * renders into a float buffer, where the renderer's tone mapping does not
  * apply, so AgX runs as an effect, before anti-aliasing. FXAA, not SMAA:
- * SMAA embeds its lookup textures (+54 KB gz in the lazy chunk). Tier 3 adds
- * ambient occlusion (N8AO) and bokeh depth of field (`extras`).
+ * SMAA embeds its lookup textures (+54 KB gz in the lazy chunk). The scene
+ * renders with 4x MSAA: sub-pixel highlights on the bevels and the glowing
+ * edge bands broke into rows of dots without it, which FXAA cannot join.
+ * Tier 3 adds ambient occlusion (N8AO) and bokeh depth of field (`extras`).
  */
 export function Effects({
   extras,
@@ -45,7 +47,7 @@ export function Effects({
   const composer = useMemo(() => {
     const composer = new EffectComposer(gl, {
       frameBufferType: HalfFloatType,
-      multisampling: 0,
+      multisampling: 4,
     });
     composer.addPass(new RenderPass(scene, camera));
     const t3 = extras?.tier3Effects(scene, camera, focus, 1, 1);
@@ -64,7 +66,11 @@ export function Effects({
         new ToneMappingEffect({ mode: ToneMappingMode.AGX }),
       ),
     );
-    composer.addPass(new EffectPass(camera, new FXAAEffect()));
+    const output = new EffectPass(camera, new FXAAEffect());
+    // The studio's dark gradients (the contact shadow on the floor) band
+    // in 8 bits; a little noise hides the steps.
+    output.dithering = true;
+    composer.addPass(output);
     return composer;
   }, [gl, scene, camera, extras, focus]);
```

- [ ] **Step 6: Run the tests again, the poster step, a look on the GPU**

Run: `rtk proxy pnpm test`
Expected: `Test Files  1 failed | 43 passed (44)`, `Tests  1 failed | 326 passed (327)`: only `posters.test.ts › were captured from the current scene code` (the poster step fixes it)

Run the poster step (`pnpm build`, `pnpm assets:posters`).
Expected: `wrote 48 files and src/experience/posters.json`; all 48 poster files are replaced

Compare the new 1920 posters with the previous commit's (`/usr/bin/git show HEAD:public/posters/<old name>` for the old file): no dark rectangle behind the stack, continuous highlight lines along every bevel, copper lines on the board's edge, a soft shadow under the stack with no outline on the floor.

Run: `rtk proxy pnpm test`, `rtk proxy pnpm typecheck`, `rtk proxy pnpm lint`
Expected: `Test Files  44 passed (44)`, `Tests  327 passed (327)`; lint `Checked 275 files in <n>ms. No fixes applied.`; no TypeScript errors.

Run: `pnpm test:e2e`
Expected: `/en: 149.5 KB gz before 3D`, `/ro: 149.5 KB gz before 3D`, `/en/projects/ledger-lens: 146.3 KB gz before 3D`, `lazy: 3 chunk(s), 316.5 KB gz`, `tier 3: +1 chunk, 81.7 KB gz`, the two `contact: … failed Error: EEXIST …` lines M3's outage test always prints, then `134 passed`

- [ ] **Step 7: Commit**

```bash
/usr/bin/git add public/posters src tests
/usr/bin/git commit -m "feat(scenes): look-dev pass on materials and light"
```

---

### Task 8: Phones: thumb-sized controls, the hero copy above the stack

**Owner:** frontend-engineer; the poster step may go to devops-engineer.

Checked at 390x844 and 360x800 (the brief's phones) with a coarse pointer. Before: the header's name, the language links, the Motion switch, Contact's email and profile links and the footer link were 24 to 32 px tall; the hero's copy sat in the middle of the screen, over the finished stack, behind a scrim that faded out at 40%. After:

1. Every control is at least 44 x 44 px on a coarse pointer (`pointer-coarse:min-h-11`, plus `min-w-11` on the Motion switch); desktop sizes do not change. Links inside running text are exempt (WCAG 2.5.8's inline exception).
2. The hero's copy moves to the top on a portrait screen (`portrait:items-start`), the portrait crop keeps the frame's bottom (`CROP_ANCHOR.portrait = "bottom"`, posters `object-position: center bottom`), and a new portrait hero key ends with the whole stack in the lowest 40% of the screen, under the copy. The scrim is solid to 36%, 60% at 50%, clear from 66%.
3. Press feedback on the Motion switch (`active:scale-[0.97]`) and the secondary hero button (`active:scale-[0.98]`), both under `motion-safe`, and no grey tap flash (`-webkit-tap-highlight-color: transparent`): the controls show their own pressed state.

**Files:**
- Modify: `src/experience/director/{framing.ts,shots.ts,JourneyShot.tsx}`, `src/components/sections/{Hero,Contact}.tsx`, `src/components/site/{SiteHeader,LocaleSwitcher,SiteFooter}.tsx`, `src/experience/MotionToggle.tsx`, `src/app/globals.css`, `public/posters/*` and `src/experience/posters.json` (poster step)
- Test: `tests/e2e/mobile.spec.ts` (new), `tests/unit/framing.test.ts`

**Interfaces:**
- Consumes: Task 6's `coverViewOffset` and `data-box`; Task 3's `MotionToggle`.
- Produces: `coverViewOffset(width, height, referenceAspect, anchor: "center" | "right" | "bottom" = "center")` (Task 6's `"end"` becomes `"right"`); `CROP_ANCHOR: Record<Orientation, "right" | "bottom">` = `{ landscape: "right", portrait: "bottom" }`; portrait hero key T 1 `[0.622, 0.947, 1.538]` → `[-0.044, 0.41, -0.053]`.

- [ ] **Step 1: Write the failing tests**

`tests/unit/framing.test.ts`:

```diff
diff --git a/tests/unit/framing.test.ts b/tests/unit/framing.test.ts
index d11b70b..f74ec7b 100644
--- a/tests/unit/framing.test.ts
+++ b/tests/unit/framing.test.ts
@@ -1,5 +1,6 @@
 import { describe, expect, it } from "vitest";
 import {
+  CROP_ANCHOR,
   coverViewOffset,
   orientationOf,
   REFERENCE_SIZE,
@@ -39,11 +40,23 @@ describe("coverViewOffset", () => {
   it("can keep the right edge instead, like object-position: right", () => {
     // Landscape shots put the stack right of the copy: a 16:10 or 3:2
     // laptop loses the empty left of the frame, never the stack.
-    const view = coverViewOffset(1440, 1080, wide, "end");
+    const view = coverViewOffset(1440, 1080, wide, "right");
 
     expect(view.x).toBeCloseTo(480);
     expect(view.x + view.width).toBeCloseTo(view.fullWidth);
-    expect(coverViewOffset(2560, 1080, wide, "end").y).toBeCloseTo(180);
+    expect(coverViewOffset(2560, 1080, wide, "right").y).toBeCloseTo(180);
+  });
+
+  it("can keep the bottom edge, like object-position: bottom", () => {
+    // Portrait shots put the stack below the copy: a tablet (3:4) loses
+    // the top of the frame, behind the copy, never the stack.
+    const tall = REFERENCE_SIZE.portrait.width / REFERENCE_SIZE.portrait.height;
+    const view = coverViewOffset(768, 1024, tall, "bottom");
+
+    expect(view.y + view.height).toBeCloseTo(view.fullHeight);
+    expect(view.y).toBeGreaterThan(0);
+    expect(coverViewOffset(360, 800, tall, "bottom").y).toBe(0);
+    expect(CROP_ANCHOR).toEqual({ landscape: "right", portrait: "bottom" });
   });
 
   it("crops top and bottom of a wider viewport", () => {
```

`tests/e2e/mobile.spec.ts` (no sideways scroll on `/en`, `/ro` and two project pages; every visible control ≥ 44 px, with the cards' stretched links and icon links included; the hero copy above the finished stack, measured in capture mode):

```ts
import { expect, type Page, test } from "@playwright/test";

// Phones: no sideways scrolling, controls big enough for a thumb (44 px,
// Apple's minimum; WCAG 2.5.8 asks for 24), and the hero's copy clear of
// the finished stack.
const PHONES = [
  { name: "390x844", width: 390, height: 844 },
  { name: "360x800", width: 360, height: 800 },
] as const;

const TARGET = 44;

async function tooSmall(page: Page, selectors: string[]) {
  return page.evaluate(
    ({ selectors, target }) =>
      selectors.flatMap((selector) =>
        [...document.querySelectorAll<HTMLElement>(selector)]
          .filter((element) => element.checkVisibility())
          .map((element) => {
            const box = element.getBoundingClientRect();
            return {
              control: `${selector} "${element.textContent?.trim().slice(0, 20)}"`,
              width: Math.round(box.width),
              height: Math.round(box.height),
            };
          })
          .filter((box) => box.width < target || box.height < target),
      ),
    { selectors, target: TARGET },
  );
}

for (const phone of PHONES) {
  test.describe(`on a ${phone.name} phone`, () => {
    test.use({
      viewport: { width: phone.width, height: phone.height },
      isMobile: true,
      hasTouch: true,
    });

    test("no page scrolls sideways", async ({ page }) => {
      for (const path of [
        "/en",
        "/ro",
        "/en/projects/ledger-lens",
        "/ro/projects/tramline",
      ]) {
        await page.goto(path);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        expect(overflow, path).toBeLessThanOrEqual(0);
      }
    });

    test("every control is big enough for a thumb", async ({ page }) => {
      await page.goto("/en");
      expect(
        await tooSmall(page, [
          "header a",
          "header button",
          '[data-scene="hero"] a',
          // A card opens its project anywhere on it (stretched title link).
          "#projects article",
          "#projects article a[aria-label]",
          "#contact .section-body > div a",
          "footer a",
        ]),
      ).toEqual([]);

      await page.goto("/en/projects/tramline");
      expect(
        await tooSmall(page, ["header a", "header button", "article a"]),
      ).toEqual([]);
    });

    test("the hero's copy sits above the finished stack", async ({ page }) => {
      test.setTimeout(120_000);
      await page.goto("/en?capture=hero&p=1");
      await expect(page.locator("html")).toHaveAttribute(
        "data-canvas",
        "captured",
        { timeout: 90_000 },
      );
      const [x, y, width] = (
        (await page.locator(".stage-layer").getAttribute("data-box")) ?? ""
      )
        .split(" ")
        .map(Number);
      const copyBottom = await page.evaluate(() =>
        Math.max(
          ...[
            ...document.querySelectorAll('[data-scene="hero"] :is(h1, p, a)'),
          ].map((element) => element.getBoundingClientRect().bottom),
        ),
      );

      expect(y).toBeGreaterThanOrEqual(copyBottom + 24);
      expect(x).toBeGreaterThanOrEqual(16);
      expect(x + width).toBeLessThanOrEqual(phone.width - 16);
    });
  });
}
```

- [ ] **Step 2: Run them to see them fail**

Run: `rtk proxy pnpm exec vitest run tests/unit/framing.test.ts tests/unit/shots.test.ts`
Expected: `Test Files  1 failed | 1 passed (2)`, `Tests  2 failed | 19 passed (21)`: `can keep the right edge instead, like object-position: right` (`expected 240 to be close to 480`: the anchor is now called `"right"`) and `can keep the bottom edge, like object-position: bottom` (`expected 1343.07… to be close to 1662.14…`)

Run: `pnpm exec playwright test tests/e2e/mobile.spec.ts --project=public`
Expected: `4 failed`, `2 passed`: `every control is big enough for a thumb` at both sizes (a list starting with `"control": "header a \"Alex Marin\""`, `"height": 32`) and `the hero's copy sits above the finished stack` (`Expected: >= 618.53125`, `Received: 359` at 390x844; `595.625` and `340` at 360x800); `no page scrolls sideways` passes already

- [ ] **Step 3: Crop portrait from the bottom, a new portrait hero key**

`src/experience/director/framing.ts`, `src/experience/director/shots.ts`, `src/experience/director/JourneyShot.tsx`:

```diff
diff --git a/src/experience/director/framing.ts b/src/experience/director/framing.ts
index cfe8bac..4bd42f7 100644
--- a/src/experience/director/framing.ts
+++ b/src/experience/director/framing.ts
@@ -32,35 +32,43 @@ export type ViewOffset = {
 /**
  * Arguments for `PerspectiveCamera.setViewOffset` (camera.aspect must be the
  * reference aspect): the viewport becomes a window into a virtual
- * reference-aspect frame that covers it, centred, or with `align: "end"`
- * against the frame's right edge when the sides are cropped (landscape
- * shots, which keep the stack right of the copy; posters use
- * `object-position: right` to match).
+ * reference-aspect frame that covers it. The crop is centred, or keeps the
+ * side where the stack is: landscape shots keep the right edge (the copy
+ * is on the left), portrait shots the bottom (the copy is on top). Posters
+ * use the same `object-position`.
  */
 export function coverViewOffset(
   width: number,
   height: number,
   referenceAspect: number,
-  align: "center" | "end" = "center",
+  anchor: "center" | "right" | "bottom" = "center",
 ): ViewOffset {
   if (width / height > referenceAspect) {
     const fullHeight = width / referenceAspect;
+    const spare = fullHeight - height;
     return {
       fullWidth: width,
       fullHeight,
       x: 0,
-      y: (fullHeight - height) / 2,
+      y: anchor === "bottom" ? spare : spare / 2,
       width,
       height,
     };
   }
   const fullWidth = height * referenceAspect;
+  const spare = fullWidth - width;
   return {
     fullWidth,
     fullHeight: height,
-    x: align === "end" ? fullWidth - width : (fullWidth - width) / 2,
+    x: anchor === "right" ? spare : spare / 2,
     y: 0,
     width,
     height,
   };
 }
+
+/** Which edge of the reference frame a shot keeps (see coverViewOffset). */
+export const CROP_ANCHOR: Record<Orientation, "right" | "bottom"> = {
+  landscape: "right",
+  portrait: "bottom",
+};
```

```diff
diff --git a/src/experience/director/shots.ts b/src/experience/director/shots.ts
index 51e55bd..7240ac0 100644
--- a/src/experience/director/shots.ts
+++ b/src/experience/director/shots.ts
@@ -81,8 +81,8 @@ export function sampleCameraKeys(
  * Shot S1 (hero), metres, stack centred on the origin (asset contract):
  * macro dolly along the anodized base plate, up the front faces, over the
  * glass top where a softbox sweep reveals `engrave_hero`, then a pull-back to
- * the whole monolith. Landscape keeps the monolith right of the copy; portrait
- * keeps it in the lower half.
+ * the whole monolith. Landscape ends with the monolith in the right half,
+ * portrait under the copy, in the lowest 40% of a phone's screen.
  */
 export const HERO_KEYS: Record<Orientation, readonly CameraKey[]> = {
   landscape: [
@@ -95,7 +95,7 @@ export const HERO_KEYS: Record<Orientation, readonly CameraKey[]> = {
     { at: 0, position: [0.3, 0.035, 0.42], target: [0.04, 0.03, 0.19] },
     { at: 0.28, position: [0.02, 0.13, 0.52], target: [0, 0.12, 0.19] },
     { at: 0.55, position: [0, 0.62, 0.36], target: [0, 0.25, 0.04] },
-    { at: 1, position: [0.72, 0.78, 1.72], target: [0, 0.2, 0] },
+    { at: 1, position: [0.622, 0.947, 1.538], target: [-0.044, 0.41, -0.053] },
   ],
 };
```

```diff
diff --git a/src/experience/director/JourneyShot.tsx b/src/experience/director/JourneyShot.tsx
index 814164c..adabedd 100644
--- a/src/experience/director/JourneyShot.tsx
+++ b/src/experience/director/JourneyShot.tsx
@@ -11,7 +11,12 @@ import { edgeObjectName } from "../scenes/edges";
 import type { PulseUniforms } from "../scenes/materials";
 import { STACK_SHADOW } from "../scenes/StudioLights";
 import { STACK_OBJECTS, stackLayout } from "../scenes/stack-layout";
-import { coverViewOffset, orientationOf, REFERENCE_SIZE } from "./framing";
+import {
+  CROP_ANCHOR,
+  coverViewOffset,
+  orientationOf,
+  REFERENCE_SIZE,
+} from "./framing";
 import { type JourneyFrame, litJob } from "./journey";
 import type { Motion } from "./motion";
 import { anchorRows, findPageLinks, markLit, stackBox } from "./page-links";
@@ -65,7 +70,7 @@ export function JourneyShot({
       width,
       height,
       reference.width / reference.height,
-      orientation === "landscape" ? "end" : "center",
+      CROP_ANCHOR[orientation],
     );
     camera.fov = SHOT_FOV[orientation];
     camera.aspect = reference.width / reference.height;
```

- [ ] **Step 4: The hero copy on top, 44 px controls, press feedback**

`src/components/sections/Hero.tsx`, `src/components/sections/Contact.tsx`:

```diff
diff --git a/src/components/sections/Hero.tsx b/src/components/sections/Hero.tsx
index ff060c6..f4a0158 100644
--- a/src/components/sections/Hero.tsx
+++ b/src/components/sections/Hero.tsx
@@ -17,7 +17,7 @@ export function Hero({ cv }: { cv: Cv }) {
 
   return (
     <section aria-labelledby="hero-title" data-scene="hero" className="hero">
-      <div className="sticky top-0 flex min-h-lvh items-center overflow-hidden">
+      <div className="sticky top-0 flex min-h-lvh items-center overflow-hidden portrait:items-start">
         <HeroPoster />
         <div aria-hidden="true" className="hero-scrim absolute inset-0" />
         <div className="relative mx-auto w-full max-w-content px-gutter pt-28 pb-16">
@@ -53,7 +53,7 @@ export function Hero({ cv }: { cv: Cv }) {
               </a>
               <a
                 href="#projects"
-                className="rounded-full bg-canvas/60 px-6 py-3 font-medium text-ink ring-1 ring-line-strong transition-colors hover:bg-raised"
+                className="rounded-full bg-canvas/60 px-6 py-3 font-medium text-ink ring-1 ring-line-strong transition-[background-color,scale] duration-(--motion-press) hover:bg-raised motion-safe:active:scale-[0.98]"
               >
                 {t("secondaryCta")}
               </a>
```

```diff
diff --git a/src/components/sections/Contact.tsx b/src/components/sections/Contact.tsx
index 14ab65d..496724d 100644
--- a/src/components/sections/Contact.tsx
+++ b/src/components/sections/Contact.tsx
@@ -45,7 +45,7 @@ export function Contact({ cv }: { cv: Cv }) {
             </h3>
             <a
               href={`mailto:${profile.email}`}
-              className="mt-2 inline-block text-heading text-ink wrap-anywhere underline decoration-line-strong underline-offset-8 transition-colors hover:decoration-signal"
+              className="mt-2 inline-block text-heading text-ink wrap-anywhere underline decoration-line-strong underline-offset-8 transition-colors hover:decoration-signal pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center"
             >
               {profile.email}
             </a>
@@ -59,7 +59,7 @@ export function Contact({ cv }: { cv: Cv }) {
                 <li key={social.network}>
                   <a
                     href={social.url}
-                    className="text-ink underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-signal"
+                    className="text-ink underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-signal pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center"
                   >
                     {SOCIAL_LABELS[social.network]}
                   </a>
```

`src/components/site/SiteHeader.tsx`, `LocaleSwitcher.tsx`, `SiteFooter.tsx`, `src/experience/MotionToggle.tsx`:

```diff
diff --git a/src/components/site/SiteHeader.tsx b/src/components/site/SiteHeader.tsx
index 2bac3d0..f0fbcf7 100644
--- a/src/components/site/SiteHeader.tsx
+++ b/src/components/site/SiteHeader.tsx
@@ -32,7 +32,7 @@ export function SiteHeader({ cv, path }: { cv: Cv; path: string | null }) {
     >
       <a
         href="#top"
-        className="rounded-full py-1.5 text-sm font-semibold text-ink"
+        className="inline-flex items-center rounded-full py-1.5 text-sm font-semibold text-ink pointer-coarse:min-h-11"
       >
         {cv.profile.fullName.value}
       </a>
```

```diff
diff --git a/src/components/site/LocaleSwitcher.tsx b/src/components/site/LocaleSwitcher.tsx
index 0904888..bea2ea3 100644
--- a/src/components/site/LocaleSwitcher.tsx
+++ b/src/components/site/LocaleSwitcher.tsx
@@ -23,7 +23,7 @@ export function LocaleSwitcher({
               locale={target}
               lang={target}
               aria-current={target === locale ? "page" : undefined}
-              className="block rounded-full px-3 py-1.5 text-sm text-ink-muted transition-colors hover:text-ink aria-[current=page]:bg-raised aria-[current=page]:text-ink"
+              className="flex items-center rounded-full px-3 py-1.5 text-sm text-ink-muted transition-colors hover:text-ink aria-[current=page]:bg-raised aria-[current=page]:text-ink pointer-coarse:min-h-11"
             >
               {t(target)}
             </Link>
```

```diff
diff --git a/src/components/site/SiteFooter.tsx b/src/components/site/SiteFooter.tsx
index f8e7881..bf2981f 100644
--- a/src/components/site/SiteFooter.tsx
+++ b/src/components/site/SiteFooter.tsx
@@ -7,7 +7,10 @@ export function SiteFooter({ cv }: { cv: Cv }) {
   return (
     <footer className="mx-auto flex w-full max-w-content flex-col gap-4 border-t px-gutter py-10 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between">
       <p>© {cv.profile.fullName.value}</p>
-      <a href="#top" className="text-ink transition-colors hover:text-signal">
+      <a
+        href="#top"
+        className="text-ink transition-colors hover:text-signal pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center"
+      >
         {t("backToTop")}
       </a>
     </footer>
```

```diff
diff --git a/src/experience/MotionToggle.tsx b/src/experience/MotionToggle.tsx
index 808d51a..537df23 100644
--- a/src/experience/MotionToggle.tsx
+++ b/src/experience/MotionToggle.tsx
@@ -27,7 +27,7 @@ export function MotionToggle({ labels }: { labels: MotionToggleLabels }) {
       type="button"
       aria-pressed={on}
       onClick={() => setMotionChoice(on ? "off" : "on")}
-      className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-2 text-sm text-ink-muted ring-1 ring-line transition-colors hover:text-ink"
+      className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-2 text-sm text-ink-muted ring-1 ring-line transition-[color,scale] duration-(--motion-press) hover:text-ink motion-safe:active:scale-[0.97] pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:justify-center"
     >
       <span
         aria-hidden="true"
```

`src/app/globals.css`:

```diff
diff --git a/src/app/globals.css b/src/app/globals.css
index 8ad7804..a7fc30d 100644
--- a/src/app/globals.css
+++ b/src/app/globals.css
@@ -87,6 +87,12 @@
     border-color: var(--color-line);
   }
 
+  /* Controls show their own pressed state; no grey flash on tap. */
+  a,
+  button {
+    -webkit-tap-highlight-color: transparent;
+  }
+
   ::selection {
     background-color: var(--color-signal);
     color: var(--color-signal-ink);
@@ -217,7 +223,7 @@ html[data-canvas="live"] .hero-poster {
 
 /*
  * Posters are cropped like the live camera (framing.ts): landscape keeps the
- * right edge of the frame, where the stack is; portrait stays centred.
+ * right edge of the frame, portrait the bottom: where the stack is.
  */
 @media (orientation: landscape) {
   :is(.hero-poster, .section-poster) img {
@@ -225,6 +231,12 @@ html[data-canvas="live"] .hero-poster {
   }
 }
 
+@media (orientation: portrait) {
+  :is(.hero-poster, .section-poster) img {
+    object-position: center bottom;
+  }
+}
+
 /* Keeps the copy readable over any frame: from the left in landscape, from the top in portrait. */
 .hero-scrim {
   background: linear-gradient(
@@ -240,12 +252,14 @@ html[data-canvas="live"] .hero-poster {
     clip-path: inset(22% 0 0 0);
   }
 
+  /* The copy sits at the top (11-48% of a phone's height), the finished
+     stack below it (from 56%): solid behind the copy, clear by the stack. */
   .hero-scrim {
     background: linear-gradient(
       180deg,
-      var(--color-canvas) 22%,
-      color-mix(in oklab, var(--color-canvas) 60%, transparent) 40%,
-      transparent 65%
+      var(--color-canvas) 36%,
+      color-mix(in oklab, var(--color-canvas) 60%, transparent) 50%,
+      transparent 66%
     );
   }
 }
```

- [ ] **Step 5: Run the tests again, then the poster step**

Run: `rtk proxy pnpm test`
Expected: `Test Files  1 failed | 43 passed (44)`, `Tests  1 failed | 327 passed (328)`: only `posters.test.ts › were captured from the current scene code` (the poster step fixes it)

Run the poster step (`pnpm build`, `pnpm assets:posters`).
Expected: `wrote 48 files and src/experience/posters.json`; four poster files are replaced: `about-portrait-828` and `hero-end-portrait-828`. Look at `public/posters/hero-end-portrait-828.*.webp`: the whole stack in the lower part of the frame, the upper half plain studio for the copy.

Run: `rtk proxy pnpm test`, `rtk proxy pnpm typecheck`, `rtk proxy pnpm lint`
Expected: `Test Files  44 passed (44)`, `Tests  328 passed (328)`; lint `Checked 276 files in <n>ms. No fixes applied.`; no TypeScript errors.

Run: `pnpm test:e2e`
Expected: `/en: 149.6 KB gz before 3D`, `/ro: 149.6 KB gz before 3D`, `/en/projects/ledger-lens: 146.3 KB gz before 3D`, `lazy: 3 chunk(s), 316.5 KB gz`, `tier 3: +1 chunk, 81.7 KB gz`, the two `contact: … failed Error: EEXIST …` lines M3's outage test always prints, then `140 passed`

- [ ] **Step 6: Commit**

```bash
/usr/bin/git add public/posters src tests
/usr/bin/git commit -m "feat(mobile): bigger tap targets, copy above stack"
```

---

### Task 9: Performance: round trips on the GPU, LHCI on a project page

**Owner:** tester.

M6's `pnpm perf:local` scrolls the page once per tier on the Iris Xe. M7 adds what M7 made possible: leaving the home page for a project page and coming back, three times. Each return mounts a new WebGL context (Task 4), so the test checks that a remount stays in short tasks (≤ 100 ms, M6's mount budget), that the page still runs at 60 fps at every stop afterwards (≥ 55 asserted, no task over 50 ms while scrolling) and that the old contexts do not pile up (tab < 400 MB). LHCI gets a project page as its third URL.

**Files:**
- Modify: `tests/perf/journey.perf.ts`, `lighthouserc.json`

**Interfaces:**
- Consumes: M6's `scrollPage`, `stats`, `privateMb`, `STOPS`, the budgets `LONG_TASK_BUDGET_MS = 50`, `MOUNT_BUDGET_MS = 100`, `MEMORY_BUDGET_MB = 400`, `MIN_FPS = 55`; Task 3's card links and "All work"; Task 4's stage reset.
- Produces: the perf test `three trips to a project page and back keep the stage smooth and lean` (prints `{"remountLongTasks":[…],"perStop":{…},"longTasksWhileScrolling":[…],"tabMb":…}`); LHCI URLs `/en`, `/ro`, `/en/projects/ledger-lens`.

- [ ] **Step 1: Write the test**

`tests/perf/journey.perf.ts`:

```diff
diff --git a/tests/perf/journey.perf.ts b/tests/perf/journey.perf.ts
index 382cbd8..f3686af 100644
--- a/tests/perf/journey.perf.ts
+++ b/tests/perf/journey.perf.ts
@@ -178,3 +178,120 @@ for (const tier of ["auto", "1", "3"] as const) {
     }
   });
 }
+
+test("three trips to a project page and back keep the stage smooth and lean", async ({
+  page,
+  browser,
+}, testInfo) => {
+  // Next keeps the home page in a hidden <Activity> while a project page is
+  // open; the stage drops its WebGL context then and mounts a new one on the
+  // way back (StageLoader). Each remount must stay in short tasks, and the
+  // contexts must not pile up in memory.
+  test.setTimeout(240_000);
+  await page.addInitScript(() => {
+    window.__longTasks = [];
+    window.__frames = [];
+    new PerformanceObserver((list) => {
+      for (const entry of list.getEntries()) {
+        window.__longTasks.push({
+          start: entry.startTime,
+          duration: entry.duration,
+        });
+      }
+    }).observe({ type: "longtask", buffered: true });
+    const frame = (now: number) => {
+      const layer = document.querySelector<HTMLElement>(".stage-layer");
+      window.__frames.push([now, Number(layer?.dataset.journey ?? 0)]);
+      requestAnimationFrame(frame);
+    };
+    requestAnimationFrame(frame);
+  });
+  await page.goto("/en");
+  const html = page.locator("html");
+  await expect(html).toHaveAttribute("data-canvas", /live|poster/, {
+    timeout: 30_000,
+  });
+  test.skip(
+    (await html.getAttribute("data-canvas")) === "poster",
+    "No hardware WebGL here: the classifier chose posters.",
+  );
+
+  const remounts: number[][] = [];
+  for (let trip = 0; trip < 3; trip += 1) {
+    await page.locator("#projects").scrollIntoViewIfNeeded();
+    await page
+      .locator("#projects")
+      .getByRole("link", { name: "Tramline", exact: true })
+      .click();
+    await expect(page).toHaveURL("/en/projects/tramline");
+    await expect(page.locator(".stage-layer")).toHaveCount(0);
+    await page.waitForTimeout(500);
+    const left = await page.evaluate(() => performance.now());
+    await page.getByRole("link", { name: "All work" }).click();
+    await expect(page).toHaveURL("/en#projects");
+    // Up to About, where the stage shows (it steps back behind Projects).
+    await page.locator("#about").scrollIntoViewIfNeeded();
+    await expect(html).toHaveAttribute("data-canvas", "live", {
+      timeout: 30_000,
+    });
+    await page.waitForTimeout(1500);
+    remounts.push(
+      await page.evaluate(
+        (since) =>
+          window.__longTasks
+            .filter((task) => task.start >= since)
+            .map((task) => Math.round(task.duration)),
+        left,
+      ),
+    );
+  }
+
+  await page.evaluate(() => window.scrollTo(0, 0));
+  await page.waitForTimeout(1500);
+  const scrollStart = await page.evaluate(() => performance.now());
+  await scrollPage(page);
+  const { longTasks, frames } = await page.evaluate(
+    (start) => ({
+      longTasks: window.__longTasks.filter((task) => task.start >= start),
+      frames: window.__frames.filter(([time]) => time >= start),
+    }),
+    scrollStart,
+  );
+  const byStop = STOPS.map(() => [] as number[]);
+  for (let i = 1; i < frames.length; i += 1) {
+    const stop = Math.min(STOPS.length - 1, Math.floor(frames[i][1]));
+    byStop[stop].push(frames[i][0] - frames[i - 1][0]);
+  }
+  const perStop = Object.fromEntries(
+    STOPS.map((stop, index) => [stop, stats(byStop[index]).fps]),
+  );
+  const browserCdp = await browser.newBrowserCDPSession();
+  const { processInfo } = await browserCdp.send("SystemInfo.getProcessInfo");
+  const renderer = processInfo
+    .filter((info) => info.type === "renderer")
+    .sort((a, b) => b.cpuTime - a.cpuTime)[0];
+  const gpu = processInfo.find((info) => info.type === "GPU");
+  const tabMb = privateMb(renderer.id) + (gpu ? privateMb(gpu.id) : 0);
+  const report = {
+    remountLongTasks: remounts,
+    perStop,
+    longTasksWhileScrolling: longTasks.map((task) => Math.round(task.duration)),
+    tabMb: Number(tabMb.toFixed(1)),
+  };
+  console.log(JSON.stringify(report));
+  await testInfo.attach("round-trips.json", {
+    body: JSON.stringify(report, null, 2),
+    contentType: "application/json",
+  });
+
+  for (const tasks of remounts) {
+    expect(Math.max(0, ...tasks)).toBeLessThanOrEqual(MOUNT_BUDGET_MS);
+  }
+  expect(
+    Math.max(0, ...longTasks.map((task) => task.duration)),
+  ).toBeLessThanOrEqual(LONG_TASK_BUDGET_MS);
+  for (const stop of STOPS) {
+    expect(perStop[stop], stop).toBeGreaterThanOrEqual(MIN_FPS);
+  }
+  expect(report.tabMb).toBeLessThan(MEMORY_BUDGET_MB);
+});
```

- [ ] **Step 2: Run the perf suite on the GPU**

Run: `pnpm build`, then `pnpm perf:local`
Expected: `4 passed`. Tier auto (2): 60 fps at every stop, p95 16.7 to 16.8 ms, `"longTasksWhileScrolling":[]`, `"longTasksBeforeScrolling":[]`, `"tabMb":213.9`; tier 1: 60 fps everywhere, 211.2 MB; tier 3: 60 fps everywhere, 225.6 MB; then `{"remountLongTasks":[[],[],[]],"perStop":{"hero":60,"about":60,"skills":60,"experience":60,"projects":60,"contact":60},"longTasksWhileScrolling":[],"tabMb":232.4}`

The new test passes at once: it guards Task 4's fix. To see it catch the bug, revert `StageLoader.tsx` to Task 3's version (`/usr/bin/git show HEAD~5:src/experience/StageLoader.tsx > src/experience/StageLoader.tsx`), rebuild and run `pnpm perf:local -g "three trips"`: it fails on the first trip with `expect(locator).toHaveCount(expected) failed`, `Expected: 0`, `Received: 1` (the hidden home page still holds its `.stage-layer` while the project page is open). Restore the file (`/usr/bin/git checkout src/experience/StageLoader.tsx`).

- [ ] **Step 3: LHCI on a project page**

`lighthouserc.json`:

```diff
diff --git a/lighthouserc.json b/lighthouserc.json
index a0a4c86..0e0e3ec 100644
--- a/lighthouserc.json
+++ b/lighthouserc.json
@@ -3,7 +3,11 @@
     "collect": {
       "startServerCommand": "next start --port 3200",
       "startServerReadyPattern": "Ready in",
-      "url": ["http://localhost:3200/en", "http://localhost:3200/ro"],
+      "url": [
+        "http://localhost:3200/en",
+        "http://localhost:3200/ro",
+        "http://localhost:3200/en/projects/ledger-lens"
+      ],
       "numberOfRuns": 3,
       "settings": {
         "preset": "desktop"
```

Run: `SITE_URL=http://localhost:3200 pnpm build`, then `pnpm lhci`
Expected: `Checking assertions against 3 URL(s), 9 total run(s)`, `Done running autorun.`, exit code 0. Every run scores 100/100/100/100; LCP 634 to 638 ms on `/en`, 673 to 715 ms on `/ro`, 553 to 558 ms on `/en/projects/ledger-lens`; TBT 0; CLS 0

Read the scores per URL from the reports:

```bash
for f in .lighthouseci/reports/localhost-*.report.json; do node -e 'const r = require(process.argv[1]); const c = r.categories; console.log(new URL(r.finalDisplayedUrl).pathname, ["performance", "accessibility", "best-practices", "seo"].map((k) => Math.round(c[k].score * 100)).join("/"), "LCP", Math.round(r.audits["largest-contentful-paint"].numericValue))' "$PWD/$f"; done
```

- [ ] **Step 4: Commit**

```bash
/usr/bin/git add lighthouserc.json tests/perf
/usr/bin/git commit -m "test(perf): round trips and a project page in lhci"
```

---

### Task 10: README, then the gate

**Owner:** frontend-engineer writes the README; the Overseer runs the gate and reads the numbers.

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document project pages, the content map, framing and look**

`README.md` (script table rows for `lhci` and `perf:local`; the tiers mention 4x MSAA; framing, look and `<Activity>` notes; a "Project pages" section; which admin field shows where):

```diff
diff --git a/README.md b/README.md
index 821965b..fcbab26 100644
--- a/README.md
+++ b/README.md
@@ -41,10 +41,10 @@ gave `pnpm admin:create`).
 | `pnpm format` | Biome format, writes files |
 | `pnpm test` | Vitest unit tests (`tests/unit`) |
 | `pnpm test:e2e` | Playwright e2e (`tests/e2e`, incl. axe); builds and serves on port 3100 |
-| `pnpm lhci` | Lighthouse CI, desktop preset, on port 3200; asserts >= 0.95 in all 4 categories. Run `pnpm build` first |
+| `pnpm lhci` | Lighthouse CI, desktop preset, on port 3200, for `/en`, `/ro` and `/en/projects/ledger-lens`; asserts >= 0.95 in all 4 categories. Run `SITE_URL=http://localhost:3200 pnpm build` first |
 | `pnpm assets:posters` | Capture the hero and section posters from the 3D scene into `public/posters` + `src/experience/posters.json` (port 3400). Run `pnpm build` first |
 | `pnpm assets:textures` | Download the Poly Haven (CC0) detail maps once, convert them to WebP in `public/textures` + `src/experience/textures.json` |
-| `pnpm perf:local` | Long tasks, frame rate per section and memory while scrolling the whole page on the live stage, on this machine's GPU (port 3300). Run `pnpm build` first |
+| `pnpm perf:local` | Long tasks, frame rate per section and memory while scrolling the whole page on the live stage, and after three trips to a project page and back, on this machine's GPU (port 3300). Run `pnpm build` first |
 | `pnpm db:generate --name <name>` | Drizzle Kit: write a SQL migration in `drizzle/` from schema changes (no database needed) |
 | `pnpm db:migrate` | Apply pending migrations to `DATABASE_URL` |
 | `pnpm db:seed` | Load the fixture CV into an empty database; `--reset` replaces all CV content |
@@ -69,7 +69,7 @@ server-rendered text over a poster image; all text stays in the HTML.
 - **Tiers.** After the load event, `StageLoader` picks a tier from the WebGL
   renderer string: 0 = posters only (no WebGL 2 or a software renderer),
   1 = light scene (DPR 1, no glass transmission, no post-processing), 2 =
-  reference (Intel Iris Xe, DPR up to 1.5, bloom + FXAA), 3 = discrete GPUs
+  reference (Intel Iris Xe, DPR up to 1.5, 4x MSAA, bloom + FXAA), 3 = discrete GPUs
   (DPR up to 2, plus ambient occlusion and depth of field from a chunk of
   their own). If frames stay slower than 40 fps while scrolling, the stage
   steps down a tier, and below tier 1 it gives up and shows the poster. A lost
@@ -77,6 +77,23 @@ server-rendered text over a poster image; all text stays in the HTML.
 - **Motion switch.** The **Motion** button in the header turns all of it off
   (posters, native scrolling, no pinned hero) and remembers the choice.
   `prefers-reduced-motion` and Save-Data start with motion off.
+- **Framing.** Each shot is authored for a 16:9 (landscape) or 828x1792
+  (portrait) frame and cropped to the screen like `object-fit: cover`,
+  keeping the side where the stack is: the right edge in landscape (the copy
+  takes the left half), the bottom in portrait (the copy sits on top).
+  `tests/e2e/framing.spec.ts` checks, from 1280x720 to 1920x1080 and on
+  16:10 and 3:2 screens, that the stack stays on screen and 32 px clear of the copy
+  (the stage writes its box to `.stage-layer[data-box]`).
+- **Look.** An environment of softbox strips (no HDRI), AgX tone mapping and
+  a studio background that lands exactly on the page colour after it
+  (`src/experience/scenes/studio.ts`), so the stage meets the page without a
+  seam. The circuit board is copper that reflects on a solder mask that does
+  not, with FR4 edges; the glass has one soft highlight; the bevels are wide
+  enough to draw a clean line along every edge.
+- **Leaving for a project page.** Next keeps the home page in a hidden
+  `<Activity>` while a project page is open: `StageLoader` drops the stage
+  (and its WebGL context) then, and mounts a fresh one on the way back,
+  starting on the section on screen.
 - **Query flags** (any page): `?tier=0..3` forces a tier and keeps it (no
   runtime step-down); `?capture=<scene>&p=0..1` renders one frame of a scene
   (`hero`, `about`, `skills`, `experience`, `contact`) for poster capture.
@@ -117,6 +134,31 @@ server-rendered text over a poster image; all text stays in the HTML.
   `engrave_contact`, `led_status`, `pcb_traces`); a `stack.glb` with the same
   names can replace `ProceduralStack` in `src/experience/scenes/StackModel.tsx`.
 
+## Project pages
+
+Every published project has a page, `/<locale>/projects/<slug>`: title,
+summary, role, outcome, stack, live and source links, the cover and the
+case study (markdown, written in the admin). The pages are prerendered like
+`/en` and `/ro` (a project published later renders on its first visit),
+cached under the same `cv` tag, listed in `sitemap.xml` with hreflang
+alternates, and describe themselves as a schema.org `CreativeWork`. There is
+no 3D on them; the header's section links lead back to the home page.
+
+- **Case studies** render with react-markdown: raw HTML is dropped, only
+  http(s), mailto and relative links survive, and images are left out (the
+  cover is the project's image). A `#` heading renders as `h2`.
+- **Covers** and the headshot come from the media library through the image
+  optimizer (resized, served as WebP): `OptimizedImage` renders next/image's
+  props as a plain `<img>` on the server, so the pages ship no image
+  JavaScript. `next.config.ts` allows `/api/media/**` only; Vercel Blob URLs
+  need a `remotePatterns` entry when production storage is set up (M9).
+- **View Transitions.** Opening a project from the grid slides the page
+  forward and morphs the card's cover into the page's; "All work", "Previous"
+  and the header's section links slide back (React `<ViewTransition>`, types
+  from `next/link`'s `transitionTypes`; `src/components/motion/`). Browsers
+  without View Transitions, reduced motion and **Motion** off swap the page
+  without animating; a browser back button never animates.
+
 ## Local database
 
 `docker compose up -d --wait` starts `postgres:18-alpine` on `127.0.0.1:5432`
@@ -144,6 +186,18 @@ migrations in `drizzle/`). `pnpm db:seed` loads the placeholder CV from
 the next request renders the new content. A blank Romanian field falls
 back to English (marked `lang="en"`).
 
+What the admin edits and where the site shows it:
+
+| Admin | Public site |
+| --- | --- |
+| Profile: name, headline, summary, location, years, availability, email, GitHub, LinkedIn | Hero, About, Contact, header, metadata |
+| Profile: avatar | About (next to the summary) |
+| Profile: CV PDF (EN, RO) | "Download CV" in the hero and in Contact (`/ro` offers the English PDF, marked `hreflang="en"`, until there is a Romanian one) |
+| Experience: role, company, company URL, dates, type, description, highlights | Experience (the company links to its URL) |
+| Skills | Skills, project stacks, JSON-LD |
+| Projects: title, summary, role, outcome, year, featured, skills, links, cover, case study | Projects grid and the project pages |
+| Media: alt text (EN, RO) | Covers and the avatar |
+
 ## Admin
 
 `/admin` is English-only and has one account: `ADMIN_EMAIL`. Public sign-up
```

Run: `rtk proxy pnpm lint`
Expected: `No fixes applied.`

- [ ] **Step 2: Commit**

```bash
/usr/bin/git add README.md
/usr/bin/git commit -m "docs: document project pages, look and framing"
```

- [ ] **Step 3: The gate on a fresh clone (Overseer)**

What CI runs, plus the GPU checks, on a clean clone of the branch with a fresh database (the local compose Postgres, database `cv_gate`), so nothing from the worktree (`.next`, `.data`, `.env.local`) helps:

```bash
cat > /tmp/m7-gate.sh <<'EOF'
#!/usr/bin/env bash
set -e
REPO="$1"
BRANCH="$2"
CI_DIR="$(mktemp -d)/cv-ci"
docker compose -f "$REPO/docker-compose.yml" exec -T db dropdb -U cv --if-exists cv_gate
docker compose -f "$REPO/docker-compose.yml" exec -T db createdb -U cv cv_gate
/usr/bin/git clone -q --branch "$BRANCH" "$REPO" "$CI_DIR"
cd "$CI_DIR"
export CI=1 NEXT_TELEMETRY_DISABLED=1
export DATABASE_URL=postgres://cv:cv@localhost:5432/cv_gate
export ADMIN_EMAIL=ci-owner@example.com
export BETTER_AUTH_SECRET="$(openssl rand -base64 32)"
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm db:migrate
pnpm db:seed
pnpm build
pnpm test:e2e
pnpm perf:local
SITE_URL=http://localhost:3200 pnpm build
pnpm lhci
echo "gate=0"
cd /
rm -rf "$(dirname "$CI_DIR")"
EOF
bash /tmp/m7-gate.sh "$PWD" feat/m7-look-and-projects > /tmp/m7-gate.log 2>&1
tail -1 /tmp/m7-gate.log
rm /tmp/m7-gate.sh
```

Expected: `gate=0`, and in the log: `Checked 276 files in <n>ms. No fixes applied.`; `Test Files  44 passed (44)`, `Tests  328 passed (328)`; `/en: 149.6 KB gz before 3D`, `/ro: 149.6 KB gz before 3D`, `/en/projects/ledger-lens: 146.3 KB gz before 3D`, `lazy: 3 chunk(s), 316.6 KB gz`, `tier 3: +1 chunk, 81.7 KB gz`, the two `contact: … failed Error: EEXIST …` lines M3's outage test always prints, then `140 passed`; `perf:local`: `4 passed`, 60 fps at every stop on tiers auto, 1 and 3 (tabs 214.3, 208.9 and 227.3 MB; the tier-3 mount had one 50 ms task, under M6's 100 ms mount budget, none while scrolling), round trips `{"remountLongTasks":[[],[],[]],…,"longTasksWhileScrolling":[],"tabMb":230.8}`; LHCI: every run 100/100/100/100 on the three URLs (LCP `/en` 634 to 674 ms, `/ro` 674 to 678 ms, project 553 to 555 ms). In the replay the same LHCI ran once more after giving Ledger Lens a 1600x1000 WebP cover through the database (the owner's case once the content is in): the project page still scored 100 in all four, LCP 591 to 636 ms

(`CI=1` turns on Playwright's two retries, as on GitHub; the summary line then also counts `flaky` tests. There were none.)

- [ ] **Step 4: Hand over**

The Overseer merges the worktree branch into `dev` (ExitWorktree or superpowers:finishing-a-development-branch) and asks the owner before any push. The owner then enters the real content in the admin (covers, case studies, links, the CV PDFs, the headshot) and looks at `/en`, `/ro` and a project page on the dev server.

---

## Deviations from the brief and the spec

1. **Only the cover morphs.** The spec's storyboard says "View Transition"; the brief asks for a shared element from the grid card. A prototype morphed the title too: the `h3` → `h1` snapshot scales as a bitmap (a blurred ghost of the small title) and a text-only morph jumps in size. The cover is the one shared element; the page slides around it. A project without a cover slides without a morph.
2. **The header moved from the locale layout into every page** (`PageShell`). Reading the route in the layout suspends under Cache Components (Verified facts 7), and the page-level `<ViewTransition>` must wrap `<main>` (fact 3). The layout keeps `<html>`, the skip link and the footer.
3. **`OptimizedImage` instead of the `<Image>` component.** Same optimizer, same `srcset` and `sizes`, but a plain server-rendered `<img>`: `next/image` would add 5.5 KB gz of client code to every page (fact 10). It relies on Next internals (`next/dist/shared/lib/get-img-props`, `process.env.__NEXT_IMAGE_OPTS`); its unit test breaks first if an upgrade moves them. No blur placeholder from Next: `ProjectCover` paints the LQIP as the frame's background instead.
4. **No CSS smooth scrolling** (M6 had it for reduced-motion-free visitors). Lenis glides to the header's section links while the live stage runs; with posters, Motion off or reduced motion, section links jump. A browser back no longer glides through the page to the grid.
5. **Three M6 unit tests change on purpose** (Task 6): the landscape monolith's x range (`shots.test.ts`), About's yaw sign (`journey.test.ts`, +30° → −30°) and `coverViewOffset`'s new argument (`framing.test.ts`). M6's About turn is replaced, not kept.
6. **4x MSAA** in the post chain (M6: `multisampling: 0`). Frame rate and memory stay within budget (gate numbers below).
7. **Project pages carry no 3D.** The stage belongs to the home page's journey; a project page is text, a cover and links, fully static, with a faint signal-coloured glow at the top (`.project-backdrop`). The home page's stage lets go of the GPU while hidden and comes back on return (Task 4).
8. **The slide needs a prefetched page** (fact 4). A click in the first moments after a card scrolls into view navigates without the slide; nothing breaks.
9. **Case studies take no images** (`disallowedElements: ["img"]`, raw HTML skipped): the media library has no picker for them yet. Headings start at `h2` (`h1` is the project title).
10. **Admin UI unchanged** apart from the "RO missing" badge counting the case study: every field M7 shows already had an admin control since M2.
11. **Test infrastructure:** `scripts/e2e-db.ts` also deletes uploads, and admin tests share `tests/e2e/media-library.ts` (fact 17).

## Open questions for the owner

1. **Vercel Blob and images.** With `BLOB_READ_WRITE_TOKEN` set, uploads get Blob URLs, and `/_next/image` refuses hosts that are not in `images.remotePatterns`: covers and the headshot would not load. M9 (deploy) must add the store's host; add it earlier if a preview deploy with Blob comes before M9.
2. **Browser back during the page slide** lands at the bottom of the home page (fact 5), in Chrome's own scroll restoration. Accept it (a back within 0.4 s of arriving is rare), or take scroll restoration over (`history.scrollRestoration = "manual"` plus saving positions per entry), which touches every navigation?
3. **Tablet portrait** (768x1024, 820x1180) was not framed or tested: phones and laptops were. Add a framing pass in M8?
4. **Placement of the CV link and the headshot:** the CV link sits in the hero next to the two buttons and again in Contact; the headshot is a 56 px circle above About's statement. Worth a look once the real PDF and photo are in.
5. **Fields M7 does not have:** images inside case studies, a project video, experience logos. Which, if any, for M8?
6. **Two timing-sensitive M5 tests** (fact 18): `poster.spec.ts › the 3D chunk is requested only after the LCP` and `motion.spec.ts › the visitor can still turn motion on`. Harden them in M8 (the first should compare with the first LCP candidate or wait for the chunk explicitly)?

## Self-review

- **Spec and brief coverage.** Covers, case studies, links, CV PDF, headshot, company links editable in the admin and shown publicly: Tasks 1, 2, 5 (admin e2e for each). Project pages static, cached, metadata, hreflang, sitemap, JSON-LD, safe markdown, cover through the media store, previous/next: Task 2. Shared-element View Transition and back, fallback without View Transitions, reduced motion and Motion off: Task 3. What the stage does on project pages: nothing, and it recovers on return: Task 4. Materials and light judged on GPU captures: Task 7. Typography and layout (About's gap, the base plate at 1366x768, "The stack" wrapping): Task 6. Phones at 390x844 and 360x800: Task 8. Engraving unchanged: no task touches `ENGRAVE_HERO_TEXT`. Posters recaptured on the GPU: Tasks 4, 6, 7, 8. Budgets, 60 fps, long tasks, memory, LHCI on three URLs: Task 9 and the gate. 101 existing e2e plus new, axe on the new page: every task's e2e run, `projects.spec.ts` runs axe on a project page.
- **Placeholders.** None: every step has its code (new files complete, changes as the replayed commit's diff) and every run its observed output.
- **Names across tasks.** `MediaImage`, `MediaFile`, `cover`, `body`, `avatar`, `cvPdf` (Task 1) are the names Tasks 2 and 5 read; `PageShell`'s `path` (Task 2) is what Task 3 wraps; `coverViewOffset`'s `align: "end"` (Task 6) becomes `anchor: "right"` in Task 8, which changes the one caller and the test; `data-box` (Task 6) is what Task 8's mobile test reads; `html[data-motion]` (Task 3) is what Task 4's tests wait for.
- **Review Focus.** Each of the five lines has its test in the task that owns the code (named in the list).

## Execution

Tasks run in order; each depends on the previous one's interfaces (Task 1's view model, Task 2's page and shell, Task 3's links and `data-motion`, Task 6's crop). Suggested owners: Task 1 backend-engineer; Tasks 2 to 8 frontend-engineer (the poster steps in Tasks 4, 6, 7 and 8 may go to devops-engineer, who then commits with the task); Task 9 tester; Task 10 frontend-engineer, then the Overseer's gate. A reviewer (code-reviewer, read-only) checks each task before the next one starts; security-auditor looks at Task 2's markdown and image handling.
