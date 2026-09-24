# M2 Data, Auth and Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the CV content from `src/content/fixtures.ts` into Postgres (Drizzle schema, migrations, seed), serve the public pages from cached database reads (`'use cache'` + `cacheTag('cv')`, admin mutations `updateTag('cv')`), and add a single-owner admin at `/admin` (Better Auth email + password, `ADMIN_EMAIL` allowlist, `pnpm admin:create`) with EN/RO side-by-side editors for Profile, Experience (reorder), Skills (mapped to stack layers), Projects (markdown preview) and a Media library (Vercel Blob or local disk). M2b (Tasks 12 and 13) adds TOTP two-factor sign-in and passkeys. The milestone is gated by the spec's acceptance: a Romanian headline edited in the admin shows on `/ro`, `/admin` redirects when logged out, server actions return 401 without a session, and a blank Romanian field falls back to English.

**Architecture:** One Drizzle schema (`src/server/db/schema/`) serves three drivers: node-postgres against docker Postgres 18 locally and in CI, Neon later (env only), and PGlite (in-process Postgres) in Vitest. Every query and mutation takes a `Db` argument, so the same code runs on all of them. The public page keeps calling `getCv(locale)`. That function is now a `'use cache'` function (`cacheLife('max')`, tag `cv`) that loads both locales from the database and resolves them with the existing `resolveCv` → `localize()` per-field English fallback. `next build` prerenders `/en` and `/ro` from the database, so builds need a migrated and seeded database (a Postgres service container in CI). The admin is a second root layout at `/admin`, outside next-intl, English only. `src/proxy.ts` only checks that a Better Auth session cookie exists. The panel layout, every page and every server action re-check the session against the database through `getAdminSession()` / `requireAdmin()` (spec §5, CVE-2025-29927). All content mutations go through one pipeline, `runAdminAction()`: it checks the session (401), validates with zod (400 with per-field messages), runs the mutation and an `audit_log` row in one transaction, maps constraint violations to 409, and on success calls `updateTag('cv')`. Uploads are sniffed by their bytes (sharp for images, `%PDF-` for PDFs) and stored through a `MediaStore` interface: Vercel Blob when `BLOB_READ_WRITE_TOKEN` is set, otherwise `.data/media/` served by `/api/media/[key]`.

**Tech Stack:** Next.js 16.3.6 (App Router, `cacheComponents`), React 19.3.0, TypeScript 7.0.2, Drizzle ORM 0.45.3 + Drizzle Kit 0.31.11, pg 8.23.0, @electric-sql/pglite 0.5.8, @vercel/functions 3.9.9, Better Auth 1.7.5 (+ `twoFactor` plugin, @better-auth/passkey 1.7.5), zod 4.6.5, sharp 0.35.4, @vercel/blob 2.8.0, react-markdown 10.1.0, tsx 4.23.15, otpauth 9.5.2 (tests), Vitest 5.0.1, Playwright 1.63.0 + @axe-core/playwright 4.13.0, Biome 2.5.14, pnpm 11.27.1, Postgres 18 (docker and CI service).

**Spec:** `docs/superpowers/specs/2026-09-23-cinematic-cv-design.md` (§3 architecture, §4 data model, §5 admin + auth + contact, §7 row M2, §8 risks, §9 verification)

## Verified facts (checked 2026-09-24 on this machine)

Every command and expected output below was produced by running this plan in a fresh clone of `dev` under the session scratchpad, one task at a time, in order. Each red phase was run and observed, the whole suite was re-run after every task, and after Task 14 the gate script passed on a fresh clone of the result (`gate=0`). The local database for that run was a throwaway `postgres:18-alpine` container; the plan itself uses the repo's `docker compose` Postgres on port 5432.

- **Repo state:** `dev` is at `6a89e08 ci(lhci): gate lighthouse at 95 on desktop`, equal to `origin/dev`. `origin/main` is still the GitHub default branch, so the worktree must be cut from `dev` explicitly (as in M1). `node_modules` is not installed in the main checkout.
- **Registry** (`npm view`, all within pnpm 11's minimum release age): `drizzle-orm` 0.45.3 and `drizzle-kit` 0.31.11 (both 2026-09-21; drizzle-orm lists `pg >=8`, `@electric-sql/pglite >=0.2.0` as optional peers). `pg` 8.23.0, `@types/pg` 8.23.1. `@electric-sql/pglite` 0.5.8 (2026-08-26). `@vercel/functions` 3.9.9 (2026-09-22; `attachDatabasePool` is a no-op unless `VERCEL_URL` and `VERCEL_REGION` are set, so local, CI and build runs are unaffected). `better-auth` 1.7.5 and `@better-auth/passkey` 1.7.5 (2026-09-14; peers `next ^14 || ^15 || ^16`, `react ^18 || ^19`, `drizzle-orm ^0.45.2`, `drizzle-kit >=0.31.4`, `vitest ... || ^5.0.0`, all optional). `@vercel/blob` 2.8.0 (2026-08-10, node >= 20). `sharp` 0.35.4 (next 16.3.6 itself depends on `sharp ^0.35.4`). `react-markdown` 10.1.0 (peer `react >=18`). `tsx` 4.23.15. `otpauth` 9.5.2. `zod` stays 4.6.5 (better-auth wants `^4.5.4`). The Better Auth CLI is the `auth` package (1.7.5); `@better-auth/cli` stopped at 1.4.21. It is **not** added to the repo: `npx auth@1.7.5 generate` was run once in a scratch folder, and its Drizzle output (`user`, `session`, `account`, `verification`, then `two_factor` and `passkey` with the plugins) is copied into `src/server/db/schema/auth.ts` without the `relations()` blocks. Its `create-admin` command targets the `admin` plugin (roles), so `pnpm admin:create` is our own script.
- **pnpm 11:** adding `drizzle-kit` and `tsx` pulls three esbuild versions and exits 1 with `[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: esbuild@0.18.20, esbuild@0.25.12, esbuild@0.28.2` and writes `esbuild: set this to true or false` into `pnpm-workspace.yaml`. Setting `esbuild: false` is enough: the platform binary comes from the `@esbuild/linux-x64` optional package, and both `tsx` and `drizzle-kit` run. `sharp` 0.35.4 also works with the existing `sharp: false` (prebuilt `@img/sharp-*` packages). `drizzle-kit` adds the harmless `[WARN] 7 deprecated subdependencies found: @esbuild-kit/core-utils@3.3.2, @esbuild-kit/esm-loader@2.6.5, glob@7.2.3, inflight@1.0.6, rimraf@2.7.1, rimraf@3.0.2, uuid@8.3.2`.
- **Next 16.3.6 cache APIs** (read in `node_modules/next/dist/docs/01-app/03-api-reference/`): `cacheTag(...tags)` inside `'use cache'`; `updateTag(tag)` works **only in Server Actions** and makes the next request wait for fresh data ("read-your-own-writes"); `revalidateTag(tag, profile)` now takes a second argument and is the one for Route Handlers; `refresh()` re-renders the client router from a Server Action. `cacheLife('max')` = stale 5 min, revalidate 30 days, expire 1 year, so the CV is part of the static shell until an admin edit. A `'use cache'` scope cannot call `cookies()` or `headers()`, not even deep in a helper. With `cacheComponents`, reading cookies outside `<Suspense>` is a build error, so the admin root layout wraps its whole tree in one `<Suspense>`. `unauthorized()` needs `experimental.authInterrupts`, whose doc page is marked `version: canary`, so it is not used; actions return `{ status: "error", code: 401 }` instead. The Server Action body limit defaults to 1 MB; `experimental.serverActions.bodySizeLimit: "4.5mb"` fits a 4 MB upload plus multipart overhead and Vercel's 4.5 MB function limit.
- **Build and cache behaviour, measured:** with the cached `getCv`, `next build` connects to `DATABASE_URL` while prerendering. With the database down it fails with `⨯ Error: Failed query: select "id", "email_public", … from "profile"`, `[cause]: Error: connect ECONNREFUSED 127.0.0.1:<port>`, `Export encountered an error on /[locale]/page: /ro, exiting the build.` (or `/en`). A migrated but unseeded database fails with `CV profile row is missing. Run \`pnpm db:migrate\` and \`pnpm db:seed\`.` The route table is unchanged (`○ /en`, `○ /ro`); build does not hang on the open pool. Under `next start`, an admin edit followed by `page.goto("/ro")` shows the new headline (e2e), so `updateTag` from a Server Action expires the prerendered page. The admin tree builds as `◐` (Partial Prerender), `/admin/login/two-factor` as `○`, `/api/auth/[...all]` and `/api/media/[key]` as `ƒ`.
- **Next 16 client behaviour that bit the e2e tests:** `redirect()` thrown inside the admin `<Suspense>` after the shell has streamed still ends on `/admin/login` in the browser (the forged-cookie test passes), but the HTTP status is 200, so only the proxy's cookie check gives a real `307`. Next 16 keeps recently visited routes mounted but hidden, so `getByLabel("Password")` can match a hidden copy of the previous page and fail strict mode; e2e code uses `getByRole("textbox", { name })`, which skips hidden elements. `getByRole("alert")` also matches Next's `__next-route-announcer__`, so form alerts are located inside `form`.
- **Better Auth 1.7.5:** `emailAndPassword.disableSignUp: true` also blocks the server-side `auth.api.signUpEmail`, so the owner is created with `ctx.internalAdapter.createUser(…, { method: "admin" })` + `linkAccount({ providerId: "credential", password: await ctx.password.hash(…) })`. The documented allowlist hook `user.validateUserInfo` throws `User validation requires an endpoint context` when called from a script, so the allowlist is a `databaseHooks.user.create.before` that throws `APIError("FORBIDDEN")`. `nextCookies()` must be the last plugin; it lets `auth.api.signInEmail` inside a Server Action set the cookie. Telemetry is off by default. The session cookie in dev is `better-auth.session_token`; `getSessionCookie(request)` from `better-auth/cookies` reads it in the proxy without a database call. With the `twoFactor` plugin, `signInEmail` returns `{ twoFactorRedirect: true, twoFactorMethods: ["totp"] }` and only a short-lived 2FA cookie; `verifyTOTP` turns it into a session. **Enabling and disabling 2FA rotate the session** (new session row, old one deleted), so those actions must `redirect()`: re-rendering in the same request still carries the revoked cookie and bounces to the login page (observed, then fixed). Passkeys: `passkey({ rpID, rpName, origin })`; `generatePasskeyRegistrationOptions` returns `rp: { id: "localhost", name: "CV admin" }` for `baseURL http://localhost:3000`. The browser side needs `createAuthClient` (`better-auth/react`) + `passkeyClient()`; it only ships in the `/admin/login` and `/admin/security` chunks.
- **Drizzle:** `drizzle-kit generate` needs no database and resolves the `@/` alias inside schema files. With `--name`, files are `drizzle/0000_init.sql`, `0001_two_factor.sql`, `0002_passkey.sql` (the `meta/*_snapshot.json` ids differ per run, which is fine). Driver errors are wrapped: the Postgres code is at `error.cause.code` (`23505` unique, `23503` foreign key, `23514` check). A generic `PgDatabase<PgQueryResultHKT, typeof schema>` works for queries and transactions on both drivers, but `db.execute()` returns `unknown` rows through it (tests query PGlite directly), and the node-postgres migrator needs the concrete `NodePgDatabase` (so `createDb` returns that type).
- **Playwright 1.63:** plugin setup (the `webServer`) runs **before** `globalSetup` (`createGlobalSetupTasks` in `playwright/lib/runner/index.js`), so the e2e database is prepared inside the `webServer.command`. `webServer.env` wins over `.env.local` because Next's env loader never overrides existing variables. Chromium's virtual authenticator (`WebAuthn.addVirtualAuthenticator` over CDP, `ctap2`, resident key, user verification) is enough for a real passkey registration and sign-in.
- **Tooling:** Node 24.0.0 supports `node --env-file-if-exists=.env.local` (it does not override variables already set). `package.json` has no `"type": "module"`, so `tsx` compiles `scripts/*.ts` as CommonJS and rejects top-level `await` (`Top-level await is currently not supported with the "cjs" output format`); scripts use a `main()` function. `pnpm typecheck` runs `next typegen`, which loads `next.config.ts` and therefore validates env: from Task 5 on it fails with `❌ Invalid environment variables` until `.env.local` has `BETTER_AUTH_SECRET` and `ADMIN_EMAIL`. TypeScript 7 did once keep a stale `RouteContext` union in `tsconfig.tsbuildinfo` after a route handler was added (`Type '"/api/media/[key]"' does not satisfy the constraint '"/api/auth/[...all]"'`); `rm -f tsconfig.tsbuildinfo tests/tsconfig.tsbuildinfo` fixes it. `import.meta.glob` (Vite) works in Vitest for the action-guard test; under TS 7 its generic overload reported `TS2558`, so the result is cast. zod 4's `z.flattenError` only keeps top-level keys, so field errors are built from `issue.path.join(".")` (keys like `en.headline`, matching the input names).
- **Results after Task 14:** `pnpm test` = 18 files, 137 tests (PGlite, about 4 s). `pnpm test:e2e` = 62 tests in three projects (`public` 35, `admin` 25, `security` 2), about 25 s after the build. LHCI desktop = 100 / 100 / 100 / 100 on `/en` and `/ro`. `/en` still loads 9 module scripts, 145.4 KB gz in total (sum of `gzip -9` per script, `noModule` excluded), with no Better Auth or WebAuthn code in them; `/admin/login` loads 148.4 KB gz. `pnpm lint` checks 162 files.
- **Tooling quirks (unchanged from M1):** a hook rewrites plain `git`, so commands use `/usr/bin/git`; `rtk` filters some output (prefix `rtk proxy` to see what this plan shows); the worktree guard can reject compound one-liners, so commands are one per line.

## Global Constraints

- Exact pins only. M0/M1 pins stay (next 16.3.6, react/react-dom 19.3.0, typescript 7.0.2, @biomejs/biome 2.5.14, tailwindcss 4.3.3, next-intl 4.14.6, zod 4.6.5, @t3-oss/env-nextjs 0.13.11, vitest 5.0.1, vite 8.3.0, @playwright/test 1.63.0, @axe-core/playwright 4.13.0, @lhci/cli 0.15.1). New runtime dependencies: `drizzle-orm` 0.45.3, `pg` 8.23.0, `@vercel/functions` 3.9.9, `better-auth` 1.7.5, `react-markdown` 10.1.0, `sharp` 0.35.4, `@vercel/blob` 2.8.0, `@better-auth/passkey` 1.7.5. New dev dependencies: `drizzle-kit` 0.31.11, `@electric-sql/pglite` 0.5.8, `tsx` 4.23.15, `@types/pg` 8.23.1, `otpauth` 9.5.2. Nothing else: no shadcn, react-hook-form, @hookform/resolvers, sonner, @dnd-kit/react, drizzle-zod, or the `auth` CLI (see Deviations in the Self-review).
- Spec §4: "Base table + `<entity>_i18n` (PK `(id, locale)`), queries COALESCE requested locale → `en` fallback; admin badges missing RO." and "Public reads: `'use cache'` + `cacheTag('cv')`; admin mutations `updateTag('cv')`. Local: Docker PG18; prod: Neon pooled; tests: PGlite."
- Spec §5: "Better Auth, single owner: email+password with `disableSignUp`, passkey + TOTP, `pnpm admin:create` seed CLI, `ADMIN_EMAIL` allowlist." "`proxy.ts` = optimistic cookie redirect only; **every** layout + server action re-checks session (CVE-2025-29927 lesson)." "Admin English-only UI, EN/RO side-by-side forms: Profile, Experience (drag reorder), Skills (mapped to stack layers), Projects (markdown preview), Media library (Blob client upload, type/size limits, LQIP), Messages inbox."
- Spec §7 M2 acceptance: "RO headline edited in admin shows on `/ro`; `/admin` redirects logged-out; actions 401 without session; RO→EN fallback".
- `ADMIN_EMAIL` and `BETTER_AUTH_SECRET` come from the environment (validated in `src/lib/create-app-env.ts`; `ADMIN_EMAIL` must be an email). This plan writes the owner's address as `<owner email>`. The real value lives only in `.env.local` and in the `pnpm admin:create` runs, and the Overseer supplies it. Committed files (`.env.example`, `README.md`, `src/`, `tests/`, CI, this plan) use placeholders only; before each commit, `/usr/bin/git diff --cached | grep -cF "$(grep ^ADMIN_EMAIL= .env.local | cut -d= -f2)"` must print `0`. `BLOB_READ_WRITE_TOKEN` is optional.
- No external accounts: nothing in M2 signs up for, logs into or calls Vercel, Neon or any other service. CI uses a `postgres:18-alpine` service container and a per-run `BETTER_AUTH_SECRET` from `openssl rand`; no repository secrets.
- `cacheComponents` rules from M1 hold: public pages read request data nowhere; they get CV content only from `getCv`. Request data (cookies, headers) is read only inside the `/admin` tree, which sits under one `<Suspense>`.
- The public pages must look identical after the switch: the 35 M1 e2e tests stay green, unchanged, in every task.
- Public JS budget (spec §3, revised): ≤ 160 KB gz before 3D. Admin and auth code must not load on `/en` or `/ro`.
- Biome is the only linter and formatter. `drizzle/` holds generated files and is excluded from Biome. Every other file in this plan is Biome-formatted, so `pnpm lint` prints `No fixes applied.` before each commit.
- Commits use `type(scope): subject`, subject ≤ 50 characters. **No AI attribution of any kind**: no `Co-Authored-By`, no `Claude-Session:`, no "Generated with" lines.
- Out of scope: the contact action, rate limit, Resend and the Messages inbox (M3; the `message` table is created now); rendering media or project bodies on the public site (M6/M7); Neon and Vercel wiring (M9); CSP, security headers and a database-backed auth rate limit (M8).

## Review Focus

These are inputs the spec implies that ordinary feature tests would not catch. Each one is pinned by a test in the task that owns the code:

1. **A forged or expired session cookie.** The proxy only checks that a cookie exists (spec §5), so anything that looks like a Better Auth cookie gets past it. The panel must still end on the login page and never render admin content. Pinned by the Task 5 PGlite test `treats a forged session cookie as signed out` and the Task 6 e2e test `a forged session cookie passes the proxy but not the layout`.
2. **A Server Action posted directly, without a session** (a stale tab, a replayed request, a script). It must answer 401, write nothing (no row, no audit entry) and leave the public cache alone. Pinned by `tests/db/admin-guard.test.ts` (Task 7): it discovers every exported function in `src/server/actions/` except `auth.ts` with `import.meta.glob`, so each later task's actions are covered without editing it (19 actions by Task 13).
3. **The owner saves a blank Romanian field, or a Romanian row is missing.** `/ro` must show the English text marked `lang="en"`, never an empty element. Pinned by the Task 2 tests `falls back per field when a Romanian value is blank` and `falls back for a whole record when its Romanian row is missing`, and the Task 7 e2e test `a blank Romanian headline falls back to English on /ro`.
4. **An upload that lies about its type, or a crafted media URL.** A text or SVG file named `cute.png` with `Content-Type: image/png` must be refused (SVG can carry scripts), and `/api/media/..%2F..%2Fpackage.json` must never read outside the upload folder. Pinned by the Task 11 tests `refuses SVG, which can carry scripts`, `judges the file by its bytes, not its name or type`, `never reads outside its directory` and the e2e tests `refuses a file that is not really an image` and `the media route never serves paths outside the upload folder`.
5. **Crafted form field names.** Admin forms are parsed from dotted names (`en.headline`), so a request with `__proto__.polluted=yes` must not pollute `Object.prototype` of the server process. Pinned by the Task 7 unit test `cannot pollute Object.prototype through crafted field names`.

## Before you start (workspace)

1. Update the main checkout and cut the worktree from `dev`:

```bash
/usr/bin/git -C /home/mihai/Documents/CV pull --ff-only
/usr/bin/git -C /home/mihai/Documents/CV worktree add .claude/worktrees/m2-data-auth-admin -b feat/m2-data-auth-admin dev
```

Expected: `Preparing worktree (new branch 'feat/m2-data-auth-admin')` and `HEAD is now at 6a89e08 ci(lhci): gate lighthouse at 95 on desktop` (or a later `dev` tip). Then call `EnterWorktree` with `path: ".claude/worktrees/m2-data-auth-admin"`. **All commands below run from the worktree root.** If this plan file is not committed on `dev`, read it from `/home/mihai/Documents/CV/docs/superpowers/plans/2026-09-24-m2-data-auth-admin.md`.

2. Install, create the local env and start Postgres (it must be running for every task from Task 2 on, and for every `pnpm build` / `pnpm test:e2e` from Task 3 on):

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
docker compose up -d --wait
pnpm exec playwright install chromium
```

Expected: `Done in <n>s using pnpm v11.27.1`; `Container cv-db-1  Healthy`.

3. Check the baseline:

Run: `pnpm test`
Expected: `Test Files  5 passed (5)`, `Tests  44 passed (44)`.

Run: `pnpm test:e2e`
Expected: `35 passed`. Afterwards `ss -ltn | grep ':3100 '` prints nothing.

## File map

| Path | Responsibility | Task |
|---|---|---|
| `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` | new pins, `db:*` / `admin:create` scripts, `esbuild: false` | 1, 2, 3, 5, 10, 11, 12, 13 |
| `biome.json`, `vitest.config.mts` | ignore generated `drizzle/`; run `tests/db/**` | 1 |
| `drizzle.config.ts`, `drizzle/*` | Drizzle Kit config; generated SQL migrations | 1, 12, 13 |
| `src/server/db/schema/{content,auth,index}.ts` | spec §4 tables; Better Auth tables (+ `two_factor`, `passkey`) | 1, 12, 13 |
| `src/server/db/{types,create-db,index,seed}.ts` | `Db` type; node-postgres factory; app `getDb()`; `seedContent()` | 1, 2, 3 |
| `src/server/queries/cv.ts` | `loadCvRecords(db)`: both locales → `CvRecords` | 2 |
| `src/content/{resolve-cv,get-cv}.ts` | pure `resolveCv`; cached `getCv` | 2, 3 |
| `src/server/cache-tags.ts` | `CV_TAG = "cv"` | 3 |
| `scripts/{require-env,db-migrate,db-seed,e2e-db,admin-create}.ts` | CLI entry points | 2, 3, 5, 12, 13 |
| `playwright.config.ts` | `cv_e2e` database, e2e owner env, `public` / `admin` / `security` projects | 3, 5 |
| `.github/workflows/ci.yml` | Postgres service in `check`, `e2e`, `lighthouse` | 4 |
| `src/lib/create-app-env.ts`, `src/env.ts`, `.env.example` | `BETTER_AUTH_SECRET`, `ADMIN_EMAIL`, `BLOB_READ_WRITE_TOKEN` | 5, 11 |
| `src/server/auth/{create-auth,admin,read-session,index}.ts` | Better Auth factory; owner upsert; session read; `auth`, `getAdminSession`, `requireAdmin` | 5, 12, 13 |
| `src/app/api/auth/[...all]/route.ts` | Better Auth HTTP handler | 5 |
| `src/proxy.ts` | optimistic `/admin` cookie redirect, next-intl for the rest | 6 |
| `src/app/admin/layout.tsx`, `src/app/admin/login/**`, `src/app/admin/(panel)/layout.tsx`, `(panel)/page.tsx` | admin root layout, login (+ 2FA step), panel shell | 6, 12, 13 |
| `src/server/actions/auth.ts` | `signIn`, `signOut`, `verifySignInCode` | 6, 12 |
| `src/server/admin/{action-result,form-data,run-action}.ts` | action result type, FormData parsing, the mutation pipeline | 7 |
| `src/server/admin/schemas/*.ts` | zod inputs per entity | 7–11 |
| `src/server/actions/{profile,experience,skills,projects,media,two-factor,passkeys}.ts` | Server Actions | 7–13 |
| `src/server/queries/admin/*.ts` | uncached admin reads | 7–10 |
| `src/components/admin/*` | admin UI (forms, fields, buttons, 2FA and passkey widgets) | 6–13 |
| `src/app/admin/(panel)/{profile,experience,skills,projects,media,security}/**` | admin pages | 6–13 |
| `src/content/localize.ts` | `missingTranslation()` for the "RO missing" badge | 8 |
| `src/server/media/{store,inspect,index}.ts`, `src/app/api/media/[key]/route.ts` | Blob / local storage, upload sniffing, local file route | 11 |
| `next.config.ts`, `.gitignore` | 4.5 MB action body limit; ignore `.data/` | 11 |
| `src/lib/auth-client.ts` | browser Better Auth client (passkeys only) | 13 |
| `tests/db/*` | PGlite harness, schema, loader, auth, action tests | 1, 2, 5, 7–13 |
| `tests/unit/{env,content,seo,form-data,media}.test.ts` | unit tests (new / changed) | 2, 5, 7, 8, 11 |
| `tests/e2e/admin-*.ts` | admin e2e specs and helpers | 5–13 |
| `README.md` | setup, scripts, database, admin, media | 14 |

---

### Task 1: Drizzle schema, first migration and the PGlite test harness

**Owner:** backend-engineer

**Files:**
- Create: `drizzle.config.ts`, `src/server/db/schema/content.ts`, `src/server/db/schema/auth.ts`, `src/server/db/schema/index.ts`, `src/server/db/types.ts`, `drizzle/0000_init.sql` + `drizzle/meta/*` (generated), `tests/db/test-db.ts`, `tests/db/schema.test.ts`
- Modify: `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `biome.json`, `vitest.config.mts`

**Interfaces:**
- Consumes: `STACK_LAYERS`, `SocialLink` from `@/content/types` (M1).
- Produces:
  - `@/server/db/schema` re-exports every table: `media`, `profile`, `profileI18n`, `experience`, `experienceI18n`, `skillCategory`, `skillCategoryI18n`, `skill`, `project`, `projectI18n`, `projectSkill`, `experienceSkill`, `message`, `auditLog`, `user`, `session`, `account`, `verification`, and the enums `localeEnum`, `stackLayerEnum`, `employmentTypeEnum`, `mediaKindEnum`, `messageStatusEnum`, `emailStatusEnum`.
  - `type Db = PgDatabase<PgQueryResultHKT, typeof schema>` from `@/server/db/types`: any Drizzle Postgres database or transaction over the app schema.
  - `createTestDb(): Promise<{ db: Db; client: PGlite; close(): Promise<void> }>` from `tests/db/test-db.ts`: a fresh in-memory Postgres with every migration in `./drizzle` applied.
  - Script `db:generate` = `drizzle-kit generate`. Vitest also runs `tests/db/**/*.test.ts`.
  - Table conventions the later tasks rely on: `profile.id` is always `1`; translatable text columns are `NOT NULL DEFAULT ''` (blank = not translated); `skill_category.layer` is unique (one category per stack layer); `skill.sort_order` and `project_skill.position` keep the fixture order; dates are `YYYY-MM` text with `CHECK`s.

- [ ] **Step 1: Add the database dependencies**

```bash
pnpm add -E drizzle-orm@0.45.3 pg@8.23.0
pnpm add -D -E drizzle-kit@0.31.11 @electric-sql/pglite@0.5.8 tsx@4.23.15 @types/pg@8.23.1
```

Expected: the first command ends with `+ drizzle-orm 0.45.3`, `+ pg 8.23.0`, `Done in <n>s using pnpm v11.27.1`. The second one lists the four packages, prints `[WARN] 7 deprecated subdependencies found: @esbuild-kit/core-utils@3.3.2, @esbuild-kit/esm-loader@2.6.5, glob@7.2.3, inflight@1.0.6, rimraf@2.7.1, rimraf@3.0.2, uuid@8.3.2`, and **exits 1** with:

```
[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: esbuild@0.18.20, esbuild@0.25.12, esbuild@0.28.2
```

`package.json` and the lockfile are updated anyway, and `pnpm-workspace.yaml` gained the line `  esbuild: set this to true or false`. esbuild's install script only checks the platform binary, which pnpm already installed from `@esbuild/linux-x64`. In `pnpm-workspace.yaml`, replace that line with:

```yaml
  esbuild: false
```

Run: `pnpm install --frozen-lockfile`
Expected: exit 0, `Done in <n>s using pnpm v11.27.1`.

Run: `pnpm exec drizzle-kit --version`
Expected: `drizzle-kit: v0.31.11` and `drizzle-orm: v0.45.3`.

- [ ] **Step 2: Point Vitest and Biome at the new folders**

Replace `vitest.config.mts`:

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/db/**/*.test.ts"],
  },
});
```

In `biome.json`, replace the `"includes"` line (drizzle-kit rewrites its own files, so they are not Biome's business):

```json
    "includes": ["**", "!node_modules", "!.next", "!dist", "!build", "!drizzle"]
```

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
    "lhci": "lhci autorun",
    "db:generate": "drizzle-kit generate"
  },
```

- [ ] **Step 3: Write the failing tests**

`tests/db/test-db.ts` (the harness every database test uses):

```ts
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/server/db/schema";
import type { Db } from "@/server/db/types";

/** A fresh in-memory Postgres (PGlite) with every migration in ./drizzle applied. */
export async function createTestDb(): Promise<{
  db: Db;
  client: PGlite;
  close: () => Promise<void>;
}> {
  const client = new PGlite();
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: "drizzle" });
  return { db, client, close: () => client.close() };
}
```

`tests/db/schema.test.ts`:

```ts
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  experience,
  profile,
  project,
  skill,
  skillCategory,
} from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { createTestDb } from "./test-db";

let db: Db;
let client: PGlite;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, client, close } = await createTestDb());
});

afterAll(async () => {
  await close();
});

/** Postgres error code of a failed statement (drizzle wraps the driver error in `cause`). */
async function pgCode(statement: Promise<unknown>): Promise<string> {
  try {
    await statement;
  } catch (error) {
    const cause = (error as { cause?: { code?: string } }).cause;
    return cause?.code ?? "no-code";
  }
  return "no-error";
}

describe("schema (migrations applied to PGlite)", () => {
  it("creates every spec §4 table plus the Better Auth tables", async () => {
    const result = await client.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public' order by table_name",
    );

    expect(result.rows.map((row) => row.table_name)).toEqual([
      "account",
      "audit_log",
      "experience",
      "experience_i18n",
      "experience_skill",
      "media",
      "message",
      "profile",
      "profile_i18n",
      "project",
      "project_i18n",
      "project_skill",
      "session",
      "skill",
      "skill_category",
      "skill_category_i18n",
      "user",
      "verification",
    ]);
  });

  it("keeps profile a singleton", async () => {
    const row = {
      emailPublic: "a@example.com",
      location: "Cluj-Napoca",
      countryCode: "RO",
      yearsExp: 9,
    };
    await db.insert(profile).values(row);

    expect(await pgCode(db.insert(profile).values({ ...row, id: 2 }))).toBe(
      "23514",
    );
    expect(await pgCode(db.insert(profile).values(row))).toBe("23505");
  });

  it("rejects dates that are not YYYY-MM and end dates before start dates", async () => {
    const base = {
      company: "Acme",
      employmentType: "full_time" as const,
      sortOrder: 1,
    };

    expect(
      await pgCode(
        db
          .insert(experience)
          .values({ ...base, id: "a", startDate: "2021-13" }),
      ),
    ).toBe("23514");
    expect(
      await pgCode(
        db.insert(experience).values({
          ...base,
          id: "b",
          startDate: "2021-03",
          endDate: "2020-01",
        }),
      ),
    ).toBe("23514");
  });

  it("allows one skill category per stack layer and levels 1 to 5", async () => {
    await db.insert(skillCategory).values({ slug: "api", layer: "api" });

    expect(
      await pgCode(
        db.insert(skillCategory).values({ slug: "api-2", layer: "api" }),
      ),
    ).toBe("23505");
    expect(
      await pgCode(
        db.insert(skill).values({
          slug: "node",
          categorySlug: "api",
          name: "Node.js",
          level: 6,
          years: 1,
          sortOrder: 1,
        }),
      ),
    ).toBe("23514");
  });

  it("rejects a project year outside 1990-2100", async () => {
    expect(
      await pgCode(db.insert(project).values({ slug: "x", year: 1899 })),
    ).toBe("23514");
  });
});
```

- [ ] **Step 4: Run them to verify they fail**

Run: `pnpm test`
Expected: FAIL with

```
Error: Cannot find package '@/server/db/schema' imported from <worktree>/tests/db/schema.test.ts
 Test Files  1 failed | 5 passed (6)
      Tests  44 passed (44)
```

- [ ] **Step 5: Create `src/server/db/schema/content.ts`**

```ts
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { type SocialLink, STACK_LAYERS } from "@/content/types";
import { user } from "./auth";

// Spec §4: every translatable entity is a base table plus an `<entity>_i18n`
// table keyed by (id, locale). Translatable text columns are NOT NULL with an
// empty-string default: a blank value means "not translated" and falls back
// to English when the CV is resolved (see src/content/localize.ts).

const YEAR_MONTH = "^[0-9]{4}-(0[1-9]|1[0-2])$";

export const localeEnum = pgEnum("locale", ["en", "ro"]);
export const stackLayerEnum = pgEnum("stack_layer", STACK_LAYERS);
export const employmentTypeEnum = pgEnum("employment_type", [
  "full_time",
  "part_time",
  "contract",
  "freelance",
]);
export const mediaKindEnum = pgEnum("media_kind", ["image", "document"]);
export const messageStatusEnum = pgEnum("message_status", [
  "new",
  "read",
  "archived",
  "spam",
]);
export const emailStatusEnum = pgEnum("email_status", ["sent", "failed"]);

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull();

export const media = pgTable("media", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Public URL: a Vercel Blob URL, or `/api/media/<key>` for local storage. */
  blobUrl: text("blob_url").notNull(),
  /** Storage key used to delete the object. */
  pathname: text("pathname").notNull().unique(),
  kind: mediaKindEnum("kind").notNull(),
  mime: text("mime").notNull(),
  width: integer("width"),
  height: integer("height"),
  bytes: integer("bytes").notNull(),
  /** Tiny blurred WebP data URL shown while the image loads. */
  lqip: text("lqip"),
  altEn: text("alt_en").notNull().default(""),
  altRo: text("alt_ro").notNull().default(""),
  createdAt: createdAt(),
});

export const profile = pgTable(
  "profile",
  {
    id: smallint("id").primaryKey().default(1),
    emailPublic: text("email_public").notNull(),
    location: text("location").notNull(),
    countryCode: text("country_code").notNull(),
    avatarMediaId: uuid("avatar_media_id").references(() => media.id, {
      onDelete: "set null",
    }),
    socials: jsonb("socials").$type<SocialLink[]>().notNull().default([]),
    available: boolean("available").notNull().default(true),
    yearsExp: smallint("years_exp").notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("profile_singleton", sql`${t.id} = 1`),
    check("profile_country_code", sql`${t.countryCode} ~ '^[A-Z]{2}$'`),
    check("profile_years_exp", sql`${t.yearsExp} between 0 and 80`),
  ],
);

export const profileI18n = pgTable(
  "profile_i18n",
  {
    profileId: smallint("profile_id")
      .notNull()
      .references(() => profile.id, { onDelete: "cascade" }),
    locale: localeEnum("locale").notNull(),
    fullName: text("full_name").notNull().default(""),
    headline: text("headline").notNull().default(""),
    summaryMd: text("summary_md").notNull().default(""),
    seoTitle: text("seo_title").notNull().default(""),
    seoDescription: text("seo_description").notNull().default(""),
    cvPdfMediaId: uuid("cv_pdf_media_id").references(() => media.id, {
      onDelete: "set null",
    }),
  },
  (t) => [primaryKey({ columns: [t.profileId, t.locale] })],
);

export const experience = pgTable(
  "experience",
  {
    id: text("id").primaryKey(),
    company: text("company").notNull(),
    url: text("url"),
    logoMediaId: uuid("logo_media_id").references(() => media.id, {
      onDelete: "set null",
    }),
    startDate: text("start_date").notNull(),
    endDate: text("end_date"),
    employmentType: employmentTypeEnum("employment_type").notNull(),
    sortOrder: integer("sort_order").notNull(),
    isPublished: boolean("is_published").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check(
      "experience_start_date",
      sql`${t.startDate} ~ '${sql.raw(YEAR_MONTH)}'`,
    ),
    check(
      "experience_end_date",
      sql`${t.endDate} is null or (${t.endDate} ~ '${sql.raw(YEAR_MONTH)}' and ${t.endDate} >= ${t.startDate})`,
    ),
    index("experience_sort_order_idx").on(t.sortOrder),
  ],
);

export const experienceI18n = pgTable(
  "experience_i18n",
  {
    experienceId: text("experience_id")
      .notNull()
      .references(() => experience.id, { onDelete: "cascade" }),
    locale: localeEnum("locale").notNull(),
    roleTitle: text("role_title").notNull().default(""),
    descriptionMd: text("description_md").notNull().default(""),
    highlights: text("highlights").array().notNull().default(sql`'{}'`),
  },
  (t) => [primaryKey({ columns: [t.experienceId, t.locale] })],
);

export const skillCategory = pgTable("skill_category", {
  slug: text("slug").primaryKey(),
  /** One category per physical layer of the 3D stack. */
  layer: stackLayerEnum("layer").notNull().unique(),
});

export const skillCategoryI18n = pgTable(
  "skill_category_i18n",
  {
    categorySlug: text("category_slug")
      .notNull()
      .references(() => skillCategory.slug, { onDelete: "cascade" }),
    locale: localeEnum("locale").notNull(),
    name: text("name").notNull().default(""),
  },
  (t) => [primaryKey({ columns: [t.categorySlug, t.locale] })],
);

export const skill = pgTable(
  "skill",
  {
    slug: text("slug").primaryKey(),
    categorySlug: text("category_slug")
      .notNull()
      .references(() => skillCategory.slug, { onDelete: "restrict" }),
    name: text("name").notNull(),
    level: smallint("level").notNull(),
    years: smallint("years").notNull(),
    featured: boolean("featured").notNull().default(false),
    sortOrder: integer("sort_order").notNull(),
  },
  (t) => [
    check("skill_level", sql`${t.level} between 1 and 5`),
    check("skill_years", sql`${t.years} between 0 and 80`),
    index("skill_category_idx").on(t.categorySlug, t.sortOrder),
  ],
);

