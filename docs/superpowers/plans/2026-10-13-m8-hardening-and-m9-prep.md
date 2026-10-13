# M8 Hardening + M9 Code Prep Implementation Plan

> **For agentic workers:** this plan is written to run **unattended** (overnight, under `/goal`, auto mode). Work task by task, in order. Steps use checkbox (`- [ ]`) syntax; tick them in this file as you go and commit the ticks with the task. When something in a task is impossible on this machine, follow the task's **Stop rule** (record it, move on). Never wait for a human answer: the owner is asleep.

**Goal.** Everything left of the spec that does not need the owner's accounts, money or content:

- **M8 hardening** (spec §7). This covers:
  - dependency audit with no high findings;
  - security headers and a CSP that keeps every public page static;
  - error boundaries;
  - OG images;
  - cookie-less Vercel analytics;
  - an accessibility audit;
  - Lighthouse on mobile;
  - tablet portrait framing;
  - the timing-sensitive e2e tests hardened;
  - a security review with no high findings.
- **M9 code prep.** This covers:
  - Vercel Blob `remotePatterns` from env;
  - a production smoke suite that runs against any URL;
  - a deploy runbook.

Then a gate on a fresh clone and a PR into `dev`.

**Not in this plan (the owner does these; Part C lists them):** real EN/RO content in `/admin`, merging PRs, the domain, DNS, and the Vercel/Neon/Resend/Blob/Renovate accounts. The auto-mode classifier blocks merges (observed 2026-10-13), so the run **ends at an open PR with green CI**.

**Spec:** `docs/superpowers/specs/2026-09-23-cinematic-cv-design.md`, read in full before Task 1. The relevant parts are:
- §3: budgets, accessibility, tiers;
- §7: the M8 row ("LHCI mobile perf ≥ 90, a11y 100, SEO 100, BP ≥ 95; 0 high findings") and the M9 row;
- §8: risks;
- §9: verification.

The M7 handover (`docs/superpowers/handover/2026-10-11-m7.md`) lists the open questions that this plan settles (see "Owner questions settled by default").

**Difference from earlier plans.** M5–M7 were replayed in a scratch clone before they were handed over, so every expected output was a fact. This one was **not** replayed. Every "Expected" below is a target. When reality differs, investigate, fix the code or (with a reason) the expectation, and record what you found under **Findings** at the end of this file.

## Machine and environment (Windows, read before anything)

Owner's laptop: Windows 10 Pro, i5-1135G7 (Iris Xe), 16 GB. Shell for the steps: **Git Bash** (the Bash tool). From `~/.claude` memory and the M7 handover:

