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