export const project = pgTable(
  "project",
  {
    slug: text("slug").primaryKey(),
    repoUrl: text("repo_url"),
    liveUrl: text("live_url"),
    coverMediaId: uuid("cover_media_id").references(() => media.id, {
      onDelete: "set null",
    }),
    videoMediaId: uuid("video_media_id").references(() => media.id, {
      onDelete: "set null",
    }),
    year: smallint("year").notNull(),
    featured: boolean("featured").notNull().default(false),
    published: boolean("published").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [check("project_year", sql`${t.year} between 1990 and 2100`)],
);

export const projectI18n = pgTable(
  "project_i18n",
  {
    projectSlug: text("project_slug")
      .notNull()
      .references(() => project.slug, { onDelete: "cascade" }),
    locale: localeEnum("locale").notNull(),
    title: text("title").notNull().default(""),
    summary: text("summary").notNull().default(""),
    bodyMd: text("body_md").notNull().default(""),
    role: text("role").notNull().default(""),
    outcome: text("outcome").notNull().default(""),
  },
  (t) => [primaryKey({ columns: [t.projectSlug, t.locale] })],
);

export const projectSkill = pgTable(
  "project_skill",
  {
    projectSlug: text("project_slug")
      .notNull()
      .references(() => project.slug, { onDelete: "cascade" }),
    skillSlug: text("skill_slug")
      .notNull()
      .references(() => skill.slug, { onDelete: "cascade" }),
    position: smallint("position").notNull(),
  },
  (t) => [primaryKey({ columns: [t.projectSlug, t.skillSlug] })],
);

export const experienceSkill = pgTable(
  "experience_skill",
  {
    experienceId: text("experience_id")
      .notNull()
      .references(() => experience.id, { onDelete: "cascade" }),
    skillSlug: text("skill_slug")
      .notNull()
      .references(() => skill.slug, { onDelete: "cascade" }),
    position: smallint("position").notNull(),
  },
  (t) => [primaryKey({ columns: [t.experienceId, t.skillSlug] })],
);

/** Contact messages. Created now so M3 only adds the action and the inbox. */
export const message = pgTable(
  "message",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    company: text("company"),
    body: text("body").notNull(),
    locale: localeEnum("locale").notNull(),
    ipHash: text("ip_hash").notNull(),
    status: messageStatusEnum("status").notNull().default("new"),
    emailStatus: emailStatusEnum("email_status"),
    createdAt: createdAt(),
  },
  (t) => [index("message_ip_hash_created_idx").on(t.ipHash, t.createdAt)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    diff: jsonb("diff").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index("audit_log_created_idx").on(t.createdAt)],
);
```

- [ ] **Step 6: Create `src/server/db/schema/auth.ts`**

Better Auth 1.7.5's core tables as printed by `npx auth@1.7.5 generate` (run once in a scratch folder, not added to the repo). `audit_log.user_id` references `user.id`, so they live in the same schema from the start.

```ts
import { boolean, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Better Auth 1.7.5 core tables, as printed by `npx auth@1.7.5 generate`
// (relations dropped: nothing here uses drizzle's relational queries).
// Plugin tables (two_factor, passkey) are appended by the M2b tasks.

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_userId_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("account_userId_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);
```

- [ ] **Step 7: Create `src/server/db/schema/index.ts` and `src/server/db/types.ts`**

```ts
export * from "./auth";
export * from "./content";
```

```ts
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "./schema";

/**
 * Any Drizzle Postgres database or transaction over the app schema: node-postgres
 * in the app and scripts, PGlite in tests. Queries and mutations take a `Db`
 * argument so both drivers run the same code.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
```

- [ ] **Step 8: Create `drizzle.config.ts` and generate the first migration**

```ts
import { defineConfig } from "drizzle-kit";

// `drizzle-kit generate` only diffs the schema against drizzle/meta, so it
// needs no database. Migrations are applied by `pnpm db:migrate`.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema/index.ts",
  out: "./drizzle",
  strict: true,
  verbose: true,
});
```

Run: `pnpm db:generate --name init`
Expected: `18 tables`, one line per table (for example `experience 11 columns 1 indexes 1 fks`, `profile 9 columns 0 indexes 1 fks`), and `[✓] Your SQL migration file ➜ drizzle/0000_init.sql 🚀`. The folder now holds `drizzle/0000_init.sql` (6 `CREATE TYPE`, 18 `CREATE TABLE` and their constraints) and `drizzle/meta/{_journal.json,0000_snapshot.json}`. Do not edit or format these files.

- [ ] **Step 9: Run the tests to verify they pass**

Run: `pnpm test`
Expected: `Test Files  6 passed (6)`, `Tests  49 passed (49)`.

Run: `pnpm typecheck`
Expected: `✓ Types generated successfully`, exit 0.

Run: `rtk proxy pnpm lint`
Expected: `Checked 65 files in <n>ms. No fixes applied.`

- [ ] **Step 10: Commit**

```bash
/usr/bin/git add biome.json drizzle drizzle.config.ts package.json pnpm-lock.yaml pnpm-workspace.yaml src/server/db tests/db vitest.config.mts
/usr/bin/git commit -m "feat(db): add drizzle schema and pglite tests"
```

---

### Task 2: Seed from the fixtures and load the CV from Postgres

**Owner:** backend-engineer

**Files:**
- Create: `src/content/resolve-cv.ts`, `src/server/db/create-db.ts`, `src/server/db/seed.ts`, `src/server/queries/cv.ts`, `scripts/require-env.ts`, `scripts/db-migrate.ts`, `scripts/db-seed.ts`, `tests/db/cv-queries.test.ts`
- Modify: `src/content/get-cv.ts`, `package.json`, `tests/unit/content.test.ts`, `tests/unit/seo.test.ts`

**Interfaces:**
- Consumes: the schema and `Db` (Task 1); `fixtures`, `CvRecords`, `I18n`, `YearMonth`, `SkillRecord` (M1); `localize` (M1).
- Produces:
  - `resolveCv(records: CvRecords, locale: Locale): Cv` now lives in `@/content/resolve-cv` (pure, no I/O), so unit tests and the cached reader share it. `getCv` stays in `@/content/get-cv` and still reads the fixtures until Task 3.
  - `createDb(connectionString): { db: NodePgDatabase<typeof schema>; pool: Pool }` from `@/server/db/create-db` (scripts close the pool).
  - `seedContent(db: Db, options?: { records?: CvRecords; reset?: boolean }): Promise<"seeded" | "skipped">` from `@/server/db/seed`. Without `reset` it only fills an empty database (`profile` has no row); with `reset` it deletes all CV content first. It never touches media, messages, users, sessions or the audit log.
  - `loadCvRecords(db: Db): Promise<CvRecords>` from `@/server/queries/cv`: both locales, experience by `sort_order`, skills by `sort_order`, project skills by `position`. Throws `CV profile row is missing. Run \`pnpm db:migrate\` and \`pnpm db:seed\`.` on an empty database and `<entity> has no English translation row.` when an EN row is missing.
  - Scripts `db:migrate` and `db:seed` (`--reset`), both reading `.env.local` through `node --env-file-if-exists`.
- Decision recorded here (spec §4 says "queries COALESCE requested locale → `en`"): the loader returns both locales and the fallback stays in `localize()`. It has the same effect as `COALESCE(NULLIF(TRIM(ro), ''), en)`, but per field, it treats blank lists as missing, and it keeps which locale each value came from, which the public page needs for `lang="en"` on fallback text. The tests below pin the fallback on real database rows.

- [ ] **Step 1: Write the failing test `tests/db/cv-queries.test.ts`**

```ts
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fixtures } from "@/content/fixtures";
import { resolveCv } from "@/content/resolve-cv";
import { profileI18n, projectI18n } from "@/server/db/schema";
import { seedContent } from "@/server/db/seed";
import type { Db } from "@/server/db/types";
import { loadCvRecords } from "@/server/queries/cv";
import { createTestDb } from "./test-db";

let db: Db;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});

afterAll(async () => {
  await close();
});

describe("seedContent + loadCvRecords", () => {
  it("explains how to fix an empty database", async () => {
    await expect(loadCvRecords(db)).rejects.toThrow(
      "CV profile row is missing. Run `pnpm db:migrate` and `pnpm db:seed`.",
    );
  });

  it("seeds an empty database from the fixtures", async () => {
    expect(await seedContent(db)).toBe("seeded");
  });

  it.each(["en", "ro"] as const)(
    "renders the same %s CV from Postgres as from the fixtures",
    async (locale) => {
      const records = await loadCvRecords(db);

      expect(resolveCv(records, locale)).toEqual(resolveCv(fixtures, locale));
    },
  );

  it("does not overwrite existing content unless asked to reset", async () => {
    await db
      .update(profileI18n)
      .set({ headline: "Edited in the admin" })
      .where(and(eq(profileI18n.profileId, 1), eq(profileI18n.locale, "ro")));

    expect(await seedContent(db)).toBe("skipped");
    expect(resolveCv(await loadCvRecords(db), "ro").profile.headline).toEqual({
      value: "Edited in the admin",
      lang: "ro",
    });

    expect(await seedContent(db, { reset: true })).toBe("seeded");
    expect(
      resolveCv(await loadCvRecords(db), "ro").profile.headline.value,
    ).toContain("construiește");
  });
});

describe("RO → EN fallback on database rows", () => {
  it("falls back per field when a Romanian value is blank", async () => {
    await seedContent(db, { reset: true });
    await db
      .update(profileI18n)
      .set({ headline: "   " })
      .where(and(eq(profileI18n.profileId, 1), eq(profileI18n.locale, "ro")));

    const cv = resolveCv(await loadCvRecords(db), "ro");

    expect(cv.profile.headline).toEqual({
      value: fixtures.profile.i18n.en.headline,
      lang: "en",
    });
    expect(cv.profile.summary.lang).toBe("ro");
  });

  it("falls back for a whole record when its Romanian row is missing", async () => {
    await seedContent(db, { reset: true });
    await db
      .delete(projectI18n)
      .where(
        and(
          eq(projectI18n.projectSlug, "tramline"),
          eq(projectI18n.locale, "ro"),
        ),
      );

    const tramline = resolveCv(await loadCvRecords(db), "ro").projects.find(
      (p) => p.slug === "tramline",
    );

    expect(tramline?.title).toEqual({ value: "Tramline", lang: "en" });
    expect(tramline?.summary.lang).toBe("en");
  });

  it("refuses to load a record without an English row", async () => {
    await seedContent(db, { reset: true });
    await db
      .delete(projectI18n)
      .where(
        and(
          eq(projectI18n.projectSlug, "tramline"),
          eq(projectI18n.locale, "en"),
        ),
      );

    await expect(loadCvRecords(db)).rejects.toThrow(
      "project tramline has no English translation row.",
    );
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test`
Expected: FAIL with

```
Error: Cannot find package '@/content/resolve-cv' imported from <worktree>/tests/db/cv-queries.test.ts
 Test Files  1 failed | 6 passed (7)
      Tests  49 passed (49)
```

- [ ] **Step 3: Split `resolveCv` out of `get-cv.ts`**

Create `src/content/resolve-cv.ts` (the M1 function, moved unchanged):

```ts
import type { Locale } from "@/i18n/routing";
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
```

Replace `src/content/get-cv.ts`:

```ts
import type { Locale } from "@/i18n/routing";
import { fixtures } from "./fixtures";
import { resolveCv } from "./resolve-cv";
import type { Cv } from "./types";

/**
 * CV content for one locale. Async on purpose: the next task swaps the
 * fixture source for cached Drizzle queries (`'use cache'` + `cacheTag('cv')`)
 * behind this signature.
 */
export async function getCv(locale: Locale): Promise<Cv> {
  return resolveCv(fixtures, locale);
}
```

`getCv` will read the database in Task 3, so the unit tests stop calling it and resolve the fixtures directly:

- In `tests/unit/content.test.ts`, replace `import { getCv, resolveCv } from "@/content/get-cv";` with `import { resolveCv } from "@/content/resolve-cv";` placed directly after the `@/content/localize` import. Then replace each of the five `await getCv("ro")` / `await getCv("en")` with `resolveCv(fixtures, "ro")` / `resolveCv(fixtures, "en")`.
- In `tests/unit/seo.test.ts`, replace `import { getCv } from "@/content/get-cv";` with the two lines `import { fixtures } from "@/content/fixtures";` and `import { resolveCv } from "@/content/resolve-cv";`. Then replace `personJsonLd(await getCv("ro"), SITE)` with `personJsonLd(resolveCv(fixtures, "ro"), SITE)` and `const cv = await getCv("en");` with `const cv = resolveCv(fixtures, "en");`.

- [ ] **Step 4: Create `src/server/db/create-db.ts`**

```ts
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/** A node-postgres pool plus a Drizzle client over it. Scripts close the pool when done. */
export function createDb(connectionString: string): {
  db: NodePgDatabase<typeof schema>;
  pool: Pool;
} {
  const pool = new Pool({ connectionString });
  return { db: drizzle({ client: pool, schema }), pool };
}
```

- [ ] **Step 5: Create `src/server/db/seed.ts`**

```ts
import { count } from "drizzle-orm";
import { fixtures } from "@/content/fixtures";
import type { CvRecords } from "@/content/types";
import {
  experience,
  experienceI18n,
  experienceSkill,
  profile,
  profileI18n,
  project,
  projectI18n,
  projectSkill,
  skill,
  skillCategory,
  skillCategoryI18n,
} from "./schema";
import type { Db } from "./types";

export type SeedResult = "seeded" | "skipped";

/**
 * Loads CV content (profile, experience, stack, projects) into the database.
 * By default it only seeds an empty database, so admin edits survive a re-run.
 * `reset: true` deletes all CV content first (e2e runs, local resets).
 * Media, messages, users, sessions and the audit log are never touched.
 */
export async function seedContent(
  db: Db,
  options: { records?: CvRecords; reset?: boolean } = {},
): Promise<SeedResult> {
  const records = options.records ?? fixtures;

  return db.transaction(async (tx) => {
    if (!options.reset) {
      const [{ value }] = await tx.select({ value: count() }).from(profile);
      if (value > 0) {
        return "skipped";
      }
    }

    // Children first; FKs would cascade, but explicit order keeps it obvious.
    await tx.delete(projectSkill);
    await tx.delete(experienceSkill);
    await tx.delete(project);
    await tx.delete(experience);
    await tx.delete(skill);
    await tx.delete(skillCategory);
    await tx.delete(profile);

    const p = records.profile;
    await tx.insert(profile).values({
      emailPublic: p.emailPublic,
      location: p.location,
      countryCode: p.countryCode,
      socials: p.socials,
      available: p.available,
      yearsExp: p.yearsExp,
    });
    await tx.insert(profileI18n).values(
      localeRows(p.i18n, (locale, t) => ({
        profileId: 1,
        locale,
        fullName: t.fullName,
        headline: t.headline,
        summaryMd: t.summary,
        seoTitle: t.seoTitle,
        seoDescription: t.seoDescription,
      })),
    );

    for (const job of records.experience) {
      await tx.insert(experience).values({
        id: job.id,
        company: job.company,
        url: job.url ?? null,
        startDate: job.startDate,
        endDate: job.endDate,
        employmentType: job.employmentType,
        sortOrder: job.sortOrder,
        isPublished: job.isPublished,
      });
      await tx.insert(experienceI18n).values(
        localeRows(job.i18n, (locale, t) => ({
          experienceId: job.id,
          locale,
          roleTitle: t.roleTitle,
          descriptionMd: t.description,
          highlights: t.highlights,
        })),
      );
    }

    for (const category of records.skillCategories) {
      await tx
        .insert(skillCategory)
        .values({ slug: category.slug, layer: category.layer });
      await tx.insert(skillCategoryI18n).values(
        localeRows(category.i18n, (locale, t) => ({
          categorySlug: category.slug,
          locale,
          name: t.name,
        })),
      );
    }

    await tx.insert(skill).values(
      records.skills.map((s, index) => ({
        slug: s.slug,
        categorySlug: s.categorySlug,
        name: s.name,
        level: s.level,
        years: s.years,
        featured: s.featured,
        sortOrder: index + 1,
      })),
    );

    for (const item of records.projects) {
      await tx.insert(project).values({
        slug: item.slug,
        repoUrl: item.repoUrl ?? null,
        liveUrl: item.liveUrl ?? null,
        year: item.year,
        featured: item.featured,
        published: item.published,
      });
      await tx.insert(projectI18n).values(
        localeRows(item.i18n, (locale, t) => ({
          projectSlug: item.slug,
          locale,
          title: t.title,
          summary: t.summary,
          role: t.role,
          outcome: t.outcome,
        })),
      );
      if (item.skills.length > 0) {
        await tx.insert(projectSkill).values(
          item.skills.map((skillSlug, index) => ({
            projectSlug: item.slug,
            skillSlug,
            position: index + 1,
          })),
        );
      }
    }

    return "seeded";
  });
}

/** One row per locale present in `i18n`; a partial RO translation leaves the rest blank. */
function localeRows<T, R>(
  i18n: { en: T; ro?: Partial<T> },
  toRow: (locale: "en" | "ro", t: Partial<T>) => R,
): R[] {
  const rows = [toRow("en", i18n.en)];
  if (i18n.ro) {
    rows.push(toRow("ro", i18n.ro));
  }
  return rows;
}
```

- [ ] **Step 6: Create `src/server/queries/cv.ts`**

```ts
import { asc } from "drizzle-orm";
import type { CvRecords, I18n, SkillRecord, YearMonth } from "@/content/types";
import type { Locale } from "@/i18n/routing";
import {
  experience,
  experienceI18n,
  profile,
  profileI18n,
  project,
  projectI18n,
  projectSkill,
  skill,
  skillCategory,
  skillCategoryI18n,
} from "@/server/db/schema";
import type { Db } from "@/server/db/types";

/**
 * Reads all CV content with both locales. The EN fallback itself happens in
 * `resolveCv` → `localize()`: per field, blank = missing, and it remembers
 * which locale each value came from (for `lang="en"` on /ro).
 */
export async function loadCvRecords(db: Db): Promise<CvRecords> {
  const [
    profiles,
    profileRows,
    jobs,
    jobRows,
    categories,
    categoryRows,
    skills,
    projects,
    projectRows,
    projectSkills,
  ] = await Promise.all([
    db.select().from(profile),
    db.select().from(profileI18n),
    db.select().from(experience).orderBy(asc(experience.sortOrder)),
    db.select().from(experienceI18n),
    db.select().from(skillCategory),
    db.select().from(skillCategoryI18n),
    db.select().from(skill).orderBy(asc(skill.sortOrder), asc(skill.slug)),
    db.select().from(project),
    db.select().from(projectI18n),
    db
      .select()
      .from(projectSkill)
      .orderBy(asc(projectSkill.projectSlug), asc(projectSkill.position)),
  ]);

  const p = profiles[0];
  if (!p) {
    throw new Error(
      "CV profile row is missing. Run `pnpm db:migrate` and `pnpm db:seed`.",
    );
  }

  return {
    profile: {
      emailPublic: p.emailPublic,
      location: p.location,
      countryCode: p.countryCode,
      socials: p.socials,
      available: p.available,
      yearsExp: p.yearsExp,
      i18n: toI18n("profile", profileRows, (row) => ({
        fullName: row.fullName,
        headline: row.headline,
        summary: row.summaryMd,
        seoTitle: row.seoTitle,
        seoDescription: row.seoDescription,
      })),
    },
    experience: jobs.map((job) => ({
      id: job.id,
      company: job.company,
      url: job.url ?? undefined,
      startDate: job.startDate as YearMonth,
      endDate: job.endDate as YearMonth | null,
      employmentType: job.employmentType,
      sortOrder: job.sortOrder,
      isPublished: job.isPublished,
      i18n: toI18n(
        `experience ${job.id}`,
        jobRows.filter((row) => row.experienceId === job.id),
        (row) => ({
          roleTitle: row.roleTitle,
          description: row.descriptionMd,
          highlights: row.highlights,
        }),
      ),
    })),
    skillCategories: categories.map((category) => ({
      slug: category.slug,
      layer: category.layer,
      i18n: toI18n(
        `skill category ${category.slug}`,
        categoryRows.filter((row) => row.categorySlug === category.slug),
        (row) => ({ name: row.name }),
      ),
    })),
    skills: skills.map((s) => ({
      slug: s.slug,
      categorySlug: s.categorySlug,
      name: s.name,
      level: s.level as SkillRecord["level"],
      years: s.years,
      featured: s.featured,
    })),
    projects: projects.map((item) => ({
      slug: item.slug,
      repoUrl: item.repoUrl ?? undefined,
      liveUrl: item.liveUrl ?? undefined,
      year: item.year,
      featured: item.featured,
      published: item.published,
      skills: projectSkills
        .filter((row) => row.projectSlug === item.slug)
        .map((row) => row.skillSlug),
      i18n: toI18n(
        `project ${item.slug}`,
        projectRows.filter((row) => row.projectSlug === item.slug),
        (row) => ({
          title: row.title,
          summary: row.summary,
          role: row.role,
          outcome: row.outcome,
        }),
      ),
    })),
  };
}

/** Folds `<entity>_i18n` rows into `{ en, ro? }`. English is required. */
function toI18n<Row extends { locale: Locale }, T>(
  what: string,
  rows: Row[],
  pick: (row: Row) => T,
): I18n<T> {
  const en = rows.find((row) => row.locale === "en");
  if (!en) {
    throw new Error(`${what} has no English translation row.`);
  }
  const ro = rows.find((row) => row.locale === "ro");
  return ro ? { en: pick(en), ro: pick(ro) } : { en: pick(en) };
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm test`
Expected: `Test Files  7 passed (7)`, `Tests  57 passed (57)`.

- [ ] **Step 8: Add the `db:migrate` and `db:seed` scripts**

`scripts/require-env.ts`:

```ts
/** Reads a required variable (from the shell or .env.local) or exits with a clear message. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`${name} is not set. Copy .env.example to .env.local.`);
    process.exit(1);
  }
  return value;
}
```

`scripts/db-migrate.ts` (no top-level `await`: `tsx` compiles this package's `.ts` files as CommonJS):

```ts
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDb } from "@/server/db/create-db";
import { requireEnv } from "./require-env";

// Applies pending SQL migrations from ./drizzle to DATABASE_URL.
async function main() {
  const { db, pool } = createDb(requireEnv("DATABASE_URL"));
  try {
    await migrate(db, { migrationsFolder: "drizzle" });
    console.log("migrations applied");
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
```

`scripts/db-seed.ts`:

```ts
import { createDb } from "@/server/db/create-db";
import { seedContent } from "@/server/db/seed";
import { requireEnv } from "./require-env";

// `pnpm db:seed` fills an empty database with the fixture CV.
// `pnpm db:seed --reset` replaces all CV content with the fixtures.
async function main() {
  const reset = process.argv.includes("--reset");
  const { db, pool } = createDb(requireEnv("DATABASE_URL"));
  try {
    const result = await seedContent(db, { reset });
    console.log(
      result === "seeded"
        ? "seeded CV content"
        : "skipped: CV content already exists (use --reset to replace it)",
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
```

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
    "lhci": "lhci autorun",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "node --env-file-if-exists=.env.local --import tsx scripts/db-migrate.ts",
    "db:seed": "node --env-file-if-exists=.env.local --import tsx scripts/db-seed.ts"
  },
```

- [ ] **Step 9: Run the scripts against the docker database**

Run: `pnpm db:migrate`
Expected: `migrations applied`.

Run: `pnpm db:seed`
Expected: `seeded CV content`.

Run: `pnpm db:seed`
Expected: `skipped: CV content already exists (use --reset to replace it)`.

Run: `pnpm db:seed --reset`
Expected: `seeded CV content`.

Run: `docker compose exec -T db psql -U cv -d cv -tAc 'select count(*) from skill'`
Expected: `19`.

Run: `DATABASE_URL= pnpm db:migrate`
Expected: exit 1 with `DATABASE_URL is not set. Copy .env.example to .env.local.` (an empty variable in the shell wins over `.env.local`).

- [ ] **Step 10: Typecheck, lint, commit**

Run: `pnpm typecheck`
Expected: `✓ Types generated successfully`, exit 0.

Run: `rtk proxy pnpm lint`
Expected: `Checked 73 files in <n>ms. No fixes applied.`

```bash
/usr/bin/git add package.json scripts src/content src/server tests
/usr/bin/git commit -m "feat(db): seed fixtures and load cv from postgres"
```

---

### Task 3: Serve the public pages from cached Postgres reads

**Owner:** backend-engineer

**Files:**
- Create: `src/server/db/index.ts`, `src/server/cache-tags.ts`, `scripts/e2e-db.ts`
- Modify: `src/content/get-cv.ts`, `playwright.config.ts`, `package.json`, `pnpm-lock.yaml`

**Interfaces:**
- Consumes: `createDb`, `seedContent`, `loadCvRecords`, `resolveCv` (Task 2); `env.DATABASE_URL` (M0).
- Produces:
  - `getDb(): Db` from `@/server/db`: one node-postgres pool per server process (kept on `globalThis` across dev reloads), passed to `attachDatabasePool` for Vercel Fluid compute (a no-op elsewhere). Imports `@/env`, so it is for app code, not scripts.
  - `CV_TAG = "cv"` from `@/server/cache-tags`.
  - `getCv(locale)` is now `'use cache'` + `cacheTag(CV_TAG)` + `cacheLife("max")` over `loadCvRecords(getDb())`. Same signature, so no component changes.
  - `next build` needs a migrated, seeded database.
  - `pnpm test:e2e` runs against a separate `cv_e2e` database on the same server. `scripts/e2e-db.ts` creates it if missing, migrates it and resets the content before the build, from inside `webServer.command` (Playwright starts the web server before `globalSetup`).

- [ ] **Step 1: Show that the build does not use the database yet (red)**

Run: `DATABASE_URL=postgres://cv:cv@localhost:59999/cv pnpm build`
Expected: the build **succeeds** with nothing listening on port 59999 (`✓ Generating static pages using <n> workers (11/11)`, `○ /en`, `○ /ro`). The pages are still built from the fixtures.

- [ ] **Step 2: Add `@vercel/functions`**

```bash
pnpm add -E @vercel/functions@3.9.9
```

Expected: `+ @vercel/functions 3.9.9`.

- [ ] **Step 3: Create `src/server/db/index.ts` and `src/server/cache-tags.ts`**

```ts
import { attachDatabasePool } from "@vercel/functions";
import { env } from "@/env";
import { createDb } from "./create-db";
import type { Db } from "./types";

export type { Db } from "./types";

// One pool per server process. `globalThis` keeps it across dev hot reloads.
const globalForDb = globalThis as unknown as { cvDb?: Db };

/** The app's database (Neon pooled in production, docker Postgres locally). */
export function getDb(): Db {
  if (!globalForDb.cvDb) {
    const { db, pool } = createDb(env.DATABASE_URL);
    // On Vercel Fluid compute, closes idle clients before the instance suspends.
    // A no-op everywhere else.
    attachDatabasePool(pool);
    globalForDb.cvDb = db;
  }
  return globalForDb.cvDb;
}
```

```ts
/** Cache tag on every public CV read; admin mutations call `updateTag(CV_TAG)`. */
export const CV_TAG = "cv";
```

- [ ] **Step 4: Cache the database read — replace `src/content/get-cv.ts`**

```ts
import { cacheLife, cacheTag } from "next/cache";
import type { Locale } from "@/i18n/routing";
import { CV_TAG } from "@/server/cache-tags";
import { getDb } from "@/server/db";
import { loadCvRecords } from "@/server/queries/cv";
import { resolveCv } from "./resolve-cv";
import type { Cv } from "./types";

/**
 * CV content for one locale, read from Postgres. Cached across requests and
 * prerendered into the static /en and /ro pages; admin mutations call
 * `updateTag(CV_TAG)` so the next request renders fresh content.
 */
export async function getCv(locale: Locale): Promise<Cv> {
  "use cache";
  cacheTag(CV_TAG);
  cacheLife("max");
  return resolveCv(await loadCvRecords(getDb()), locale);
}
```

- [ ] **Step 5: Verify the build now reads Postgres (green)**

Run: `DATABASE_URL=postgres://cv:cv@localhost:59999/cv pnpm build`
Expected: exit 1. The log shows `⨯ Error: Failed query: select "id", "email_public", "location", "country_code", "avatar_media_id", "socials", "available", "years_exp", "updated_at" from "profile"`, `[cause]: Error: connect ECONNREFUSED 127.0.0.1:59999`, `Error occurred prerendering page "/ro"` (or `/en`), then `Export encountered an error on /[locale]/page: /ro, exiting the build.` and `⨯ Next.js build worker exited with code: 1 and signal: null`.

Run: `pnpm build`
Expected: `✓ Compiled successfully` and the same route table as M1:

```
Route (app)
┌ ○ /_not-found
├   /[locale]
│ ├ ◐ /[locale]
│ ├ ○ /en
│ └ ○ /ro
├   /[locale]/[...rest]
│ ├ ◐ /[locale]/[...rest]
│ ├ ◐ /en/[...rest]
│ └ ◐ /ro/[...rest]
├ ○ /robots.txt
└ ○ /sitemap.xml
```

- [ ] **Step 6: Give e2e its own database**

`scripts/e2e-db.ts`:

```ts
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";
import { createDb } from "@/server/db/create-db";
import { seedContent } from "@/server/db/seed";
import { requireEnv } from "./require-env";

// Prepares the e2e database named in DATABASE_URL (playwright.config.ts points
// it at `cv_e2e`, never the dev database): creates it if missing, applies the
// migrations and resets the CV content to the fixtures.
async function main() {
  const url = new URL(requireEnv("DATABASE_URL"));
  const name = url.pathname.slice(1);
  if (!/^[a-z0-9_]+$/.test(name)) {
    throw new Error(`Unexpected e2e database name: ${name}`);
  }

  const maintenance = new URL(url);
  maintenance.pathname = "/postgres";
  const client = new Client({ connectionString: maintenance.toString() });
  await client.connect();
  try {
    const found = await client.query(
      "select 1 from pg_database where datname = $1",
      [name],
    );
    if (found.rowCount === 0) {
      await client.query(`create database "${name}"`);
    }
  } finally {
    await client.end();
  }

  const { db, pool } = createDb(url.toString());
  try {
    await migrate(db, { migrationsFolder: "drizzle" });
    await seedContent(db, { reset: true });
    console.log(`e2e database ${name} ready`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
```

Replace `playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

// Same server as the dev database (.env.local or the CI env), but a separate
// `cv_e2e` database that every run resets, so e2e never touches dev content.
try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local (CI): DATABASE_URL comes from the environment.
}
const databaseUrl = new URL(
  process.env.DATABASE_URL ?? "postgres://cv:cv@localhost:5432/cv",
);
databaseUrl.pathname = "/cv_e2e";

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
    command: `node --import tsx scripts/e2e-db.ts && next build && next start --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      // Canonical URLs, hreflang, sitemap and JSON-LD are baked at build time.
      SITE_URL: baseURL,
      DATABASE_URL: databaseUrl.toString(),
    },
  },
});
```

- [ ] **Step 7: Verify the public pages are unchanged**

Run: `pnpm test:e2e`
Expected: `35 passed` (the unchanged M1 suite, now rendered from `cv_e2e`). Afterwards `ss -ltn | grep ':3100 '` prints nothing.

Run: `docker compose exec -T db psql -U cv -d cv_e2e -tAc 'select count(*) from project'`
Expected: `5`.

Run: `pnpm test`
Expected: `Test Files  7 passed (7)`, `Tests  57 passed (57)`.

Run: `pnpm typecheck`
Expected: `✓ Types generated successfully`, exit 0.

Run: `rtk proxy pnpm lint`
Expected: `Checked 76 files in <n>ms. No fixes applied.`

- [ ] **Step 8: Commit**

```bash
/usr/bin/git add package.json pnpm-lock.yaml playwright.config.ts scripts/e2e-db.ts src
/usr/bin/git commit -m "feat(content): serve cv from cached postgres reads"
```

---

### Task 4: Postgres in CI

**Owner:** devops-engineer

**Files:**
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `pnpm db:migrate`, `pnpm db:seed` (Task 2); the `cv_e2e` switch in `playwright.config.ts` (Task 3).
- Produces: all three jobs get a `postgres:18-alpine` service with a health check. `check` and `lighthouse` reach it on `localhost:5432` and migrate + seed before `pnpm build`. `e2e` runs inside the Playwright container, where the service is reachable by its name, so that job sets `DATABASE_URL=postgres://cv:cv@postgres:5432/cv`, and `scripts/e2e-db.ts` creates `cv_e2e` next to it. The workflow already exports `ADMIN_EMAIL` and a per-run `BETTER_AUTH_SECRET` (`openssl rand -base64 32` into `$GITHUB_ENV`): the env schema requires both from Task 5 on, and a random secret per run is safe because CI databases never outlive the job. No repository secrets are used.

- [ ] **Step 1: Replace `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main, dev]
  pull_request:

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

env:
  DATABASE_URL: postgres://cv:cv@localhost:5432/cv
  ADMIN_EMAIL: ci-owner@example.com
  NEXT_TELEMETRY_DISABLED: "1"

jobs:
  check:
    name: Typecheck, lint, unit, build
    runs-on: ubuntu-24.04
    timeout-minutes: 15
    services:
      postgres:
        image: postgres:18-alpine
        env:
          POSTGRES_USER: cv
          POSTGRES_PASSWORD: cv
          POSTGRES_DB: cv
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U cv -d cv"
          --health-interval 2s
          --health-timeout 5s
          --health-retries 15
    steps:
      - uses: actions/checkout@v7
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v7
        with:
          node-version-file: package.json
          cache: pnpm
      # Throwaway per-run secret: CI databases never hold real sessions.
      - run: echo "BETTER_AUTH_SECRET=$(openssl rand -base64 32)" >> "$GITHUB_ENV"
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test
      # The public pages are prerendered from Postgres at build time.
      - run: pnpm db:migrate
      - run: pnpm db:seed
      - run: pnpm build

  e2e:
    name: Playwright e2e
    runs-on: ubuntu-24.04
    timeout-minutes: 20
    container:
      image: mcr.microsoft.com/playwright:v1.63.0-noble
      options: --user 1001
    services:
      postgres:
        image: postgres:18-alpine
        env:
          POSTGRES_USER: cv
          POSTGRES_PASSWORD: cv
          POSTGRES_DB: cv
        options: >-
          --health-cmd "pg_isready -U cv -d cv"
          --health-interval 2s
          --health-timeout 5s
          --health-retries 15
    env:
      # Inside a job container the service is reached by its name, not localhost.
      # playwright.config.ts switches to the cv_e2e database on this server.
      DATABASE_URL: postgres://cv:cv@postgres:5432/cv
    steps:
      - uses: actions/checkout@v7
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v7
        with:
          node-version-file: package.json
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm test:e2e
      - if: failure()
        uses: actions/upload-artifact@v7
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7

  lighthouse:
    name: Lighthouse (desktop)
    runs-on: ubuntu-24.04
    timeout-minutes: 15
    services:
      postgres:
        image: postgres:18-alpine
        env:
          POSTGRES_USER: cv
          POSTGRES_PASSWORD: cv
          POSTGRES_DB: cv
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U cv -d cv"
          --health-interval 2s
          --health-timeout 5s
          --health-retries 15
    steps:
      - uses: actions/checkout@v7
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v7
        with:
          node-version-file: package.json
          cache: pnpm
      - run: echo "BETTER_AUTH_SECRET=$(openssl rand -base64 32)" >> "$GITHUB_ENV"
      - run: pnpm install --frozen-lockfile
      - run: pnpm db:migrate
      - run: pnpm db:seed
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

- [ ] **Step 2: Lint the workflow**

Run: `/home/mihai/go/bin/actionlint .github/workflows/ci.yml; echo "exit=$?"`
Expected: no findings, `exit=0`.

The full CI sequence is exercised locally by the gate in Task 14, Step 4. CI itself runs when the Overseer pushes `dev` (never unprompted).

- [ ] **Step 3: Commit**

```bash
/usr/bin/git add .github/workflows/ci.yml
/usr/bin/git commit -m "ci: run postgres 18 service for build and e2e"
```

---

### Task 5: Single-owner Better Auth and `pnpm admin:create`

**Owner:** backend-engineer

**Files:**
- Create: `src/server/auth/create-auth.ts`, `src/server/auth/admin.ts`, `src/server/auth/read-session.ts`, `src/server/auth/index.ts`, `src/app/api/auth/[...all]/route.ts`, `scripts/admin-create.ts`, `tests/db/auth.test.ts`, `tests/e2e/admin-credentials.ts`
- Modify: `src/lib/create-app-env.ts`, `src/env.ts`, `.env.example`, `tests/unit/env.test.ts`, `scripts/e2e-db.ts`, `playwright.config.ts`, `package.json`, `pnpm-lock.yaml`

**Interfaces:**
- Consumes: `Db`, schema `user/session/account/verification` (Task 1); `createDb` (Task 2); `getDb` (Task 3); `siteUrl` (M1).
- Produces:
  - Env: `BETTER_AUTH_SECRET` (required, ≥ 32 chars) and `ADMIN_EMAIL` (required, email, lower-cased), both server-only.
  - `createAuth(config: { db: Db; secret: string; baseURL: string; adminEmail: string })` and `type Auth` from `@/server/auth/create-auth`; `MIN_PASSWORD_LENGTH = 12`. Email + password only, `disableSignUp: true`, sessions 7 days (refreshed daily), `databaseHooks.user.create.before` throws `APIError("FORBIDDEN", { message: "Only ADMIN_EMAIL may have an account." })` for any other email, `nextCookies()` last.
  - `upsertAdmin(auth, { email, password, name, adminEmail }): Promise<"created" | "updated">` from `@/server/auth/admin`: creates the owner or resets the password and deletes every session. Throws `Refusing to create <email>: it is not ADMIN_EMAIL.` and `The password must be 12 to 128 characters long.`
  - `type AdminSession = { userId; email; name }` and `readAdminSession(auth, headers, adminEmail): Promise<AdminSession | null>` from `@/server/auth/read-session` (a valid session for another email is `null`).
  - From `@/server/auth` (app code only, it imports `@/env`): `auth`, `getAdminSession()` (React `cache()`d per request, reads `headers()`), `requireAdmin()` (redirects to `/admin/login`).
  - `/api/auth/*` (Better Auth handler). Script `admin:create` (password from `ADMIN_PASSWORD` or a hidden prompt).
  - e2e: the owner `E2E_ADMIN = { email: "owner@e2e.example.com", password, secret }` from `tests/e2e/admin-credentials.ts`, created by `scripts/e2e-db.ts`. `playwright.config.ts` gets its final shape now: projects `public` (everything except `admin-*.spec.ts`), `admin` (after `public`, files in parallel, tests in a file serial) and `security` (after `admin`, for Task 12). `BLOB_READ_WRITE_TOKEN: ""` forces local media storage from Task 11 on.

- [ ] **Step 1: Add Better Auth**

```bash
pnpm add -E better-auth@1.7.5
```

Expected: `+ better-auth 1.7.5`, `Done in <n>s using pnpm v11.27.1`, no build-script error.

- [ ] **Step 2: Write the failing tests**

Replace `tests/unit/env.test.ts` (every existing case now starts from a complete `BASE` env, and four cases are new):

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAppEnv } from "@/lib/create-app-env";

const LOCAL_DB = "postgres://cv:cv@localhost:5432/cv";
const NEON_DB =
  "postgresql://cv_owner:secret@ep-quiet-sky-a1b2c3-pooler.eu-central-1.aws.neon.tech/cv?sslmode=require&channel_binding=require";

// The smallest valid server env; each test overrides one variable.
const BASE = {
  DATABASE_URL: LOCAL_DB,
  BETTER_AUTH_SECRET: "test-secret-that-is-at-least-32-chars",
  ADMIN_EMAIL: "owner@example.com",
};

describe("createAppEnv", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("accepts the local docker database URL", () => {
    const env = createAppEnv(BASE);

    expect(env.DATABASE_URL).toBe(LOCAL_DB);
  });

  it("accepts a Neon pooled URL with query parameters", () => {
    const env = createAppEnv({ ...BASE, DATABASE_URL: NEON_DB });

    expect(env.DATABASE_URL).toBe(NEON_DB);
  });

  it("treats an empty NEXT_PUBLIC_ASSET_BASE as unset", () => {
    const env = createAppEnv({ ...BASE, NEXT_PUBLIC_ASSET_BASE: "" });

    expect(env.NEXT_PUBLIC_ASSET_BASE).toBeUndefined();
  });

  it("accepts an absolute NEXT_PUBLIC_ASSET_BASE", () => {
    const env = createAppEnv({
      ...BASE,
      NEXT_PUBLIC_ASSET_BASE: "https://cdn.example.com",
    });

    expect(env.NEXT_PUBLIC_ASSET_BASE).toBe("https://cdn.example.com");
  });

  it("rejects a missing DATABASE_URL", () => {
    expect(() => createAppEnv({ ...BASE, DATABASE_URL: undefined })).toThrow(
      "Invalid environment variables",
    );
  });

  it("rejects a non-postgres DATABASE_URL", () => {
    expect(() =>
      createAppEnv({
        ...BASE,
        DATABASE_URL: "mysql://cv:cv@localhost:3306/cv",
      }),
    ).toThrow("Invalid environment variables");
  });

  it("rejects a NEXT_PUBLIC_ASSET_BASE without a scheme", () => {
    expect(() =>
      createAppEnv({ ...BASE, NEXT_PUBLIC_ASSET_BASE: "cdn.example.com" }),
    ).toThrow("Invalid environment variables");
  });

  it("accepts an https SITE_URL", () => {
    const env = createAppEnv({ ...BASE, SITE_URL: "https://cv.example.dev" });

    expect(env.SITE_URL).toBe("https://cv.example.dev");
  });

  it("treats an empty SITE_URL as unset", () => {
    const env = createAppEnv({ ...BASE, SITE_URL: "" });

    expect(env.SITE_URL).toBeUndefined();
  });

  it("rejects a SITE_URL without an http(s) scheme", () => {
    expect(() => createAppEnv({ ...BASE, SITE_URL: "cv.example.dev" })).toThrow(
      "Invalid environment variables",
    );
  });

  it("rejects a BETTER_AUTH_SECRET shorter than 32 characters", () => {
    expect(() =>
      createAppEnv({ ...BASE, BETTER_AUTH_SECRET: "too-short" }),
    ).toThrow("Invalid environment variables");
  });

  it("rejects a missing ADMIN_EMAIL", () => {
    expect(() => createAppEnv({ ...BASE, ADMIN_EMAIL: "" })).toThrow(
      "Invalid environment variables",
    );
  });

  it("lower-cases ADMIN_EMAIL so the allowlist match is case-insensitive", () => {
    const env = createAppEnv({ ...BASE, ADMIN_EMAIL: "Owner@Example.COM" });

    expect(env.ADMIN_EMAIL).toBe("owner@example.com");
  });

  it("refuses to expose DATABASE_URL to client code", () => {
    const env = createAppEnv(BASE, { isServer: false });

    expect(() => env.DATABASE_URL).toThrow(
      "Attempted to access a server-side environment variable on the client",
    );
  });

  it("refuses to expose BETTER_AUTH_SECRET to client code", () => {
    const env = createAppEnv(BASE, { isServer: false });

    expect(() => env.BETTER_AUTH_SECRET).toThrow(
      "Attempted to access a server-side environment variable on the client",
    );
  });
});
```

`tests/db/auth.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { upsertAdmin } from "@/server/auth/admin";
import { type Auth, createAuth } from "@/server/auth/create-auth";
import { readAdminSession } from "@/server/auth/read-session";
import type { Db } from "@/server/db/types";
import { createTestDb } from "./test-db";

const ADMIN = "owner@example.com";
const PASSWORD = "correct-horse-battery";

let db: Db;
let close: () => Promise<void>;
let auth: Auth;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  auth = createAuth({
    db,
    secret: "test-secret-that-is-at-least-32-chars",
    baseURL: "http://localhost:3000",
    adminEmail: ADMIN,
  });
});

afterAll(async () => {
  await close();
});

/** Signs in through the real endpoint and returns the Cookie header a browser would send. */
async function signIn(email: string, password: string): Promise<Headers> {
  const response = await auth.api.signInEmail({
    body: { email, password },
    asResponse: true,
  });
  if (!response.ok) {
    throw new Error(`sign-in failed with ${response.status}`);
  }
  const cookie = response.headers
    .getSetCookie()
    .map((header) => header.split(";")[0])
    .join("; ");
  return new Headers({ cookie });
}