- No global pnpm. Run every script as `corepack pnpm <script>` with `export COREPACK_ENABLE_DOWNLOAD_PROMPT=0`. Below, `pnpm` means exactly that.
- Docker's CLI is not on PATH: `export PATH="$PATH:/c/Program Files/Docker/Docker/resources/bin"`. Start Docker Desktop if `docker info` fails: `"/c/Program Files/Docker/Docker/Docker Desktop.exe" &`, then poll `docker info` for up to 3 minutes. If it never comes up, run `wsl --shutdown` from PowerShell and try once more.
- `gh` is at `/c/Program Files/GitHub CLI/gh.exe` (logged in as DorobatMihaiGit). It may not be on PATH: call it by full path.
- The repo uses `core.autocrlf=false` and `.gitattributes` (`eol=lf`, PR #2). Gate clones use `-c core.autocrlf=false` on a **short path** (`C:/Users/MiHAi/AppData/Local/Temp/m8gate`). Delete gate clones from PowerShell: `cmd /c 'rd /s /q "\\?\C:\Users\MiHAi\AppData\Local\Temp\m8gate"'`.
- Windows-only budgets (README "On Windows"):
  - e2e uses 2 workers;
  - `perf:local` allows 70 ms long tasks, 150 ms mount tasks and 750 MB per tab;
  - `pnpm lhci:windows` replaces `pnpm lhci`, with performance ≥ 0.65 on desktop.

  **CI (Ubuntu) is the authority for the spec's budgets.**
- Ports:
  - 3020 is the owner's dev server: never use it;
  - 3100 e2e, 3200 LHCI, 3300 `perf:local`, 3400 posters;
  - this plan adds **3500** for the smoke suite.
- Never put the owner's real address into a committed file. Before each commit, `git diff --cached | grep -cF "$(grep ^ADMIN_EMAIL= .env.local | cut -d= -f2)"` prints `0`.
- Commits: `type(scope): subject`, subject ≤ 50 characters, one commit per task, ending with the attribution lines the session's system reminder gives (owner, open question 9).
- Lint: `pnpm lint` must print `No fixes applied.` with no warnings before each commit.

## Global constraints (binding)

- **Every public page stays static** (`○` in `next build`): `/en`, `/ro`, every project page. No nonce CSP (Next's CSP guide, `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`: nonces force dynamic rendering and are incompatible with the prerendered shells). Read that guide before Task 2.
- Read the relevant guide in `node_modules/next/dist/docs/` before writing Next code (AGENTS.md). For example: `01-app/01-getting-started/14-metadata-and-og-images.md` before Task 4, and `error` file conventions before Task 3.
- Budgets that still hold:
  - public JS before 3D ≤ 160 KB gz on `/en`, `/ro` and a project page;
  - the lazy 3D chunks ≤ 350 KB gz;
  - tier 3's own chunk ≤ 100 KB gz on top;
  - posters ≤ 400 KB per visitor;
  - `perf:local` green (Windows budgets);
  - LHCI desktop ≥ 0.95 in CI.

  Today's numbers (2026-10-13 gate):
  - `/en` and `/ro`: 149.6 KB gz before 3D;
  - project page: 146.3 KB gz;
  - lazy 3D: 316.6 KB gz;
  - tier 3: +81.7 KB gz.

  Anything added to the first load (analytics!) must fit under 160 KB.
- Exact pins. A new runtime dependency is allowed only where a task names it, and is pinned exactly in `package.json`.
- No change to the 3D look. The poster source-hash test must stay green. If a task changes scene code (Task 7 may), recapture posters on the GPU (`pnpm build && pnpm assets:posters`, as in M7) in the same task.
- Don't weaken a test or a budget to make it pass, unless the task's Stop rule allows it, and then only with a recorded finding and an open question.

## Owner questions settled by default (the owner can overrule later)

From the handover's open questions:

1. **Blob host:** Task 11 derives `remotePatterns` from env.
2. **Back during the page slide:** accepted as is (no scroll-restoration takeover). It is noted in the README.
3. **Tablet portrait framing:** done in Task 7.
4. **CV link and headshot placement:** waits for real content (Part C).
5. **Case-study images, project video, experience logos:** not in M8 (no admin fields; new features, not hardening).
6. **Timing-sensitive e2e:** hardened in Task 8.
7. **Windows budgets vs the spec's:** CI on Linux stays the authority. The mobile LHCI job runs in CI (Task 9).
8. **`.gitattributes`:** done (PR #2).
9. **New, commit attribution:** the M7 plan said "no AI attribution of any kind", but every commit since the M7 handover carries a `Co-Authored-By` line. This plan follows the session's system reminder. The owner decides; `git rebase` can strip the lines before the merge if wanted.

## Problems become GitHub issues, implementation goes on (owner decision 2026-10-13)

The owner chose finishing the implementation over fixing every problem in the same night. Problems found during the run go to **GitHub issues** for a later bug-fixing session. The run does not loop on them.

- **When to open an issue instead of fixing.** Open one when any of these holds:
  - a problem is not solved after **2 focused attempts** (or ~30 minutes);
  - it lies outside the task being worked on;
  - it is a medium or low finding;
  - it is a flaky test;
  - a target is missed (mobile LHCI);
  - a Stop rule fires.

  Simple, contained fixes are still made on the spot.
- **How to open one.** Run `"/c/Program Files/GitHub CLI/gh.exe" issue create -R DorobatMihaiGit/presentation --label m8-followup --title "<type>: <what>" --body-file <file>`. The body holds: what fails, exact command and output (trimmed), file:line, what was tried, a suggested next step, and the commit it was seen on. Add `--label blocker-m9` when it must be fixed before going to production.

  At Task 0, create the labels once (`gh label create m8-followup --color FBCA04`, `gh label create blocker-m9 --color B60205`; ignore "already exists").

  Before creating an issue, search for a duplicate (`gh issue list --label m8-followup --search "<words>"`) and add a comment there instead.
- **Keep CI green so the work stays reviewable.** A test this plan adds that cannot pass yet becomes `test.fixme("…", …)` with a comment `// see #<issue>`. Never use `.skip` without an issue. An existing test that turns flaky is never weakened or disabled: open an issue and leave it as is (CI retries twice). A budget or threshold is not lowered except where a Stop rule says so, and then the issue records the real number.
- **Exception 1: security.** The repo is **public**. Security findings (Task 10) and anything that describes how to attack the site never go into a GitHub issue, a commit message or the PR body. Write them to the git-ignored file `.data/security-findings.md` (it lives only on this laptop). In the PR body, say only "N security findings recorded locally for the owner". A **high** finding is still fixed in the run if at all possible. When fixed, the commit message names the area, not the exploit (`fix(security): tighten media route checks`).
- **Exception 2: no task is skipped silently.** If a whole task cannot be done, its issue says so. The PR body lists every issue opened (`gh issue list --label m8-followup`). The Findings section of this file links them.
- **Pushing is allowed** to `feat/m8-hardening` at any time (push after every task, so nothing is lost if the laptop stops). Pushing to `dev` or `main`, merging, and changing repository settings are not allowed.

## Task 0: Workspace and baseline

- [ ] Docker up (see Machine). `docker compose up -d --wait` prints `Healthy`.
- [ ] `git fetch -p origin`. You are on branch `feat/m8-hardening`, which has this plan committed. If `origin/dev` moved (for example PR #2 merged), run `git rebase origin/dev`.
- [ ] `pnpm install --frozen-lockfile`, `pnpm db:migrate`, `pnpm db:seed`.
- [ ] Baseline, recorded under Findings:
  - `pnpm typecheck`;
  - `pnpm lint`;
  - `pnpm test` (expected 44 files / 328 tests);
  - `pnpm build` (note the route table: every public route `○`);
  - `pnpm test:e2e` (expected 140 passed and the JS budget lines above).
- [ ] `git push -u origin feat/m8-hardening` (pushing a feature branch is allowed). Open a **draft** PR into `dev` now, so CI runs on every push: `gh pr create --draft --base dev --title "M8: hardening and M9 prep" --body "Work in progress; see docs/superpowers/plans/2026-10-13-m8-hardening-and-m9-prep.md"`.

## Task 1: Dependency audit (0 high)

`pnpm audit --prod` on 2026-10-13 found 9 issues (1 low, 5 moderate, 3 high):

- `next` 16.3.6: SSRF in image optimization (high), plus 4 moderate and 1 low. Fixed in **16.3.8**.
- `sharp` 0.35.4: librsvg CVE (high). Fixed in **0.35.5**.
- `source-map-js` < 1.2.2 (high, transitive).
- `esbuild` ≤ 0.24.2 (moderate, transitive, dev server only).

Steps:

- [ ] Bump `next` to `16.3.8` (stay on 16.3; 16.4 is a minor with its own docs, so not in M8). Also bump `eslint-config-next` or `@next/*`, if present, to the same version, and `sharp` to `0.35.5`.
- [ ] For the transitive ones, run `pnpm why source-map-js` and `pnpm why esbuild`. Prefer bumping the direct parent. Otherwise add a `pnpm.overrides` entry in `pnpm-workspace.yaml` (pnpm 11 reads overrides there; check the existing file's format), pinned to the patched version.
- [ ] `pnpm install`, then the full local check:
  - typecheck, lint, unit, build, e2e;
  - `pnpm perf:local`;
  - `pnpm build && pnpm assets:posters` **only if** the poster-hash unit test fails.

  sharp encodes the posters, so if sharp's output bytes changed, recapture and commit the posters in this task.
- [ ] `pnpm audit --prod` shows **0 high and 0 critical**. Record the moderate/low ones that remain, with the reason each is acceptable (for example, dev server only).
- [ ] Add `renovate.json` (spec §8: "Renovate weekly grouped"): weekly schedule, exact pins kept (`rangeStrategy: "pin"`), group minor/patch, leave majors ungrouped, keep `react` < 19.4 (R3F peer). It does nothing until the owner installs the Renovate app (Part C).
- [ ] Commit `chore(deps): patch next, sharp and audit findings`.

**Stop rule:** if 16.3.8 breaks a test, investigate up to the point of a clear cause. If it cannot be fixed within the task, revert to 16.3.6, record the advisory as an open question (high), and continue.

## Task 2: Security headers and CSP (static-safe)

Test first. Add `tests/e2e/security-headers.spec.ts`:

- [ ] On `/en`, `/ro`, a project page, `/admin/login`, `/sitemap.xml` and `/api/media/...` (one seeded or uploaded file), assert these response headers:
  - `Content-Security-Policy` (below);
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`;
  - `X-Content-Type-Options: nosniff`;
  - `Referrer-Policy: strict-origin-when-cross-origin`;
  - `X-Frame-Options: DENY`;
  - `Permissions-Policy` that denies camera, microphone, geolocation, payment, usb, interest-cohort/browsing-topics;
  - `Cross-Origin-Opener-Policy: same-origin`.
- [ ] Assert **zero** `securitypolicyviolation` events (listen with `page.addInitScript` → `document.addEventListener('securitypolicyviolation', …)` pushing to `window.__csp`), and zero CSP console errors, on:
  - a full scroll of `/en` at tiers 0, 1 and 2 (`?tier=`; SwiftShader in e2e);
  - a project page round trip with the View Transition;
  - the contact form submit;
  - admin login, including the 2FA page;
  - an admin media upload;
  - the profile editor with its markdown preview.
- [ ] Run it red.

Implement in `next.config.ts` `headers()`. Keep the existing posters `Cache-Control` rule; headers merge by matching source. Policy, built by a small pure function in `src/lib/security-headers.ts` with a unit test:

```
default-src 'self';
script-src 'self' 'unsafe-inline'{dev: 'unsafe-eval'};
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:{+ Blob host when configured, Task 11};
font-src 'self';
connect-src 'self'{dev: ws:};
media-src 'self';
worker-src 'self' blob:;
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';
upgrade-insecure-requests   (production only)
```

- `'unsafe-inline'` for scripts is the documented trade-off: Next's inline flight/bootstrap scripts carry no nonce on static pages. Try **SRI** (`experimental.sri: { algorithm: 'sha256' }`, same guide). If it works with `cacheComponents` and the budgets/tests stay green, keep it and note that integrity attributes now protect the external chunks. If it breaks anything, drop it and record why.
- Check whether three.js, postprocessing, N8AO or the texture loader use `blob:` workers or `data:` URLs (the e2e run will tell). Don't loosen anything else without a violation that proves the need.
- Better Auth passkeys (WebAuthn) need no CSP entry. Vercel Analytics (Task 5) loads from same-origin `/_vercel/...`.
- [ ] Green: the e2e spec, the full e2e suite, `perf:local` (tier 3 on the GPU must show no violations either; add the same listener to the perf spec's page and assert it is empty), and the build route table (still all `○`).
- [ ] Commit `feat(security): headers and a static-safe csp`.

**Stop rule:** none. This task must pass.

## Task 3: Error boundaries

- [ ] Read Next's `error.js` / `global-error.js` docs in `node_modules/next/dist/docs/`.
- [ ] Add:
  - `src/app/[locale]/error.tsx`: client component, localized via the existing messages (add keys to `messages/en.json` and `ro.json`). It shows a calm message, a "Try again" button (`reset`) and a link home, and uses the design system's styles.
  - `src/app/global-error.tsx`: its own `<html>`/`<body>`, inline minimal styles, EN/RO picked from the URL path. No next-intl provider is available there.
  - `src/app/admin/error.tsx`: English, with a link back to `/admin`.
- [ ] **The 3D stage gets its own error boundary.** A throw inside the R3F tree (shader compile, a lost context during mount) must fall back to the posters (tier 0 path) without taking down the page. Look at how `StageLoader` and the context-loss handling already fall back (`tests/unit/context-loss.test.ts`) and reuse that path.
- [ ] Tests (unit, jsdom + Testing Library, as the repo already does):
  - each boundary renders its message and calls `reset`;
  - the stage boundary renders the poster fallback when a child throws.
- [ ] e2e: inject a throw into the stage (for example via an existing capture/test hook or `page.addInitScript` that makes `getContext('webgl2')` throw after the tier is chosen) and assert the posters show, the page scrolls, and nothing else breaks.

  Do **not** add a route that throws on purpose to the production build.
- [ ] Commit `feat(errors): boundaries for pages, admin and stage`.

## Task 4: OG images

- [ ] Read `01-app/01-getting-started/14-metadata-and-og-images.md` and the `opengraph-image` file-convention reference.
- [ ] Add `opengraph-image.tsx` (and `twitter-image` re-exporting it, or `twitter:card summary_large_image` metadata pointing at the same image) for:
  - `src/app/[locale]/`: name, headline and the role over the studio background colours, 1200×630. It reads `getCv(locale)`, so the image expires with the `cv` tag like the page.
  - `src/app/[locale]/projects/[slug]/`: the project title, summary and year. It uses the cover when there is one: fetch it through the media store, not over HTTP.
- [ ] Fonts. `next/og` (Satori) cannot read woff2. Load a TTF/OTF of Mona Sans. Check whether `next/font/google`'s cache or `node_modules` has one. Otherwise commit the one weight you need from the official Mona Sans release (SIL OFL), as `src/app/og/MonaSans-SemiBold.ttf`, with its licence file next to it.

  Romanian diacritics (ș ț ă â î) must render: add a test with a Romanian headline.
- [ ] The images must be static at build (prerendered like the pages; check the build table) or cached with the `cv` tag. No per-request rendering.
- [ ] Tests:
  - `metadata.spec.ts` checks that `og:image`, `og:image:width/height`, `twitter:card` and `twitter:image` are present on `/en`, `/ro` and a project page;
  - fetching the og:image URL returns `200 image/png` and is 1200×630 (read the PNG header);
  - an admin edit of the RO headline changes `/ro`'s OG image (bytes differ after the edit; follow the existing admin e2e pattern).
- [ ] Commit `feat(seo): open graph images per page`.

## Task 5: Analytics (cookie-less, budget-safe)

- [ ] Add `@vercel/analytics` `2.0.1` and `@vercel/speed-insights` `2.0.0` (the spec's pins; check that they are still the latest 2.x and peer-compatible with Next 16.3 and React 19.3).
- [ ] Render them only when the build runs on Vercel (`process.env.VERCEL === "1"` read at build time in a server component). Locally, in CI, in e2e and in LHCI they must render nothing. Otherwise the 404 on `/_vercel/insights/script.js` costs Best Practices points and pollutes the console.

  Don't render them on `/admin`. Respect `Do Not Track`? Vercel Analytics is cookie-less; note this in the README instead of adding code.
- [ ] Budget: measure the first-load JS added when the flag is on. Do a local build with `VERCEL=1` and run `budgets.spec.ts`; only the measurement matters, the network 404s don't. It must keep `/en` ≤ 160 KB gz. Load them after the page (`afterInteractive` / their default) and **after** LCP.

  If they push past 160 KB, load them from the same idle callback that loads the 3D chunk.
- [ ] Unit test: the analytics component renders nothing without `VERCEL`, and renders both with it.
- [ ] Commit `feat(analytics): vercel analytics and speed insights`.

## Task 6: Accessibility audit (a11y 100)

- [ ] Widen `tests/e2e/a11y.spec.ts`. Run axe (WCAG 2.2 AA tags) on:
  - `/en` and `/ro`, top and after scrolling to each section;
  - a project page in both locales;
  - the 404 page;
  - the error boundary (Task 3's e2e trigger);
  - `/admin/login` and every `/admin` page (logged in, as the admin specs do);
  - at 1280×720 and 390×844, with `reducedMotion: 'reduce'` and without it.
- [ ] Add a keyboard-only journey:
  - Tab from the top: the skip link comes first and works;
  - every interactive control is reachable in visual order, shows a visible focus ring (assert a non-`none` outline or box-shadow), and is operable (Motion toggle, language switch, project cards, the View Transition link, the contact form submit, the CV link);
  - no focus trap;
  - after a project page and back, focus lands on something sensible.
- [ ] Contrast over the poster and the live canvas: sample the text colour against the scrim at each section (capture mode). Assert ≥ 4.5:1 for body text (spec §3). Use a pure helper with a unit test.
- [ ] Fix what fails. Then LHCI accessibility must be 100 on the three URLs (desktop and the mobile config from Task 9).
- [ ] Commit `test(a11y): audit every page and the keyboard path`, plus `fix(a11y): …` commits for the fixes.

## Task 7: Tablet portrait framing

Open question 3: 768×1024 and 820×1180 were neither framed nor tested.

- [ ] Extend `tests/e2e/framing.spec.ts` with 768×1024 and 820×1180 (and 1024×1366 landscape-ish iPad Pro portrait). Use the same assertions as the laptop sizes: the stack is fully on screen at each stop and ≥ 32 px from the copy (`.stage-layer[data-box]`). Extend the mobile assertions where portrait applies: no horizontal scroll, 44 px targets on a coarse pointer.
- [ ] Run red, then fix the framing in `src/experience/director/shots.ts` / framing helpers. That is the portrait camera path, with the threshold where portrait cameras take over. Write unit tests for any new pure framing math first (`tests/unit/framing.test.ts`).
- [ ] If the shots changed, the posters' source hash changes: run `pnpm build && pnpm assets:posters` on the GPU (Iris Xe through ANGLE; M7's probe in the README shows how to check), and commit the new posters and `posters.json`. Check the posters budget (≤ 400 KB per visitor) in e2e.
- [ ] Run `perf:local` again.
- [ ] Commit `fix(framing): tablets in portrait`.

**Stop rule:** if the GPU capture is unavailable (probe fails), do **not** commit scene changes without posters. Revert the scene part, keep the failing tests as `test.fixme` with a comment, and record an open question.

## Task 8: Harden the timing-sensitive e2e tests

Flaky, known from M7 (handover "Known flaky on this laptop"):
- `poster.spec.ts › the hero poster is the LCP element`;
- `› the 3D chunk is requested only after the LCP`;
- `motion.spec.ts › the visitor can still turn motion on`;
- `contact.spec.ts › the rate limit`;
- `stage.spec.ts › tier 2 puts one hidden canvas…`;
- `› a lost WebGL context…`.

- [ ] For each, find the race:
  - the LCP ones should compare the chunk request with the **first** LCP candidate, or wait for the chunk explicitly (M7 plan, fact 18);
  - the rate limit one should not depend on wall-clock speed (count server responses, not timings);
  - the stage ones should wait on the `data-canvas` state rather than on time.
- [ ] Prove it: `pnpm test:e2e --repeat-each=10 -g "<test title>"` for each one, **0 failures**, under the Windows 2-worker setting. Record the counts.
- [ ] Commit `test(e2e): wait on events, not on time`.

## Task 9: Lighthouse on mobile (perf ≥ 90, a11y 100, SEO 100, BP ≥ 95)

- [ ] Add `lighthouserc.mobile.json`. It uses the same URLs and server as `lighthouserc.json`, with the default (mobile) preset: Moto G-class emulation, simulated 4× CPU slowdown, slow 4G. Assertions: performance ≥ 0.90, accessibility = 1, seo = 1, best-practices ≥ 0.95.

  Add these scripts:
  - `"lhci:mobile": "lhci autorun --config=lighthouserc.mobile.json"`;
  - Windows: `scripts/lhci-windows.ts` takes a `--mobile` flag, or a sibling script.
- [ ] Add a CI job `Lighthouse (mobile)` in `.github/workflows/ci.yml`, a copy of the desktop job using the mobile config.
- [ ] Measure first: push, and read the CI job's report (the `lighthouse-reports` artifact: `gh run download`). Also run locally on Windows for the diagnosis, but **CI decides**.

  Note: headless Chrome in CI runs on SwiftShader, which the tier classifier puts on tier 0 (posters only). So CI's mobile score measures the poster path. Write that in the README next to the numbers.
- [ ] If it's below target, work through the Lighthouse diagnostics in this order, measuring after each change:
  1. LCP element and its resource priority on mobile (the 828 portrait poster, `fetchpriority`, preload);
  2. render-blocking CSS and fonts (Mona Sans preload on mobile);
  3. main-thread work before LCP (hydration cost; next-intl client messages; GSAP/Lenis imports that could wait until after load on tier 0);
  4. unused JS on the first load.

  Every change keeps all e2e and the desktop LHCI green.
- [ ] Commit `perf(mobile): lighthouse mobile in ci`, plus `perf(…)` commits for the fixes.

**Stop rule:** after **six** measured improvement attempts, if performance is still < 0.90, stop optimizing. Set the mobile performance assertion to the best score reached, rounded down to 0.05 (other categories keep their targets), so CI stays green. Record the score, the top three Lighthouse opportunities and what was tried as an **open question (M8 target missed)**. Never lower the desktop assertions.

## Task 10: Security review (0 high)

- [ ] Launch a review subagent (general-purpose) with this brief. Review the whole app for:
  - authz on every server action and route handler (`requireAdmin` before any read or write; `src/server/actions/**`, `src/app/api/**`, admin pages);
  - upload validation (type sniffing, size, SVG refused, filename and path traversal in `/api/media/[key]`);
  - markdown XSS (react-markdown settings, `skipHtml`, URL transform) in public and admin preview;
  - contact abuse (rate limit by `ip_hash`, header injection CR/LF, honeypot, min fill time, `replyTo` only);
  - session cookie flags;
  - Better Auth config (`disableSignUp`, `ADMIN_EMAIL` allowlist, 2FA, passkey origin/rpID from `SITE_URL`);
  - secrets in client bundles (grep `.next/static` for env names and values);
  - open redirects (login `callbackURL`);
  - CSRF on server actions (Next's origin check);
  - the headers from Task 2;
  - `pnpm audit` from Task 1.

  Severity per finding (high/medium/low) with file:line and a concrete exploit scenario. Then verify each high or medium finding yourself before acting.
- [ ] Fix every **high** finding, test first: each one gets a unit or e2e test that fails before the fix. Fix mediums that are cheap and contained. Record the rest in `.data/security-findings.md` only (see "Problems become GitHub issues", Exception 1); a high that cannot be fixed tonight is recorded there and marked **unfixed, blocks M9**.
- [ ] Commit `fix(security): <finding>` per fix, and add a summary without exploit detail (counts by severity, fixed/unfixed) to the Findings section.

## Task 11: M9 prep, Blob images

- [ ] `images.remotePatterns` from env. Vercel Blob public URLs look like `https://<storeId>.public.blob.vercel-storage.com/...`. Read Next's `images` config docs and `@vercel/blob` 2.8.0's docs/types in `node_modules` to confirm the host format and whether the store id can be derived from `BLOB_READ_WRITE_TOKEN` (`vercel_blob_rw_<storeId>_<secret>`).

  Implement a pure `blobImageHost(env)` in `src/lib/`:
  - it prefers an explicit optional `BLOB_PUBLIC_HOST`;
  - otherwise it derives the host from the token;
  - otherwise it returns nothing.

  `next.config.ts` adds `{ protocol: "https", hostname: <host>, pathname: "/**" }` only when there is a host, and Task 2's CSP `img-src` gets the same host.
- [ ] Add `BLOB_PUBLIC_HOST` to `src/env.ts` / `create-app-env.ts` (optional, hostname-validated) and to `.env.example`, with a comment.
- [ ] Unit tests: token → host, explicit host wins, nothing → no pattern, a malformed token → no pattern (no throw at build).
- [ ] Commit `feat(media): allow the blob store's image host`.

## Task 12: M9 prep, production smoke suite

- [ ] Add `playwright.smoke.config.ts` and `tests/smoke/*.smoke.ts`, run with `pnpm smoke` (script `"smoke": "playwright test -c playwright.smoke.config.ts"`). The suite runs against `SMOKE_URL` (required; no web server of its own), is read-only, and never logs in or sends mail. It checks:
  - `/`, `/en`, `/ro`, the first project page from `/sitemap.xml`: 200, correct `lang`, title, canonical, hreflang, JSON-LD Person, OG image reachable;
  - `/robots.txt` and `/sitemap.xml` are valid and point at `SMOKE_URL`'s origin;
  - the Task 2 security headers on a page and on `/admin/login`;
  - `Cache-Control: public, max-age=31536000, immutable` on a poster and on a `/_next/static/` chunk (spec §9: "immutable cache headers on assets");
  - `/admin` redirects to `/admin/login` when logged out;
  - a server action without a session gets 401 (pick the cheapest existing one, as `admin-auth.spec.ts` does);
  - an unknown project slug returns 404;
  - the contact form renders, but is **not** submitted;
  - no console errors and no CSP violations on `/en` and a project page.
- [ ] Prove it locally: `pnpm build` (with `SITE_URL=http://localhost:3500`), `pnpm start --port 3500` in the background, `SMOKE_URL=http://localhost:3500 pnpm smoke` → all pass. HSTS and `upgrade-insecure-requests` checks are skipped on `http://` origins, with an explicit `test.skip` reason.
- [ ] Add a manual-dispatch workflow `.github/workflows/smoke.yml` (`workflow_dispatch` with a `url` input) that runs the suite against a given URL. The owner runs it after deploying.
- [ ] Commit `test(smoke): production smoke suite`.

## Task 13: M9 prep, deploy runbook

- [ ] Write `docs/deploy.md`. It is for the owner and is concrete enough to follow click by click. Name the exact env var, where it is set (Production/Preview), and how to check each step:
  1. **Vercel project.** Import the GitHub repo. Framework Next.js, Node 24, install `pnpm install --frozen-lockfile`. Build command: `pnpm db:migrate && pnpm build` (public pages prerender from the DB). Production branch `main`; `dev` gets previews.
  2. **Neon.** Use the Vercel integration. Create a production branch and a preview branch. `DATABASE_URL` is pooled (confirm `attachDatabasePool` in `src/server/db`). After the first deploy, run `pnpm admin:create` against production from a local shell with the production `DATABASE_URL` in a one-off env, never committed.
  3. **Secrets.** `BETTER_AUTH_SECRET` (new, `openssl rand -base64 32`, different per environment), `ADMIN_EMAIL`, `SITE_URL` (the real domain).
  4. **Blob.** Create a store, connect it to the project (`BLOB_READ_WRITE_TOKEN`). Task 11 handles the image host automatically.
  5. **Resend.** Add the domain, then the DNS records Resend shows: SPF `TXT`, DKIM `CNAME`/`TXT`, and the bounce `MX` if Resend asks. Add DMARC `TXT _dmarc` starting at `p=none; rua=mailto:<owner>`, then tighten. Set `RESEND_API_KEY`, `CONTACT_FROM_EMAIL` (on the verified domain) and `CONTACT_TO_EMAIL`. Point to the README section "Mail settings to fill in once Resend exists".
  6. **Domain.** Add it in Vercel and set the DNS (apex `A`/`ALIAS` and `www` `CNAME`, as Vercel shows); HTTPS is automatic. Then check: HSTS preload only after everything works.
  7. **After deploy.** Run the smoke workflow (Task 12) with the production URL. Send a real contact message and check that it arrives, and that the auto-reply arrives with a passing SPF/DKIM/DMARC (Gmail "Show original"). Enter the content in `/admin`.
  8. **Hobby vs Pro.** Spec §8: the Hobby plan is non-commercial. Pro is needed if the site advertises paid services.
- [ ] Link it from the README. Update the README sections touched by M8: security headers, analytics, OG, mobile LHCI, the smoke suite, and the settled questions.
- [ ] Commit `docs: deploy runbook and m8 readme`.

## Task 14: Gate on a fresh clone, then the PR

- [ ] The gate script is M7's (`docs/superpowers/handover/2026-10-11-m7.md`, "How to resume" step 3), with:
  - the branch `feat/m8-hardening`;
  - the clone at `C:/Users/MiHAi/AppData/Local/Temp/m8gate`;
  - the database `cv_m8gate`.

  After `pnpm lhci:windows`, add:
  - `pnpm lhci:windows --mobile` (or its sibling script);
  - a smoke run against a `next start --port 3500` of the gate build.

  The gate ends with `echo "gate=0"`. Write it to the scratchpad and log to a file. It runs ~45 min: use `run_in_background` and wait on the notification. Don't poll in a loop that burns turns.
- [ ] If the gate fails, fix what is quick and run it again, **at most 3 gate runs** in total. Whatever still fails after that gets an issue (labels `m8-followup` and `blocker-m9`), and the PR body says the gate did not reach `gate=0` and links the issue. A test that fails once and passes on rerun gets an issue, as a flaky test, and is recorded under Findings.
- [ ] Delete the gate clone.
- [ ] Push. Mark the PR ready (`gh pr ready`) and update its body. The body covers:
  - what changed per task;
  - the gate numbers (unit and e2e counts, JS budgets, perf fps, LHCI desktop + mobile scores);
  - `pnpm audit` before/after;
  - the security review summary;
  - the open questions.

  End the body with the session's PR attribution line.
- [ ] Wait for CI (all jobs, including `Lighthouse (mobile)`). Use `gh pr checks <n> --watch` in a background command, or a poll every 60 s. If a job fails, read its log (`gh run view --log-failed`), fix and push, **at most 3 rounds**. A job still failing after that gets an issue, which the PR body links.
- [ ] **Done when:** every task has been worked through, and is either done or has its issue. The PR is open (not draft) against `dev`, and its body lists every `m8-followup` issue. CI is green, or each red job has an issue. `git status` is clean, everything is pushed, and this file's checkboxes are ticked or explained under Findings.
- [ ] Write the handover `docs/superpowers/handover/<date>-m8.md` (same shape as M7's) and commit it to the branch. Push.

**Never merge.** The owner merges.

## Part C: what only the owner can do (not for the overnight run)

1. Merge PR #2 (`.gitattributes`) and the M8 PR once CI is green.
2. Enter the real EN/RO content in `/admin` (local or, better, on production after M9): headline, about, skills, experience, projects with covers and case studies, CV PDFs, headshot, links. Then decide open question 4 (placement).
3. M9 accounts, following `docs/deploy.md`: Vercel project, Neon, Blob store, Resend + DNS, domain, env vars, `admin:create` on production, the smoke workflow on the production URL. An attended Claude session with Claude in Chrome can drive the dashboards while the owner is logged in.
4. Install the Renovate GitHub app on the repo.
5. A real iPhone and Android check (spec §8/§9).

## Suggested `/goal` (copy into a fresh session, started in auto mode)

Start the session in the repo with `claude --permission-mode auto`. Then:

```
/goal Execute docs/superpowers/plans/2026-10-13-m8-hardening-and-m9-prep.md on branch feat/m8-hardening, task by task in order (Task 0 to Task 14), following its Machine notes, Global constraints, Stop rules and the section "Problems become GitHub issues". Prefer finishing the implementation over perfecting it: after 2 failed attempts at a problem, open an m8-followup issue (security findings go only to the local .data/security-findings.md, never to GitHub, the repo is public) and continue. Push the branch after every task. Done when: every task is done or has an issue; the M8 pull request into dev is open, not a draft, and lists all m8-followup issues; `gh pr checks` output is pasted and every red job has an issue; the gate log tail is pasted; `git status` is clean and everything is pushed; the M8 handover file is committed. Never merge a PR, never push to dev or main, never change GitHub settings. Stop after 200 turns.
```

Before leaving it:
- keep the laptop on mains power;
- set Windows not to sleep (PowerShell as admin: `powercfg /change standby-timeout-ac 0` and `powercfg /change monitor-timeout-ac 0`);
- start Docker Desktop;
- close the dev server on 3020 if it is running.

## Findings

(Filled in during the run: baseline numbers, deviations from the expectations above, flaky tests seen, audit before/after, security review summary.)

## Open questions

(Filled in during the run.)
