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
pnpm exec playwright install chromium
pnpm dev
```

Open http://localhost:3000 (redirects to `/en`; `/ro` serves Romanian).

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

## Local database

`docker compose up -d --wait` starts `postgres:18-alpine` on `127.0.0.1:5432`
(user `cv`, password `cv`, database `cv`), matching `DATABASE_URL` in
`.env.example`. `docker compose down` stops it; add `-v` to delete the data volume.

## Site URL

Canonical URLs, hreflang links, `sitemap.xml`, `robots.txt` and the JSON-LD
`Person` use `SITE_URL` (see `.env.example`). Unset, Vercel builds use the
project's production domain and everything else uses `http://localhost:3000`.
These URLs are baked in at `next build`, so set `SITE_URL` before building.

## Content

M1 renders fixture content from `src/content/fixtures.ts` (placeholder person,
example.com links). M2 moves it to Postgres behind the same `getCv(locale)`.