describe("single-owner auth", () => {
  it("creates the owner account once, then resets its password", async () => {
    expect(
      await upsertAdmin(auth, {
        email: "Owner@Example.com",
        password: PASSWORD,
        name: "Owner",
        adminEmail: ADMIN,
      }),
    ).toBe("created");

    const headers = await signIn(ADMIN, PASSWORD);
    expect(await readAdminSession(auth, headers, ADMIN)).toMatchObject({
      email: ADMIN,
      name: "Owner",
    });

    expect(
      await upsertAdmin(auth, {
        email: ADMIN,
        password: "a-brand-new-password",
        name: "Owner",
        adminEmail: ADMIN,
      }),
    ).toBe("updated");
    // The reset signs out every existing session and retires the old password.
    expect(await readAdminSession(auth, headers, ADMIN)).toBeNull();
    await expect(signIn(ADMIN, PASSWORD)).rejects.toThrow();
    await expect(signIn(ADMIN, "a-brand-new-password")).resolves.toBeInstanceOf(
      Headers,
    );
  });

  it("refuses to create any account other than ADMIN_EMAIL", async () => {
    await expect(
      upsertAdmin(auth, {
        email: "intruder@example.com",
        password: PASSWORD,
        name: "Intruder",
        adminEmail: ADMIN,
      }),
    ).rejects.toThrow(
      "Refusing to create intruder@example.com: it is not ADMIN_EMAIL.",
    );

    const ctx = await auth.$context;
    await expect(
      ctx.internalAdapter.createUser(
        { email: "intruder@example.com", name: "Intruder" },
        { method: "admin" },
      ),
    ).rejects.toThrow();
    expect(
      await ctx.internalAdapter.findUserByEmail("intruder@example.com"),
    ).toBeNull();
  });

  it("rejects passwords shorter than 12 characters", async () => {
    await expect(
      upsertAdmin(auth, {
        email: ADMIN,
        password: "short-pass",
        name: "Owner",
        adminEmail: ADMIN,
      }),
    ).rejects.toThrow("The password must be 12 to");
  });

  it("keeps public sign-up closed", async () => {
    await expect(
      auth.api.signUpEmail({
        body: {
          email: ADMIN,
          password: "another-long-password",
          name: "Owner",
        },
      }),
    ).rejects.toThrow();
  });

  it("treats a valid session for another email as signed out", async () => {
    const headers = await signIn(ADMIN, "a-brand-new-password");

    expect(await readAdminSession(auth, headers, ADMIN)).not.toBeNull();
    expect(
      await readAdminSession(auth, headers, "new-owner@example.com"),
    ).toBeNull();
  });

  it("treats a forged session cookie as signed out", async () => {
    const forged = new Headers({
      cookie: "better-auth.session_token=forged.signature",
    });

    expect(await readAdminSession(auth, forged, ADMIN)).toBeNull();
  });
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `pnpm test`
Expected: FAIL with

```
 FAIL  tests/db/auth.test.ts [ tests/db/auth.test.ts ]
Error: Cannot find package '@/server/auth/admin' imported from <worktree>/tests/db/auth.test.ts
 FAIL  tests/unit/env.test.ts > createAppEnv > rejects a BETTER_AUTH_SECRET shorter than 32 characters
 FAIL  tests/unit/env.test.ts > createAppEnv > rejects a missing ADMIN_EMAIL
 FAIL  tests/unit/env.test.ts > createAppEnv > lower-cases ADMIN_EMAIL so the allowlist match is case-insensitive
 Test Files  2 failed | 6 passed (8)
      Tests  3 failed | 58 passed (61)
```

- [ ] **Step 4: Add the env variables**

Replace `src/lib/create-app-env.ts`:

```ts
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export type RuntimeEnv = {
  DATABASE_URL?: string;
  SITE_URL?: string;
  BETTER_AUTH_SECRET?: string;
  ADMIN_EMAIL?: string;
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
      BETTER_AUTH_SECRET: z.string().min(32),
      ADMIN_EMAIL: z.email().transform((email) => email.toLowerCase()),
    },
    client: {
      NEXT_PUBLIC_ASSET_BASE: z.url().optional(),
    },
    runtimeEnv: {
      DATABASE_URL: runtimeEnv.DATABASE_URL,
      SITE_URL: runtimeEnv.SITE_URL,
      BETTER_AUTH_SECRET: runtimeEnv.BETTER_AUTH_SECRET,
      ADMIN_EMAIL: runtimeEnv.ADMIN_EMAIL,
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
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
  NEXT_PUBLIC_ASSET_BASE: process.env.NEXT_PUBLIC_ASSET_BASE,
});
```

Replace `.env.example`:

```bash
# Copy to .env.local for local development: cp .env.example .env.local

# Postgres connection string. Local default matches docker-compose.yml.
# On Vercel this is injected by the Neon integration.
DATABASE_URL=postgres://cv:cv@localhost:5432/cv

# Public origin for canonical URLs, hreflang, sitemap.xml and JSON-LD.
# Empty = the Vercel production domain on Vercel, http://localhost:3000 elsewhere.
SITE_URL=

# Better Auth: signs session cookies and encrypts 2FA secrets (>= 32 chars).
# This value is for local development only. Generate a real one for any
# deployed environment: openssl rand -base64 32
BETTER_AUTH_SECRET=dev-only-better-auth-secret-change-me-0123

# The only account allowed into /admin. Create it with `pnpm admin:create`.
ADMIN_EMAIL=admin@example.com

# Optional absolute base URL for /public media (sequences, glb). Empty = same origin.
NEXT_PUBLIC_ASSET_BASE=
```

Add both variables to your `.env.local` (it is git-ignored; `next.config.ts` validates env, so `pnpm typecheck` and `pnpm build` fail with `❌ Invalid environment variables` and `path: [ 'BETTER_AUTH_SECRET' ]` / `path: [ 'ADMIN_EMAIL' ]` until you do). Locally, `ADMIN_EMAIL` is the owner's real address. It goes **only** into `.env.local`, never into a committed file: `.env.example`, `README.md`, `src/`, `tests/` and CI keep placeholders (`admin@example.com`, `owner@example.com`, `owner@e2e.example.com`, `ci-owner@example.com`).

```bash
BETTER_AUTH_SECRET=dev-only-better-auth-secret-change-me-0123
ADMIN_EMAIL=<owner email>
```

- [ ] **Step 5: Create the Better Auth factory, the owner upsert and the session reader**

`src/server/auth/create-auth.ts`:

```ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import * as schema from "@/server/db/schema";
import type { Db } from "@/server/db/types";

export type AuthConfig = {
  db: Db;
  secret: string;
  baseURL: string;
  /** The only identity allowed to exist (spec §5: ADMIN_EMAIL allowlist). */
  adminEmail: string;
};

export const MIN_PASSWORD_LENGTH = 12;

/**
 * Single-owner Better Auth: email + password, public sign-up disabled, and
 * every user creation outside ADMIN_EMAIL rejected. The owner account is
 * created by `pnpm admin:create` (see ./admin.ts).
 */
export function createAuth(config: AuthConfig) {
  const adminEmail = config.adminEmail.toLowerCase();

  return betterAuth({
    appName: "CV admin",
    baseURL: config.baseURL,
    secret: config.secret,
    database: drizzleAdapter(config.db, { provider: "pg", schema }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
    },
    databaseHooks: {
      user: {
        create: {
          // Runs for every user insert, including `pnpm admin:create`.
          before: async (user) => {
            if (user.email.toLowerCase() !== adminEmail) {
              throw new APIError("FORBIDDEN", {
                message: "Only ADMIN_EMAIL may have an account.",
              });
            }
          },
        },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    // nextCookies() must stay last: it writes Set-Cookie from server actions.
    plugins: [nextCookies()],
  });
}

export type Auth = ReturnType<typeof createAuth>;
```

`src/server/auth/admin.ts`:

```ts
import type { Auth } from "./create-auth";

export type UpsertAdminResult = "created" | "updated";

/**
 * Creates the owner account, or resets its password (and signs out every
 * session) when it already exists. Public sign-up is disabled, so this is the
 * only way an account comes into being.
 */
export async function upsertAdmin(
  auth: Auth,
  input: {
    email: string;
    password: string;
    name: string;
    adminEmail: string;
  },
): Promise<UpsertAdminResult> {
  const email = input.email.toLowerCase();
  if (email !== input.adminEmail.toLowerCase()) {
    throw new Error(`Refusing to create ${email}: it is not ADMIN_EMAIL.`);
  }

  const ctx = await auth.$context;
  const { minPasswordLength, maxPasswordLength } = ctx.password.config;
  if (
    input.password.length < minPasswordLength ||
    input.password.length > maxPasswordLength
  ) {
    throw new Error(
      `The password must be ${minPasswordLength} to ${maxPasswordLength} characters long.`,
    );
  }
  const hash = await ctx.password.hash(input.password);

  const existing = await ctx.internalAdapter.findUserByEmail(email, {
    includeAccounts: true,
  });
  if (existing) {
    const userId = existing.user.id;
    const credential = existing.accounts.find(
      (account) => account.providerId === "credential",
    );
    if (credential) {
      await ctx.internalAdapter.updatePassword(userId, hash);
    } else {
      await ctx.internalAdapter.linkAccount({
        userId,
        providerId: "credential",
        accountId: userId,
        password: hash,
      });
    }
    await ctx.internalAdapter.deleteUserSessions(userId);
    return "updated";
  }

  const user = await ctx.internalAdapter.createUser(
    { email, name: input.name, emailVerified: true },
    { method: "admin" },
  );
  await ctx.internalAdapter.linkAccount({
    userId: user.id,
    providerId: "credential",
    accountId: user.id,
    password: hash,
  });
  return "created";
}
```

`src/server/auth/read-session.ts`:

```ts
import type { Auth } from "./create-auth";

export type AdminSession = {
  userId: string;
  email: string;
  name: string;
};

/**
 * The signed-in owner for these request headers, or null. A valid session for
 * any other email (for example after ADMIN_EMAIL changed) counts as signed out.
 */
export async function readAdminSession(
  auth: Auth,
  headers: Headers,
  adminEmail: string,
): Promise<AdminSession | null> {
  const result = await auth.api.getSession({ headers });
  if (!result || result.user.email.toLowerCase() !== adminEmail.toLowerCase()) {
    return null;
  }
  return {
    userId: result.user.id,
    email: result.user.email,
    name: result.user.name,
  };
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm test`
Expected: `Test Files  8 passed (8)`, `Tests  67 passed (67)`.

- [ ] **Step 7: Wire Better Auth into the app**

`src/server/auth/index.ts`:

```ts
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { env } from "@/env";
import { getDb } from "@/server/db";
import { siteUrl } from "@/site";
import { createAuth } from "./create-auth";
import { type AdminSession, readAdminSession } from "./read-session";

export type { AdminSession } from "./read-session";

export const auth = createAuth({
  db: getDb(),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: siteUrl,
  adminEmail: env.ADMIN_EMAIL,
});

/**
 * Data-access-layer session check (spec §5, CVE-2025-29927): the proxy's cookie
 * check is only a redirect hint, so every admin layout, page and server action
 * calls this. Deduplicated per request.
 */
export const getAdminSession = cache(
  async (): Promise<AdminSession | null> =>
    readAdminSession(auth, await headers(), env.ADMIN_EMAIL),
);

/** For admin layouts and pages: the owner, or a redirect to the login page. */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login");
  }
  return session;
}
```

`src/app/api/auth/[...all]/route.ts`:

```ts
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/server/auth";

export const { GET, POST } = toNextJsHandler(auth);
```

- [ ] **Step 8: Add `pnpm admin:create`**

`scripts/admin-create.ts`:

```ts
import { stdin, stdout } from "node:process";
import { upsertAdmin } from "@/server/auth/admin";
import { createAuth } from "@/server/auth/create-auth";
import { createDb } from "@/server/db/create-db";
import { requireEnv } from "./require-env";

// `pnpm admin:create` creates the owner account for ADMIN_EMAIL, or resets its
// password. The password comes from ADMIN_PASSWORD (CI, e2e) or a hidden prompt.
async function main() {
  const adminEmail = requireEnv("ADMIN_EMAIL");
  const password =
    process.env.ADMIN_PASSWORD || (await promptHidden("Admin password: "));
  const { db, pool } = createDb(requireEnv("DATABASE_URL"));
  try {
    const auth = createAuth({
      db,
      secret: requireEnv("BETTER_AUTH_SECRET"),
      baseURL: "http://localhost:3000",
      adminEmail,
    });
    const result = await upsertAdmin(auth, {
      email: adminEmail,
      password,
      name: "Owner",
      adminEmail,
    });
    console.log(
      result === "created"
        ? `created admin ${adminEmail}`
        : `reset the password of ${adminEmail} and signed out its sessions`,
    );
  } finally {
    await pool.end();
  }
}

/** Reads one line from the terminal without echoing it. */
function promptHidden(question: string): Promise<string> {
  if (!stdin.isTTY) {
    throw new Error("Set ADMIN_PASSWORD or run this in a terminal.");
  }
  stdout.write(question);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");
  return new Promise((resolve, reject) => {
    let value = "";
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === "\r" || char === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          stdout.write("\n");
          resolve(value);
          return;
        }
        if (char === "\u0003") {
          stdin.setRawMode(false);
          reject(new Error("Cancelled."));
          return;
        }
        value = char === "\u007f" ? value.slice(0, -1) : value + char;
      }
    };
    stdin.on("data", onData);
  });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
```

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
    "lhci": "lhci autorun",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "node --env-file-if-exists=.env.local --import tsx scripts/db-migrate.ts",
    "db:seed": "node --env-file-if-exists=.env.local --import tsx scripts/db-seed.ts",
    "admin:create": "node --env-file-if-exists=.env.local --import tsx scripts/admin-create.ts"
  },
```

Run: `ADMIN_PASSWORD=local-admin-password-1 pnpm admin:create`
Expected: `created admin <owner email>`.

Run it again.
Expected: `reset the password of <owner email> and signed out its sessions`.

Run: `ADMIN_PASSWORD=short pnpm admin:create`
Expected: exit 1, `The password must be 12 to 128 characters long.`

Run: `pnpm admin:create < /dev/null`
Expected: exit 1, `Set ADMIN_PASSWORD or run this in a terminal.` (In a real terminal it asks `Admin password: ` without echoing.)

- [ ] **Step 9: Create the e2e owner**

`tests/e2e/admin-credentials.ts`:

```ts
// The e2e owner account. scripts/e2e-db.ts creates it in the throwaway
// cv_e2e database before every run; these values never reach a real database.
export const E2E_ADMIN = {
  email: "owner@e2e.example.com",
  password: "e2e-owner-password-0001",
  secret: "e2e-only-better-auth-secret-0000000000",
} as const;
```

Replace `scripts/e2e-db.ts`:

```ts
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";
import { upsertAdmin } from "@/server/auth/admin";
import { createAuth } from "@/server/auth/create-auth";
import { createDb } from "@/server/db/create-db";
import { seedContent } from "@/server/db/seed";
import { requireEnv } from "./require-env";

// Prepares the e2e database named in DATABASE_URL (playwright.config.ts points
// it at `cv_e2e`, never the dev database): creates it if missing, applies the
// migrations, resets the CV content to the fixtures and (re)creates the owner
// account from ADMIN_EMAIL / ADMIN_PASSWORD.
async function main() {
  const url = new URL(requireEnv("DATABASE_URL"));
  const name = url.pathname.slice(1);
  if (!/^[a-z0-9_]+$/.test(name)) {
    throw new Error(`Unexpected e2e database name: ${name}`);
  }

  const maintenance = new URL(url);
  maintenance.pathname = "/postgres";
  const client = new Client({ connectionString: maintenance.toString() });
  await client.connect();
  try {
    const found = await client.query(
      "select 1 from pg_database where datname = $1",
      [name],
    );
    if (found.rowCount === 0) {
      await client.query(`create database "${name}"`);
    }
  } finally {
    await client.end();
  }

  const { db, pool } = createDb(url.toString());
  try {
    await migrate(db, { migrationsFolder: "drizzle" });
    await seedContent(db, { reset: true });
    const adminEmail = requireEnv("ADMIN_EMAIL");
    const auth = createAuth({
      db,
      secret: requireEnv("BETTER_AUTH_SECRET"),
      baseURL: "http://localhost:3100",
      adminEmail,
    });
    await upsertAdmin(auth, {
      email: adminEmail,
      password: requireEnv("ADMIN_PASSWORD"),
      name: "E2E Owner",
      adminEmail,
    });
    console.log(`e2e database ${name} ready`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
```

Replace `playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";
import { E2E_ADMIN } from "./tests/e2e/admin-credentials";

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

// Same server as the dev database (.env.local or the CI env), but a separate
// `cv_e2e` database that every run resets, so e2e never touches dev content.
try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local (CI): DATABASE_URL comes from the environment.
}
const databaseUrl = new URL(
  process.env.DATABASE_URL ?? "postgres://cv:cv@localhost:5432/cv",
);
databaseUrl.pathname = "/cv_e2e";

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
  projects: [
    {
      name: "public",
      testIgnore: /admin-.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // Admin specs edit shared content, so they start after every public
      // spec has finished reading the seeded fixtures.
      name: "admin",
      testMatch: /admin-.*\.spec\.ts/,
      testIgnore: /admin-security\.spec\.ts/,
      dependencies: ["public"],
      fullyParallel: false,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // Turns 2FA on for the shared owner account, so it runs alone, last.
      name: "security",
      testMatch: /admin-security\.spec\.ts/,
      dependencies: ["admin"],
      fullyParallel: false,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `node --import tsx scripts/e2e-db.ts && next build && next start --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      // Canonical URLs, hreflang, sitemap and JSON-LD are baked at build time.
      SITE_URL: baseURL,
      DATABASE_URL: databaseUrl.toString(),
      BETTER_AUTH_SECRET: E2E_ADMIN.secret,
      ADMIN_EMAIL: E2E_ADMIN.email,
      ADMIN_PASSWORD: E2E_ADMIN.password,
      // Local media storage even if .env.local has a Blob token.
      BLOB_READ_WRITE_TOKEN: "",
    },
  },
});
```

- [ ] **Step 10: Verify**

Run: `pnpm typecheck`
Expected: `✓ Types generated successfully`, exit 0.

Run: `rtk proxy pnpm lint`
Expected: `Checked 84 files in <n>ms. No fixes applied.`

Run: `pnpm build`
Expected: the Task 3 route table plus `├ ƒ /api/auth/[...all]`.

Run: `pnpm test:e2e`
Expected: `35 passed` (all in the `public` project; `admin` and `security` have no specs yet).

Run: `docker compose exec -T db psql -U cv -d cv_e2e -tAc 'select email, email_verified from "user"'`
Expected: `owner@e2e.example.com|t`.

- [ ] **Step 11: Commit**

```bash
/usr/bin/git add .env.example package.json pnpm-lock.yaml playwright.config.ts scripts src tests
/usr/bin/git commit -m "feat(auth): add single-owner better auth"
```

---

### Task 6: Gate `/admin`: proxy, login and the panel shell

**Owner:** backend-engineer (the few UI files reuse the M1 tokens; no design work)

**Files:**
- Create: `src/app/admin/layout.tsx`, `src/app/admin/login/page.tsx`, `src/app/admin/(panel)/layout.tsx`, `src/app/admin/(panel)/page.tsx`, `src/app/admin/(panel)/profile/page.tsx` (placeholder), `src/components/admin/styles.ts`, `src/components/admin/LoginForm.tsx`, `src/server/actions/auth.ts`, `tests/e2e/admin-login.ts`, `tests/e2e/admin-auth.spec.ts`
- Modify: `src/proxy.ts`

**Interfaces:**
- Consumes: `auth`, `getAdminSession`, `requireAdmin` (Task 5); `E2E_ADMIN` (Task 5); fonts and `globals.css` (M1).
- Produces:
  - `src/proxy.ts`: requests to `/admin` and `/admin/*` skip next-intl. Without a Better Auth session cookie they get a `307` to `/admin/login`; `/admin/login` and `/admin/login/*` are always allowed. The cookie is **not** validated here (no database call).
  - `/admin` root layout: `<html lang="en">`, `robots: noindex, nofollow`, title template `%s · Admin`, the whole tree inside one `<Suspense>`.
  - `(panel)/layout.tsx` calls `requireAdmin()` on every render and shows the admin nav (Profile, Experience, Skills, Projects, Media, Security; the later tasks add those pages) and a Sign out button. `/admin` redirects to `/admin/profile`.
  - Server actions `signIn(prev: SignInState, formData): Promise<SignInState>` and `signOut()` in `@/server/actions/auth`, `type SignInState = { error?: string }`. Every failed sign-in says `Wrong email or password.` (429 says `Too many attempts. Wait a minute and try again.`).
  - Shared admin class names in `@/components/admin/styles` (`field`, `label`, `button`, `secondaryButton`, `panel`).
  - e2e helper `signInAsOwner(page)` in `tests/e2e/admin-login.ts`. Admin specs use `getByRole("textbox", { name })` and `{ name: "Sign in", exact: true }` (see Verified facts: hidden route copies, and Task 13's "Sign in with a passkey" button).

- [ ] **Step 1: Write the failing e2e tests**

`tests/e2e/admin-login.ts`:

```ts
import { expect, type Page } from "@playwright/test";
import { E2E_ADMIN } from "./admin-credentials";

/** Signs in through the real login form and waits for the admin panel. */
export async function signInAsOwner(page: Page): Promise<void> {
  await page.goto("/admin/login");
  await page.getByRole("textbox", { name: "Email" }).fill(E2E_ADMIN.email);
  await page
    .getByRole("textbox", { name: "Password" })
    .fill(E2E_ADMIN.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/admin/profile");
}
```

`tests/e2e/admin-auth.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { E2E_ADMIN } from "./admin-credentials";
import { signInAsOwner } from "./admin-login";

test("redirects /admin to the login page when logged out", async ({
  page,
  request,
}) => {
  const response = await request.get("/admin/profile", { maxRedirects: 0 });

  expect(response.status()).toBe(307);
  expect(response.headers().location).toBe("/admin/login");

  await page.goto("/admin");
  await expect(page).toHaveURL("/admin/login");
  await expect(
    page.getByRole("heading", { name: "Sign in to the admin" }),
  ).toBeVisible();
});

test("a forged session cookie passes the proxy but not the layout", async ({
  page,
  context,
  baseURL,
}) => {
  await context.addCookies([
    {
      name: "better-auth.session_token",
      value: "forged.signature",
      url: baseURL,
    },
  ]);

  await page.goto("/admin/profile");

  await expect(page).toHaveURL("/admin/login");
  await expect(page.getByRole("heading", { name: "Profile" })).toHaveCount(0);
});

test("rejects a wrong password without saying which field was wrong", async ({
  page,
}) => {
  await page.goto("/admin/login");
  await page.getByRole("textbox", { name: "Email" }).fill(E2E_ADMIN.email);
  await page
    .getByRole("textbox", { name: "Password" })
    .fill("not-the-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(page.locator("form").getByRole("alert")).toHaveText(
    "Wrong email or password.",
  );
  await expect(page).toHaveURL("/admin/login");
});

test("signs in, reaches the panel and signs out", async ({ page }) => {
  await signInAsOwner(page);
  await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Admin" })).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/admin/login");

  await page.goto("/admin/profile");
  await expect(page).toHaveURL("/admin/login");
});

test("keeps admin pages out of search engines", async ({ page }) => {
  await page.goto("/admin/login");

  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, nofollow",
  );
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm exec playwright test --project admin --no-deps`
Expected: `5 failed`. `/admin/profile` is still handled by next-intl, so the first test gets `Expected: "/admin/login"` / `Received: "/en/admin/profile"`, the form tests time out waiting for `getByRole('textbox', { name: 'Email' })`, and the robots meta is the not-found page's `noindex` instead of `noindex, nofollow`.

- [ ] **Step 3: Route `/admin` around next-intl — replace `src/proxy.ts`**

```ts
import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intl = createMiddleware(routing);

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    // Optimistic redirect only (no DB call). A forged or expired cookie gets
    // through here and is rejected by requireAdmin() in the admin layout,
    // pages and every server action (CVE-2025-29927).
    const isLogin =
      pathname === "/admin/login" || pathname.startsWith("/admin/login/");
    if (!isLogin && !getSessionCookie(request)) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return NextResponse.next();
  }

  return intl(request);
}

export const config = {
  // Everything except API routes, Next/Vercel internals and files with an extension.
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
```

- [ ] **Step 4: Create the admin root layout and the shared styles**

`src/app/admin/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { mono, sans } from "../fonts";
import "../globals.css";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin" },
  robots: { index: false, follow: false },
};

// Second root layout: /admin is English-only and outside next-intl routing.
// Every admin page reads the session cookie, so the whole tree is dynamic and
// sits behind one Suspense boundary (Cache Components requires it).
export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-dvh bg-canvas font-sans text-ink">
        <Suspense fallback={null}>{children}</Suspense>
      </body>
    </html>
  );
}
```

`src/components/admin/styles.ts`:

```ts
// Shared admin class names (English-only UI, same tokens as the public site).
export const field =
  "mt-1.5 w-full rounded-control bg-canvas px-3 py-2 text-ink ring-1 ring-line-strong";
export const label = "block text-sm text-ink-muted";
export const button =
  "rounded-full bg-signal px-5 py-2 font-medium text-signal-ink disabled:opacity-60";
export const secondaryButton =
  "rounded-full px-4 py-2 text-sm text-ink ring-1 ring-line-strong hover:bg-raised";
export const panel = "rounded-panel bg-surface p-6 ring-1 ring-line";
```

- [ ] **Step 5: Create the sign-in and sign-out actions and the login page**

`src/server/actions/auth.ts`:

```ts
"use server";

import { isAPIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/server/auth";

export type SignInState = { error?: string };

const credentials = z.object({
  email: z.email(),
  password: z.string().min(1).max(128),
});

export async function signIn(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Enter your email and password." };
  }
  try {
    await auth.api.signInEmail({
      body: parsed.data,
      headers: await headers(),
    });
  } catch (error) {
    if (isAPIError(error)) {
      // One message for every failure: never reveal whether the email exists.
      return {
        error:
          error.statusCode === 429
            ? "Too many attempts. Wait a minute and try again."
            : "Wrong email or password.",
      };
    }
    throw error;
  }
  redirect("/admin");
}

export async function signOut(): Promise<void> {
  await auth.api.signOut({ headers: await headers() });
  redirect("/admin/login");
}
```

`src/components/admin/LoginForm.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { type SignInState, signIn } from "@/server/actions/auth";
import { button, field, label } from "./styles";

export function LoginForm() {
  const [state, action, pending] = useActionState<SignInState, FormData>(
    signIn,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-5">
      <label className={label}>
        Email
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          className={field}
        />
      </label>
      <label className={label}>
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={field}
        />
      </label>
      <p role="alert" className="min-h-6 text-sm text-ink">
        {state.error}
      </p>
      <button type="submit" disabled={pending} className={button}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
```

`src/app/admin/login/page.tsx`:

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/LoginForm";
import { panel } from "@/components/admin/styles";
import { getAdminSession } from "@/server/auth";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getAdminSession()) {
    redirect("/admin");
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-gutter">
      <h1 className="text-heading text-ink">Sign in to the admin</h1>
      <div className={panel}>
        <LoginForm />
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Create the panel shell**

`src/app/admin/(panel)/layout.tsx`:

```tsx
import Link from "next/link";
import { secondaryButton } from "@/components/admin/styles";
import { signOut } from "@/server/actions/auth";
import { requireAdmin } from "@/server/auth";

const NAV = [
  { href: "/admin/profile", label: "Profile" },
  { href: "/admin/experience", label: "Experience" },
  { href: "/admin/skills", label: "Skills" },
  { href: "/admin/projects", label: "Projects" },
  { href: "/admin/media", label: "Media" },
  { href: "/admin/security", label: "Security" },
] as const;

export default async function PanelLayout({ children }: LayoutProps<"/admin">) {
  // Re-checks the session on every render; the proxy only checks the cookie exists.
  const session = await requireAdmin();

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-8 px-gutter py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <nav aria-label="Admin">
          <ul className="flex flex-wrap gap-2">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={secondaryButton}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <form action={signOut} className="flex items-center gap-3">
          <span className="text-sm text-ink-muted">{session.email}</span>
          <button type="submit" className={secondaryButton}>
            Sign out
          </button>
        </form>
      </header>
      <main id="main">{children}</main>
    </div>
  );
}
```

`src/app/admin/(panel)/page.tsx`:

```tsx
import { redirect } from "next/navigation";

export default function AdminHome() {
  redirect("/admin/profile");
}
```

`src/app/admin/(panel)/profile/page.tsx` (Task 7 replaces it):

```tsx
import type { Metadata } from "next";
import { requireAdmin } from "@/server/auth";

export const metadata: Metadata = { title: "Profile" };

// Placeholder until the profile editor lands in the next task.
export default async function ProfilePage() {
  await requireAdmin();
  return <h1 className="text-title text-ink">Profile</h1>;
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm test:e2e`
Expected: `40 passed` (`public` 35, then `admin` 5). The log shows one `[WebServer] … WARN [Better Auth]: Invalid password` from the wrong-password test. Afterwards `ss -ltn | grep ':3100 '` prints nothing.

Run: `pnpm build`
Expected: the route table now also lists `├ ◐ /admin`, `├ ◐ /admin/login`, `├ ◐ /admin/profile`.

Run: `pnpm typecheck`
Expected: `✓ Types generated successfully`, exit 0.

Run: `rtk proxy pnpm lint`
Expected: `Checked 94 files in <n>ms. No fixes applied.`

Run: `pnpm test`
Expected: `Test Files  8 passed (8)`, `Tests  67 passed (67)`.

- [ ] **Step 8: Commit**

```bash
/usr/bin/git add src tests
/usr/bin/git commit -m "feat(admin): gate /admin behind owner session"
```

---

### Task 7: The admin action pipeline and the Profile editor (M2 acceptance)

**Owner:** backend-engineer (server actions, pipeline, tests) — the form components in `src/components/admin/` are plain server-rendered markup plus one small client wrapper; a frontend-engineer can take them if the Overseer splits the task.

**Files:**
- Create: `src/server/admin/action-result.ts`, `src/server/admin/form-data.ts`, `src/server/admin/run-action.ts`, `src/server/admin/schemas/fields.ts`, `src/server/admin/schemas/profile.ts`, `src/server/actions/profile.ts`, `src/server/queries/admin/by-locale.ts`, `src/server/queries/admin/profile.ts`, `src/server/queries/admin/media.ts`, `src/components/admin/ActionForm.tsx`, `src/components/admin/fields.tsx`, `tests/unit/form-data.test.ts`, `tests/db/form.ts`, `tests/db/action-mocks.ts`, `tests/db/admin-profile.test.ts`, `tests/db/admin-guard.test.ts`, `tests/e2e/admin-profile.spec.ts`
- Modify: `src/app/admin/(panel)/profile/page.tsx`

**Interfaces:**
- Consumes: `getAdminSession`, `requireAdmin`, `AdminSession` (Task 5); `getDb`, `CV_TAG` (Task 3); schema (Task 1); `seedContent`, `loadCvRecords`, `resolveCv` (Task 2).
- Produces:
  - `type ActionResult = { status: "idle" } | { status: "ok"; message } | { status: "error"; code: 400 | 401 | 404 | 409; message; fieldErrors?: Record<string, string[]> }`, `IDLE`, and `type AdminFormAction = (previous: ActionResult, formData: FormData) => Promise<ActionResult>` from `@/server/admin/action-result`. **Every content action has the `AdminFormAction` signature**, so it works with `useActionState` and with the guard test.
  - `formToObject(formData): Record<string, unknown>` from `@/server/admin/form-data`: dotted names nest (`en.headline`), repeated keys become arrays, `$ACTION*` fields and `__proto__` / `prototype` / `constructor` path segments are dropped.
  - `runAdminAction(formData, schema, run)` from `@/server/admin/run-action`, where `run(input, { db, session, audit })` returns `{ status: "ok"; message; redirectTo? }` or an error result. It returns `UNAUTHORIZED` (401) without a session, 400 with `fieldErrors` keyed by input name, runs `run` and its `audit()` rows in one transaction, maps Postgres `23505` → 409 `Something with this slug already exists.` and `23503` → 409 `This change refers to something that no longer exists, or is still in use.`, then on success calls `updateTag(CV_TAG)` and `redirect(redirectTo)` if given. Also exports `UNAUTHORIZED`, `notFound(message)`, `type ActionContext`.
  - Field schemas in `@/server/admin/schemas/fields` (`text`, `required`, `checkbox`, `optionalUrl`, `optionalMediaId`, `yearMonth`, `lines`, `stringList`, `slug`, `idInput`, `slugInput`) and `profileInput` in `…/schemas/profile`. English text is required, Romanian may be blank.
  - `saveProfile: AdminFormAction` in `@/server/actions/profile`.
  - Admin reads (uncached): `getProfileForAdmin(db)`, `listMediaForAdmin(db)`, `mediaOptions(db, kind)`, `byLocale(rows, locale)`.
  - Components: `<ActionForm action submitLabel className?>` (client; keeps typed values, message in `role="status"`, context for `<FieldError name id?>`), and in `@/components/admin/fields`: `TextField` (with optional `id` for repeated forms), `TranslatedField` (EN + RO side by side, labels `<Label> (EN)` / `<Label> (RO)`, "RO missing" badge), `MissingBadge`, `Checkbox`, `Select`, `FormSection`.
  - Test helpers: `form(values)` (`tests/db/form.ts`); `mocks`, `OWNER`, `setupActionDb()` and the module stubs `dbModule`, `authModule`, `cacheModule`, `navigationModule` (`tests/db/action-mocks.ts`), used as `vi.mock("@/server/db", () => import("./action-mocks").then((m) => m.dbModule))`.

- [ ] **Step 1: Write the failing unit and database tests**

`tests/unit/form-data.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formToObject } from "@/server/admin/form-data";

function form(entries: Array<[string, string]>): FormData {
  const data = new FormData();
  for (const [key, value] of entries) {
    data.append(key, value);
  }
  return data;
}

describe("formToObject", () => {
  it("nests dotted names into objects", () => {
    expect(
      formToObject(
        form([
          ["location", "Cluj-Napoca"],
          ["en.headline", "Hello"],
          ["ro.headline", "Salut"],
        ]),
      ),
    ).toEqual({
      location: "Cluj-Napoca",
      en: { headline: "Hello" },
      ro: { headline: "Salut" },
    });
  });

  it("turns repeated keys into arrays", () => {
    expect(
      formToObject(
        form([
          ["skills", "nextjs"],
          ["skills", "postgres"],
        ]),
      ),
    ).toEqual({ skills: ["nextjs", "postgres"] });
  });

  it("drops Next's internal action fields", () => {
    expect(
      formToObject(
        form([
          ["$ACTION_ID_abc", ""],
          ["slug", "x"],
        ]),
      ),
    ).toEqual({ slug: "x" });
  });

  it("cannot pollute Object.prototype through crafted field names", () => {
    const result = formToObject(
      form([
        ["__proto__.polluted", "yes"],
        ["en.__proto__.polluted", "yes"],
        ["constructor.prototype.polluted", "yes"],
      ]),
    );

    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(result).toEqual({});
  });
});
```

`tests/db/form.ts`:

```ts
/** FormData from a flat record; array values become repeated keys. */
export function form(
  values: Record<string, string | string[] | File>,
): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      data.append(key, item);
    }
  }
  return data;
}
```

`tests/db/action-mocks.ts`:

```ts
import { vi } from "vitest";
import type { AdminSession } from "@/server/auth/read-session";
import { user } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { createTestDb } from "./test-db";

// Shared state behind the vi.mock factories in the admin action tests:
//   vi.mock("@/server/db", () => import("./action-mocks").then((m) => m.dbModule));
// Server actions then run against PGlite, a controllable session, a spy for
// updateTag and a redirect that throws like Next's does.

export const OWNER: AdminSession = {
  userId: "owner",
  email: "owner@example.com",
  name: "Owner",
};

export const mocks = {
  db: undefined as unknown as Db,
  session: null as AdminSession | null,
  updateTag: vi.fn(),
};

export const dbModule = { getDb: () => mocks.db };
export const authModule = { getAdminSession: async () => mocks.session };
export const cacheModule = { updateTag: mocks.updateTag };
export const navigationModule = {
  redirect: (url: string): never => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
};

/** Fresh PGlite with the owner user row (audit_log.user_id references it). */
export async function setupActionDb(): Promise<() => Promise<void>> {
  const { db, close } = await createTestDb();
  mocks.db = db;
  await db.insert(user).values({
    id: OWNER.userId,
    name: OWNER.name,
    email: OWNER.email,
    emailVerified: true,
  });
  return close;
}
```

`tests/db/admin-profile.test.ts`:

```ts
import { count, eq } from "drizzle-orm";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { fixtures } from "@/content/fixtures";
import { resolveCv } from "@/content/resolve-cv";
import { saveProfile } from "@/server/actions/profile";
import { IDLE } from "@/server/admin/action-result";
import { auditLog } from "@/server/db/schema";
import { seedContent } from "@/server/db/seed";
import { loadCvRecords } from "@/server/queries/cv";
import { mocks, OWNER, setupActionDb } from "./action-mocks";
import { form } from "./form";

vi.mock("@/server/db", () => import("./action-mocks").then((m) => m.dbModule));
vi.mock("@/server/auth", () =>
  import("./action-mocks").then((m) => m.authModule),
);
vi.mock("next/cache", () =>
  import("./action-mocks").then((m) => m.cacheModule),
);

let close: () => Promise<void>;

beforeAll(async () => {
  close = await setupActionDb();
});

afterAll(async () => {
  await close();
});

beforeEach(async () => {
  await seedContent(mocks.db, { reset: true });
  mocks.session = OWNER;
  mocks.updateTag.mockClear();
});

/** The fixture profile as the admin form would post it. */
function profileForm(overrides: Record<string, string> = {}): FormData {
  const { en, ro } = fixtures.profile.i18n;
  return form({
    emailPublic: fixtures.profile.emailPublic,
    location: fixtures.profile.location,
    countryCode: fixtures.profile.countryCode,
    yearsExp: String(fixtures.profile.yearsExp),
    available: "on",
    github: "https://example.com/alex-marin/github",
    linkedin: "https://example.com/alex-marin/linkedin",
    avatarMediaId: "",
    "en.fullName": en.fullName,
    "en.headline": en.headline,
    "en.summary": en.summary,
    "en.seoTitle": en.seoTitle,
    "en.seoDescription": en.seoDescription,
    "en.cvPdfMediaId": "",
    "ro.fullName": ro?.fullName ?? "",
    "ro.headline": ro?.headline ?? "",
    "ro.summary": ro?.summary ?? "",
    "ro.seoTitle": ro?.seoTitle ?? "",
    "ro.seoDescription": ro?.seoDescription ?? "",
    "ro.cvPdfMediaId": "",
    ...overrides,
  });
}

async function auditCount(): Promise<number> {
  const [{ value }] = await mocks.db.select({ value: count() }).from(auditLog);
  return value;
}

describe("saveProfile", () => {
  it("returns 401 and writes nothing without an owner session", async () => {
    mocks.session = null;

    const result = await saveProfile(
      IDLE,
      profileForm({ "ro.headline": "Titlu nou" }),
    );

    expect(result).toMatchObject({ status: "error", code: 401 });
    const cv = resolveCv(await loadCvRecords(mocks.db), "ro");
    expect(cv.profile.headline.value).not.toBe("Titlu nou");
    expect(mocks.updateTag).not.toHaveBeenCalled();
  });

  it("saves the Romanian headline, audits it and expires the CV cache", async () => {
    const before = await auditCount();

    const result = await saveProfile(
      IDLE,
      profileForm({ "ro.headline": "Titlu nou din admin" }),
    );

    expect(result).toEqual({ status: "ok", message: "Profile saved." });
    const cv = resolveCv(await loadCvRecords(mocks.db), "ro");
    expect(cv.profile.headline).toEqual({
      value: "Titlu nou din admin",
      lang: "ro",
    });
    expect(mocks.updateTag).toHaveBeenCalledWith("cv");
    expect(await auditCount()).toBe(before + 1);
    const [entry] = await mocks.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.entity, "profile"));
    expect(entry).toMatchObject({ userId: "owner", action: "update" });
  });

  it("accepts a blank Romanian field and falls back to English on /ro", async () => {
    await saveProfile(IDLE, profileForm({ "ro.headline": "  " }));

    const cv = resolveCv(await loadCvRecords(mocks.db), "ro");
    expect(cv.profile.headline).toEqual({
      value: fixtures.profile.i18n.en.headline,
      lang: "en",
    });
  });

  it("requires every English field", async () => {
    const result = await saveProfile(IDLE, profileForm({ "en.headline": "" }));

    expect(result).toMatchObject({
      status: "error",
      code: 400,
      fieldErrors: { "en.headline": ["Required"] },
    });
    expect(mocks.updateTag).not.toHaveBeenCalled();
  });

  it("rejects javascript: URLs for social links", async () => {
    const result = await saveProfile(
      IDLE,
      profileForm({ github: "javascript:alert(1)" }),
    );

    expect(result).toMatchObject({
      status: "error",
      code: 400,
      fieldErrors: { github: ["Use an http(s) URL"] },
    });
  });

  it("drops a social link that is left blank", async () => {
    await saveProfile(IDLE, profileForm({ linkedin: "" }));

    const cv = resolveCv(await loadCvRecords(mocks.db), "en");
    expect(cv.profile.socials).toEqual([
      { network: "github", url: "https://example.com/alex-marin/github" },
    ]);
  });
});
```

`tests/db/admin-guard.test.ts` (spec §7: "actions 401 without session"). It finds the actions with Vite's `import.meta.glob`, so every action module added in later tasks is covered without editing this file. `@/server/media` is stubbed ahead of Task 11 because that module validates env on import:

```ts
/// <reference types="vite/client" />
import { count } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { type AdminFormAction, IDLE } from "@/server/admin/action-result";
import { auditLog } from "@/server/db/schema";
import { seedContent } from "@/server/db/seed";
import { mocks, setupActionDb } from "./action-mocks";

vi.mock("@/server/db", () => import("./action-mocks").then((m) => m.dbModule));
vi.mock("@/server/auth", () =>
  import("./action-mocks").then((m) => m.authModule),
);
vi.mock("next/cache", () =>
  import("./action-mocks").then((m) => m.cacheModule),
);
vi.mock("next/navigation", () =>
  import("./action-mocks").then((m) => m.navigationModule),
);
vi.mock("@/server/media", () => ({ getMediaStore: () => null }));

// Every export of every module in src/server/actions/ except auth.ts (sign-in
// and sign-out run before there is a session). A module or action added later
// is covered without touching this test.
const modules = import.meta.glob(
  ["../../src/server/actions/*.ts", "!../../src/server/actions/auth.ts"],
  { eager: true },
) as Record<string, Record<string, AdminFormAction>>;
const ACTIONS = Object.values(modules).flatMap((mod) => Object.entries(mod));

let close: () => Promise<void>;

beforeAll(async () => {
  close = await setupActionDb();
  await seedContent(mocks.db);
  mocks.session = null;
});

afterAll(async () => {
  await close();
});

describe("admin server actions without a session", () => {
  it("finds the actions", () => {
    expect(ACTIONS.map(([name]) => name)).toContain("saveProfile");
  });

  it.each(ACTIONS)(
    "%s returns 401 and changes nothing",
    async (_name, action) => {
      const data = new FormData();
      data.set("id", "ardea-health");
      data.set("slug", "ledger-lens");

      const result = await action(IDLE, data);

      expect(result).toEqual({
        status: "error",
        code: 401,
        message: "Your session has ended. Sign in again.",
      });
      const [{ value }] = await mocks.db
        .select({ value: count() })
        .from(auditLog);
      expect(value).toBe(0);
      expect(mocks.updateTag).not.toHaveBeenCalled();
    },
  );
});
```

- [ ] **Step 2: Write the failing e2e test `tests/e2e/admin-profile.spec.ts`**

```ts
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { signInAsOwner } from "./admin-login";

const SEEDED_RO_HEADLINE =
  "Dezvoltator fullstack care construiește produse web rapide și accesibile, de la baza de date la pixel.";
const SEEDED_EN_HEADLINE =
  "Fullstack developer building fast, accessible web products from database to pixel.";

test.beforeEach(async ({ page }) => {
  await signInAsOwner(page);
});

test("a Romanian headline edited in the admin shows on /ro", async ({
  page,
}) => {
  const headline = page.getByLabel("Headline (RO)");
  await expect(headline).toHaveValue(SEEDED_RO_HEADLINE);

  await headline.fill("Construiesc produse web rapide, de la bază la pixel.");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("status")).toHaveText("Profile saved.");
  await expect(headline).toHaveValue(
    "Construiesc produse web rapide, de la bază la pixel.",
  );

  await page.goto("/ro");
  await expect(
    page.getByText("Construiesc produse web rapide, de la bază la pixel."),
  ).toBeVisible();

  await page.goto("/admin/profile");
  await page.getByLabel("Headline (RO)").fill(SEEDED_RO_HEADLINE);
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("status")).toHaveText("Profile saved.");
});

test("a blank Romanian headline falls back to English on /ro", async ({
  page,
}) => {
  await page.getByLabel("Headline (RO)").fill("");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("status")).toHaveText("Profile saved.");
  await expect(
    page.getByRole("group", { name: "Headline RO missing" }),
  ).toBeVisible();

  await page.goto("/ro");
  const fallback = page.getByText(SEEDED_EN_HEADLINE);
  await expect(fallback).toBeVisible();
  await expect(fallback).toHaveAttribute("lang", "en");

  await page.goto("/admin/profile");
  await page.getByLabel("Headline (RO)").fill(SEEDED_RO_HEADLINE);
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("status")).toHaveText("Profile saved.");
});

test("shows field errors and keeps the typed values", async ({ page }) => {
  await page.getByLabel("GitHub URL").fill("javascript:alert(1)");
  await page.getByRole("button", { name: "Save profile" }).click();

  await expect(page.getByRole("status")).toHaveText(
    "Check the highlighted fields.",
  );
  await expect(page.getByText("Use an http(s) URL")).toBeVisible();
  await expect(page.getByLabel("GitHub URL")).toHaveValue(
    "javascript:alert(1)",
  );
});

test("the profile page has no axe violations", async ({ page }) => {
  const { violations } = await new AxeBuilder({ page }).analyze();

  expect(violations.map((v) => v.id)).toEqual([]);
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm test`
Expected: FAIL with

```
Error: Cannot find package '@/server/admin/action-result' imported from <worktree>/tests/db/admin-guard.test.ts
Error: Cannot find package '@/server/actions/profile' imported from <worktree>/tests/db/admin-profile.test.ts
Error: Cannot find package '@/server/admin/form-data' imported from <worktree>/tests/unit/form-data.test.ts
 Test Files  3 failed | 8 passed (11)
      Tests  67 passed (67)
```

Run: `pnpm exec playwright test tests/e2e/admin-profile.spec.ts --project admin --no-deps`
Expected: `3 failed`, `1 passed` (the placeholder page has no axe violations): the others wait for `getByLabel('Headline (RO)')`.

- [ ] **Step 4: Create the action result type and the FormData parser**

`src/server/admin/action-result.ts`:

```ts
/**
 * What every admin server action returns. Errors carry an HTTP-like code so
 * callers (and tests) can tell "not signed in" (401) from bad input (400),
 * a missing record (404) and a conflict (409).
 */
export type ActionResult =
  | { status: "idle" }
  | { status: "ok"; message: string }
  | {
      status: "error";
      code: 400 | 401 | 404 | 409;
      message: string;
      /** Keyed by form field name, e.g. `en.headline`. */
      fieldErrors?: Record<string, string[]>;
    };

export const IDLE: ActionResult = { status: "idle" };

/** Signature shared by every admin action, so each works with useActionState. */
export type AdminFormAction = (
  previous: ActionResult,
  formData: FormData,
) => Promise<ActionResult>;
```

`src/server/admin/form-data.ts`:

```ts
const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);

/**
 * Turns FormData into a nested plain object for zod: `en.headline` becomes
 * `{ en: { headline } }` and repeated keys (checkbox groups) become arrays.
 * Next's internal `$ACTION_*` fields and prototype-polluting keys are dropped.
 */
export function formToObject(formData: FormData): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const key of new Set(formData.keys())) {
    const path = key.split(".");
    if (key.startsWith("$ACTION") || path.some((p) => FORBIDDEN_KEYS.has(p))) {
      continue;
    }
    const values = formData.getAll(key);
    let node = result;
    for (const part of path.slice(0, -1)) {
      const next = node[part];
      if (typeof next !== "object" || next === null || Array.isArray(next)) {
        node[part] = {};
      }
      node = node[part] as Record<string, unknown>;
    }
    node[path[path.length - 1]] = values.length > 1 ? values : values[0];
  }

  return result;
}
```

- [ ] **Step 5: Create the input schemas**

`src/server/admin/schemas/fields.ts`:

```ts
import { z } from "zod";

// Field schemas shared by the admin forms. English text is required, Romanian
// may be left blank (blank = not translated = English fallback on /ro).

export const text = (max: number) => z.string().trim().max(max);
export const required = (max: number) => text(max).min(1, "Required");

/** An unchecked checkbox is absent from FormData. */
export const checkbox = z.preprocess((value) => value === "on", z.boolean());

/** "" means "none"; anything else must be an http(s) URL. */
export const optionalUrl = z
  .union([
    z.literal(""),
    z.url({ protocol: /^https?$/, message: "Use an http(s) URL" }),
  ])
  .optional()
  .transform((value) => value || null);

/** A media library pick: "" means "none". */
export const optionalMediaId = z
  .union([z.literal(""), z.uuid()])
  .optional()
  .transform((value) => value || null);

export const yearMonth = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use YYYY-MM");

/** Textarea with one entry per line; blank lines are dropped. */
export const lines = z
  .string()
  .optional()
  .transform((value) =>
    (value ?? "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0),
  )
  .pipe(z.array(z.string().max(300)).max(12));

/** A checkbox group: absent = [], one value = [value]. */
export const stringList = z.preprocess(
  (value) =>
    value === undefined ? [] : Array.isArray(value) ? value : [value],
  z.array(z.string()),
);

export const slug = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, digits and dashes")
  .max(60);

export const idInput = z.object({ id: z.string().min(1).max(100) });
export const slugInput = z.object({ slug });
```

`src/server/admin/schemas/profile.ts`:

```ts
import { z } from "zod";
import {
  checkbox,
  optionalMediaId,
  optionalUrl,
  required,
  text,
} from "./fields";

export const profileInput = z.object({
  emailPublic: z.email("Enter an email address"),
  location: required(80),
  countryCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "Two-letter country code"),
  yearsExp: z.coerce.number().int().min(0).max(80),
  available: checkbox,
  github: optionalUrl,
  linkedin: optionalUrl,
  avatarMediaId: optionalMediaId,
  en: z.object({
    fullName: required(120),
    headline: required(200),
    summary: required(2000),
    seoTitle: required(70),
    seoDescription: required(200),
    cvPdfMediaId: optionalMediaId,
  }),
  ro: z.object({
    fullName: text(120),
    headline: text(200),
    summary: text(2000),
    seoTitle: text(70),
    seoDescription: text(200),
    cvPdfMediaId: optionalMediaId,
  }),
});
export type ProfileInput = z.infer<typeof profileInput>;
```

- [ ] **Step 6: Create the pipeline `src/server/admin/run-action.ts`**

```ts
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";
import { type AdminSession, getAdminSession } from "@/server/auth";
import { CV_TAG } from "@/server/cache-tags";
import { getDb } from "@/server/db";
import { auditLog } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import type { ActionResult } from "./action-result";
import { formToObject } from "./form-data";

type ActionError = Extract<ActionResult, { status: "error" }>;

export type ActionContext = {
  /** The transaction the whole action runs in. */
  db: Db;
  session: AdminSession;
  audit: (entry: {
    action: "create" | "update" | "delete" | "reorder";
    entity: string;
    entityId?: string;
    diff?: Record<string, unknown>;
  }) => Promise<void>;
};

export type ActionOutcome =
  | { status: "ok"; message: string; redirectTo?: string }
  | ActionError;

export const UNAUTHORIZED: ActionError = {
  status: "error",
  code: 401,
  message: "Your session has ended. Sign in again.",
};

export function notFound(message: string): ActionError {
  return { status: "error", code: 404, message };
}

/**
 * The one entry point for admin mutations:
 * 1. re-checks the owner session (never trusts the proxy): 401 without it;
 * 2. validates the form with zod: 400 with per-field messages;
 * 3. runs the mutation and its audit row in one transaction;
 * 4. on success expires the public CV cache (`updateTag`), then redirects or
 *    returns a message.
 */
export async function runAdminAction<S extends z.ZodType>(
  formData: FormData,
  schema: S,
  run: (input: z.output<S>, ctx: ActionContext) => Promise<ActionOutcome>,
): Promise<ActionResult> {
  const session = await getAdminSession();
  if (!session) {
    return UNAUTHORIZED;
  }

  const parsed = schema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return {
      status: "error",
      code: 400,
      message: "Check the highlighted fields.",
      fieldErrors: fieldErrors(parsed.error.issues),
    };
  }

  let outcome: ActionOutcome;
  try {
    outcome = await getDb().transaction(async (tx) =>
      run(parsed.data, {
        db: tx,
        session,
        audit: async (entry) => {
          await tx
            .insert(auditLog)
            .values({ userId: session.userId, ...entry });
        },
      }),
    );
  } catch (error) {
    const conflict = conflictMessage(error);
    if (conflict) {
      return { status: "error", code: 409, message: conflict };
    }
    throw error;
  }

  if (outcome.status === "error") {
    return outcome;
  }
  updateTag(CV_TAG);
  if (outcome.redirectTo) {
    redirect(outcome.redirectTo);
  }
  return { status: "ok", message: outcome.message };
}

function fieldErrors(issues: z.core.$ZodIssue[]): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = issue.path.join(".") || "form";
    result[key] = [...(result[key] ?? []), issue.message];
  }
  return result;
}

/** Postgres constraint violations (drizzle wraps the driver error in `cause`). */
function conflictMessage(error: unknown): string | null {
  const code = (error as { cause?: { code?: string } }).cause?.code;
  if (code === "23505") {
    return "Something with this slug already exists.";
  }
  if (code === "23503") {
    return "This change refers to something that no longer exists, or is still in use.";
  }
  return null;
}
```

- [ ] **Step 7: Create the profile action `src/server/actions/profile.ts`**

```ts
"use server";

import { eq } from "drizzle-orm";
import type { SocialLink } from "@/content/types";
import type { ActionResult } from "@/server/admin/action-result";
import { notFound, runAdminAction } from "@/server/admin/run-action";
import { profileInput } from "@/server/admin/schemas/profile";
import { profile, profileI18n } from "@/server/db/schema";

export async function saveProfile(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(
    formData,
    profileInput,
    async (input, { db, audit }) => {
      const socials: SocialLink[] = [];
      if (input.github) {
        socials.push({ network: "github", url: input.github });
      }
      if (input.linkedin) {
        socials.push({ network: "linkedin", url: input.linkedin });
      }

      const updated = await db
        .update(profile)
        .set({
          emailPublic: input.emailPublic,
          location: input.location,
          countryCode: input.countryCode,
          yearsExp: input.yearsExp,
          available: input.available,
          socials,
          avatarMediaId: input.avatarMediaId,
        })
        .where(eq(profile.id, 1))
        .returning({ id: profile.id });
      if (updated.length === 0) {
        return notFound("The profile is missing. Run `pnpm db:seed`.");
      }

      for (const locale of ["en", "ro"] as const) {
        const t = input[locale];
        const row = {
          fullName: t.fullName,
          headline: t.headline,
          summaryMd: t.summary,
          seoTitle: t.seoTitle,
          seoDescription: t.seoDescription,
          cvPdfMediaId: t.cvPdfMediaId,
        };
        await db
          .insert(profileI18n)
          .values({ profileId: 1, locale, ...row })
          .onConflictDoUpdate({
            target: [profileI18n.profileId, profileI18n.locale],
            set: row,
          });
      }

      await audit({
        action: "update",
        entity: "profile",
        entityId: "1",
        diff: input,
      });
      return { status: "ok", message: "Profile saved." };
    },
  );
}
```

- [ ] **Step 8: Run the unit and database tests to verify they pass**

Run: `pnpm test`
Expected: `Test Files  11 passed (11)`, `Tests  79 passed (79)` (the guard test reports `saveProfile returns 401 and changes nothing`).

- [ ] **Step 9: Create the admin reads**

`src/server/queries/admin/by-locale.ts`:

```ts
import type { Locale } from "@/i18n/routing";

/** The `<entity>_i18n` row for one locale, if it exists. */
export function byLocale<Row extends { locale: Locale }>(
  rows: Row[],
  locale: Locale,
): Row | undefined {
  return rows.find((row) => row.locale === locale);
}
```

`src/server/queries/admin/profile.ts`:

```ts
import { profile, profileI18n } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { byLocale } from "./by-locale";

// Admin reads are uncached; callers must have run requireAdmin().

export async function getProfileForAdmin(db: Db) {
  const [row] = await db.select().from(profile);
  if (!row) {
    return null;
  }
  const rows = await db.select().from(profileI18n);
  return { ...row, en: byLocale(rows, "en"), ro: byLocale(rows, "ro") };
}
```

`src/server/queries/admin/media.ts` (the profile form already offers avatar and CV PDF pickers; they list nothing until Task 11):

```ts
import { desc } from "drizzle-orm";
import { media } from "@/server/db/schema";
import type { Db } from "@/server/db/types";

export async function listMediaForAdmin(db: Db) {
  return db.select().from(media).orderBy(desc(media.createdAt));
}

/** `<select>` options for picking an uploaded file of one kind. */
export async function mediaOptions(db: Db, kind: "image" | "document") {
  const items = await listMediaForAdmin(db);
  return items
    .filter((item) => item.kind === kind)
    .map((item) => ({ value: item.id, label: item.altEn || item.pathname }));
}
```

- [ ] **Step 10: Create the form components**

`src/components/admin/ActionForm.tsx`:

```tsx
"use client";

import {
  createContext,
  type ReactNode,
  startTransition,
  useActionState,
  useContext,
} from "react";
import {
  type ActionResult,
  type AdminFormAction,
  IDLE,
} from "@/server/admin/action-result";
import { button } from "./styles";

const FormState = createContext<ActionResult>(IDLE);

/**
 * A form bound to one admin server action. Submitting keeps what was typed
 * (no automatic React form reset), shows the action's message in a live
 * region and exposes per-field errors to <FieldError>.
 */
export function ActionForm({
  action,
  submitLabel,
  children,
  className = "flex flex-col gap-6",
}: {
  action: AdminFormAction;
  submitLabel: string;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, IDLE);

  return (
    <FormState value={state}>
      <form
        action={formAction}
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          startTransition(() => formAction(data));
        }}
        className={className}
      >
        {children}
        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" disabled={pending} className={button}>
            {pending ? "Saving…" : submitLabel}
          </button>
          <p role="status" className="text-sm text-ink-muted">
            {state.status === "idle" ? "" : state.message}
          </p>
        </div>
      </form>
    </FormState>
  );
}

/**
 * The validation message for one field of the surrounding <ActionForm>.
 * Always rendered (empty when valid) so `aria-describedby` never dangles.
 */
export function FieldError({
  name,
  id = `${name}-error`,
}: {
  name: string;
  id?: string;
}) {
  const state = useContext(FormState);
  const errors = state.status === "error" ? state.fieldErrors?.[name] : null;
  return (
    <span id={id} className="mt-1 block text-sm text-signal">
      {errors?.join(" ")}
    </span>
  );
}
```

`src/components/admin/fields.tsx`:

```tsx
import type { ReactNode } from "react";
import { FieldError } from "./ActionForm";
import { field, label as labelClass } from "./styles";

type InputProps = {
  name: string;
  /** Defaults to `name`; set it when the same form repeats on one page. */
  id?: string;
  label: string;
  defaultValue?: string | number | null;
  type?: "text" | "email" | "url" | "number" | "month";
  required?: boolean;
  multiline?: boolean;
  rows?: number;
  hint?: string;
};

/** Labelled input or textarea with its validation message. */
export function TextField({
  name,
  id = name,
  label,
  defaultValue,
  type = "text",
  required,
  multiline,
  rows = 4,
  hint,
}: InputProps) {
  const common = {
    id,
    name,
    required,
    defaultValue: defaultValue ?? "",
    "aria-describedby": `${id}-error`,
    className: field,
  };
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {multiline ? (
        <textarea rows={rows} {...common} />
      ) : (
        <input type={type} {...common} />
      )}
      {hint ? (
        <span className="mt-1 block text-sm text-ink-subtle">{hint}</span>
      ) : null}
      <FieldError name={name} id={`${id}-error`} />
    </div>
  );
}

/**
 * EN and RO inputs side by side (spec §5). English is required; a blank
 * Romanian value falls back to English on /ro and is flagged here.
 */
export function TranslatedField({
  name,
  label,
  en,
  ro,
  multiline,
  rows,
  hint,
}: {
  name: string;
  label: string;
  en: string;
  ro: string;
  multiline?: boolean;
  rows?: number;
  hint?: string;
}) {
  const missing = en.trim() !== "" && ro.trim() === "";
  return (
    <fieldset className="grid gap-4 md:grid-cols-2">
      <legend className="mb-2 flex items-center gap-3 text-ink">
        {label}
        {missing ? <MissingBadge /> : null}
      </legend>
      <TextField
        name={`en.${name}`}
        label={`${label} (EN)`}
        defaultValue={en}
        required
        multiline={multiline}
        rows={rows}
        hint={hint}
      />
      <TextField
        name={`ro.${name}`}
        label={`${label} (RO)`}
        defaultValue={ro}
        multiline={multiline}
        rows={rows}
        hint={hint}
      />
    </fieldset>
  );
}

export function MissingBadge() {
  return (
    <span className="rounded-full px-2 py-0.5 font-mono text-label uppercase text-ink-muted ring-1 ring-line-strong">
      RO missing
    </span>
  );
}

export function Checkbox({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-ink">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} />
      {label}
    </label>
  );
}

export function Select({
  name,
  label,
  defaultValue,
  options,
}: {
  name: string;
  label: string;
  defaultValue: string;
  options: ReadonlyArray<{ value: string; label: string }>;
}) {
  return (
    <div>
      <label htmlFor={name} className={labelClass}>
        {label}
      </label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue}
        className={field}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <FieldError name={name} />
    </div>
  );
}

export function FormSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-5 rounded-panel bg-surface p-6 ring-1 ring-line">
      <h2 className="text-heading text-ink">{title}</h2>
      {children}
    </section>
  );
}
```

- [ ] **Step 11: Build the profile page — replace `src/app/admin/(panel)/profile/page.tsx`**

```tsx
import type { Metadata } from "next";
import { ActionForm } from "@/components/admin/ActionForm";
import {
  Checkbox,
  FormSection,
  Select,
  TextField,
  TranslatedField,
} from "@/components/admin/fields";
import { saveProfile } from "@/server/actions/profile";
import { requireAdmin } from "@/server/auth";
import { getDb } from "@/server/db";
import { mediaOptions } from "@/server/queries/admin/media";
import { getProfileForAdmin } from "@/server/queries/admin/profile";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  await requireAdmin();
  const db = getDb();
  const [data, imageOptions, documentOptions] = await Promise.all([
    getProfileForAdmin(db),
    mediaOptions(db, "image"),
    mediaOptions(db, "document"),
  ]);
  if (!data) {
    return <p>No profile yet. Run `pnpm db:seed`.</p>;
  }
  const social = (network: "github" | "linkedin") =>
    data.socials.find((link) => link.network === network)?.url ?? "";
  const images = [{ value: "", label: "None" }, ...imageOptions];
  const documents = [{ value: "", label: "None" }, ...documentOptions];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-title text-ink">Profile</h1>
      <ActionForm action={saveProfile} submitLabel="Save profile">
        <FormSection title="Contact">
          <div className="grid gap-4 md:grid-cols-2">
            <TextField
              name="emailPublic"
              label="Public email"
              type="email"
              defaultValue={data.emailPublic}
              required
            />
            <TextField
              name="location"
              label="Location"
              defaultValue={data.location}
              required
            />
            <TextField
              name="countryCode"
              label="Country code"
              defaultValue={data.countryCode}
              required
            />
            <TextField
              name="yearsExp"
              label="Years of experience"
              type="number"
              defaultValue={data.yearsExp}
              required
            />
            <TextField
              name="github"
              label="GitHub URL"
              type="url"
              defaultValue={social("github")}
            />
            <TextField
              name="linkedin"
              label="LinkedIn URL"
              type="url"
              defaultValue={social("linkedin")}
            />
            <Select
              name="avatarMediaId"
              label="Avatar"
              defaultValue={data.avatarMediaId ?? ""}
              options={images}
            />
          </div>
          <Checkbox
            name="available"
            label="Open to new projects"
            defaultChecked={data.available}
          />
        </FormSection>
        <FormSection title="Text">
          <TranslatedField
            name="fullName"
            label="Full name"
            en={data.en?.fullName ?? ""}
            ro={data.ro?.fullName ?? ""}
          />
          <TranslatedField
            name="headline"
            label="Headline"
            en={data.en?.headline ?? ""}
            ro={data.ro?.headline ?? ""}
            multiline
            rows={2}
          />
          <TranslatedField
            name="summary"
            label="Summary"
            en={data.en?.summaryMd ?? ""}
            ro={data.ro?.summaryMd ?? ""}
            multiline
            rows={5}
          />
          <TranslatedField
            name="seoTitle"
            label="SEO title"
            en={data.en?.seoTitle ?? ""}
            ro={data.ro?.seoTitle ?? ""}
          />
          <TranslatedField
            name="seoDescription"
            label="SEO description"
            en={data.en?.seoDescription ?? ""}
            ro={data.ro?.seoDescription ?? ""}
            multiline
            rows={2}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <Select
              name="en.cvPdfMediaId"
              label="CV PDF (EN)"
              defaultValue={data.en?.cvPdfMediaId ?? ""}
              options={documents}
            />
            <Select
              name="ro.cvPdfMediaId"
              label="CV PDF (RO)"
              defaultValue={data.ro?.cvPdfMediaId ?? ""}
              options={documents}
            />
          </div>
        </FormSection>
      </ActionForm>
    </div>
  );
}
```

- [ ] **Step 12: Verify the acceptance flow**

Run: `pnpm test:e2e`
Expected: `44 passed`. This includes the two spec §7 acceptance tests `a Romanian headline edited in the admin shows on /ro` and `a blank Romanian headline falls back to English on /ro`.

Run: `pnpm typecheck`
Expected: `✓ Types generated successfully`, exit 0.

Run: `rtk proxy pnpm lint`
Expected: `Checked 111 files in <n>ms. No fixes applied.`

- [ ] **Step 13: Commit**

```bash
/usr/bin/git add src tests
/usr/bin/git commit -m "feat(admin): edit profile with en/ro side by side"
```

---

### Task 8: Experience editor with reorder

**Owner:** backend-engineer (full slice: action, reads, page)

**Files:**
- Create: `src/server/admin/schemas/experience.ts`, `src/server/actions/experience.ts`, `src/server/queries/admin/experience.ts`, `src/components/admin/ActionButton.tsx`, `src/components/admin/ExperienceFields.tsx`, `src/app/admin/(panel)/experience/page.tsx`, `src/app/admin/(panel)/experience/new/page.tsx`, `src/app/admin/(panel)/experience/[id]/page.tsx`, `tests/db/admin-experience.test.ts`, `tests/e2e/admin-experience.spec.ts`
- Modify: `src/content/localize.ts`, `tests/unit/content.test.ts`

**Interfaces:**
- Consumes: `runAdminAction`, `notFound`, `ActionContext`, `ActionResult`, field schemas, `idInput` (Task 7); `ActionForm`, `TextField`, `TranslatedField`, `Checkbox`, `Select`, `FormSection`, `MissingBadge` (Task 7); `byLocale` (Task 7).
- Produces:
  - `experienceInput` (end date ≥ start date, `"The end date is before the start date"` on `endDate`), `ExperienceInput`, `moveInput` in `@/server/admin/schemas/experience`.
  - Actions `createExperience` (new id = `crypto.randomUUID()`, appended at the end, redirects to `/admin/experience/<id>`), `updateExperience` (404 when gone), `deleteExperience` (redirects to the list), `moveExperience` (swaps `sort_order` with the neighbour; `Already at the edge.` at either end). Spec §5 says "drag reorder": this plan uses Move up / Move down buttons (see Deviations).
  - `listExperienceForAdmin(db)`.
  - `missingTranslation(en, ro, keys): boolean` in `@/content/localize` (the "RO missing" badge; same blank rule as the public fallback).
  - `<ActionButton action fields label confirmMessage?>`: a one-button form for delete and move, with an optional `window.confirm`.
  - `ExperienceFields`, `EMPTY_EXPERIENCE`, `type ExperienceDefaults`.

- [ ] **Step 1: Write the failing tests**

`tests/db/admin-experience.test.ts`:

```ts
import { eq } from "drizzle-orm";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { resolveCv } from "@/content/resolve-cv";
import {
  createExperience,
  deleteExperience,
  moveExperience,
  updateExperience,
} from "@/server/actions/experience";
import { IDLE } from "@/server/admin/action-result";
import { experience } from "@/server/db/schema";
import { seedContent } from "@/server/db/seed";
import { loadCvRecords } from "@/server/queries/cv";
import { mocks, OWNER, setupActionDb } from "./action-mocks";
import { form } from "./form";

vi.mock("@/server/db", () => import("./action-mocks").then((m) => m.dbModule));
vi.mock("@/server/auth", () =>
  import("./action-mocks").then((m) => m.authModule),
);
vi.mock("next/cache", () =>
  import("./action-mocks").then((m) => m.cacheModule),
);
vi.mock("next/navigation", () =>
  import("./action-mocks").then((m) => m.navigationModule),
);

let close: () => Promise<void>;

beforeAll(async () => {
  close = await setupActionDb();
});

afterAll(async () => {
  await close();
});

beforeEach(async () => {
  await seedContent(mocks.db, { reset: true });
  mocks.session = OWNER;
  mocks.updateTag.mockClear();
});

async function cv(locale: "en" | "ro" = "en") {
  return resolveCv(await loadCvRecords(mocks.db), locale);
}

const NEW_JOB = {
  company: "Nova Labs",
  url: "https://example.com/nova",
  startDate: "2016-02",
  endDate: "2017-05",
  employmentType: "contract",
  isPublished: "on",
  "en.roleTitle": "Web Developer",
  "en.description": "Built things.",
  "en.highlights": "First win\n\n  Second win  ",
  "ro.roleTitle": "",
  "ro.description": "",
  "ro.highlights": "",
};

describe("experience actions", () => {
  it("creates an entry at the end, then redirects to its edit page", async () => {
    await expect(createExperience(IDLE, form(NEW_JOB))).rejects.toThrow(
      /^NEXT_REDIRECT \/admin\/experience\/[0-9a-f-]{36}$/,
    );
    expect(mocks.updateTag).toHaveBeenCalledWith("cv");

    const jobs = (await cv()).experience;
    expect(jobs.at(-1)).toMatchObject({
      company: "Nova Labs",
      roleTitle: { value: "Web Developer", lang: "en" },
      highlights: { value: ["First win", "Second win"], lang: "en" },
    });
    expect((await cv("ro")).experience.at(-1)?.roleTitle.lang).toBe("en");
  });

  it("rejects an end date before the start date", async () => {
    const result = await createExperience(
      IDLE,
      form({ ...NEW_JOB, endDate: "2015-01" }),
    );

    expect(result).toMatchObject({
      status: "error",
      code: 400,
      fieldErrors: { endDate: ["The end date is before the start date"] },
    });
  });

  it("returns 404 when updating an entry that was deleted meanwhile", async () => {
    const result = await updateExperience(
      IDLE,
      form({ ...NEW_JOB, id: "gone" }),
    );

    expect(result).toMatchObject({ status: "error", code: 404 });
  });

  it("moves an entry up and down by swapping neighbours", async () => {
    await moveExperience(IDLE, form({ id: "ferrum-freight", direction: "up" }));
    expect((await cv()).experience.map((job) => job.id)).toEqual([
      "ferrum-freight",
      "ardea-health",
      "studio-meridian",
    ]);

    const result = await moveExperience(
      IDLE,
      form({ id: "ferrum-freight", direction: "up" }),
    );
    expect(result).toEqual({ status: "ok", message: "Already at the edge." });
  });

  it("deletes an entry with its translations", async () => {
    await expect(
      deleteExperience(IDLE, form({ id: "studio-meridian" })),
    ).rejects.toThrow("NEXT_REDIRECT /admin/experience");

    expect(
      await mocks.db
        .select()
        .from(experience)
        .where(eq(experience.id, "studio-meridian")),
    ).toEqual([]);
  });
});
```

In `tests/unit/content.test.ts`, replace the `@/content/localize` import with:

```ts
import { fallbackLang, localize, missingTranslation } from "@/content/localize";
```

and append at the end of the file:

```ts

describe("missingTranslation (admin RO badge)", () => {
  it("flags a field that is filled in English but blank in Romanian", () => {
    expect(
      missingTranslation(
        { title: "Ledger", tags: ["a"] },
        { title: "  ", tags: ["b"] },
        ["title", "tags"],
      ),
    ).toBe(true);
  });

  it("treats a missing Romanian row as untranslated", () => {
    expect(missingTranslation({ title: "Ledger" }, undefined, ["title"])).toBe(
      true,
    );
  });

  it("ignores fields that are blank in both languages", () => {
    expect(
      missingTranslation(
        { title: "Ledger", body: "" },
        { title: "Registru", body: "" },
        ["title", "body"],
      ),
    ).toBe(false);
  });
});
```

`tests/e2e/admin-experience.spec.ts`:

```ts
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { signInAsOwner } from "./admin-login";

test.beforeEach(async ({ page }) => {
  await signInAsOwner(page);
});

test("reordering experience changes the public timeline", async ({ page }) => {
  await page.goto("/admin/experience");
  await page.getByRole("button", { name: "Move Ferrum Freight up" }).click();
  // First in the list: the "up" button disappears once the action is done.
  await expect(
    page.getByRole("button", { name: "Move Ferrum Freight up" }),
  ).toHaveCount(0);

  await page.goto("/en");
  await expect(
    page.locator("#experience").getByRole("heading", { level: 3 }).first(),
  ).toHaveText("Fullstack Developer");

  await page.goto("/admin/experience");
  await page.getByRole("button", { name: "Move Ferrum Freight down" }).click();
  await expect(
    page.getByRole("button", { name: "Move Ardea Health up" }),
  ).toHaveCount(0);
});

const PATHS = [
  "/admin/experience",
  "/admin/experience/new",
  "/admin/experience/ardea-health",
];

for (const path of PATHS) {
  test(`${path} has no axe violations`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).analyze();

    expect(
      violations.map((v) => ({
        id: v.id,
        targets: v.nodes.map((node) => node.target.join(" ")),
      })),
    ).toEqual([]);
  });
}
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm test`
Expected: FAIL with

```
TypeError: missingTranslation is not a function
Error: Cannot find package '@/server/actions/experience' imported from <worktree>/tests/db/admin-experience.test.ts
 Test Files  2 failed | 10 passed (12)
      Tests  3 failed | 79 passed (82)
```

Run: `pnpm exec playwright test tests/e2e/admin-experience.spec.ts --project admin --no-deps`
Expected: `4 failed`: `/admin/experience` is a 404, so the reorder test waits for `getByRole('button', { name: 'Move Ferrum Freight up' })` and the axe tests report the bare 404 page.

- [ ] **Step 3: Add `missingTranslation` to `src/content/localize.ts`**

Append at the end of the file:

```ts

/**
 * True when some field is filled in English but blank in Romanian: the admin
 * shows a "RO missing" badge because /ro falls back to English there.
 */
export function missingTranslation<T extends Record<string, unknown>>(
  en: T | undefined,
  ro: T | undefined,
  keys: ReadonlyArray<keyof T>,
): boolean {
  return keys.some((key) => isFilled(en?.[key]) && !isFilled(ro?.[key]));
}
```

- [ ] **Step 4: Create the schema and the actions**

`src/server/admin/schemas/experience.ts`:

```ts
import { z } from "zod";
import {
  checkbox,
  lines,
  optionalUrl,
  required,
  text,
  yearMonth,
} from "./fields";

export const experienceInput = z
  .object({
    company: required(120),
    url: optionalUrl,
    startDate: yearMonth,
    endDate: z.union([z.literal(""), yearMonth]).transform((v) => v || null),
    employmentType: z.enum(["full_time", "part_time", "contract", "freelance"]),
    isPublished: checkbox,
    en: z.object({
      roleTitle: required(120),
      description: required(2000),
      highlights: lines,
    }),
    ro: z.object({
      roleTitle: text(120),
      description: text(2000),
      highlights: lines,
    }),
  })
  .refine((v) => v.endDate === null || v.endDate >= v.startDate, {
    path: ["endDate"],
    message: "The end date is before the start date",
  });
export type ExperienceInput = z.infer<typeof experienceInput>;

export const moveInput = z.object({
  id: z.string().min(1).max(100),
  direction: z.enum(["up", "down"]),
});
```

`src/server/actions/experience.ts`:

```ts
"use server";

import { asc, desc, eq, gt, lt, max } from "drizzle-orm";
import type { ActionResult } from "@/server/admin/action-result";
import {
  type ActionContext,
  notFound,
  runAdminAction,
} from "@/server/admin/run-action";
import {
  type ExperienceInput,
  experienceInput,
  moveInput,
} from "@/server/admin/schemas/experience";
import { idInput } from "@/server/admin/schemas/fields";
import { experience, experienceI18n } from "@/server/db/schema";

export async function createExperience(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(
    formData,
    experienceInput,
    async (input, { db, audit }) => {
      const id = crypto.randomUUID();
      const [{ last }] = await db
        .select({ last: max(experience.sortOrder) })
        .from(experience);
      await db
        .insert(experience)
        .values({ id, ...baseRow(input), sortOrder: (last ?? 0) + 1 });
      await writeTranslations(db, id, input);
      await audit({
        action: "create",
        entity: "experience",
        entityId: id,
        diff: input,
      });
      return {
        status: "ok",
        message: "Experience added.",
        redirectTo: `/admin/experience/${id}`,
      };
    },
  );
}

export async function updateExperience(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(
    formData,
    experienceInput.and(idInput),
    async (input, { db, audit }) => {
      const updated = await db
        .update(experience)
        .set(baseRow(input))
        .where(eq(experience.id, input.id))
        .returning({ id: experience.id });
      if (updated.length === 0) {
        return notFound("This experience entry no longer exists.");
      }
      await writeTranslations(db, input.id, input);
      await audit({
        action: "update",
        entity: "experience",
        entityId: input.id,
        diff: input,
      });
      return { status: "ok", message: "Experience saved." };
    },
  );
}

export async function deleteExperience(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(formData, idInput, async ({ id }, { db, audit }) => {
    const deleted = await db
      .delete(experience)
      .where(eq(experience.id, id))
      .returning({ id: experience.id });
    if (deleted.length === 0) {
      return notFound("This experience entry no longer exists.");
    }
    await audit({ action: "delete", entity: "experience", entityId: id });
    return {
      status: "ok",
      message: "Experience deleted.",
      redirectTo: "/admin/experience",
    };
  });
}

/** Swaps sort_order with the neighbour above or below (spec §5 reorder). */
export async function moveExperience(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(
    formData,
    moveInput,
    async ({ id, direction }, { db, audit }) => {
      const [current] = await db
        .select({ sortOrder: experience.sortOrder })
        .from(experience)
        .where(eq(experience.id, id));
      if (!current) {
        return notFound("This experience entry no longer exists.");
      }
      const [neighbour] = await db
        .select({ id: experience.id, sortOrder: experience.sortOrder })
        .from(experience)
        .where(
          direction === "up"
            ? lt(experience.sortOrder, current.sortOrder)
            : gt(experience.sortOrder, current.sortOrder),
        )
        .orderBy(
          direction === "up"
            ? desc(experience.sortOrder)
            : asc(experience.sortOrder),
        )
        .limit(1);
      if (!neighbour) {
        return { status: "ok", message: "Already at the edge." };
      }
      await db
        .update(experience)
        .set({ sortOrder: neighbour.sortOrder })
        .where(eq(experience.id, id));
      await db
        .update(experience)
        .set({ sortOrder: current.sortOrder })
        .where(eq(experience.id, neighbour.id));
      await audit({
        action: "reorder",
        entity: "experience",
        entityId: id,
        diff: { direction },
      });
      return { status: "ok", message: "Order saved." };
    },
  );
}

function baseRow(input: ExperienceInput) {
  return {
    company: input.company,
    url: input.url,
    startDate: input.startDate,
    endDate: input.endDate,
    employmentType: input.employmentType,
    isPublished: input.isPublished,
  };
}

async function writeTranslations(
  db: ActionContext["db"],
  id: string,
  input: ExperienceInput,
) {
  for (const locale of ["en", "ro"] as const) {
    const t = input[locale];
    const row = {
      roleTitle: t.roleTitle,
      descriptionMd: t.description,
      highlights: t.highlights,
    };
    await db
      .insert(experienceI18n)
      .values({ experienceId: id, locale, ...row })
      .onConflictDoUpdate({
        target: [experienceI18n.experienceId, experienceI18n.locale],
        set: row,
      });
  }
}
```

Run: `pnpm test`
Expected: `Test Files  12 passed (12)`, `Tests  91 passed (91)` (the guard test now also lists the four experience actions).

- [ ] **Step 5: Create the read, the components and the pages**

`src/server/queries/admin/experience.ts`:

```ts
import { asc } from "drizzle-orm";
import { experience, experienceI18n } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { byLocale } from "./by-locale";

export async function listExperienceForAdmin(db: Db) {
  const [jobs, rows] = await Promise.all([
    db.select().from(experience).orderBy(asc(experience.sortOrder)),
    db.select().from(experienceI18n),
  ]);
  return jobs.map((job) => {
    const own = rows.filter((row) => row.experienceId === job.id);
    return { ...job, en: byLocale(own, "en"), ro: byLocale(own, "ro") };
  });
}
```

`src/components/admin/ActionButton.tsx`:

```tsx
"use client";

import { startTransition, useActionState } from "react";
import { type AdminFormAction, IDLE } from "@/server/admin/action-result";
import { secondaryButton } from "./styles";

/** One-button form (delete, move) with hidden fields and an optional confirm step. */
export function ActionButton({
  action,
  fields,
  label,
  confirmMessage,
}: {
  action: AdminFormAction;
  fields: Record<string, string>;
  label: string;
  confirmMessage?: string;
}) {
  const [state, formAction, pending] = useActionState(action, IDLE);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        event.preventDefault();
        if (confirmMessage && !window.confirm(confirmMessage)) {
          return;
        }
        const data = new FormData(event.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="inline-flex items-center gap-2"
    >
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button type="submit" disabled={pending} className={secondaryButton}>
        {label}
      </button>
      {state.status === "error" ? (
        <span role="status" className="text-sm text-signal">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
```

`src/components/admin/ExperienceFields.tsx`:

```tsx
import {
  Checkbox,
  FormSection,
  Select,
  TextField,
  TranslatedField,
} from "./fields";

export type ExperienceDefaults = {
  company: string;
  url: string | null;
  startDate: string;
  endDate: string | null;
  employmentType: string;
  isPublished: boolean;
  en?: { roleTitle: string; descriptionMd: string; highlights: string[] };
  ro?: { roleTitle: string; descriptionMd: string; highlights: string[] };
};

const EMPLOYMENT_TYPES = [
  { value: "full_time", label: "Full time" },
  { value: "part_time", label: "Part time" },
  { value: "contract", label: "Contract" },
  { value: "freelance", label: "Freelance" },
] as const;

export const EMPTY_EXPERIENCE: ExperienceDefaults = {
  company: "",
  url: null,
  startDate: "",
  endDate: null,
  employmentType: "full_time",
  isPublished: false,
};

/** Fields shared by the create and edit experience forms. */
export function ExperienceFields({ value }: { value: ExperienceDefaults }) {
  return (
    <>
      <FormSection title="Role">
        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            name="company"
            label="Company"
            defaultValue={value.company}
            required
          />
          <TextField
            name="url"
            label="Company URL"
            type="url"
            defaultValue={value.url}
          />
          <TextField
            name="startDate"
            label="Start (YYYY-MM)"
            type="month"
            defaultValue={value.startDate}
            required
          />
          <TextField
            name="endDate"
            label="End (YYYY-MM)"
            type="month"
            defaultValue={value.endDate}
            hint="Leave empty for your current role."
          />
          <Select
            name="employmentType"
            label="Employment type"
            defaultValue={value.employmentType}
            options={EMPLOYMENT_TYPES}
          />
        </div>
        <Checkbox
          name="isPublished"
          label="Published"
          defaultChecked={value.isPublished}
        />
      </FormSection>
      <FormSection title="Text">
        <TranslatedField
          name="roleTitle"
          label="Role title"
          en={value.en?.roleTitle ?? ""}
          ro={value.ro?.roleTitle ?? ""}
        />
        <TranslatedField
          name="description"
          label="Description"
          en={value.en?.descriptionMd ?? ""}
          ro={value.ro?.descriptionMd ?? ""}
          multiline
          rows={4}
        />
        <TranslatedField
          name="highlights"
          label="Highlights"
          en={(value.en?.highlights ?? []).join("\n")}
          ro={(value.ro?.highlights ?? []).join("\n")}
          multiline
          rows={4}
          hint="One per line."
        />
      </FormSection>
    </>
  );
}
```

`src/app/admin/(panel)/experience/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton } from "@/components/admin/ActionButton";
import { MissingBadge } from "@/components/admin/fields";
import { button } from "@/components/admin/styles";
import { missingTranslation } from "@/content/localize";
import { moveExperience } from "@/server/actions/experience";
import { requireAdmin } from "@/server/auth";
import { getDb } from "@/server/db";
import { listExperienceForAdmin } from "@/server/queries/admin/experience";

export const metadata: Metadata = { title: "Experience" };

export default async function ExperienceListPage() {
  await requireAdmin();
  const jobs = await listExperienceForAdmin(getDb());

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-title text-ink">Experience</h1>
        <Link href="/admin/experience/new" className={button}>
          Add experience
        </Link>
      </div>
      <ol className="flex flex-col gap-3">
        {jobs.map((job, index) => (
          <li
            key={job.id}
            className="flex flex-wrap items-center justify-between gap-4 rounded-panel bg-surface p-4 ring-1 ring-line"
          >
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={`/admin/experience/${job.id}`}
                className="text-ink underline underline-offset-4"
              >
                {job.company}: {job.en?.roleTitle}
              </Link>
              <span className="font-mono text-label text-ink-subtle">
                {job.startDate} to {job.endDate ?? "now"}
              </span>
              {job.isPublished ? null : (
                <span className="font-mono text-label uppercase text-ink-muted">
                  Draft
                </span>
              )}
              {missingTranslation(job.en, job.ro, [
                "roleTitle",
                "descriptionMd",
                "highlights",
              ]) ? (
                <MissingBadge />
              ) : null}
            </div>
            <div className="flex gap-2">
              {index > 0 ? (
                <ActionButton
                  action={moveExperience}
                  fields={{ id: job.id, direction: "up" }}
                  label={`Move ${job.company} up`}
                />
              ) : null}
              {index < jobs.length - 1 ? (
                <ActionButton
                  action={moveExperience}
                  fields={{ id: job.id, direction: "down" }}
                  label={`Move ${job.company} down`}
                />
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
```

`src/app/admin/(panel)/experience/new/page.tsx`:

```tsx
import type { Metadata } from "next";
import { ActionForm } from "@/components/admin/ActionForm";
import {
  EMPTY_EXPERIENCE,
  ExperienceFields,
} from "@/components/admin/ExperienceFields";
import { createExperience } from "@/server/actions/experience";
import { requireAdmin } from "@/server/auth";

export const metadata: Metadata = { title: "Add experience" };

export default async function NewExperiencePage() {
  await requireAdmin();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-title text-ink">Add experience</h1>
      <ActionForm action={createExperience} submitLabel="Add experience">
        <ExperienceFields value={EMPTY_EXPERIENCE} />
      </ActionForm>
    </div>
  );
}
```

`src/app/admin/(panel)/experience/[id]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/admin/ActionButton";
import { ActionForm } from "@/components/admin/ActionForm";
import { ExperienceFields } from "@/components/admin/ExperienceFields";
import {
  deleteExperience,
  updateExperience,
} from "@/server/actions/experience";
import { requireAdmin } from "@/server/auth";
import { getDb } from "@/server/db";
import { listExperienceForAdmin } from "@/server/queries/admin/experience";

export const metadata: Metadata = { title: "Edit experience" };

export default async function EditExperiencePage({
  params,
}: PageProps<"/admin/experience/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const job = (await listExperienceForAdmin(getDb())).find((j) => j.id === id);
  if (!job) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-title text-ink">{job.company}</h1>
        <ActionButton
          action={deleteExperience}
          fields={{ id: job.id }}
          label="Delete"
          confirmMessage={`Delete ${job.company}? This cannot be undone.`}
        />
      </div>
      <ActionForm action={updateExperience} submitLabel="Save experience">
        <input type="hidden" name="id" value={job.id} />
        <ExperienceFields value={job} />
      </ActionForm>
    </div>
  );
}
```

- [ ] **Step 6: Verify**

Run: `pnpm test:e2e`
Expected: `48 passed`.

Run: `pnpm typecheck`
Expected: `✓ Types generated successfully`, exit 0.

Run: `rtk proxy pnpm lint`
Expected: `Checked 121 files in <n>ms. No fixes applied.`

- [ ] **Step 7: Commit**

```bash
/usr/bin/git add src tests
/usr/bin/git commit -m "feat(admin): edit and reorder experience"
```

---

### Task 9: Skills mapped to the stack layers

**Owner:** backend-engineer (full slice)

**Files:**
- Create: `src/server/admin/schemas/skills.ts`, `src/server/actions/skills.ts`, `src/server/queries/admin/skills.ts`, `src/components/admin/SkillFields.tsx`, `src/app/admin/(panel)/skills/page.tsx`, `src/app/admin/(panel)/skills/new/page.tsx`, `src/app/admin/(panel)/skills/[slug]/page.tsx`, `tests/db/admin-skills.test.ts`, `tests/e2e/admin-skills.spec.ts`

**Interfaces:**
- Consumes: the Task 7 pipeline, schemas and components; `ActionButton` (Task 8); `STACK_LAYERS` (M1).
- Produces:
  - `categoriesInput` (`{ en: Record<StackLayer, string>, ro: … }`, EN required), `skillInput`, `SkillInput` in `@/server/admin/schemas/skills`.
  - Actions `saveCategories` (renames the five layer categories), `createSkill` (appended to its layer, redirects to `/admin/skills`; duplicate slug → 409), `updateSkill` (slug is immutable, sent as a hidden field), `deleteSkill` (cascades out of `project_skill`).
  - `listStackForAdmin(db): { categories, names, skills }`.
  - `SkillFields`, `type SkillDefaults`.

- [ ] **Step 1: Write the failing tests**

`tests/db/admin-skills.test.ts`:

```ts
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { resolveCv } from "@/content/resolve-cv";
import {
  createSkill,
  deleteSkill,
  saveCategories,
} from "@/server/actions/skills";
import { IDLE } from "@/server/admin/action-result";
import { seedContent } from "@/server/db/seed";
import { loadCvRecords } from "@/server/queries/cv";
import { mocks, OWNER, setupActionDb } from "./action-mocks";
import { form } from "./form";

vi.mock("@/server/db", () => import("./action-mocks").then((m) => m.dbModule));
vi.mock("@/server/auth", () =>
  import("./action-mocks").then((m) => m.authModule),
);
vi.mock("next/cache", () =>
  import("./action-mocks").then((m) => m.cacheModule),
);
vi.mock("next/navigation", () =>
  import("./action-mocks").then((m) => m.navigationModule),
);

let close: () => Promise<void>;

beforeAll(async () => {
  close = await setupActionDb();
});

afterAll(async () => {
  await close();
});

beforeEach(async () => {
  await seedContent(mocks.db, { reset: true });
  mocks.session = OWNER;
  mocks.updateTag.mockClear();
});

async function cv(locale: "en" | "ro" = "en") {
  return resolveCv(await loadCvRecords(mocks.db), locale);
}

describe("skill actions", () => {
  const LAYER_NAMES = {
    "en.interface": "Interface",
    "en.api": "API",
    "en.data": "Data",
    "en.infra": "Infrastructure",
    "en.craft": "Craft",
    "ro.interface": "Interfață",
    "ro.api": "",
    "ro.data": "Date",
    "ro.infra": "Infrastructură",
    "ro.craft": "Meșteșug",
  };

  it("renames layers; a blank Romanian name falls back to English", async () => {
    const result = await saveCategories(
      IDLE,
      form({ ...LAYER_NAMES, "en.craft": "Practice" }),
    );

    expect(result).toEqual({ status: "ok", message: "Layer names saved." });
    const stack = (await cv("ro")).stack;
    expect(stack.find((s) => s.layer === "api")?.name).toEqual({
      value: "API",
      lang: "en",
    });
    expect(
      (await cv()).stack.find((s) => s.layer === "craft")?.name.value,
    ).toBe("Practice");
  });

  it("adds a skill to a layer and refuses a duplicate slug with 409", async () => {
    const skill = {
      slug: "rust",
      layer: "api",
      name: "Rust",
      level: "2",
      years: "1",
      featured: "on",
    };

    await expect(createSkill(IDLE, form(skill))).rejects.toThrow(
      "NEXT_REDIRECT /admin/skills",
    );
    const api = (await cv()).stack.find((s) => s.layer === "api");
    expect(api?.skills.at(-1)).toEqual({
      slug: "rust",
      name: "Rust",
      featured: true,
    });

    expect(await createSkill(IDLE, form(skill))).toMatchObject({
      status: "error",
      code: 409,
    });
  });

  it("rejects a level outside 1 to 5", async () => {
    const result = await createSkill(
      IDLE,
      form({
        slug: "cobol",
        layer: "api",
        name: "COBOL",
        level: "9",
        years: "1",
      }),
    );

    expect(result).toMatchObject({ status: "error", code: 400 });
    expect(result.status === "error" && result.fieldErrors?.level).toBeTruthy();
  });

  it("deleting a skill removes it from projects", async () => {
    await expect(deleteSkill(IDLE, form({ slug: "drizzle" }))).rejects.toThrow(
      "NEXT_REDIRECT /admin/skills",
    );

    const ledger = (await cv()).projects.find((p) => p.slug === "ledger-lens");
    expect(ledger?.skills).toEqual([
      "Next.js",
      "PostgreSQL",
      "Vitest and Playwright",
    ]);
  });
});
```

`tests/e2e/admin-skills.spec.ts`:

```ts
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { signInAsOwner } from "./admin-login";

test.beforeEach(async ({ page }) => {
  await signInAsOwner(page);
});

test("a new skill appears in its stack layer on the public page", async ({
  page,
}) => {
  await page.goto("/admin/skills/new");
  await page.getByLabel("Slug").fill("rust");
  await page.getByLabel("Name").fill("Rust");
  await page.getByLabel("Stack layer").selectOption("api");
  await page.getByRole("button", { name: "Add skill" }).click();
  await expect(page).toHaveURL("/admin/skills");

  await page.goto("/en");
  await expect(page.locator('#skills [data-layer="api"]')).toContainText(
    "Rust",
  );

  await page.goto("/admin/skills/rust");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL("/admin/skills");
});

const PATHS = ["/admin/skills", "/admin/skills/new", "/admin/skills/postgres"];

for (const path of PATHS) {
  test(`${path} has no axe violations`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).analyze();

    expect(
      violations.map((v) => ({
        id: v.id,
        targets: v.nodes.map((node) => node.target.join(" ")),
      })),
    ).toEqual([]);
  });
}
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm test`
Expected: FAIL with

```
Error: Cannot find package '@/server/actions/skills' imported from <worktree>/tests/db/admin-skills.test.ts
 Test Files  1 failed | 12 passed (13)
      Tests  91 passed (91)
```

Run: `pnpm exec playwright test tests/e2e/admin-skills.spec.ts --project admin --no-deps`
Expected: `4 failed` (the create test waits for `getByLabel('Slug')`).

- [ ] **Step 3: Create the schema and the actions**

`src/server/admin/schemas/skills.ts`:

```ts
import { z } from "zod";
import { STACK_LAYERS } from "@/content/types";
import { checkbox, required, slug, text } from "./fields";

/** One name per stack layer, as posted by TranslatedField (`en.api`, `ro.api`). */
function layerNames(name: z.ZodString) {
  return z.object(
    Object.fromEntries(STACK_LAYERS.map((layer) => [layer, name])) as Record<
      (typeof STACK_LAYERS)[number],
      z.ZodString
    >,
  );
}

export const categoriesInput = z.object({
  en: layerNames(required(60)),
  ro: layerNames(text(60)),
});

export const skillInput = z.object({
  slug,
  layer: z.enum(STACK_LAYERS),
  name: required(60),
  level: z.coerce.number().int().min(1).max(5),
  years: z.coerce.number().int().min(0).max(80),
  featured: checkbox,
});
export type SkillInput = z.infer<typeof skillInput>;
```

`src/server/actions/skills.ts`:

```ts
"use server";

import { eq, max } from "drizzle-orm";
import { STACK_LAYERS } from "@/content/types";
import type { ActionResult } from "@/server/admin/action-result";
import {
  type ActionContext,
  notFound,
  runAdminAction,
} from "@/server/admin/run-action";
import { slugInput } from "@/server/admin/schemas/fields";
import {
  categoriesInput,
  type SkillInput,
  skillInput,
} from "@/server/admin/schemas/skills";
import { skill, skillCategory, skillCategoryI18n } from "@/server/db/schema";

/** Renames the five stack-layer categories (EN required, RO optional). */
export async function saveCategories(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(
    formData,
    categoriesInput,
    async (input, { db, audit }) => {
      const categories = await db.select().from(skillCategory);
      for (const layer of STACK_LAYERS) {
        const category = categories.find((c) => c.layer === layer);
        if (!category) {
          return notFound(
            `The ${layer} layer has no category. Run \`pnpm db:seed\`.`,
          );
        }
        for (const locale of ["en", "ro"] as const) {
          await db
            .insert(skillCategoryI18n)
            .values({
              categorySlug: category.slug,
              locale,
              name: input[locale][layer],
            })
            .onConflictDoUpdate({
              target: [
                skillCategoryI18n.categorySlug,
                skillCategoryI18n.locale,
              ],
              set: { name: input[locale][layer] },
            });
        }
      }
      await audit({ action: "update", entity: "skill_category", diff: input });
      return { status: "ok", message: "Layer names saved." };
    },
  );
}

export async function createSkill(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(formData, skillInput, async (input, { db, audit }) => {
    const categorySlug = await categoryFor(db, input);
    if (!categorySlug) {
      return notFound(`The ${input.layer} layer has no category.`);
    }
    const [{ last }] = await db
      .select({ last: max(skill.sortOrder) })
      .from(skill)
      .where(eq(skill.categorySlug, categorySlug));
    await db.insert(skill).values({
      slug: input.slug,
      categorySlug,
      name: input.name,
      level: input.level,
      years: input.years,
      featured: input.featured,
      sortOrder: (last ?? 0) + 1,
    });
    await audit({
      action: "create",
      entity: "skill",
      entityId: input.slug,
      diff: input,
    });
    return {
      status: "ok",
      message: "Skill added.",
      redirectTo: "/admin/skills",
    };
  });
}

export async function updateSkill(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(formData, skillInput, async (input, { db, audit }) => {
    const categorySlug = await categoryFor(db, input);
    if (!categorySlug) {
      return notFound(`The ${input.layer} layer has no category.`);
    }
    const updated = await db
      .update(skill)
      .set({
        categorySlug,
        name: input.name,
        level: input.level,
        years: input.years,
        featured: input.featured,
      })
      .where(eq(skill.slug, input.slug))
      .returning({ slug: skill.slug });
    if (updated.length === 0) {
      return notFound("This skill no longer exists.");
    }
    await audit({
      action: "update",
      entity: "skill",
      entityId: input.slug,
      diff: input,
    });
    return { status: "ok", message: "Skill saved." };
  });
}

export async function deleteSkill(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(
    formData,
    slugInput,
    async ({ slug }, { db, audit }) => {
      const deleted = await db
        .delete(skill)
        .where(eq(skill.slug, slug))
        .returning({ slug: skill.slug });
      if (deleted.length === 0) {
        return notFound("This skill no longer exists.");
      }
      await audit({ action: "delete", entity: "skill", entityId: slug });
      return {
        status: "ok",
        message: "Skill deleted.",
        redirectTo: "/admin/skills",
      };
    },
  );
}

async function categoryFor(
  db: ActionContext["db"],
  input: SkillInput,
): Promise<string | undefined> {
  const [category] = await db
    .select({ slug: skillCategory.slug })
    .from(skillCategory)
    .where(eq(skillCategory.layer, input.layer));
  return category?.slug;
}
```

Run: `pnpm test`
Expected: `Test Files  13 passed (13)`, `Tests  99 passed (99)`.

- [ ] **Step 4: Create the read, the fields and the pages**

`src/server/queries/admin/skills.ts`:

```ts
import { asc } from "drizzle-orm";
import { skill, skillCategory, skillCategoryI18n } from "@/server/db/schema";
import type { Db } from "@/server/db/types";

export async function listStackForAdmin(db: Db) {
  const [categories, names, skills] = await Promise.all([
    db.select().from(skillCategory),
    db.select().from(skillCategoryI18n),
    db.select().from(skill).orderBy(asc(skill.sortOrder), asc(skill.slug)),
  ]);
  return { categories, names, skills };
}
```

`src/components/admin/SkillFields.tsx`:

```tsx
import { STACK_LAYERS } from "@/content/types";
import { Checkbox, Select, TextField } from "./fields";

export type SkillDefaults = {
  slug: string;
  layer: string;
  name: string;
  level: number;
  years: number;
  featured: boolean;
};

const LAYERS = STACK_LAYERS.map((layer) => ({ value: layer, label: layer }));

/** Skill form fields. The slug is editable only when creating. */
export function SkillFields({
  value,
  isNew,
}: {
  value: SkillDefaults;
  isNew: boolean;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {isNew ? (
        <TextField
          name="slug"
          label="Slug"
          defaultValue={value.slug}
          required
          hint="Lowercase letters, digits and dashes. Cannot change later."
        />
      ) : (
        <input type="hidden" name="slug" value={value.slug} />
      )}
      <TextField name="name" label="Name" defaultValue={value.name} required />
      <Select
        name="layer"
        label="Stack layer"
        defaultValue={value.layer}
        options={LAYERS}
      />
      <TextField
        name="level"
        label="Level (1 to 5)"
        type="number"
        defaultValue={value.level}
        required
      />
      <TextField
        name="years"
        label="Years"
        type="number"
        defaultValue={value.years}
        required
      />
      <Checkbox
        name="featured"
        label="Featured"
        defaultChecked={value.featured}
      />
    </div>
  );
}
```

`src/app/admin/(panel)/skills/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/admin/ActionForm";
import { FormSection, TranslatedField } from "@/components/admin/fields";
import { button } from "@/components/admin/styles";
import { STACK_LAYERS } from "@/content/types";
import { saveCategories } from "@/server/actions/skills";
import { requireAdmin } from "@/server/auth";
import { getDb } from "@/server/db";
import { listStackForAdmin } from "@/server/queries/admin/skills";

export const metadata: Metadata = { title: "Skills" };

export default async function SkillsPage() {
  await requireAdmin();
  const { categories, names, skills } = await listStackForAdmin(getDb());
  const nameOf = (slug: string | undefined, locale: "en" | "ro") =>
    names.find((row) => row.categorySlug === slug && row.locale === locale)
      ?.name ?? "";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-title text-ink">Skills</h1>
        <Link href="/admin/skills/new" className={button}>
          Add skill
        </Link>
      </div>
      <ActionForm action={saveCategories} submitLabel="Save layer names">
        <FormSection title="Stack layers">
          {STACK_LAYERS.map((layer) => {
            const slug = categories.find((c) => c.layer === layer)?.slug;
            return (
              <TranslatedField
                key={layer}
                name={`${layer}`}
                label={`Layer ${layer}`}
                en={nameOf(slug, "en")}
                ro={nameOf(slug, "ro")}
              />
            );
          })}
        </FormSection>
      </ActionForm>
      {STACK_LAYERS.map((layer) => {
        const slug = categories.find((c) => c.layer === layer)?.slug;
        const inLayer = skills.filter((s) => s.categorySlug === slug);
        return (
          <section
            key={layer}
            className="flex flex-col gap-3 rounded-panel bg-surface p-6 ring-1 ring-line"
          >
            <h2 className="text-heading text-ink">
              {nameOf(slug, "en")}{" "}
              <span className="font-mono text-label text-ink-subtle">
                ({layer})
              </span>
            </h2>
            <ul className="flex flex-wrap gap-2">
              {inLayer.map((s) => (
                <li key={s.slug}>
                  <Link
                    href={`/admin/skills/${s.slug}`}
                    className="inline-block rounded-full px-3 py-1 text-sm text-ink ring-1 ring-line-strong hover:bg-raised"
                  >
                    {s.name}
                    {s.featured ? " ★" : ""}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
```

`src/app/admin/(panel)/skills/new/page.tsx`:

```tsx
import type { Metadata } from "next";
import { ActionForm } from "@/components/admin/ActionForm";
import { SkillFields } from "@/components/admin/SkillFields";
import { createSkill } from "@/server/actions/skills";
import { requireAdmin } from "@/server/auth";

export const metadata: Metadata = { title: "Add skill" };

export default async function NewSkillPage() {
  await requireAdmin();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-title text-ink">Add skill</h1>
      <ActionForm action={createSkill} submitLabel="Add skill">
        <SkillFields
          isNew
          value={{
            slug: "",
            layer: "interface",
            name: "",
            level: 3,
            years: 1,
            featured: false,
          }}
        />
      </ActionForm>
    </div>
  );
}
```

`src/app/admin/(panel)/skills/[slug]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/admin/ActionButton";
import { ActionForm } from "@/components/admin/ActionForm";
import { SkillFields } from "@/components/admin/SkillFields";
import { deleteSkill, updateSkill } from "@/server/actions/skills";
import { requireAdmin } from "@/server/auth";
import { getDb } from "@/server/db";
import { listStackForAdmin } from "@/server/queries/admin/skills";

export const metadata: Metadata = { title: "Edit skill" };

export default async function EditSkillPage({
  params,
}: PageProps<"/admin/skills/[slug]">) {
  await requireAdmin();
  const { slug } = await params;
  const { categories, skills } = await listStackForAdmin(getDb());
  const found = skills.find((s) => s.slug === slug);
  const layer = categories.find((c) => c.slug === found?.categorySlug)?.layer;
  if (!found || !layer) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-title text-ink">{found.name}</h1>
        <ActionButton
          action={deleteSkill}
          fields={{ slug: found.slug }}
          label="Delete"
          confirmMessage={`Delete ${found.name}? Projects lose this tag.`}
        />
      </div>
      <ActionForm action={updateSkill} submitLabel="Save skill">
        <SkillFields isNew={false} value={{ ...found, layer }} />
      </ActionForm>
    </div>
  );
}
```

- [ ] **Step 5: Verify**

Run: `pnpm test:e2e`
Expected: `52 passed`.

Run: `pnpm typecheck`
Expected: `✓ Types generated successfully`, exit 0.

Run: `rtk proxy pnpm lint`
Expected: `Checked 130 files in <n>ms. No fixes applied.`

- [ ] **Step 6: Commit**

```bash
/usr/bin/git add src tests
/usr/bin/git commit -m "feat(admin): edit skills mapped to stack layers"
```

---

### Task 10: Projects with a markdown preview

**Owner:** backend-engineer (full slice)

**Files:**
- Create: `src/server/admin/schemas/projects.ts`, `src/server/actions/projects.ts`, `src/server/queries/admin/projects.ts`, `src/components/admin/MarkdownField.tsx`, `src/components/admin/ProjectFields.tsx`, `src/app/admin/(panel)/projects/page.tsx`, `src/app/admin/(panel)/projects/new/page.tsx`, `src/app/admin/(panel)/projects/[slug]/page.tsx`, `tests/db/admin-projects.test.ts`, `tests/e2e/admin-projects.spec.ts`
- Modify: `package.json`, `pnpm-lock.yaml`

**Interfaces:**
- Consumes: the Task 7 pipeline, schemas and components; `ActionButton` (Task 8); `missingTranslation` (Task 8); `mediaOptions` (Task 7).
- Produces:
  - `projectInput` (slug `^[a-z0-9]+(?:-[a-z0-9]+)*$`, year 1990–2100, up to 12 skill slugs in order, EN title/summary/role/outcome required, optional markdown `body` per locale), `ProjectInput` in `@/server/admin/schemas/projects`.
  - Actions `createProject` (redirects to `/admin/projects/<slug>`; duplicate slug → 409), `updateProject` (slug immutable; replaces the ordered skill list; an unknown skill → 409 and nothing changes), `deleteProject`.
  - `listProjectsForAdmin(db)`, `projectPickers(db): { skills, images }`.
  - `<MarkdownField name label defaultValue>`: textarea with an Edit / Preview toggle rendered by `react-markdown`, which never renders raw HTML.
  - `ProjectFields`, `EMPTY_PROJECT`, `type ProjectDefaults`.

- [ ] **Step 1: Add react-markdown**

```bash
pnpm add -E react-markdown@10.1.0
```

Expected: `+ react-markdown 10.1.0`.

- [ ] **Step 2: Write the failing tests**

`tests/db/admin-projects.test.ts`:

```ts
import { eq } from "drizzle-orm";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { resolveCv } from "@/content/resolve-cv";
import {
  createProject,
  deleteProject,
  updateProject,
} from "@/server/actions/projects";
import { IDLE } from "@/server/admin/action-result";
import { projectSkill } from "@/server/db/schema";
import { seedContent } from "@/server/db/seed";
import { loadCvRecords } from "@/server/queries/cv";
import { mocks, OWNER, setupActionDb } from "./action-mocks";
import { form } from "./form";

vi.mock("@/server/db", () => import("./action-mocks").then((m) => m.dbModule));
vi.mock("@/server/auth", () =>
  import("./action-mocks").then((m) => m.authModule),
);
vi.mock("next/cache", () =>
  import("./action-mocks").then((m) => m.cacheModule),
);
vi.mock("next/navigation", () =>
  import("./action-mocks").then((m) => m.navigationModule),
);

let close: () => Promise<void>;

beforeAll(async () => {
  close = await setupActionDb();
});

afterAll(async () => {
  await close();
});

beforeEach(async () => {
  await seedContent(mocks.db, { reset: true });
  mocks.session = OWNER;
  mocks.updateTag.mockClear();
});

async function cv(locale: "en" | "ro" = "en") {
  return resolveCv(await loadCvRecords(mocks.db), locale);
}

describe("project actions", () => {
  const PROJECT = {
    slug: "orbit",
    year: "2026",
    repoUrl: "",
    liveUrl: "https://example.com/orbit",
    coverMediaId: "",
    featured: "on",
    published: "on",
    skills: ["postgres", "nextjs"],
    "en.title": "Orbit",
    "en.summary": "Satellite dashboard.",
    "en.role": "Lead",
    "en.outcome": "Launched.",
    "en.body": "## Why\n\nBecause.",
    "ro.title": "Orbită",
    "ro.summary": "",
    "ro.role": "",
    "ro.outcome": "",
    "ro.body": "",
  };

  it("creates a published project with ordered skills", async () => {
    await expect(createProject(IDLE, form(PROJECT))).rejects.toThrow(
      "NEXT_REDIRECT /admin/projects/orbit",
    );

    const orbit = (await cv("ro")).projects.find((p) => p.slug === "orbit");
    expect(orbit).toMatchObject({
      title: { value: "Orbită", lang: "ro" },
      summary: { value: "Satellite dashboard.", lang: "en" },
      skills: ["PostgreSQL", "Next.js"],
      featured: true,
    });
  });

  it("refuses a slug that is not lowercase-dashed", async () => {
    const result = await createProject(
      IDLE,
      form({ ...PROJECT, slug: "Orbit Two" }),
    );

    expect(result).toMatchObject({ status: "error", code: 400 });
  });

  it("refuses an unknown skill with 409 and keeps the old skills", async () => {
    const result = await updateProject(
      IDLE,
      form({ ...PROJECT, slug: "tramline", skills: ["no-such-skill"] }),
    );

    expect(result).toMatchObject({ status: "error", code: 409 });
    const rows = await mocks.db
      .select()
      .from(projectSkill)
      .where(eq(projectSkill.projectSlug, "tramline"));
    expect(rows).toHaveLength(3);
  });

  it("unpublishing hides a project from the public CV", async () => {
    const { published: _published, ...draft } = PROJECT;
    await updateProject(IDLE, form({ ...draft, slug: "tramline" }));

    expect((await cv()).projects.map((p) => p.slug)).not.toContain("tramline");
  });

  it("deletes a project", async () => {
    await expect(
      deleteProject(IDLE, form({ slug: "pulse-check" })),
    ).rejects.toThrow("NEXT_REDIRECT /admin/projects");
    expect(
      await deleteProject(IDLE, form({ slug: "pulse-check" })),
    ).toMatchObject({
      status: "error",
      code: 404,
    });
  });
});
```

`tests/e2e/admin-projects.spec.ts`. The case study text puts `<script>` on its own line after the markdown on purpose: a line that starts with `<script>` opens a CommonMark HTML block that swallows the rest of that line, and react-markdown drops HTML blocks entirely.

```ts
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { signInAsOwner } from "./admin-login";

test.beforeEach(async ({ page }) => {
  await signInAsOwner(page);
});

test("a project is created with a markdown preview and published", async ({
  page,
}) => {
  await page.goto("/admin/projects/new");
  await page.getByLabel("Slug").fill("orbit");
  await page.getByLabel("Year").fill("2026");
  await page.getByLabel("Title (EN)").fill("Orbit");
  await page.getByLabel("Summary (EN)").fill("Satellite pass planner.");
  await page.getByLabel("Role (EN)").fill("Lead developer");
  await page
    .getByLabel("Outcome (EN)")
    .fill("Planning went from hours to minutes.");
  await page
    .getByLabel("Case study (EN)")
    .fill("## Why\n\nPlain **bold**\n\n<script>alert(1)</script>");
  await page.getByRole("button", { name: "Preview Case study (EN)" }).click();
  await expect(page.getByRole("heading", { name: "Why" })).toBeVisible();
  await expect(page.locator("strong", { hasText: "bold" })).toBeVisible();
  await expect(page.locator("form script")).toHaveCount(0);
  await page.getByLabel("PostgreSQL").check();
  await page.getByLabel("Published").check();
  await page.getByRole("button", { name: "Add project" }).click();
  await expect(page).toHaveURL("/admin/projects/orbit");

  await page.goto("/en");
  await expect(page.locator("#projects")).toContainText("Orbit");

  await page.goto("/admin/projects/orbit");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL("/admin/projects");
});

const PATHS = [
  "/admin/projects",
  "/admin/projects/new",
  "/admin/projects/ledger-lens",
];

for (const path of PATHS) {
  test(`${path} has no axe violations`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).analyze();

    expect(
      violations.map((v) => ({
        id: v.id,
        targets: v.nodes.map((node) => node.target.join(" ")),
      })),
    ).toEqual([]);
  });
}
```

- [ ] **Step 3: Run them to verify they fail**

Run: `pnpm test`
Expected: FAIL with

```
Error: Cannot find package '@/server/actions/projects' imported from <worktree>/tests/db/admin-projects.test.ts
 Test Files  1 failed | 13 passed (14)
      Tests  99 passed (99)
```

Run: `pnpm exec playwright test tests/e2e/admin-projects.spec.ts --project admin --no-deps`
Expected: `4 failed` (the create test waits for `getByLabel('Slug')`).

- [ ] **Step 4: Create the schema and the actions**

`src/server/admin/schemas/projects.ts`:

```ts
import { z } from "zod";
import {
  checkbox,
  optionalMediaId,
  optionalUrl,
  required,
  slug,
  stringList,
  text,
} from "./fields";

export const projectInput = z.object({
  slug,
  year: z.coerce.number().int().min(1990).max(2100),
  repoUrl: optionalUrl,
  liveUrl: optionalUrl,
  coverMediaId: optionalMediaId,
  featured: checkbox,
  published: checkbox,
  skills: stringList.pipe(z.array(slug).max(12)),
  en: z.object({
    title: required(120),
    summary: required(400),
    role: required(120),
    outcome: required(300),
    body: text(20_000),
  }),
  ro: z.object({
    title: text(120),
    summary: text(400),
    role: text(120),
    outcome: text(300),
    body: text(20_000),
  }),
});
export type ProjectInput = z.infer<typeof projectInput>;
```

`src/server/actions/projects.ts`:

```ts
"use server";

import { eq } from "drizzle-orm";
import type { ActionResult } from "@/server/admin/action-result";
import {
  type ActionContext,
  notFound,
  runAdminAction,
} from "@/server/admin/run-action";
import { slugInput } from "@/server/admin/schemas/fields";
import {
  type ProjectInput,
  projectInput,
} from "@/server/admin/schemas/projects";
import { project, projectI18n, projectSkill } from "@/server/db/schema";

export async function createProject(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(
    formData,
    projectInput,
    async (input, { db, audit }) => {
      await db.insert(project).values({ slug: input.slug, ...baseRow(input) });
      await writeDetails(db, input);
      await audit({
        action: "create",
        entity: "project",
        entityId: input.slug,
        diff: input,
      });
      return {
        status: "ok",
        message: "Project added.",
        redirectTo: `/admin/projects/${input.slug}`,
      };
    },
  );
}

/** The slug is the project's identity and cannot change after creation. */
export async function updateProject(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(
    formData,
    projectInput,
    async (input, { db, audit }) => {
      const updated = await db
        .update(project)
        .set(baseRow(input))
        .where(eq(project.slug, input.slug))
        .returning({ slug: project.slug });
      if (updated.length === 0) {
        return notFound("This project no longer exists.");
      }
      await writeDetails(db, input);
      await audit({
        action: "update",
        entity: "project",
        entityId: input.slug,
        diff: input,
      });
      return { status: "ok", message: "Project saved." };
    },
  );
}

export async function deleteProject(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(
    formData,
    slugInput,
    async ({ slug }, { db, audit }) => {
      const deleted = await db
        .delete(project)
        .where(eq(project.slug, slug))
        .returning({ slug: project.slug });
      if (deleted.length === 0) {
        return notFound("This project no longer exists.");
      }
      await audit({ action: "delete", entity: "project", entityId: slug });
      return {
        status: "ok",
        message: "Project deleted.",
        redirectTo: "/admin/projects",
      };
    },
  );
}

function baseRow(input: ProjectInput) {
  return {
    year: input.year,
    repoUrl: input.repoUrl,
    liveUrl: input.liveUrl,
    coverMediaId: input.coverMediaId,
    featured: input.featured,
    published: input.published,
  };
}

/** Upserts both translations and replaces the ordered skill list. */
async function writeDetails(db: ActionContext["db"], input: ProjectInput) {
  for (const locale of ["en", "ro"] as const) {
    const t = input[locale];
    const row = {
      title: t.title,
      summary: t.summary,
      bodyMd: t.body,
      role: t.role,
      outcome: t.outcome,
    };
    await db
      .insert(projectI18n)
      .values({ projectSlug: input.slug, locale, ...row })
      .onConflictDoUpdate({
        target: [projectI18n.projectSlug, projectI18n.locale],
        set: row,
      });
  }
  await db.delete(projectSkill).where(eq(projectSkill.projectSlug, input.slug));
  if (input.skills.length > 0) {
    await db.insert(projectSkill).values(
      input.skills.map((skillSlug, index) => ({
        projectSlug: input.slug,
        skillSlug,
        position: index + 1,
      })),
    );
  }
}
```

Run: `pnpm test`
Expected: `Test Files  14 passed (14)`, `Tests  107 passed (107)`.

- [ ] **Step 5: Create the reads, the fields and the pages**

`src/server/queries/admin/projects.ts`:

```ts
import { asc, desc } from "drizzle-orm";
import { project, projectI18n, projectSkill, skill } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { byLocale } from "./by-locale";
import { mediaOptions } from "./media";

export async function listProjectsForAdmin(db: Db) {
  const [projects, rows, skills] = await Promise.all([
    db.select().from(project).orderBy(desc(project.year), asc(project.slug)),
    db.select().from(projectI18n),
    db.select().from(projectSkill).orderBy(asc(projectSkill.position)),
  ]);
  return projects.map((item) => {
    const own = rows.filter((row) => row.projectSlug === item.slug);
    return {
      ...item,
      en: byLocale(own, "en"),
      ro: byLocale(own, "ro"),
      skills: skills
        .filter((row) => row.projectSlug === item.slug)
        .map((row) => row.skillSlug),
    };
  });
}

/** Skill checkboxes and cover-image options for the project form. */
export async function projectPickers(db: Db) {
  const [skills, images] = await Promise.all([
    db
      .select({ slug: skill.slug, name: skill.name })
      .from(skill)
      .orderBy(asc(skill.sortOrder), asc(skill.slug)),
    mediaOptions(db, "image"),
  ]);
  return { skills, images };
}
```

`src/components/admin/MarkdownField.tsx`:

```tsx
"use client";

import { useId, useState } from "react";
import Markdown from "react-markdown";
import { FieldError } from "./ActionForm";
import { field, label as labelClass, secondaryButton } from "./styles";

/**
 * Markdown textarea with a rendered preview (spec §5: projects with markdown
 * preview). react-markdown never renders raw HTML, so a preview cannot run
 * scripts from the text.
 */
export function MarkdownField({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [preview, setPreview] = useState(false);
  const previewId = useId();

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={name} className={labelClass}>
          {label}
        </label>
        <button
          type="button"
          aria-controls={previewId}
          aria-pressed={preview}
          onClick={() => setPreview((shown) => !shown)}
          className={secondaryButton}
        >
          {preview ? `Edit ${label}` : `Preview ${label}`}
        </button>
      </div>
      <textarea
        id={name}
        name={name}
        rows={10}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        hidden={preview}
        aria-describedby={`${name}-error`}
        className={`${field} font-mono`}
      />
      <div
        id={previewId}
        hidden={!preview}
        className="mt-1.5 flex flex-col gap-3 rounded-control bg-canvas p-4 text-ink ring-1 ring-line [&_a]:underline [&_h2]:text-heading [&_ul]:list-disc [&_ul]:pl-5"
      >
        <Markdown>{value || "Nothing to preview yet."}</Markdown>
      </div>
      <FieldError name={name} />
    </div>
  );
}
```

`src/components/admin/ProjectFields.tsx`:

```tsx
import {
  Checkbox,
  FormSection,
  Select,
  TextField,
  TranslatedField,
} from "./fields";
import { MarkdownField } from "./MarkdownField";

type ProjectText = {
  title: string;
  summary: string;
  role: string;
  outcome: string;
  bodyMd: string;
};

export type ProjectDefaults = {
  slug: string;
  year: number;
  repoUrl: string | null;
  liveUrl: string | null;
  coverMediaId: string | null;
  featured: boolean;
  published: boolean;
  skills: string[];
  en?: ProjectText;
  ro?: ProjectText;
};

export const EMPTY_PROJECT: ProjectDefaults = {
  slug: "",
  year: new Date().getUTCFullYear(),
  repoUrl: null,
  liveUrl: null,
  coverMediaId: null,
  featured: false,
  published: false,
  skills: [],
};

/** Project form fields; `skills` and `images` feed the pickers. */
export function ProjectFields({
  value,
  isNew,
  skills,
  images,
}: {
  value: ProjectDefaults;
  isNew: boolean;
  skills: ReadonlyArray<{ slug: string; name: string }>;
  images: ReadonlyArray<{ value: string; label: string }>;
}) {
  return (
    <>
      <FormSection title="Project">
        <div className="grid gap-4 md:grid-cols-2">
          {isNew ? (
            <TextField
              name="slug"
              label="Slug"
              defaultValue={value.slug}
              required
              hint="Used in the URL. Cannot change later."
            />
          ) : (
            <input type="hidden" name="slug" value={value.slug} />
          )}
          <TextField
            name="year"
            label="Year"
            type="number"
            defaultValue={value.year}
            required
          />
          <TextField
            name="liveUrl"
            label="Live URL"
            type="url"
            defaultValue={value.liveUrl}
          />
          <TextField
            name="repoUrl"
            label="Source URL"
            type="url"
            defaultValue={value.repoUrl}
          />
          <Select
            name="coverMediaId"
            label="Cover image"
            defaultValue={value.coverMediaId ?? ""}
            options={[{ value: "", label: "None" }, ...images]}
          />
        </div>
        <div className="flex flex-wrap gap-6">
          <Checkbox
            name="featured"
            label="Featured"
            defaultChecked={value.featured}
          />
          <Checkbox
            name="published"
            label="Published"
            defaultChecked={value.published}
          />
        </div>
        <fieldset>
          <legend className="mb-2 text-sm text-ink-muted">Skills</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {skills.map((s) => (
              <label
                key={s.slug}
                className="flex items-center gap-2 text-sm text-ink"
              >
                <input
                  type="checkbox"
                  name="skills"
                  value={s.slug}
                  defaultChecked={value.skills.includes(s.slug)}
                />
                {s.name}
              </label>
            ))}
          </div>
        </fieldset>
      </FormSection>
      <FormSection title="Text">
        <TranslatedField
          name="title"
          label="Title"
          en={value.en?.title ?? ""}
          ro={value.ro?.title ?? ""}
        />
        <TranslatedField
          name="summary"
          label="Summary"
          en={value.en?.summary ?? ""}
          ro={value.ro?.summary ?? ""}
          multiline
          rows={3}
        />
        <TranslatedField
          name="role"
          label="Role"
          en={value.en?.role ?? ""}
          ro={value.ro?.role ?? ""}
        />
        <TranslatedField
          name="outcome"
          label="Outcome"
          en={value.en?.outcome ?? ""}
          ro={value.ro?.outcome ?? ""}
          multiline
          rows={2}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <MarkdownField
            name="en.body"
            label="Case study (EN)"
            defaultValue={value.en?.bodyMd ?? ""}
          />
          <MarkdownField
            name="ro.body"
            label="Case study (RO)"
            defaultValue={value.ro?.bodyMd ?? ""}
          />
        </div>
      </FormSection>
    </>
  );
}
```

`src/app/admin/(panel)/projects/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { MissingBadge } from "@/components/admin/fields";
import { button } from "@/components/admin/styles";
import { missingTranslation } from "@/content/localize";
import { requireAdmin } from "@/server/auth";
import { getDb } from "@/server/db";
import { listProjectsForAdmin } from "@/server/queries/admin/projects";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage() {
  await requireAdmin();
  const projects = await listProjectsForAdmin(getDb());

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-title text-ink">Projects</h1>
        <Link href="/admin/projects/new" className={button}>
          Add project
        </Link>
      </div>
      <ul className="flex flex-col gap-3">
        {projects.map((item) => (
          <li
            key={item.slug}
            className="flex flex-wrap items-center gap-3 rounded-panel bg-surface p-4 ring-1 ring-line"
          >
            <Link
              href={`/admin/projects/${item.slug}`}
              className="text-ink underline underline-offset-4"
            >
              {item.en?.title ?? item.slug}
            </Link>
            <span className="font-mono text-label text-ink-subtle">
              {item.year}
            </span>
            {item.published ? null : (
              <span className="font-mono text-label uppercase text-ink-muted">
                Draft
              </span>
            )}
            {missingTranslation(item.en, item.ro, [
              "title",
              "summary",
              "role",
              "outcome",
            ]) ? (
              <MissingBadge />
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

`src/app/admin/(panel)/projects/new/page.tsx`:

```tsx
import type { Metadata } from "next";
import { ActionForm } from "@/components/admin/ActionForm";
import { EMPTY_PROJECT, ProjectFields } from "@/components/admin/ProjectFields";
import { createProject } from "@/server/actions/projects";
import { requireAdmin } from "@/server/auth";
import { getDb } from "@/server/db";
import { projectPickers } from "@/server/queries/admin/projects";

export const metadata: Metadata = { title: "Add project" };

export default async function NewProjectPage() {
  await requireAdmin();
  const pickers = await projectPickers(getDb());
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-title text-ink">Add project</h1>
      <ActionForm action={createProject} submitLabel="Add project">
        <ProjectFields value={EMPTY_PROJECT} isNew {...pickers} />
      </ActionForm>
    </div>
  );
}
```

`src/app/admin/(panel)/projects/[slug]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/admin/ActionButton";
import { ActionForm } from "@/components/admin/ActionForm";
import { ProjectFields } from "@/components/admin/ProjectFields";
import { deleteProject, updateProject } from "@/server/actions/projects";
import { requireAdmin } from "@/server/auth";
import { getDb } from "@/server/db";
import {
  listProjectsForAdmin,
  projectPickers,
} from "@/server/queries/admin/projects";

export const metadata: Metadata = { title: "Edit project" };

export default async function EditProjectPage({
  params,
}: PageProps<"/admin/projects/[slug]">) {
  await requireAdmin();
  const { slug } = await params;
  const db = getDb();
  const [projects, pickers] = await Promise.all([
    listProjectsForAdmin(db),
    projectPickers(db),
  ]);
  const item = projects.find((p) => p.slug === slug);
  if (!item) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-title text-ink">{item.en?.title ?? item.slug}</h1>
        <ActionButton
          action={deleteProject}
          fields={{ slug: item.slug }}
          label="Delete"
          confirmMessage={`Delete ${item.en?.title ?? item.slug}? This cannot be undone.`}
        />
      </div>
      <ActionForm action={updateProject} submitLabel="Save project">
        <ProjectFields value={item} isNew={false} {...pickers} />
      </ActionForm>
    </div>
  );
}
```

- [ ] **Step 6: Verify**

Run: `pnpm test:e2e`
Expected: `56 passed`.

Run: `pnpm typecheck`
Expected: `✓ Types generated successfully`, exit 0.

Run: `rtk proxy pnpm lint`
Expected: `Checked 140 files in <n>ms. No fixes applied.`

- [ ] **Step 7: Commit**

```bash
/usr/bin/git add package.json pnpm-lock.yaml src tests
/usr/bin/git commit -m "feat(admin): edit projects with markdown preview"
```

---

### Task 11: Media library and uploads (Vercel Blob or local disk)

**Owner:** backend-engineer (full slice)

**Files:**
- Create: `src/server/media/store.ts`, `src/server/media/inspect.ts`, `src/server/media/index.ts`, `src/server/admin/schemas/media.ts`, `src/server/actions/media.ts`, `src/app/api/media/[key]/route.ts`, `src/app/admin/(panel)/media/page.tsx`, `tests/unit/media.test.ts`, `tests/db/admin-media.test.ts`, `tests/e2e/admin-media.spec.ts`
- Modify: `src/lib/create-app-env.ts`, `src/env.ts`, `.env.example`, `tests/unit/env.test.ts`, `tests/db/action-mocks.ts`, `next.config.ts`, `.gitignore`, `package.json`, `pnpm-lock.yaml`

**Interfaces:**
- Consumes: the Task 7 pipeline and components; `ActionButton` (Task 8); `listMediaForAdmin` (Task 7); `idInput`, `text` (Task 7).
- Produces:
  - Env: optional server-only `BLOB_READ_WRITE_TOKEN` (empty = unset).
  - `type MediaStore = { put(key, body: Buffer, contentType): Promise<{ url; pathname }>; delete(pathname): Promise<void> }`, `MEDIA_KEY` (`<uuid>.(jpg|png|webp|avif|pdf)`), `createBlobStore(token)` (public objects under `media/`, `addRandomSuffix: false`, one-year cache), `createLocalStore(dir)` (URL `/api/media/<key>`), `readLocalMedia(dir, key)`, `LOCAL_MEDIA_DIR` (`.data/media`) from `@/server/media/store`.
  - `getMediaStore()` from `@/server/media`: Blob with a token, local disk without one, and on Vercel without a token it throws `Set BLOB_READ_WRITE_TOKEN: uploads cannot be stored on Vercel's filesystem.`
  - `inspectUpload(bytes): Promise<InspectedUpload>` and `MAX_UPLOAD_BYTES` (4 MB) from `@/server/media/inspect`: JPEG/PNG/WebP/AVIF via sharp metadata (size after EXIF orientation, 16 px WebP LQIP data URL), PDF via `%PDF-`; everything else, SVG included, is refused.
  - Actions `uploadMedia` (sniff → store → insert; the stored object is deleted again if the insert fails), `saveMediaAlt`, `deleteMedia` (row first, references become `NULL`, then the object).
  - `GET /api/media/[key]`: serves local uploads with the right `Content-Type`, `Cache-Control: public, max-age=31536000, immutable`, `X-Content-Type-Options: nosniff`; 404 for anything that is not a valid key.
  - `experimental.serverActions.bodySizeLimit: "4.5mb"`.
  - `mocks.media` and `mediaModule` in `tests/db/action-mocks.ts`.
- Spec §5 says "Blob client upload". This plan uploads through a Server Action and `put()` on the server (see Deviations): a 4 MB cap covers images and a CV PDF, and it works identically with the local store, with no Blob callback that must reach the app.

- [ ] **Step 1: Add sharp and the Blob SDK**

```bash
pnpm add -E sharp@0.35.4 @vercel/blob@2.8.0
```

Expected: `+ @vercel/blob 2.8.0`, `+ sharp 0.35.4`, exit 0 (the existing `sharp: false` in `pnpm-workspace.yaml` is fine: sharp 0.35 ships prebuilt binaries).

- [ ] **Step 2: Write the failing tests**

In `tests/unit/env.test.ts`, insert directly before `it("refuses to expose DATABASE_URL to client code", …)`:

```ts
  it("accepts a Vercel Blob token", () => {
    const env = createAppEnv({
      ...BASE,
      BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_store_secret",
    });

    expect(env.BLOB_READ_WRITE_TOKEN).toBe("vercel_blob_rw_store_secret");
  });

  it("treats an empty BLOB_READ_WRITE_TOKEN as unset (local media storage)", () => {
    const env = createAppEnv({ ...BASE, BLOB_READ_WRITE_TOKEN: "" });

    expect(env.BLOB_READ_WRITE_TOKEN).toBeUndefined();
  });

```

Replace `tests/db/action-mocks.ts`:

```ts
import { vi } from "vitest";
import type { AdminSession } from "@/server/auth/read-session";
import { user } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import type { MediaStore } from "@/server/media/store";
import { createTestDb } from "./test-db";

// Shared state behind the vi.mock factories in the admin action tests:
//   vi.mock("@/server/db", () => import("./action-mocks").then((m) => m.dbModule));
// Server actions then run against PGlite, a controllable session, a spy for
// updateTag and a redirect that throws like Next's does.

export const OWNER: AdminSession = {
  userId: "owner",
  email: "owner@example.com",
  name: "Owner",
};

export const mocks = {
  db: undefined as unknown as Db,
  session: null as AdminSession | null,
  media: undefined as unknown as MediaStore,
  updateTag: vi.fn(),
};

export const dbModule = { getDb: () => mocks.db };
export const authModule = { getAdminSession: async () => mocks.session };
export const cacheModule = { updateTag: mocks.updateTag };
export const navigationModule = {
  redirect: (url: string): never => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
};
export const mediaModule = { getMediaStore: () => mocks.media };

/** Fresh PGlite with the owner user row (audit_log.user_id references it). */
export async function setupActionDb(): Promise<() => Promise<void>> {
  const { db, close } = await createTestDb();
  mocks.db = db;
  await db.insert(user).values({
    id: OWNER.userId,
    name: OWNER.name,
    email: OWNER.email,
    emailVerified: true,
  });
  return close;
}
```

`tests/unit/media.test.ts` (the Blob adapter is checked against a mocked `@vercel/blob`: no Blob store or account exists yet):

```ts
import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getMediaStore } from "@/server/media";
import { inspectUpload, MAX_UPLOAD_BYTES } from "@/server/media/inspect";
import {
  createBlobStore,
  createLocalStore,
  readLocalMedia,
} from "@/server/media/store";

const blob = vi.hoisted(() => ({
  put: vi.fn(async (pathname: string) => ({
    url: `https://store.public.blob.vercel-storage.com/${pathname}`,
    pathname,
  })),
  del: vi.fn(async () => {}),
}));
vi.mock("@vercel/blob", () => blob);

const env = vi.hoisted(() => ({
  BLOB_READ_WRITE_TOKEN: undefined as string | undefined,
}));
vi.mock("@/env", () => ({ env }));

const KEY = "0b7e2a8e-4f5a-4c7e-9d0b-1f2e3d4c5b6a.png";

function png(width = 40, height = 20): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: "#336699" },
  })
    .png()
    .toBuffer();
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  env.BLOB_READ_WRITE_TOKEN = undefined;
});

describe("inspectUpload", () => {
  it("reads size and a tiny blurred preview from a PNG", async () => {
    const result = await inspectUpload(await png());

    expect(result).toMatchObject({
      ok: true,
      kind: "image",
      mime: "image/png",
      ext: "png",
      width: 40,
      height: 20,
    });
    expect(result.ok && result.lqip).toMatch(/^data:image\/webp;base64,/);
  });

  it("accepts a PDF by its signature", async () => {
    expect(await inspectUpload(Buffer.from("%PDF-1.7\n%âãÏÓ\n"))).toMatchObject(
      {
        ok: true,
        kind: "document",
        mime: "application/pdf",
        ext: "pdf",
      },
    );
  });

  it("refuses SVG, which can carry scripts", async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>',
    );

    expect(await inspectUpload(svg)).toEqual({
      ok: false,
      message: "Upload a JPEG, PNG, WebP, AVIF or PDF file.",
    });
  });

  it("refuses a text file renamed to .png", async () => {
    expect(await inspectUpload(Buffer.from("just text"))).toMatchObject({
      ok: false,
    });
  });

  it("refuses empty and oversized files", async () => {
    expect(await inspectUpload(Buffer.alloc(0))).toEqual({
      ok: false,
      message: "The file is empty.",
    });
    expect(await inspectUpload(Buffer.alloc(MAX_UPLOAD_BYTES + 1))).toEqual({
      ok: false,
      message: "The file is larger than 4 MB.",
    });
  });
});

describe("local media store", () => {
  it("writes, serves and deletes a file by key", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "cv-media-"));
    const store = createLocalStore(dir);
    const bytes = await png();

    expect(await store.put(KEY, bytes, "image/png")).toEqual({
      url: `/api/media/${KEY}`,
      pathname: KEY,
    });
    expect(await readLocalMedia(dir, KEY)).toEqual(bytes);

    await store.delete(KEY);
    expect(await readdir(dir)).toEqual([]);
  });

  it("never reads outside its directory", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "cv-media-"));

    expect(await readLocalMedia(dir, "../../etc/passwd")).toBeNull();
    expect(await readLocalMedia(dir, "..%2F..%2Fetc%2Fpasswd")).toBeNull();
    await expect(
      createLocalStore(dir).put("../x.png", Buffer.alloc(1), "image/png"),
    ).rejects.toThrow("Invalid media key");
  });
});

describe("Vercel Blob store", () => {
  it("uploads public, immutable objects under media/ with the given token", async () => {
    const store = createBlobStore("vercel_blob_rw_test");

    const stored = await store.put(KEY, Buffer.from("x"), "image/png");

    expect(blob.put).toHaveBeenCalledWith(`media/${KEY}`, Buffer.from("x"), {
      access: "public",
      contentType: "image/png",
      token: "vercel_blob_rw_test",
      addRandomSuffix: false,
      cacheControlMaxAge: 31_536_000,
    });
    expect(stored.url).toBe(
      `https://store.public.blob.vercel-storage.com/media/${KEY}`,
    );

    await store.delete(stored.pathname);
    expect(blob.del).toHaveBeenCalledWith(`media/${KEY}`, {
      token: "vercel_blob_rw_test",
    });
  });
});

describe("getMediaStore", () => {
  it("uses Vercel Blob when a token is set", async () => {
    env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_test";

    await getMediaStore().put(KEY, Buffer.from("x"), "image/png");

    expect(blob.put).toHaveBeenCalledOnce();
  });

  it("refuses to store uploads on Vercel's read-only disk without a token", () => {
    vi.stubEnv("VERCEL", "1");

    expect(() => getMediaStore()).toThrow(
      "Set BLOB_READ_WRITE_TOKEN: uploads cannot be stored on Vercel's filesystem.",
    );
  });
});
```

`tests/db/admin-media.test.ts`:

```ts
import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { deleteMedia, saveMediaAlt, uploadMedia } from "@/server/actions/media";
import { saveProfile } from "@/server/actions/profile";
import { IDLE } from "@/server/admin/action-result";
import { media, profile } from "@/server/db/schema";
import { seedContent } from "@/server/db/seed";
import { createLocalStore } from "@/server/media/store";
import { mocks, OWNER, setupActionDb } from "./action-mocks";
import { form } from "./form";

vi.mock("@/server/db", () => import("./action-mocks").then((m) => m.dbModule));
vi.mock("@/server/auth", () =>
  import("./action-mocks").then((m) => m.authModule),
);
vi.mock("next/cache", () =>
  import("./action-mocks").then((m) => m.cacheModule),
);
vi.mock("@/server/media", () =>
  import("./action-mocks").then((m) => m.mediaModule),
);

let close: () => Promise<void>;
let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "cv-media-"));
  close = await setupActionDb();
  mocks.media = createLocalStore(dir);
  await seedContent(mocks.db);
});

afterAll(async () => {
  await close();
});

beforeEach(() => {
  mocks.session = OWNER;
});

async function pngFile(name = "avatar.png"): Promise<File> {
  const bytes = await sharp({
    create: { width: 64, height: 48, channels: 3, background: "#7cc5ff" },
  })
    .png()
    .toBuffer();
  return new File([new Uint8Array(bytes)], name, { type: "image/png" });
}

describe("media actions", () => {
  it("stores an image, records its size and shows it in the library", async () => {
    const result = await uploadMedia(
      IDLE,
      form({ file: await pngFile(), altEn: "Portrait", altRo: "Portret" }),
    );

    expect(result).toEqual({ status: "ok", message: "Uploaded." });
    const [row] = await mocks.db.select().from(media);
    expect(row).toMatchObject({
      kind: "image",
      mime: "image/png",
      width: 64,
      height: 48,
      altEn: "Portrait",
      altRo: "Portret",
    });
    expect(row.blobUrl).toBe(`/api/media/${row.pathname}`);
    expect(await readdir(dir)).toEqual([row.pathname]);
  });

  it("judges the file by its bytes, not its name or type", async () => {
    const fake = new File(["<svg onload=alert(1)>"], "cute.png", {
      type: "image/png",
    });

    const result = await uploadMedia(
      IDLE,
      form({ file: fake, altEn: "", altRo: "" }),
    );

    expect(result).toMatchObject({
      status: "error",
      code: 400,
      fieldErrors: { file: ["Upload a JPEG, PNG, WebP, AVIF or PDF file."] },
    });
    expect(await readdir(dir)).toHaveLength(1);
  });

  it("edits alt text", async () => {
    const [row] = await mocks.db.select().from(media);

    await saveMediaAlt(IDLE, form({ id: row.id, altEn: "Me", altRo: "Eu" }));

    const [updated] = await mocks.db
      .select()
      .from(media)
      .where(eq(media.id, row.id));
    expect(updated).toMatchObject({ altEn: "Me", altRo: "Eu" });
  });

  it("deleting a file clears references to it and removes the stored object", async () => {
    const [row] = await mocks.db.select().from(media);
    await mocks.db.update(profile).set({ avatarMediaId: row.id });

    expect(await deleteMedia(IDLE, form({ id: row.id }))).toEqual({
      status: "ok",
      message: "Deleted.",
    });

    const [p] = await mocks.db.select().from(profile);
    expect(p.avatarMediaId).toBeNull();
    expect(await readdir(dir)).toEqual([]);
  });

  it("refuses a profile that points at a media id that does not exist", async () => {
    const result = await saveProfile(
      IDLE,
      form({
        emailPublic: "hello@example.com",
        location: "Cluj-Napoca",
        countryCode: "RO",
        yearsExp: "9",
        avatarMediaId: "00000000-0000-4000-8000-000000000000",
        "en.fullName": "A",
        "en.headline": "B",
        "en.summary": "C",
        "en.seoTitle": "D",
        "en.seoDescription": "E",
        "ro.fullName": "",
        "ro.headline": "",
        "ro.summary": "",
        "ro.seoTitle": "",
        "ro.seoDescription": "",
      }),
    );

    expect(result).toMatchObject({ status: "error", code: 409 });
  });
});
```

`tests/e2e/admin-media.spec.ts`:

```ts
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { signInAsOwner } from "./admin-login";

test("uploads an image, serves it and deletes it", async ({
  page,
  request,
}) => {
  await signInAsOwner(page);
  await page.goto("/admin/media");
  const buffer = await sharp({
    create: { width: 32, height: 24, channels: 3, background: "#7cc5ff" },
  })
    .png()
    .toBuffer();

  await page.getByLabel(/^File/).setInputFiles({
    name: "portrait.png",
    mimeType: "image/png",
    buffer,
  });
  await page.getByLabel("Alt text (EN)", { exact: true }).fill("Portrait");
  await page.getByRole("button", { name: "Upload" }).click();
  await expect(page.getByRole("status").first()).toHaveText("Uploaded.");

  const image = page.getByRole("img", { name: "Portrait" });
  await expect(image).toBeVisible();
  const src = await image.getAttribute("src");
  expect(src).toMatch(/^\/api\/media\/[0-9a-f-]{36}\.png$/);
  const served = await request.get(src ?? "");
  expect(served.status()).toBe(200);
  expect(served.headers()["content-type"]).toBe("image/png");
  expect(served.headers()["x-content-type-options"]).toBe("nosniff");

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: /^Delete / }).click();
  await expect(image).toHaveCount(0);
  expect((await request.get(src ?? "")).status()).toBe(404);
});

test("refuses a file that is not really an image", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/admin/media");

  await page.getByLabel(/^File/).setInputFiles({
    name: "cute.png",
    mimeType: "image/png",
    buffer: Buffer.from("<svg onload=alert(1)>"),
  });
  await page.getByRole("button", { name: "Upload" }).click();

  await expect(
    page.getByText("Upload a JPEG, PNG, WebP, AVIF or PDF file.").first(),
  ).toBeVisible();
});

test("the media route never serves paths outside the upload folder", async ({
  request,
}) => {
  for (const key of ["..%2F..%2Fpackage.json", "package.json", "x.svg"]) {
    expect((await request.get(`/api/media/${key}`)).status()).toBe(404);
  }
});

test("the media page has no axe violations", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/admin/media");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const { violations } = await new AxeBuilder({ page }).analyze();

  expect(violations.map((v) => v.id)).toEqual([]);
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `pnpm test`
Expected: FAIL with

```
Error: Cannot find package '@/server/actions/media' imported from <worktree>/tests/db/admin-media.test.ts
Error: Cannot find package '@/server/media' imported from <worktree>/tests/unit/media.test.ts
AssertionError: expected undefined to be 'vercel_blob_rw_store_secret' // Object.is equality
 Test Files  3 failed | 13 passed (16)
      Tests  1 failed | 108 passed (109)
```

Run: `pnpm exec playwright test tests/e2e/admin-media.spec.ts --project admin --no-deps`
Expected: `3 failed`, `1 passed` (the route test already gets 404s because the route does not exist); the upload tests wait for `getByLabel(/^File/)`.

- [ ] **Step 4: Add the env variable**

Replace `src/lib/create-app-env.ts`:

```ts
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export type RuntimeEnv = {
  DATABASE_URL?: string;
  SITE_URL?: string;
  BETTER_AUTH_SECRET?: string;
  ADMIN_EMAIL?: string;
  BLOB_READ_WRITE_TOKEN?: string;
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
      BETTER_AUTH_SECRET: z.string().min(32),
      ADMIN_EMAIL: z.email().transform((email) => email.toLowerCase()),
      BLOB_READ_WRITE_TOKEN: z.string().min(1).optional(),
    },
    client: {
      NEXT_PUBLIC_ASSET_BASE: z.url().optional(),
    },
    runtimeEnv: {
      DATABASE_URL: runtimeEnv.DATABASE_URL,
      SITE_URL: runtimeEnv.SITE_URL,
      BETTER_AUTH_SECRET: runtimeEnv.BETTER_AUTH_SECRET,
      ADMIN_EMAIL: runtimeEnv.ADMIN_EMAIL,
      BLOB_READ_WRITE_TOKEN: runtimeEnv.BLOB_READ_WRITE_TOKEN,
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
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
  BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
  NEXT_PUBLIC_ASSET_BASE: process.env.NEXT_PUBLIC_ASSET_BASE,
});
```

Replace `.env.example`:

```bash
# Copy to .env.local for local development: cp .env.example .env.local

# Postgres connection string. Local default matches docker-compose.yml.
# On Vercel this is injected by the Neon integration.
DATABASE_URL=postgres://cv:cv@localhost:5432/cv

# Public origin for canonical URLs, hreflang, sitemap.xml and JSON-LD.
# Empty = the Vercel production domain on Vercel, http://localhost:3000 elsewhere.
SITE_URL=

# Better Auth: signs session cookies and encrypts 2FA secrets (>= 32 chars).
# This value is for local development only. Generate a real one for any
# deployed environment: openssl rand -base64 32
BETTER_AUTH_SECRET=dev-only-better-auth-secret-change-me-0123

# The only account allowed into /admin. Create it with `pnpm admin:create`.
ADMIN_EMAIL=admin@example.com

# Vercel Blob read/write token for admin uploads. Empty = files are stored in
# .data/media and served by /api/media (local dev, tests, CI).
BLOB_READ_WRITE_TOKEN=

# Optional absolute base URL for /public media (sequences, glb). Empty = same origin.
NEXT_PUBLIC_ASSET_BASE=
```

Add `BLOB_READ_WRITE_TOKEN=` (empty) to your `.env.local`.

- [ ] **Step 5: Create the storage, the sniffing and the store choice**

`src/server/media/store.ts`:

```ts
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, put } from "@vercel/blob";

/** Where admin uploads live. Keys look like `<uuid>.<ext>`. */
export type MediaStore = {
  put(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<{ url: string; pathname: string }>;
  delete(pathname: string): Promise<void>;
};

/** Keys the local store accepts: a UUID plus one of the allowed extensions. */
export const MEDIA_KEY =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|avif|pdf)$/;

/** Vercel Blob (production). Public URLs on the Blob CDN. */
export function createBlobStore(token: string): MediaStore {
  return {
    async put(key, body, contentType) {
      const blob = await put(`media/${key}`, body, {
        access: "public",
        contentType,
        token,
        addRandomSuffix: false,
        cacheControlMaxAge: 60 * 60 * 24 * 365,
      });
      return { url: blob.url, pathname: blob.pathname };
    },
    async delete(pathname) {
      await del(pathname, { token });
    },
  };
}

/**
 * Local filesystem (dev, tests, CI: no BLOB_READ_WRITE_TOKEN). Files are
 * served by src/app/api/media/[key]/route.ts, so they work after `next build`.
 */
export function createLocalStore(dir: string): MediaStore {
  return {
    async put(key, body) {
      assertKey(key);
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, key), body);
      return { url: `/api/media/${key}`, pathname: key };
    },
    async delete(pathname) {
      assertKey(pathname);
      await rm(path.join(dir, pathname), { force: true });
    },
  };
}

/** Reads a locally stored file, or null when the key is invalid or missing. */
export async function readLocalMedia(
  dir: string,
  key: string,
): Promise<Buffer | null> {
  if (!MEDIA_KEY.test(key)) {
    return null;
  }
  try {
    return await readFile(path.join(dir, key));
  } catch {
    return null;
  }
}

export const LOCAL_MEDIA_DIR = path.join(process.cwd(), ".data", "media");

function assertKey(key: string) {
  if (!MEDIA_KEY.test(key)) {
    throw new Error(`Invalid media key: ${key}`);
  }
}
```

`src/server/media/inspect.ts`:

```ts
import sharp from "sharp";

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export type InspectedUpload =
  | {
      ok: true;
      kind: "image" | "document";
      mime: string;
      ext: "jpg" | "png" | "webp" | "avif" | "pdf";
      width: number | null;
      height: number | null;
      lqip: string | null;
    }
  | { ok: false; message: string };

const IMAGE_FORMATS = {
  jpeg: { mime: "image/jpeg", ext: "jpg" },
  png: { mime: "image/png", ext: "png" },
  webp: { mime: "image/webp", ext: "webp" },
  heif: { mime: "image/avif", ext: "avif" },
} as const;

/**
 * Decides what an upload really is from its bytes, never from the file name
 * or the browser's Content-Type. Allowed: JPEG, PNG, WebP, AVIF images and
 * PDF documents up to 4 MB. SVG and everything else is refused.
 */
export async function inspectUpload(bytes: Buffer): Promise<InspectedUpload> {
  if (bytes.length === 0) {
    return { ok: false, message: "The file is empty." };
  }
  if (bytes.length > MAX_UPLOAD_BYTES) {
    return { ok: false, message: "The file is larger than 4 MB." };
  }
  if (bytes.subarray(0, 5).toString("latin1") === "%PDF-") {
    return {
      ok: true,
      kind: "document",
      mime: "application/pdf",
      ext: "pdf",
      width: null,
      height: null,
      lqip: null,
    };
  }

  const metadata = await sharp(bytes)
    .metadata()
    .catch(() => null);
  if (!metadata) {
    return {
      ok: false,
      message: "Upload a JPEG, PNG, WebP, AVIF or PDF file.",
    };
  }
  const format =
    metadata.format === "heif" && metadata.compression !== "av1"
      ? undefined
      : IMAGE_FORMATS[metadata.format as keyof typeof IMAGE_FORMATS];
  if (!format || !metadata.width || !metadata.height) {
    return {
      ok: false,
      message: "Upload a JPEG, PNG, WebP, AVIF or PDF file.",
    };
  }

  const preview = await sharp(bytes)
    .rotate()
    .resize(16)
    .webp({ quality: 40 })
    .toBuffer();
  return {
    ok: true,
    kind: "image",
    mime: format.mime,
    ext: format.ext,
    width: metadata.autoOrient.width,
    height: metadata.autoOrient.height,
    lqip: `data:image/webp;base64,${preview.toString("base64")}`,
  };
}
```

`src/server/media/index.ts`:

```ts
import { env } from "@/env";
import {
  createBlobStore,
  createLocalStore,
  LOCAL_MEDIA_DIR,
  type MediaStore,
} from "./store";

/**
 * Vercel Blob when BLOB_READ_WRITE_TOKEN is set, otherwise the local
 * filesystem (dev, tests, CI). Vercel's filesystem is read-only, so a deploy
 * without a token fails loudly instead of losing uploads.
 */
export function getMediaStore(): MediaStore {
  if (env.BLOB_READ_WRITE_TOKEN) {
    return createBlobStore(env.BLOB_READ_WRITE_TOKEN);
  }
  if (process.env.VERCEL) {
    throw new Error(
      "Set BLOB_READ_WRITE_TOKEN: uploads cannot be stored on Vercel's filesystem.",
    );
  }
  return createLocalStore(LOCAL_MEDIA_DIR);
}
```

- [ ] **Step 6: Create the schema and the actions**

`src/server/admin/schemas/media.ts`:

```ts
import { z } from "zod";
import { text } from "./fields";

export const uploadInput = z.object({
  file: z.instanceof(File, { message: "Choose a file" }),
  altEn: text(300),
  altRo: text(300),
});

export const mediaAltInput = z.object({
  id: z.uuid(),
  altEn: text(300),
  altRo: text(300),
});
```

`src/server/actions/media.ts`:

```ts
"use server";

import { eq } from "drizzle-orm";
import type { ActionResult } from "@/server/admin/action-result";
import { notFound, runAdminAction } from "@/server/admin/run-action";
import { idInput } from "@/server/admin/schemas/fields";
import { mediaAltInput, uploadInput } from "@/server/admin/schemas/media";
import { media } from "@/server/db/schema";
import { getMediaStore } from "@/server/media";
import { inspectUpload } from "@/server/media/inspect";

export async function uploadMedia(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(formData, uploadInput, async (input, { db, audit }) => {
    const bytes = Buffer.from(await input.file.arrayBuffer());
    const inspected = await inspectUpload(bytes);
    if (!inspected.ok) {
      return {
        status: "error",
        code: 400,
        message: inspected.message,
        fieldErrors: { file: [inspected.message] },
      };
    }

    const store = getMediaStore();
    const stored = await store.put(
      `${crypto.randomUUID()}.${inspected.ext}`,
      bytes,
      inspected.mime,
    );
    try {
      const [row] = await db
        .insert(media)
        .values({
          blobUrl: stored.url,
          pathname: stored.pathname,
          kind: inspected.kind,
          mime: inspected.mime,
          width: inspected.width,
          height: inspected.height,
          bytes: bytes.length,
          lqip: inspected.lqip,
          altEn: input.altEn,
          altRo: input.altRo,
        })
        .returning({ id: media.id });
      await audit({
        action: "create",
        entity: "media",
        entityId: row.id,
        diff: {
          pathname: stored.pathname,
          mime: inspected.mime,
          bytes: bytes.length,
        },
      });
    } catch (error) {
      await store.delete(stored.pathname);
      throw error;
    }
    return { status: "ok", message: "Uploaded." };
  });
}

export async function saveMediaAlt(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(
    formData,
    mediaAltInput,
    async (input, { db, audit }) => {
      const updated = await db
        .update(media)
        .set({ altEn: input.altEn, altRo: input.altRo })
        .where(eq(media.id, input.id))
        .returning({ id: media.id });
      if (updated.length === 0) {
        return notFound("This file no longer exists.");
      }
      await audit({
        action: "update",
        entity: "media",
        entityId: input.id,
        diff: input,
      });
      return { status: "ok", message: "Alt text saved." };
    },
  );
}

/** Deletes the row (references become NULL) and then the stored file. */
export async function deleteMedia(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(formData, idInput, async ({ id }, { db, audit }) => {
    const [row] = await db
      .delete(media)
      .where(eq(media.id, id))
      .returning({ pathname: media.pathname });
    if (!row) {
      return notFound("This file no longer exists.");
    }
    await getMediaStore().delete(row.pathname);
    await audit({ action: "delete", entity: "media", entityId: id });
    return { status: "ok", message: "Deleted." };
  });
}
```

Run: `pnpm test`
Expected: `Test Files  16 passed (16)`, `Tests  127 passed (127)`.

- [ ] **Step 7: Serve local files, raise the body limit, ignore `.data/`**

`src/app/api/media/[key]/route.ts`:

```ts
import { LOCAL_MEDIA_DIR, readLocalMedia } from "@/server/media/store";

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  pdf: "application/pdf",
};

/** Serves uploads stored on the local filesystem (no Blob token: dev, tests, CI). */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/media/[key]">,
) {
  const { key } = await params;
  const body = await readLocalMedia(LOCAL_MEDIA_DIR, key);
  if (!body) {
    return new Response("Not found", { status: 404 });
  }
  const ext = key.slice(key.lastIndexOf(".") + 1);
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": CONTENT_TYPES[ext],
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
```

Replace `next.config.ts`:

```ts
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import "./src/env";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  cacheComponents: true,
  experimental: {
    serverActions: {
      // Admin uploads are capped at 4 MB (src/server/media/inspect.ts) plus
      // multipart overhead; Vercel functions accept at most 4.5 MB.
      bodySizeLimit: "4.5mb",
    },
  },
};

export default withNextIntl(nextConfig);
```

Append to `.gitignore`:

```gitignore

# local media uploads (no Blob token)
.data/
```

- [ ] **Step 8: Create the media page `src/app/admin/(panel)/media/page.tsx`**

```tsx
import type { Metadata } from "next";
import { ActionButton } from "@/components/admin/ActionButton";
import { ActionForm, FieldError } from "@/components/admin/ActionForm";
import { FormSection, TextField } from "@/components/admin/fields";
import { field, label } from "@/components/admin/styles";
import { deleteMedia, saveMediaAlt, uploadMedia } from "@/server/actions/media";
import { requireAdmin } from "@/server/auth";
import { getDb } from "@/server/db";
import { listMediaForAdmin } from "@/server/queries/admin/media";

export const metadata: Metadata = { title: "Media" };

export default async function MediaPage() {
  await requireAdmin();
  const items = await listMediaForAdmin(getDb());

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-title text-ink">Media</h1>
      <ActionForm action={uploadMedia} submitLabel="Upload">
        <FormSection title="Upload">
          <div>
            <label htmlFor="file" className={label}>
              File (JPEG, PNG, WebP, AVIF or PDF, up to 4 MB)
            </label>
            <input
              id="file"
              name="file"
              type="file"
              required
              accept="image/jpeg,image/png,image/webp,image/avif,application/pdf"
              aria-describedby="file-error"
              className={field}
            />
            <FieldError name="file" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <TextField name="altEn" label="Alt text (EN)" />
            <TextField name="altRo" label="Alt text (RO)" />
          </div>
        </FormSection>
      </ActionForm>
      <ul className="grid gap-4 md:grid-cols-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex flex-col gap-3 rounded-panel bg-surface p-4 ring-1 ring-line"
          >
            {item.kind === "image" ? (
              // biome-ignore lint/performance/noImgElement: admin thumbnails of arbitrary uploads; next/image needs known remote hosts.
              <img
                src={item.blobUrl}
                alt={item.altEn}
                width={item.width ?? undefined}
                height={item.height ?? undefined}
                className="h-40 w-full rounded-control bg-canvas object-contain"
                style={
                  item.lqip
                    ? {
                        backgroundImage: `url(${item.lqip})`,
                        backgroundSize: "cover",
                      }
                    : undefined
                }
              />
            ) : (
              <a
                href={item.blobUrl}
                className="text-ink underline underline-offset-4"
              >
                {item.pathname}
              </a>
            )}
            <p className="font-mono text-label text-ink-subtle">
              {item.mime} · {Math.round(item.bytes / 1024)} KB
              {item.width ? ` · ${item.width}×${item.height}` : ""}
            </p>
            <ActionForm
              action={saveMediaAlt}
              submitLabel="Save alt text"
              className="flex flex-col gap-3"
            >
              <input type="hidden" name="id" value={item.id} />
              <TextField
                name="altEn"
                label={`Alt text (EN) for ${item.pathname}`}
                defaultValue={item.altEn}
              />
              <TextField
                name="altRo"
                label={`Alt text (RO) for ${item.pathname}`}
                defaultValue={item.altRo}
              />
            </ActionForm>
            <ActionButton
              action={deleteMedia}
              fields={{ id: item.id }}
              label={`Delete ${item.pathname}`}
              confirmMessage="Delete this file? Anything using it loses it."
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 9: Verify**

Run: `pnpm typecheck`
Expected: `✓ Types generated successfully`, exit 0. (If it reports `Type '"/api/media/[key]"' does not satisfy the constraint '"/api/auth/[...all]"'`, the TypeScript 7 incremental cache is stale: `rm -f tsconfig.tsbuildinfo tests/tsconfig.tsbuildinfo` and run it again.)

Run: `rtk proxy pnpm lint`
Expected: `Checked 150 files in <n>ms. No fixes applied.`

Run: `pnpm test:e2e`
Expected: `60 passed`. `.data/media/` is empty afterwards (the upload test deletes its file) and `git status --short` does not list it.

- [ ] **Step 10: Commit**

```bash
/usr/bin/git add .env.example .gitignore next.config.ts package.json pnpm-lock.yaml src tests
/usr/bin/git commit -m "feat(media): upload to blob or local storage"
```

---

### Task 12 (M2b): TOTP two-factor sign-in

**Owner:** backend-engineer

> **M2b.** Tasks 12 and 13 finish spec §5's "passkey + TOTP". None of the spec §7 M2 acceptance checks depend on them, so the Overseer may merge Tasks 1–11 + 14 as M2 and run 12–13 on a follow-up branch. They are written to apply cleanly after Task 11 (Task 14 only touches `README.md`).

**Files:**
- Create: `src/server/actions/two-factor.ts`, `src/components/admin/CodeForm.tsx`, `src/components/admin/TwoFactorSettings.tsx`, `src/app/admin/login/two-factor/page.tsx`, `src/app/admin/(panel)/security/page.tsx`, `drizzle/0001_two_factor.sql` + `drizzle/meta/*` (generated), `tests/db/two-factor.test.ts`, `tests/e2e/admin-security.spec.ts`
- Modify: `src/server/db/schema/auth.ts`, `src/server/auth/create-auth.ts`, `src/server/auth/read-session.ts`, `src/server/auth/admin.ts`, `src/server/actions/auth.ts`, `scripts/admin-create.ts`, `scripts/e2e-db.ts`, `tests/db/schema.test.ts`, `tests/db/action-mocks.ts`, `package.json`, `pnpm-lock.yaml`

**Interfaces:**
- Consumes: Tasks 5–7 (auth factory, `upsertAdmin`, `readAdminSession`, `signIn`, `ActionResult`, `UNAUTHORIZED`, `formToObject`).
- Produces:
  - `user.two_factor_enabled` and the `two_factor` table (migration `0001_two_factor`); `twoFactor({ issuer: "CV admin" })` in `createAuth`.
  - `AdminSession.twoFactorEnabled: boolean`.
  - `signIn` redirects to `/admin/login/two-factor` when Better Auth answers `twoFactorRedirect`; `verifySignInCode(prev: SignInState, formData)` turns the 2FA cookie into a session and redirects to `/admin`.
  - `type TwoFactorState = ActionResult | { status: "setup"; secret; totpURI; backupCodes }` and the actions `startTwoFactor` (password → secret, not active yet), `confirmTwoFactor` (first valid code turns 2FA on, then `redirect("/admin/security")`), `disableTwoFactor` (password, then the same redirect). Both redirects are required: Better Auth rotates the session at that moment.
  - `upsertAdmin(…, { resetSecondFactors: { db } })` and `pnpm admin:create --reset-2fa`: the recovery path for a lost phone (deletes the TOTP secret, turns 2FA off, signs out every session). `scripts/e2e-db.ts` uses it so every e2e run starts without 2FA.
  - `/admin/security` page (TOTP now, passkeys in Task 13).

- [ ] **Step 1: Add otpauth (tests generate real TOTP codes with it)**

```bash
pnpm add -D -E otpauth@9.5.2
```

Expected: `+ otpauth 9.5.2`.

- [ ] **Step 2: Write the failing tests**

`tests/db/two-factor.test.ts`:

```ts
import { TOTP } from "otpauth";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { upsertAdmin } from "@/server/auth/admin";
import { type Auth, createAuth } from "@/server/auth/create-auth";
import { readAdminSession } from "@/server/auth/read-session";
import type { Db } from "@/server/db/types";
import { createTestDb } from "./test-db";

const ADMIN = "owner@example.com";
const PASSWORD = "correct-horse-battery";

let db: Db;
let close: () => Promise<void>;
let auth: Auth;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  auth = createAuth({
    db,
    secret: "test-secret-that-is-at-least-32-chars",
    baseURL: "http://localhost:3000",
    adminEmail: ADMIN,
  });
  await upsertAdmin(auth, {
    email: ADMIN,
    password: PASSWORD,
    name: "Owner",
    adminEmail: ADMIN,
  });
});

afterAll(async () => {
  await close();
});

/** Cookie header built from a response's Set-Cookie headers. */
function cookiesOf(response: Response): Headers {
  const cookie = response.headers
    .getSetCookie()
    .map((header) => header.split(";")[0])
    .join("; ");
  return new Headers({ cookie });
}

async function signIn(): Promise<{
  headers: Headers;
  body: Record<string, unknown>;
}> {
  const response = await auth.api.signInEmail({
    body: { email: ADMIN, password: PASSWORD },
    asResponse: true,
  });
  return { headers: cookiesOf(response), body: await response.json() };
}

describe("TOTP two-factor sign-in", () => {
  let totp: TOTP;

  it("enables 2FA only after the first code is confirmed", async () => {
    const { headers } = await signIn();

    const setup = await auth.api.enableTwoFactor({
      body: { password: PASSWORD, method: "totp" },
      headers,
    });
    if (setup.method !== "totp") {
      throw new Error("expected a TOTP setup");
    }
    expect(setup.backupCodes).toHaveLength(10);
    const uri = new URL(setup.totpURI);
    expect(uri.protocol).toBe("otpauth:");
    totp = new TOTP({ secret: uri.searchParams.get("secret") ?? "" });

    // Not enabled yet: a new sign-in still gets a session straight away.
    expect((await signIn()).body).not.toHaveProperty("twoFactorRedirect");

    const confirmed = await auth.api.verifyTOTP({
      body: { code: totp.generate() },
      headers,
      asResponse: true,
    });
    // Enabling 2FA rotates the session: the old cookie is revoked.
    expect(await readAdminSession(auth, headers, ADMIN)).toBeNull();
    expect(
      await readAdminSession(auth, cookiesOf(confirmed), ADMIN),
    ).toMatchObject({ twoFactorEnabled: true });
  });

  it("asks for a code after the password, and a wrong code gives no session", async () => {
    const { headers, body } = await signIn();

    expect(body).toMatchObject({
      twoFactorRedirect: true,
      twoFactorMethods: ["totp"],
    });
    expect(await readAdminSession(auth, headers, ADMIN)).toBeNull();
    await expect(
      auth.api.verifyTOTP({ body: { code: "000000" }, headers }),
    ).rejects.toThrow();
  });

  it("a correct code completes the sign-in", async () => {
    const { headers } = await signIn();

    const response = await auth.api.verifyTOTP({
      body: { code: totp.generate() },
      headers,
      asResponse: true,
    });

    expect(response.status).toBe(200);
    expect(
      await readAdminSession(auth, cookiesOf(response), ADMIN),
    ).toMatchObject({ email: ADMIN });
  });

  it("`admin:create --reset-2fa` turns it off for a lost authenticator", async () => {
    await upsertAdmin(auth, {
      email: ADMIN,
      password: PASSWORD,
      name: "Owner",
      adminEmail: ADMIN,
      resetSecondFactors: { db },
    });

    const { headers, body } = await signIn();
    expect(body).not.toHaveProperty("twoFactorRedirect");
    expect(await readAdminSession(auth, headers, ADMIN)).toMatchObject({
      twoFactorEnabled: false,
    });
  });
});
```

In `tests/db/schema.test.ts`, add `"two_factor",` to the expected table list between `"skill_category_i18n",` and `"user",`.

Replace `tests/db/action-mocks.ts` (`OWNER` gains `twoFactorEnabled`):

```ts
import { vi } from "vitest";
import type { AdminSession } from "@/server/auth/read-session";
import { user } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import type { MediaStore } from "@/server/media/store";
import { createTestDb } from "./test-db";

// Shared state behind the vi.mock factories in the admin action tests:
//   vi.mock("@/server/db", () => import("./action-mocks").then((m) => m.dbModule));
// Server actions then run against PGlite, a controllable session, a spy for
// updateTag and a redirect that throws like Next's does.

export const OWNER: AdminSession = {
  userId: "owner",
  email: "owner@example.com",
  name: "Owner",
  twoFactorEnabled: false,
};

export const mocks = {
  db: undefined as unknown as Db,
  session: null as AdminSession | null,
  media: undefined as unknown as MediaStore,
  updateTag: vi.fn(),
};

export const dbModule = { getDb: () => mocks.db };
export const authModule = { getAdminSession: async () => mocks.session };
export const cacheModule = { updateTag: mocks.updateTag };
export const navigationModule = {
  redirect: (url: string): never => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
};
export const mediaModule = { getMediaStore: () => mocks.media };

/** Fresh PGlite with the owner user row (audit_log.user_id references it). */
export async function setupActionDb(): Promise<() => Promise<void>> {
  const { db, close } = await createTestDb();
  mocks.db = db;
  await db.insert(user).values({
    id: OWNER.userId,
    name: OWNER.name,
    email: OWNER.email,
    emailVerified: true,
  });
  return close;
}
```

`tests/e2e/admin-security.spec.ts` (runs in the `security` project, after every other admin spec, because it turns 2FA on for the shared owner):

```ts
import { expect, test } from "@playwright/test";
import { TOTP } from "otpauth";
import { E2E_ADMIN } from "./admin-credentials";
import { signInAsOwner } from "./admin-login";

test("TOTP: set up, sign in with a code, turn off", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/admin/security");
  await page
    .getByRole("textbox", { name: "Password" })
    .fill(E2E_ADMIN.password);
  await page
    .getByRole("button", { name: "Set up an authenticator app" })
    .click();

  const secret = await page.getByTestId("totp-secret").textContent();
  const totp = new TOTP({ secret: secret ?? "" });
  await page.getByLabel("Code from the app").fill(totp.generate());
  await page
    .getByRole("button", { name: "Turn on two-factor sign-in" })
    .click();
  await expect(page.getByText("Two-factor sign-in is on.")).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/admin/login");
  await page.getByRole("textbox", { name: "Email" }).fill(E2E_ADMIN.email);
  await page
    .getByRole("textbox", { name: "Password" })
    .fill(E2E_ADMIN.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/admin/login/two-factor");

  // The password alone is not a session.
  await page.goto("/admin/profile");
  await expect(page).toHaveURL("/admin/login");
  await page.getByRole("textbox", { name: "Email" }).fill(E2E_ADMIN.email);
  await page
    .getByRole("textbox", { name: "Password" })
    .fill(E2E_ADMIN.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/admin/login/two-factor");

  await page.getByLabel("Authenticator code").fill("000000");
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page.locator("form").getByRole("alert")).toHaveText(
    "That code is not valid, or the sign-in expired. Try again.",
  );

  await page.getByLabel("Authenticator code").fill(totp.generate());
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page).toHaveURL("/admin/profile");

  await page.goto("/admin/security");
  await page
    .getByRole("textbox", { name: "Password" })
    .fill(E2E_ADMIN.password);
  await page
    .getByRole("button", { name: "Turn off two-factor sign-in" })
    .click();
  await expect(page.getByText("Two-factor sign-in is off.")).toBeVisible();
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `pnpm test`
Expected: FAIL with

```
 × creates every spec §4 table plus the Better Auth tables
 × enables 2FA only after the first code is confirmed
 × asks for a code after the password, and a wrong code gives no session
 × a correct code completes the sign-in
 × `admin:create --reset-2fa` turns it off for a lost authenticator
TypeError: auth.api.enableTwoFactor is not a function
 Test Files  2 failed | 15 passed (17)
      Tests  5 failed | 126 passed (131)
```

Run: `pnpm exec playwright test --project security --no-deps`
Expected: `1 failed`: `/admin/security` is a 404, so it waits for `getByRole('textbox', { name: 'Password' })`.

- [ ] **Step 4: Add the plugin tables and generate the migration**

Replace `src/server/db/schema/auth.ts`:

```ts
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

// Better Auth 1.7.5 core tables, as printed by `npx auth@1.7.5 generate`
// (relations dropped: nothing here uses drizzle's relational queries).
// Plugin tables follow the core ones.

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_userId_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("account_userId_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

// twoFactor() plugin (TOTP + backup codes).
export const twoFactor = pgTable(
  "two_factor",
  {
    id: text("id").primaryKey(),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    verified: boolean("verified").default(true),
    failedVerificationCount: integer("failed_verification_count").default(0),
    lockedUntil: timestamp("locked_until"),
  },
  (t) => [
    index("twoFactor_secret_idx").on(t.secret),
    index("twoFactor_userId_idx").on(t.userId),
  ],
);
```

Run: `pnpm db:generate --name two_factor`
Expected: `[✓] Your SQL migration file ➜ drizzle/0001_two_factor.sql 🚀`. The file creates `two_factor` (with its foreign key and two indexes) and runs `ALTER TABLE "user" ADD COLUMN "two_factor_enabled" boolean DEFAULT false`.

Run: `pnpm db:migrate`
Expected: `migrations applied`.

- [ ] **Step 5: Turn the plugin on**

Replace `src/server/auth/create-auth.ts`:

```ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins";
import * as schema from "@/server/db/schema";
import type { Db } from "@/server/db/types";

export type AuthConfig = {
  db: Db;
  secret: string;
  baseURL: string;
  /** The only identity allowed to exist (spec §5: ADMIN_EMAIL allowlist). */
  adminEmail: string;
};

export const MIN_PASSWORD_LENGTH = 12;

/**
 * Single-owner Better Auth: email + password, public sign-up disabled, and
 * every user creation outside ADMIN_EMAIL rejected. The owner account is
 * created by `pnpm admin:create` (see ./admin.ts).
 */
export function createAuth(config: AuthConfig) {
  const adminEmail = config.adminEmail.toLowerCase();

  return betterAuth({
    appName: "CV admin",
    baseURL: config.baseURL,
    secret: config.secret,
    database: drizzleAdapter(config.db, { provider: "pg", schema }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
    },
    databaseHooks: {
      user: {
        create: {
          // Runs for every user insert, including `pnpm admin:create`.
          before: async (user) => {
            if (user.email.toLowerCase() !== adminEmail) {
              throw new APIError("FORBIDDEN", {
                message: "Only ADMIN_EMAIL may have an account.",
              });
            }
          },
        },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    // nextCookies() must stay last: it writes Set-Cookie from server actions.
    plugins: [twoFactor({ issuer: "CV admin" }), nextCookies()],
  });
}

export type Auth = ReturnType<typeof createAuth>;
```

Replace `src/server/auth/read-session.ts`:

```ts
import type { Auth } from "./create-auth";

export type AdminSession = {
  userId: string;
  email: string;
  name: string;
  twoFactorEnabled: boolean;
};

/**
 * The signed-in owner for these request headers, or null. A valid session for
 * any other email (for example after ADMIN_EMAIL changed) counts as signed out.
 */
export async function readAdminSession(
  auth: Auth,
  headers: Headers,
  adminEmail: string,
): Promise<AdminSession | null> {
  const result = await auth.api.getSession({ headers });
  if (!result || result.user.email.toLowerCase() !== adminEmail.toLowerCase()) {
    return null;
  }
  return {
    userId: result.user.id,
    email: result.user.email,
    name: result.user.name,
    twoFactorEnabled: result.user.twoFactorEnabled === true,
  };
}
```

Replace `src/server/auth/admin.ts`:

```ts
import { eq } from "drizzle-orm";
import { twoFactor, user as userTable } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import type { Auth } from "./create-auth";

export type UpsertAdminResult = "created" | "updated";

/**
 * Creates the owner account, or resets its password (and signs out every
 * session) when it already exists. Public sign-up is disabled, so this is the
 * only way an account comes into being. `resetSecondFactors` is the recovery
 * path for a lost phone: it removes the TOTP secret and turns 2FA off.
 */
export async function upsertAdmin(
  auth: Auth,
  input: {
    email: string;
    password: string;
    name: string;
    adminEmail: string;
    resetSecondFactors?: { db: Db };
  },
): Promise<UpsertAdminResult> {
  const email = input.email.toLowerCase();
  if (email !== input.adminEmail.toLowerCase()) {
    throw new Error(`Refusing to create ${email}: it is not ADMIN_EMAIL.`);
  }

  const ctx = await auth.$context;
  const { minPasswordLength, maxPasswordLength } = ctx.password.config;
  if (
    input.password.length < minPasswordLength ||
    input.password.length > maxPasswordLength
  ) {
    throw new Error(
      `The password must be ${minPasswordLength} to ${maxPasswordLength} characters long.`,
    );
  }
  const hash = await ctx.password.hash(input.password);

  const existing = await ctx.internalAdapter.findUserByEmail(email, {
    includeAccounts: true,
  });
  if (existing) {
    const userId = existing.user.id;
    const credential = existing.accounts.find(
      (account) => account.providerId === "credential",
    );
    if (credential) {
      await ctx.internalAdapter.updatePassword(userId, hash);
    } else {
      await ctx.internalAdapter.linkAccount({
        userId,
        providerId: "credential",
        accountId: userId,
        password: hash,
      });
    }
    if (input.resetSecondFactors) {
      const { db } = input.resetSecondFactors;
      await db.delete(twoFactor).where(eq(twoFactor.userId, userId));
      await db
        .update(userTable)
        .set({ twoFactorEnabled: false })
        .where(eq(userTable.id, userId));
    }
    await ctx.internalAdapter.deleteUserSessions(userId);
    return "updated";
  }

  const user = await ctx.internalAdapter.createUser(
    { email, name: input.name, emailVerified: true },
    { method: "admin" },
  );
  await ctx.internalAdapter.linkAccount({
    userId: user.id,
    providerId: "credential",
    accountId: user.id,
    password: hash,
  });
  return "created";
}
```

Replace `scripts/admin-create.ts`:

```ts
import { stdin, stdout } from "node:process";
import { upsertAdmin } from "@/server/auth/admin";
import { createAuth } from "@/server/auth/create-auth";
import { createDb } from "@/server/db/create-db";
import { requireEnv } from "./require-env";

// `pnpm admin:create` creates the owner account for ADMIN_EMAIL, or resets its
// password. The password comes from ADMIN_PASSWORD (CI, e2e) or a hidden prompt.
// `pnpm admin:create --reset-2fa` also turns two-factor sign-in off (lost phone).
async function main() {
  const adminEmail = requireEnv("ADMIN_EMAIL");
  const password =
    process.env.ADMIN_PASSWORD || (await promptHidden("Admin password: "));
  const { db, pool } = createDb(requireEnv("DATABASE_URL"));
  try {
    const auth = createAuth({
      db,
      secret: requireEnv("BETTER_AUTH_SECRET"),
      baseURL: "http://localhost:3000",
      adminEmail,
    });
    const result = await upsertAdmin(auth, {
      email: adminEmail,
      password,
      name: "Owner",
      adminEmail,
      resetSecondFactors: process.argv.includes("--reset-2fa")
        ? { db }
        : undefined,
    });
    console.log(
      result === "created"
        ? `created admin ${adminEmail}`
        : `reset the password of ${adminEmail} and signed out its sessions`,
    );
  } finally {
    await pool.end();
  }
}

/** Reads one line from the terminal without echoing it. */
function promptHidden(question: string): Promise<string> {
  if (!stdin.isTTY) {
    throw new Error("Set ADMIN_PASSWORD or run this in a terminal.");
  }
  stdout.write(question);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");
  return new Promise((resolve, reject) => {
    let value = "";
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === "\r" || char === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          stdout.write("\n");
          resolve(value);
          return;
        }
        if (char === "\u0003") {
          stdin.setRawMode(false);
          reject(new Error("Cancelled."));
          return;
        }
        value = char === "\u007f" ? value.slice(0, -1) : value + char;
      }
    };
    stdin.on("data", onData);
  });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
```

Replace `scripts/e2e-db.ts`:

```ts
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";
import { upsertAdmin } from "@/server/auth/admin";
import { createAuth } from "@/server/auth/create-auth";
import { createDb } from "@/server/db/create-db";
import { seedContent } from "@/server/db/seed";
import { requireEnv } from "./require-env";

// Prepares the e2e database named in DATABASE_URL (playwright.config.ts points
// it at `cv_e2e`, never the dev database): creates it if missing, applies the
// migrations, resets the CV content to the fixtures and (re)creates the owner
// account from ADMIN_EMAIL / ADMIN_PASSWORD.
async function main() {
  const url = new URL(requireEnv("DATABASE_URL"));
  const name = url.pathname.slice(1);
  if (!/^[a-z0-9_]+$/.test(name)) {
    throw new Error(`Unexpected e2e database name: ${name}`);
  }

  const maintenance = new URL(url);
  maintenance.pathname = "/postgres";
  const client = new Client({ connectionString: maintenance.toString() });
  await client.connect();
  try {
    const found = await client.query(
      "select 1 from pg_database where datname = $1",
      [name],
    );
    if (found.rowCount === 0) {
      await client.query(`create database "${name}"`);
    }
  } finally {
    await client.end();
  }

  const { db, pool } = createDb(url.toString());
  try {
    await migrate(db, { migrationsFolder: "drizzle" });
    await seedContent(db, { reset: true });
    const adminEmail = requireEnv("ADMIN_EMAIL");
    const auth = createAuth({
      db,
      secret: requireEnv("BETTER_AUTH_SECRET"),
      baseURL: "http://localhost:3100",
      adminEmail,
    });
    await upsertAdmin(auth, {
      email: adminEmail,
      password: requireEnv("ADMIN_PASSWORD"),
      name: "E2E Owner",
      adminEmail,
      resetSecondFactors: { db },
    });
    console.log(`e2e database ${name} ready`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
```

Run: `pnpm test`
Expected: `Test Files  17 passed (17)`, `Tests  134 passed (134)`.

Run: `ADMIN_PASSWORD=local-admin-password-1 pnpm admin:create --reset-2fa`
Expected: `reset the password of <owner email> and signed out its sessions`.

- [ ] **Step 6: Add the second sign-in step**

Replace `src/server/actions/auth.ts`:

```ts
"use server";

import { isAPIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/server/auth";

export type SignInState = { error?: string };

const credentials = z.object({
  email: z.email(),
  password: z.string().min(1).max(128),
});

export async function signIn(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Enter your email and password." };
  }
  let twoFactor = false;
  try {
    const result = await auth.api.signInEmail({
      body: parsed.data,
      headers: await headers(),
    });
    twoFactor =
      "twoFactorRedirect" in result && result.twoFactorRedirect === true;
  } catch (error) {
    if (isAPIError(error)) {
      // One message for every failure: never reveal whether the email exists.
      return {
        error:
          error.statusCode === 429
            ? "Too many attempts. Wait a minute and try again."
            : "Wrong email or password.",
      };
    }
    throw error;
  }
  // With 2FA on, the password only earns a short-lived "two factor" cookie.
  redirect(twoFactor ? "/admin/login/two-factor" : "/admin");
}

const totpCode = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/),
});

/** Second sign-in step: the authenticator code turns the 2FA cookie into a session. */
export async function verifySignInCode(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = totpCode.safeParse({ code: formData.get("code") });
  if (!parsed.success) {
    return { error: "Enter the 6-digit code from your authenticator app." };
  }
  try {
    await auth.api.verifyTOTP({
      body: { code: parsed.data.code },
      headers: await headers(),
    });
  } catch (error) {
    if (isAPIError(error)) {
      return {
        error:
          error.statusCode === 429
            ? "Too many attempts. Wait a minute and try again."
            : "That code is not valid, or the sign-in expired. Try again.",
      };
    }
    throw error;
  }
  redirect("/admin");
}

export async function signOut(): Promise<void> {
  await auth.api.signOut({ headers: await headers() });
  redirect("/admin/login");
}
```

`src/components/admin/CodeForm.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { type SignInState, verifySignInCode } from "@/server/actions/auth";
import { button, field, label } from "./styles";

export function CodeForm() {
  const [state, action, pending] = useActionState<SignInState, FormData>(
    verifySignInCode,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-5">
      <label className={label}>
        Authenticator code
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          className={field}
        />
      </label>
      <p role="alert" className="min-h-6 text-sm text-ink">
        {state.error}
      </p>
      <button type="submit" disabled={pending} className={button}>
        {pending ? "Checking…" : "Verify"}
      </button>
    </form>
  );
}
```

`src/app/admin/login/two-factor/page.tsx` (the proxy already lets `/admin/login/*` through without a session):

```tsx
import type { Metadata } from "next";
import { CodeForm } from "@/components/admin/CodeForm";
import { panel } from "@/components/admin/styles";

export const metadata: Metadata = { title: "Two-factor sign-in" };

export default function TwoFactorPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-gutter">
      <h1 className="text-heading text-ink">Enter your authenticator code</h1>
      <div className={panel}>
        <CodeForm />
      </div>
    </main>
  );
}
```

- [ ] **Step 7: Add the security page**

`src/server/actions/two-factor.ts`:

```ts
"use server";

import { isAPIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionResult } from "@/server/admin/action-result";
import { formToObject } from "@/server/admin/form-data";
import { UNAUTHORIZED } from "@/server/admin/run-action";
import { auth, getAdminSession } from "@/server/auth";

/** ActionResult plus the one-time setup data shown after the password check. */
export type TwoFactorState =
  | ActionResult
  | { status: "setup"; secret: string; totpURI: string; backupCodes: string[] };

const passwordInput = z.object({ password: z.string().min(1).max(128) });
const codeInput = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code"),
});

/** Step 1: re-check the password, create a TOTP secret (not active yet). */
export async function startTwoFactor(
  _previous: TwoFactorState,
  formData: FormData,
): Promise<TwoFactorState> {
  if (!(await getAdminSession())) {
    return UNAUTHORIZED;
  }
  const parsed = passwordInput.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { status: "error", code: 400, message: "Enter your password." };
  }
  try {
    const setup = await auth.api.enableTwoFactor({
      body: { password: parsed.data.password, method: "totp" },
      headers: await headers(),
    });
    if (setup.method !== "totp") {
      return { status: "error", code: 400, message: "TOTP is not available." };
    }
    return {
      status: "setup",
      secret: new URL(setup.totpURI).searchParams.get("secret") ?? "",
      totpURI: setup.totpURI,
      backupCodes: setup.backupCodes,
    };
  } catch (error) {
    if (isAPIError(error)) {
      return { status: "error", code: 400, message: "Wrong password." };
    }
    throw error;
  }
}

/**
 * Step 2: the first valid code turns 2FA on. Better Auth rotates the session
 * at that moment, so the action redirects: re-rendering this request would
 * still carry the revoked cookie and bounce to the login page.
 */
export async function confirmTwoFactor(
  _previous: TwoFactorState,
  formData: FormData,
): Promise<TwoFactorState> {
  if (!(await getAdminSession())) {
    return UNAUTHORIZED;
  }
  const parsed = codeInput.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { status: "error", code: 400, message: "Enter the 6-digit code." };
  }
  try {
    await auth.api.verifyTOTP({
      body: { code: parsed.data.code },
      headers: await headers(),
    });
  } catch (error) {
    if (isAPIError(error)) {
      return {
        status: "error",
        code: 400,
        message: "That code is not valid. Try the next one.",
      };
    }
    throw error;
  }
  redirect("/admin/security");
}

export async function disableTwoFactor(
  _previous: TwoFactorState,
  formData: FormData,
): Promise<TwoFactorState> {
  if (!(await getAdminSession())) {
    return UNAUTHORIZED;
  }
  const parsed = passwordInput.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { status: "error", code: 400, message: "Enter your password." };
  }
  try {
    await auth.api.disableTwoFactor({
      body: { password: parsed.data.password },
      headers: await headers(),
    });
  } catch (error) {
    if (isAPIError(error)) {
      return { status: "error", code: 400, message: "Wrong password." };
    }
    throw error;
  }
  // Disabling also rotates the session (see confirmTwoFactor).
  redirect("/admin/security");
}
```

`src/components/admin/TwoFactorSettings.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import {
  confirmTwoFactor,
  disableTwoFactor,
  startTwoFactor,
  type TwoFactorState,
} from "@/server/actions/two-factor";
import { IDLE } from "@/server/admin/action-result";
import { button, field, label, panel } from "./styles";

function Message({ state }: { state: TwoFactorState }) {
  return (
    <p role="status" className="min-h-6 text-sm text-ink-muted">
      {state.status === "ok" || state.status === "error" ? state.message : ""}
    </p>
  );
}

/** Turn TOTP on (password, then scan, then first code) or off (password). */
export function TwoFactorSettings({ enabled }: { enabled: boolean }) {
  const [setup, start, starting] = useActionState(startTwoFactor, IDLE);
  const [confirmed, confirm, confirming] = useActionState(
    confirmTwoFactor,
    IDLE,
  );
  const [disabled, disable, disabling] = useActionState(disableTwoFactor, IDLE);

  if (enabled || confirmed.status === "ok") {
    return (
      <div className={`${panel} flex flex-col gap-4`}>
        <p className="text-ink">Two-factor sign-in is on.</p>
        {disabled.status === "ok" ? (
          <Message state={disabled} />
        ) : (
          <form action={disable} className="flex flex-col gap-4">
            <label className={label}>
              Password
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className={field}
              />
            </label>
            <button type="submit" disabled={disabling} className={button}>
              Turn off two-factor sign-in
            </button>
            <Message state={disabled} />
          </form>
        )}
      </div>
    );
  }

  if (setup.status === "setup") {
    return (
      <div className={`${panel} flex flex-col gap-4`}>
        <p className="text-ink">
          Add this key to your authenticator app, then enter the code it shows.
        </p>
        <p>
          <span className={label}>Setup key</span>
          <code
            data-testid="totp-secret"
            className="mt-1 block font-mono text-ink wrap-anywhere"
          >
            {setup.secret}
          </code>
        </p>
        <details>
          <summary className="text-sm text-ink-muted">
            Backup codes (store them offline)
          </summary>
          <ul className="mt-2 grid grid-cols-2 gap-1 font-mono text-sm text-ink">
            {setup.backupCodes.map((code) => (
              <li key={code}>{code}</li>
            ))}
          </ul>
        </details>
        <form action={confirm} className="flex flex-col gap-4">
          <label className={label}>
            Code from the app
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              className={field}
            />
          </label>
          <button type="submit" disabled={confirming} className={button}>
            Turn on two-factor sign-in
          </button>
          <Message state={confirmed} />
        </form>
      </div>
    );
  }

  return (
    <form action={start} className={`${panel} flex flex-col gap-4`}>
      <p className="text-ink">Two-factor sign-in is off.</p>
      <label className={label}>
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={field}
        />
      </label>
      <button type="submit" disabled={starting} className={button}>
        Set up an authenticator app
      </button>
      <Message state={setup} />
    </form>
  );
}
```

`src/app/admin/(panel)/security/page.tsx`:

```tsx
import type { Metadata } from "next";
import { TwoFactorSettings } from "@/components/admin/TwoFactorSettings";
import { requireAdmin } from "@/server/auth";

export const metadata: Metadata = { title: "Security" };

export default async function SecurityPage() {
  const session = await requireAdmin();

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <h1 className="text-title text-ink">Security</h1>
      <h2 className="text-heading text-ink">Two-factor sign-in (TOTP)</h2>
      <TwoFactorSettings enabled={session.twoFactorEnabled} />
    </div>
  );
}
```

- [ ] **Step 8: Verify**

Run: `pnpm test:e2e`
Expected: `61 passed` (`security` 1). The guard test in `pnpm test` now also lists `startTwoFactor`, `confirmTwoFactor`, `disableTwoFactor`.

Run: `pnpm typecheck`
Expected: `✓ Types generated successfully`, exit 0.

Run: `rtk proxy pnpm lint`
Expected: `Checked 157 files in <n>ms. No fixes applied.`

- [ ] **Step 9: Commit**

```bash
/usr/bin/git add drizzle package.json pnpm-lock.yaml scripts src tests
/usr/bin/git commit -m "feat(auth): add totp two-factor sign-in"
```

---

### Task 13 (M2b): Passkeys

**Owner:** backend-engineer (with one browser-side widget pair; frontend-engineer optional)

**Files:**
- Create: `src/lib/auth-client.ts`, `src/components/admin/PasskeySignIn.tsx`, `src/components/admin/PasskeySettings.tsx`, `src/server/actions/passkeys.ts`, `drizzle/0002_passkey.sql` + `drizzle/meta/*` (generated), `tests/db/passkeys.test.ts`
- Modify: `src/server/db/schema/auth.ts`, `src/server/auth/create-auth.ts`, `src/server/auth/admin.ts`, `scripts/admin-create.ts`, `src/app/admin/login/page.tsx`, `src/app/admin/(panel)/security/page.tsx`, `tests/db/schema.test.ts`, `tests/db/action-mocks.ts`, `tests/e2e/admin-security.spec.ts`, `package.json`, `pnpm-lock.yaml`

**Interfaces:**
- Consumes: Task 12 (security page, `resetSecondFactors`), Task 8 (`ActionButton`), Task 5 (auth factory).
- Produces:
  - The `passkey` table (migration `0002_passkey`); `passkey({ rpID: <baseURL host name>, rpName: "CV admin", origin: <baseURL origin> })` in `createAuth`. A passkey only works on the host it was registered on, so a later domain change (M9) means registering again.
  - `authClient` from `@/lib/auth-client` (`createAuthClient` + `passkeyClient()`), imported only by the two widgets below, so no auth code reaches `/en` or `/ro`.
  - `<PasskeySignIn />` on `/admin/login` ("Sign in with a passkey", then a full navigation to `/admin`), `<PasskeySettings passkeys />` on `/admin/security` (list, "Add a passkey", remove).
  - `deletePasskey: AdminFormAction` in `@/server/actions/passkeys` (401 without a session, `refresh()` after success because passkeys are not CV content).
  - `resetSecondFactors` / `--reset-2fa` now also deletes every passkey (lost laptop).
  - A passkey sign-in creates a session without the TOTP step (a passkey is itself a phishing-resistant factor). See the open question in the Self-review.

- [ ] **Step 1: Add the plugin**

```bash
pnpm add -E @better-auth/passkey@1.7.5
```

Expected: `+ @better-auth/passkey 1.7.5` (its peers `nanostores`, `better-call`, `@better-fetch/fetch`, … are already present through `better-auth`).

- [ ] **Step 2: Write the failing tests**

`tests/db/passkeys.test.ts`:

```ts
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { upsertAdmin } from "@/server/auth/admin";
import { type Auth, createAuth } from "@/server/auth/create-auth";
import { passkey, user } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { createTestDb } from "./test-db";

const ADMIN = "owner@example.com";
const PASSWORD = "correct-horse-battery";

let db: Db;
let close: () => Promise<void>;
let auth: Auth;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  auth = createAuth({
    db,
    secret: "test-secret-that-is-at-least-32-chars",
    baseURL: "http://localhost:3000",
    adminEmail: ADMIN,
  });
  await upsertAdmin(auth, {
    email: ADMIN,
    password: PASSWORD,
    name: "Owner",
    adminEmail: ADMIN,
  });
});

afterAll(async () => {
  await close();
});

describe("passkeys", () => {
  it("offers WebAuthn registration bound to the site's origin", async () => {
    const response = await auth.api.signInEmail({
      body: { email: ADMIN, password: PASSWORD },
      asResponse: true,
    });
    const cookie = response.headers
      .getSetCookie()
      .map((header) => header.split(";")[0])
      .join("; ");

    const options = await auth.api.generatePasskeyRegistrationOptions({
      headers: new Headers({ cookie }),
    });

    expect(options.rp).toEqual({ id: "localhost", name: "CV admin" });
    expect(options.user.name).toBe(ADMIN);
  });

  it("`admin:create --reset-2fa` removes every passkey (lost laptop)", async () => {
    const [owner] = await db.select().from(user).where(eq(user.email, ADMIN));
    await db.insert(passkey).values({
      id: "pk-1",
      name: "Old laptop",
      publicKey: "public-key",
      userId: owner.id,
      credentialID: "credential-1",
      counter: 0,
      deviceType: "singleDevice",
      backedUp: false,
    });

    await upsertAdmin(auth, {
      email: ADMIN,
      password: PASSWORD,
      name: "Owner",
      adminEmail: ADMIN,
      resetSecondFactors: { db },
    });

    expect(await db.select().from(passkey)).toEqual([]);
  });
});
```

In `tests/db/schema.test.ts`, add `"passkey",` to the expected table list between `"message",` and `"profile",`.

In `tests/db/action-mocks.ts`, replace the `cacheModule` line with:

```ts
export const cacheModule = { updateTag: mocks.updateTag, refresh: vi.fn() };
```

Append to `tests/e2e/admin-security.spec.ts`:

```ts

test("passkey: register one, then sign in with it", async ({
  page,
  context,
}) => {
  // Chrome's virtual authenticator stands in for Touch ID / Windows Hello.
  const cdp = await context.newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
    },
  });

  await signInAsOwner(page);
  await page.goto("/admin/security");
  await page.getByRole("textbox", { name: "Passkey name" }).fill("Test laptop");
  await page.getByRole("button", { name: "Add a passkey" }).click();
  await expect(page.getByText("Passkey added.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Remove Test laptop" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/admin/login");
  await page.getByRole("button", { name: "Sign in with a passkey" }).click();
  await expect(page).toHaveURL("/admin/profile");

  await page.goto("/admin/security");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Remove Test laptop" }).click();
  await expect(page.getByText("No passkeys yet.")).toBeVisible();
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `pnpm test`
Expected: FAIL with

```
 × creates every spec §4 table plus the Better Auth tables
 × offers WebAuthn registration bound to the site's origin
 × `admin:create --reset-2fa` removes every passkey (lost laptop)
TypeError: auth.api.generatePasskeyRegistrationOptions is not a function
 Test Files  2 failed | 16 passed (18)
      Tests  3 failed | 133 passed (136)
```

Run: `pnpm exec playwright test --project security --no-deps -g passkey`
Expected: `1 failed`, waiting for `getByRole('textbox', { name: 'Passkey name' })`.

- [ ] **Step 4: Add the table and generate the migration**

Replace `src/server/db/schema/auth.ts`:

```ts
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

// Better Auth 1.7.5 core tables, as printed by `npx auth@1.7.5 generate`
// (relations dropped: nothing here uses drizzle's relational queries).
// Plugin tables follow the core ones.

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_userId_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("account_userId_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

// twoFactor() plugin (TOTP + backup codes).
export const twoFactor = pgTable(
  "two_factor",
  {
    id: text("id").primaryKey(),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    verified: boolean("verified").default(true),
    failedVerificationCount: integer("failed_verification_count").default(0),
    lockedUntil: timestamp("locked_until"),
  },
  (t) => [
    index("twoFactor_secret_idx").on(t.secret),
    index("twoFactor_userId_idx").on(t.userId),
  ],
);

// passkey() plugin (WebAuthn credentials).
export const passkey = pgTable(
  "passkey",
  {
    id: text("id").primaryKey(),
    name: text("name"),
    publicKey: text("public_key").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    credentialID: text("credential_id").notNull(),
    counter: integer("counter").notNull(),
    deviceType: text("device_type").notNull(),
    backedUp: boolean("backed_up").notNull(),
    transports: text("transports"),
    createdAt: timestamp("created_at"),
    aaguid: text("aaguid"),
  },
  (t) => [
    index("passkey_userId_idx").on(t.userId),
    index("passkey_credentialID_idx").on(t.credentialID),
  ],
);
```

Run: `pnpm db:generate --name passkey`
Expected: `[✓] Your SQL migration file ➜ drizzle/0002_passkey.sql 🚀`.

Run: `pnpm db:migrate`
Expected: `migrations applied`.

- [ ] **Step 5: Turn the plugin on and extend the recovery path**

Replace `src/server/auth/create-auth.ts`:

```ts
import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins";
import * as schema from "@/server/db/schema";
import type { Db } from "@/server/db/types";

export type AuthConfig = {
  db: Db;
  secret: string;
  baseURL: string;
  /** The only identity allowed to exist (spec §5: ADMIN_EMAIL allowlist). */
  adminEmail: string;
};

export const MIN_PASSWORD_LENGTH = 12;

/**
 * Single-owner Better Auth: email + password, public sign-up disabled, and
 * every user creation outside ADMIN_EMAIL rejected. The owner account is
 * created by `pnpm admin:create` (see ./admin.ts).
 */
export function createAuth(config: AuthConfig) {
  const adminEmail = config.adminEmail.toLowerCase();
  const origin = new URL(config.baseURL);

  return betterAuth({
    appName: "CV admin",
    baseURL: config.baseURL,
    secret: config.secret,
    database: drizzleAdapter(config.db, { provider: "pg", schema }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
    },
    databaseHooks: {
      user: {
        create: {
          // Runs for every user insert, including `pnpm admin:create`.
          before: async (user) => {
            if (user.email.toLowerCase() !== adminEmail) {
              throw new APIError("FORBIDDEN", {
                message: "Only ADMIN_EMAIL may have an account.",
              });
            }
          },
        },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    // nextCookies() must stay last: it writes Set-Cookie from server actions.
    plugins: [
      twoFactor({ issuer: "CV admin" }),
      // WebAuthn is bound to the site's host name and exact origin.
      passkey({
        rpID: origin.hostname,
        rpName: "CV admin",
        origin: origin.origin,
      }),
      nextCookies(),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
```

Replace `src/server/auth/admin.ts`:

```ts
import { eq } from "drizzle-orm";
import { passkey, twoFactor, user as userTable } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import type { Auth } from "./create-auth";

export type UpsertAdminResult = "created" | "updated";

/**
 * Creates the owner account, or resets its password (and signs out every
 * session) when it already exists. Public sign-up is disabled, so this is the
 * only way an account comes into being. `resetSecondFactors` is the recovery
 * path for a lost phone or laptop: it removes the TOTP secret (2FA off) and
 * every registered passkey.
 */
export async function upsertAdmin(
  auth: Auth,
  input: {
    email: string;
    password: string;
    name: string;
    adminEmail: string;
    resetSecondFactors?: { db: Db };
  },
): Promise<UpsertAdminResult> {
  const email = input.email.toLowerCase();
  if (email !== input.adminEmail.toLowerCase()) {
    throw new Error(`Refusing to create ${email}: it is not ADMIN_EMAIL.`);
  }

  const ctx = await auth.$context;
  const { minPasswordLength, maxPasswordLength } = ctx.password.config;
  if (
    input.password.length < minPasswordLength ||
    input.password.length > maxPasswordLength
  ) {
    throw new Error(
      `The password must be ${minPasswordLength} to ${maxPasswordLength} characters long.`,
    );
  }
  const hash = await ctx.password.hash(input.password);

  const existing = await ctx.internalAdapter.findUserByEmail(email, {
    includeAccounts: true,
  });
  if (existing) {
    const userId = existing.user.id;
    const credential = existing.accounts.find(
      (account) => account.providerId === "credential",
    );
    if (credential) {
      await ctx.internalAdapter.updatePassword(userId, hash);
    } else {
      await ctx.internalAdapter.linkAccount({
        userId,
        providerId: "credential",
        accountId: userId,
        password: hash,
      });
    }
    if (input.resetSecondFactors) {
      const { db } = input.resetSecondFactors;
      await db.delete(twoFactor).where(eq(twoFactor.userId, userId));
      await db.delete(passkey).where(eq(passkey.userId, userId));
      await db
        .update(userTable)
        .set({ twoFactorEnabled: false })
        .where(eq(userTable.id, userId));
    }
    await ctx.internalAdapter.deleteUserSessions(userId);
    return "updated";
  }

  const user = await ctx.internalAdapter.createUser(
    { email, name: input.name, emailVerified: true },
    { method: "admin" },
  );
  await ctx.internalAdapter.linkAccount({
    userId: user.id,
    providerId: "credential",
    accountId: user.id,
    password: hash,
  });
  return "created";
}
```

Replace `scripts/admin-create.ts`:

```ts
import { stdin, stdout } from "node:process";
import { upsertAdmin } from "@/server/auth/admin";
import { createAuth } from "@/server/auth/create-auth";
import { createDb } from "@/server/db/create-db";
import { requireEnv } from "./require-env";

// `pnpm admin:create` creates the owner account for ADMIN_EMAIL, or resets its
// password. The password comes from ADMIN_PASSWORD (CI, e2e) or a hidden prompt.
// `pnpm admin:create --reset-2fa` also turns TOTP off and removes every passkey
// (lost phone or laptop).
async function main() {
  const adminEmail = requireEnv("ADMIN_EMAIL");
  const password =
    process.env.ADMIN_PASSWORD || (await promptHidden("Admin password: "));
  const { db, pool } = createDb(requireEnv("DATABASE_URL"));
  try {
    const auth = createAuth({
      db,
      secret: requireEnv("BETTER_AUTH_SECRET"),
      baseURL: "http://localhost:3000",
      adminEmail,
    });
    const result = await upsertAdmin(auth, {
      email: adminEmail,
      password,
      name: "Owner",
      adminEmail,
      resetSecondFactors: process.argv.includes("--reset-2fa")
        ? { db }
        : undefined,
    });
    console.log(
      result === "created"
        ? `created admin ${adminEmail}`
        : `reset the password of ${adminEmail} and signed out its sessions`,
    );
  } finally {
    await pool.end();
  }
}

/** Reads one line from the terminal without echoing it. */
function promptHidden(question: string): Promise<string> {
  if (!stdin.isTTY) {
    throw new Error("Set ADMIN_PASSWORD or run this in a terminal.");
  }
  stdout.write(question);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");
  return new Promise((resolve, reject) => {
    let value = "";
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === "\r" || char === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          stdout.write("\n");
          resolve(value);
          return;
        }
        if (char === "\u0003") {
          stdin.setRawMode(false);
          reject(new Error("Cancelled."));
          return;
        }
        value = char === "\u007f" ? value.slice(0, -1) : value + char;
      }
    };
    stdin.on("data", onData);
  });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
```

Run: `pnpm test`
Expected: `Test Files  18 passed (18)`, `Tests  137 passed (137)`.

- [ ] **Step 6: Add the browser client, the widgets and the action**

`src/lib/auth-client.ts`:

```ts
import { passkeyClient } from "@better-auth/passkey/client";
import { createAuthClient } from "better-auth/react";

/**
 * Browser-side Better Auth client, used only by admin components that need
 * WebAuthn in the browser (passkey sign-in and registration). Everything else
 * goes through server actions.
 */
export const authClient = createAuthClient({ plugins: [passkeyClient()] });
```

`src/components/admin/PasskeySignIn.tsx`:

```tsx
"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { secondaryButton } from "./styles";

export function PasskeySignIn() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        disabled={pending}
        className={secondaryButton}
        onClick={async () => {
          setPending(true);
          setError("");
          const result = await authClient.signIn.passkey();
          if (result?.error) {
            setError(
              "Passkey sign-in did not complete. Try again or use your password.",
            );
            setPending(false);
            return;
          }
          // Full navigation so the new session cookie is sent with the request.
          window.location.assign("/admin");
        }}
      >
        Sign in with a passkey
      </button>
      <p role="status" className="min-h-6 text-sm text-ink">
        {error}
      </p>
    </div>
  );
}
```

`src/server/actions/passkeys.ts`:

```ts
"use server";

import { isAPIError } from "better-auth/api";
import { refresh } from "next/cache";
import { headers } from "next/headers";
import type { ActionResult } from "@/server/admin/action-result";
import { formToObject } from "@/server/admin/form-data";
import { UNAUTHORIZED } from "@/server/admin/run-action";
import { idInput } from "@/server/admin/schemas/fields";
import { auth, getAdminSession } from "@/server/auth";

export async function deletePasskey(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  if (!(await getAdminSession())) {
    return UNAUTHORIZED;
  }
  const parsed = idInput.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { status: "error", code: 400, message: "Unknown passkey." };
  }
  try {
    await auth.api.deletePasskey({
      body: { id: parsed.data.id },
      headers: await headers(),
    });
  } catch (error) {
    if (isAPIError(error)) {
      return {
        status: "error",
        code: 404,
        message: "This passkey no longer exists.",
      };
    }
    throw error;
  }
  // Passkeys are not CV content, so there is no tag to expire: re-render the page.
  refresh();
  return { status: "ok", message: "Passkey removed." };
}
```

`src/components/admin/PasskeySettings.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { deletePasskey } from "@/server/actions/passkeys";
import { ActionButton } from "./ActionButton";
import { button, field, label, panel } from "./styles";

export type PasskeyRow = { id: string; name: string | null };

/** Lists registered passkeys and adds a new one through the browser's WebAuthn prompt. */
export function PasskeySettings({ passkeys }: { passkeys: PasskeyRow[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <div className={`${panel} flex flex-col gap-4`}>
      {passkeys.length === 0 ? (
        <p className="text-ink">No passkeys yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {passkeys.map((key) => (
            <li
              key={key.id}
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <span className="text-ink">{key.name ?? "Passkey"}</span>
              <ActionButton
                action={deletePasskey}
                fields={{ id: key.id }}
                label={`Remove ${key.name ?? "passkey"}`}
                confirmMessage="Remove this passkey?"
              />
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex flex-col gap-4"
        onSubmit={async (event) => {
          event.preventDefault();
          const name = String(
            new FormData(event.currentTarget).get("name") ?? "",
          ).trim();
          setPending(true);
          setMessage("");
          const result = await authClient.passkey.addPasskey({
            name: name || "Passkey",
          });
          setPending(false);
          if (result?.error) {
            setMessage("The passkey was not added.");
            return;
          }
          setMessage("Passkey added.");
          router.refresh();
        }}
      >
        <label className={label}>
          Passkey name
          <input
            name="name"
            maxLength={60}
            placeholder="Laptop"
            className={field}
          />
        </label>
        <button type="submit" disabled={pending} className={button}>
          Add a passkey
        </button>
        <p role="status" className="min-h-6 text-sm text-ink-muted">
          {message}
        </p>
      </form>
    </div>
  );
}
```

Replace `src/app/admin/login/page.tsx`:

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/LoginForm";
import { PasskeySignIn } from "@/components/admin/PasskeySignIn";
import { panel } from "@/components/admin/styles";
import { getAdminSession } from "@/server/auth";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getAdminSession()) {
    redirect("/admin");
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-gutter">
      <h1 className="text-heading text-ink">Sign in to the admin</h1>
      <div className={`${panel} flex flex-col gap-6`}>
        <LoginForm />
        <PasskeySignIn />
      </div>
    </main>
  );
}
```

Replace `src/app/admin/(panel)/security/page.tsx`:

```tsx
import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { PasskeySettings } from "@/components/admin/PasskeySettings";
import { TwoFactorSettings } from "@/components/admin/TwoFactorSettings";
import { requireAdmin } from "@/server/auth";
import { getDb } from "@/server/db";
import { passkey } from "@/server/db/schema";

export const metadata: Metadata = { title: "Security" };

export default async function SecurityPage() {
  const session = await requireAdmin();
  const passkeys = await getDb()
    .select({ id: passkey.id, name: passkey.name })
    .from(passkey)
    .where(eq(passkey.userId, session.userId));

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <h1 className="text-title text-ink">Security</h1>
      <h2 className="text-heading text-ink">Two-factor sign-in (TOTP)</h2>
      <TwoFactorSettings enabled={session.twoFactorEnabled} />
      <h2 className="text-heading text-ink">Passkeys</h2>
      <PasskeySettings passkeys={passkeys} />
    </div>
  );
}
```

- [ ] **Step 7: Verify**

Run: `pnpm test:e2e`
Expected: `62 passed` (`public` 35, `admin` 25, `security` 2).

Run: `pnpm typecheck`
Expected: `✓ Types generated successfully`, exit 0.

Run: `rtk proxy pnpm lint`
Expected: `Checked 162 files in <n>ms. No fixes applied.`

- [ ] **Step 8: Commit**

```bash
/usr/bin/git add drizzle package.json pnpm-lock.yaml scripts src tests
/usr/bin/git commit -m "feat(auth): add passkey sign-in"
```

---

### Task 14: Docs and the M2 gate

**Owner:** backend-engineer (README); the Overseer runs the gate in Step 4 itself as evidence.

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: everything above.
- Produces: setup, scripts, database, admin and media documentation; the M2 acceptance evidence.

- [ ] **Step 1: Replace `README.md`**

````markdown
# CV

Cinematic fullstack CV / portfolio: Next.js 16 (App Router), next-intl (EN/RO),
Postgres, deployed on Vercel.

Design spec: [`docs/superpowers/specs/2026-09-23-cinematic-cv-design.md`](docs/superpowers/specs/2026-09-23-cinematic-cv-design.md)

## Prerequisites

- Node 24 (`node -v` prints `v24.x`)
- Corepack shims on `PATH` (bundled with Node). `pnpm` resolves to the version
  pinned in `package.json#packageManager` (pnpm 11.27.1). Run pnpm only inside
  this repo: `/home/mihai/package.json` pins yarn for everything else under `~`.
- Docker with Compose v2 (local Postgres)
- git-lfs (`sudo apt install git-lfs && git lfs install`) before committing
  anything under `public/seq/`, `public/3d/` or any `*.blend` file

## Setup

```bash
pnpm install
cp .env.example .env.local
docker compose up -d --wait
pnpm db:migrate
pnpm db:seed
pnpm admin:create
pnpm exec playwright install chromium
pnpm dev
```

Open http://localhost:3000 (redirects to `/en`; `/ro` serves Romanian) and
http://localhost:3000/admin (sign in as `ADMIN_EMAIL` with the password you
gave `pnpm admin:create`).

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Next dev server (Turbopack) on port 3000 |
| `pnpm build` / `pnpm start` | Production build / serve it |
| `pnpm typecheck` | `next typegen`, then `tsc --noEmit` for `src` and `tests` (TypeScript 7) |
| `pnpm lint` | Biome lint + format check |
| `pnpm format` | Biome format, writes files |
| `pnpm test` | Vitest unit tests (`tests/unit`) |
| `pnpm test:e2e` | Playwright e2e (`tests/e2e`, incl. axe); builds and serves on port 3100 |
| `pnpm lhci` | Lighthouse CI, desktop preset, on port 3200; asserts >= 0.95 in all 4 categories. Run `pnpm build` first |
| `pnpm db:generate --name <name>` | Drizzle Kit: write a SQL migration in `drizzle/` from schema changes (no database needed) |
| `pnpm db:migrate` | Apply pending migrations to `DATABASE_URL` |
| `pnpm db:seed` | Load the fixture CV into an empty database; `--reset` replaces all CV content |
| `pnpm admin:create` | Create the owner account for `ADMIN_EMAIL` or reset its password; `--reset-2fa` also removes TOTP and passkeys |

## Local database

`docker compose up -d --wait` starts `postgres:18-alpine` on `127.0.0.1:5432`
(user `cv`, password `cv`, database `cv`), matching `DATABASE_URL` in
`.env.example`. `docker compose down` stops it; add `-v` to delete the data volume.

`next build` prerenders `/en` and `/ro` from the database, so it needs a
migrated and seeded database. `pnpm test:e2e` uses a separate `cv_e2e`
database on the same server and resets it on every run. Unit tests use
PGlite (in-memory Postgres) and need no server.

## Site URL

Canonical URLs, hreflang links, `sitemap.xml`, `robots.txt` and the JSON-LD
`Person` use `SITE_URL` (see `.env.example`). Unset, Vercel builds use the
project's production domain and everything else uses `http://localhost:3000`.
These URLs are baked in at `next build`, so set `SITE_URL` before building.

## Content

CV content lives in Postgres (Drizzle schema in `src/server/db/schema/`,
migrations in `drizzle/`). `pnpm db:seed` loads the placeholder CV from
`src/content/fixtures.ts`. Public pages read it through `getCv(locale)`
(`'use cache'`, tag `cv`); every admin change calls `updateTag('cv')`, so
the next request renders the new content. A blank Romanian field falls
back to English (marked `lang="en"`).

## Admin

`/admin` is English-only and has one account: `ADMIN_EMAIL`. Public sign-up
is disabled; `pnpm admin:create` is the only way to create the account or
reset its password. Under **Security** the owner can turn on TOTP two-factor
sign-in and register passkeys. Lost phone or laptop:
`pnpm admin:create --reset-2fa`.

The proxy only checks that a session cookie exists; every admin layout, page
and server action re-checks the session against the database.

## Media uploads

Admin uploads (JPEG, PNG, WebP, AVIF, PDF; 4 MB max) go to Vercel Blob when
`BLOB_READ_WRITE_TOKEN` is set. Without it they are stored in `.data/media/`
and served by `/api/media/<key>` (local development, tests, CI).
````

Run: `rtk proxy pnpm lint`
Expected: `Checked 162 files in <n>ms. No fixes applied.` (Biome does not check Markdown.)

- [ ] **Step 2: Commit**

```bash
/usr/bin/git add README.md
/usr/bin/git status --short
/usr/bin/git commit -m "docs: document database, admin and media setup"
```

`git status --short` must print only `M  README.md`. `.data/`, `.next/`, `test-results/`, `playwright-report/` and `.lighthouseci/` are ignored.

- [ ] **Step 3: Check the history**

Run: `/usr/bin/git log --oneline dev..HEAD`
Expected (newest first; without Tasks 12–13 if they moved to a follow-up branch):

```
docs: document database, admin and media setup
feat(auth): add passkey sign-in
feat(auth): add totp two-factor sign-in
feat(media): upload to blob or local storage
feat(admin): edit projects with markdown preview
feat(admin): edit skills mapped to stack layers
feat(admin): edit and reorder experience
feat(admin): edit profile with en/ro side by side
feat(admin): gate /admin behind owner session
feat(auth): add single-owner better auth
ci: run postgres 18 service for build and e2e
feat(content): serve cv from cached postgres reads
feat(db): seed fixtures and load cv from postgres
feat(db): add drizzle schema and pglite tests
```

No commit message contains `Co-Authored-By`, `Claude` or `Generated with`: `/usr/bin/git log dev..HEAD --format=%B | grep -ciE 'co-authored|claude|generated with'` prints `0`.

- [ ] **Step 4: Run the full CI sequence on a fresh clone (M2 acceptance)**

This proves the committed branch passes with no local-only files: no `.env.local`, a random `BETTER_AUTH_SECRET`, the docker Postgres (`docker compose up -d --wait` must be running). Put it in a script, since the worktree guard rejects long compound one-liners. Replace `<scratch>` with the session scratchpad directory:

```bash
cat > <scratch>/m2-gate.sh <<'EOF'
#!/usr/bin/env bash
set -e
REPO="$1"
CI_DIR="$(mktemp -d)/cv-ci"
/usr/bin/git clone -q --branch feat/m2-data-auth-admin "$REPO" "$CI_DIR"
cd "$CI_DIR"
export CI=1 NEXT_TELEMETRY_DISABLED=1
export DATABASE_URL="${DATABASE_URL:-postgres://cv:cv@localhost:5432/cv}"
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
SITE_URL=http://localhost:3200 pnpm build
pnpm lhci
echo "gate=0"
cd /
rm -rf "$CI_DIR"
EOF
chmod +x <scratch>/m2-gate.sh
<scratch>/m2-gate.sh "$(/usr/bin/git rev-parse --path-format=absolute --git-common-dir)"
```

Expected, in order: `✓ Types generated successfully`; `Checked 162 files … No fixes applied.`; `Test Files  18 passed (18)`, `Tests  137 passed (137)`; `migrations applied`; `seeded CV content` (or `skipped: CV content already exists …` on a database you already seeded); `✓ Compiled successfully` with the full route table below; `62 passed` plus `::notice title=🎭 Playwright Run Summary::  62 passed`; `Checking assertions against 2 URL(s), 6 total run(s)`, `All results processed!`; finally `gate=0`. Afterwards `ss -ltn | grep -E ':(3100|3200) '` prints nothing. Measured on 2026-09-24 (throwaway Postgres 18 container): `gate=0`, e2e 21.7 s, LHCI 100 / 100 / 100 / 100 on `/en` and `/ro`.

```
Route (app)
┌ ○ /_not-found
├   /[locale]
│ ├ ◐ /[locale]
│ ├ ○ /en
│ └ ○ /ro
├   /[locale]/[...rest]
│ ├ ◐ /[locale]/[...rest]
│ ├ ◐ /en/[...rest]
│ └ ◐ /ro/[...rest]
├ ◐ /admin
├ ◐ /admin/experience
├   /admin/experience/[id]
│ └ ◐ /admin/experience/[id]
├ ◐ /admin/experience/new
├ ◐ /admin/login
├ ○ /admin/login/two-factor
├ ◐ /admin/media
├ ◐ /admin/profile
├ ◐ /admin/projects
├   /admin/projects/[slug]
│ └ ◐ /admin/projects/[slug]
├ ◐ /admin/projects/new
├ ◐ /admin/security
├ ◐ /admin/skills
├   /admin/skills/[slug]
│ └ ◐ /admin/skills/[slug]
├ ◐ /admin/skills/new
├ ƒ /api/auth/[...all]
├ ƒ /api/media/[key]
├ ○ /robots.txt
└ ○ /sitemap.xml
```

This covers the spec §7 M2 acceptance:
- **RO headline edited in admin shows on `/ro`**: `admin-profile.spec.ts` › `a Romanian headline edited in the admin shows on /ro` (Task 7).
- **`/admin` redirects logged-out**: `admin-auth.spec.ts` › `redirects /admin to the login page when logged out` (proxy `307`) and `a forged session cookie passes the proxy but not the layout` (Task 6).
- **Actions 401 without session**: `tests/db/admin-guard.test.ts`, one case per exported action (19 by Task 13) (Task 7).
- **RO→EN fallback**: `tests/db/cv-queries.test.ts` (Task 2), `tests/db/admin-profile.test.ts` › `accepts a blank Romanian field and falls back to English on /ro`, and `admin-profile.spec.ts` › `a blank Romanian headline falls back to English on /ro` (Task 7).
- **Public pages unchanged**: the 35 M1 specs in the `public` project, plus LHCI 100s.

- [ ] **Step 5: Optional manual check (real browser)**

With `docker compose up -d --wait`, `pnpm dev` and the owner account (`ADMIN_EMAIL=<owner email>` in `.env.local`, then `pnpm admin:create`), open `http://localhost:3000/admin`, sign in, change the Romanian headline, save, and open `http://localhost:3000/ro` in another tab: the new headline shows at once. Upload a JPEG in **Media**, pick it as the avatar in **Profile**, then delete it in **Media** and check the Profile avatar falls back to **None**. There is no pass/fail here beyond the automated gate.

Merging `feat/m2-data-auth-admin` into `dev` and deciding when to push follow the Overseer flow: **never push unprompted**. Pushing `dev` starts the three CI jobs (`check`, `e2e`, `lighthouse`), now with a Postgres service each.

---

## Self-review

- **Spec coverage (§3, §4, §5, §7 M2 row, brief):**
  - Drizzle schema, migrations, seed: Task 1 (every §4 table needed now: `profile`/`_i18n`, `experience`/`_i18n`, `skill_category`/`_i18n`, `skill`, `project`/`_i18n`, `project_skill`, `experience_skill`, `media`, `message`, `audit_log`, Better Auth `user`/`session`/`account`/`verification`), Task 2 (seed from the M1 fixtures, loader), Tasks 12–13 (`two_factor`, `passkey`).
  - Cached public queries replacing the fixture reader: Task 3 (`'use cache'`, `cacheTag('cv')`, `cacheLife('max')`); mutations `updateTag('cv')`: Task 7 pipeline, used by every content action in Tasks 7–11.
  - RO→EN fallback: Task 2 (database rows, per field and per record), Task 7 (admin save of a blank field, e2e with `lang="en"`), Task 8 (RO-missing badge).
  - Better Auth single owner: Task 5 (email + password, `disableSignUp`, `ADMIN_EMAIL` allowlist hook, `pnpm admin:create`), Task 6 (proxy + login + panel), Task 12 (TOTP), Task 13 (passkeys).
  - "Every layout + server action re-checks session": `(panel)/layout.tsx` and every panel page call `requireAdmin()`; every content action goes through `runAdminAction`; the 2FA and passkey actions call `getAdminSession()` first; the guard test enforces 401 for all of them. The admin root layout (shared with the login page) does not check, by design.
  - Admin CRUD, English-only, EN/RO side by side: Profile (Task 7), Experience + reorder (Task 8), Skills mapped to stack layers (Task 9), Projects + markdown preview (Task 10), Media library with type/size limits and LQIP (Task 11). The Messages inbox is M3.
  - Media: `MediaStore` with a local adapter (no token) and a Vercel Blob adapter (token), Task 11. CI and every local run use the local adapter.
  - Acceptance: see Task 14, Step 4. Public pages identical: the unchanged 35 M1 e2e specs run in every task from Task 3 on.
  - CI with no secrets and no accounts: Task 4.
- **Deliberate deviations (for the Overseer to confirm or overrule):**
  - Spec §4 "queries COALESCE requested locale → `en`": the fallback stays in `localize()` over rows of both locales (Task 2). Same result as `COALESCE(NULLIF(TRIM(ro), ''), en)` per field, plus blank-list handling and the source locale for `lang="en"`, which SQL COALESCE would lose.
  - Spec §5 "Experience (drag reorder)": Move up / Move down buttons (Task 8). They are keyboard accessible, need no dependency, and are tested end to end. `@dnd-kit/react` (0.5.0, pre-1.0) can be layered on later without changing `moveExperience`.
  - Spec §5 "Media library (Blob client upload…)": server-side upload through a Server Action with a 4 MB cap and `bodySizeLimit: "4.5mb"` (Task 11). A client upload needs Vercel's `onUploadCompleted` callback to reach the app, which cannot happen locally or in CI, and there is no Vercel account yet. Switching to client uploads for large files later only touches `uploadMedia` and the media page.
  - Spec §2 lists shadcn, react-hook-form, @hookform/resolvers, sonner and drizzle-zod for the admin: not used. Native forms + `useActionState` + zod cover five small forms, with less client JS and no generated component code.
  - Spec §7 "actions 401 without session": a Server Action always answers HTTP 200 with an RSC payload, so "401" is the action result `{ status: "error", code: 401 }`. `unauthorized()` would need the canary-only `experimental.authInterrupts`.
  - `next build` now needs a migrated, seeded database (CI service containers, Task 4). On Vercel (M9) the build will need the Neon URL at build time.
  - Passkey sign-in skips the TOTP step (Task 13).
  - `media` has an extra `pathname` column (the storage key used for deletes), and `profile` keeps M1's `country_code`, which spec §4 does not list.
- **Deferred on purpose (later milestones):** a database-backed Better Auth rate limit (the default limiter is in-memory and production-only) and CSP (M8); `baseURL` / `trustedOrigins` for Vercel preview domains, running the Blob adapter against a real store, and the Neon URL at build time (M9); rendering media, CV PDFs and project bodies publicly (M6/M7); contact action and inbox (M3).
- **Open questions for the user:** (1) passkey sign-in bypasses TOTP: keep it, or require TOTP after a passkey too? (2) Are Move up / Move down buttons acceptable instead of drag and drop? (3) Is a 4 MB upload cap enough (portrait images, CV PDF), or should client uploads to Blob come in M7?
- **Placeholder scan:** no TBD or TODO. Every code step has the complete file or the exact inserted block with its anchor. `<worktree>`, `<n>`, `<port>` and `<scratch>` appear only where paths, timings or ports vary by machine. Generated files (`drizzle/*.sql`, `drizzle/meta/*`, `pnpm-lock.yaml`) come from the commands shown, never typed by hand.
- **Name consistency:** `Db`, `createDb`, `getDb`, `createTestDb`, `seedContent`, `loadCvRecords`, `resolveCv`, `getCv`, `CV_TAG`, `createAuth`, `Auth`, `MIN_PASSWORD_LENGTH`, `upsertAdmin` (`resetSecondFactors`), `readAdminSession`, `AdminSession` (`twoFactorEnabled` from Task 12), `getAdminSession`, `requireAdmin`, `signIn`, `signOut`, `verifySignInCode`, `SignInState`, `ActionResult`, `IDLE`, `AdminFormAction`, `formToObject`, `runAdminAction`, `ActionContext`, `UNAUTHORIZED`, `notFound`, `saveProfile`, `createExperience`, `updateExperience`, `deleteExperience`, `moveExperience`, `saveCategories`, `createSkill`, `updateSkill`, `deleteSkill`, `createProject`, `updateProject`, `deleteProject`, `uploadMedia`, `saveMediaAlt`, `deleteMedia`, `startTwoFactor`, `confirmTwoFactor`, `disableTwoFactor`, `TwoFactorState`, `deletePasskey`, `MediaStore`, `createBlobStore`, `createLocalStore`, `readLocalMedia`, `LOCAL_MEDIA_DIR`, `MEDIA_KEY`, `getMediaStore`, `inspectUpload`, `MAX_UPLOAD_BYTES`, `missingTranslation`, `E2E_ADMIN`, `signInAsOwner`. The e2e database is `cv_e2e` and the ports are 3100 (e2e) and 3200 (LHCI) in every task where they appear.
- **Review Focus:** all five items have tests in the owning tasks (T5 PGlite + T6 e2e forged cookie; T7 guard over every action; T2 + T7 blank RO; T11 unit + e2e for lying uploads and crafted media keys; T7 unit for `__proto__` field names).
