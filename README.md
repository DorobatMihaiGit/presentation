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
| `pnpm assets:posters` | Capture the hero posters from the 3D scene into `public/posters` + `src/experience/posters.json` (port 3400). Run `pnpm build` first |
| `pnpm perf:local` | Long tasks, frame times and memory while scrolling the live hero, on this machine's GPU (port 3300). Run `pnpm build` first |
| `pnpm db:generate --name <name>` | Drizzle Kit: write a SQL migration in `drizzle/` from schema changes (no database needed) |
| `pnpm db:migrate` | Apply pending migrations to `DATABASE_URL` |
| `pnpm db:seed` | Load the fixture CV into an empty database; `--reset` replaces all CV content |
| `pnpm admin:create` | Create the owner account for `ADMIN_EMAIL` or reset its password; `--reset-2fa` also removes TOTP and passkeys |

## Motion and 3D

The hero is a real-time three.js scene (React Three Fiber): a procedural
"stack" of five slabs, scrubbed by scroll. Everything 3D lives in
`src/experience/` and loads as one lazy chunk after the page has loaded, so
the first paint is the server-rendered text over a poster image.

- **Tiers.** After the load event, `StageLoader` picks a tier from the WebGL
  renderer string: 0 = posters only (no WebGL 2 or a software renderer),
  1 = light scene (DPR 1, no glass transmission, no post-processing), 2 =
  reference (Intel Iris Xe, DPR up to 1.5, bloom + FXAA), 3 = discrete GPUs
  (DPR up to 2). If frames stay slower than 40 fps while scrolling, the stage
  steps down a tier, and below tier 1 it gives up and shows the poster. A lost
  WebGL context also falls back to the poster.
- **Motion switch.** The **Motion** button in the header turns all of it off
  (posters, native scrolling, no pinned hero) and remembers the choice.
  `prefers-reduced-motion` and Save-Data start with motion off.
- **Query flags** (any page): `?tier=0..3` forces a tier;
  `?capture=hero&p=0..1` renders one frame of the hero shot for poster capture.
- **Posters.** `public/posters` holds content-hashed AVIF/WebP captures of
  the first and last hero frame, landscape and portrait. They are the LCP
  image, the tier-0 hero, and what reduced motion shows (the last frame).
  After changing anything in `src/experience/{Stage.tsx,director,postfx,scenes}`
  regenerate and commit them, or `pnpm test` fails. The capture runs against
  the production build; build again afterwards so the page uses the new
  manifest:

  ```bash
  pnpm build
  pnpm assets:posters
  pnpm build
  ```

  `POSTERS_SOFTWARE=1 pnpm assets:posters` renders with SwiftShader where no
  GPU is available (slower, slightly different pixels).
- **Performance check.** `pnpm build && pnpm perf:local` scrolls the hero on
  the real GPU and fails on a long task over 50 ms or more than 400 MB of tab
  memory. The JS budgets (160 KB gz before 3D, 350 KB gz for the 3D chunk)
  are e2e tests (`tests/e2e/budgets.spec.ts`), so CI enforces them.
- **Swapping in a modelled stack.** Shots find objects by the asset-contract
  names (`layer_interface` … `layer_craft`, `engrave_hero`,
  `engrave_contact`, `led_status`, `pcb_traces`); a `stack.glb` with the same
  names can replace `ProceduralStack` in `src/experience/scenes/StackModel.tsx`.

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

## Contact form and mail

The contact form on `/en` and `/ro` posts to a Server Action. Each message is
checked (a hidden honeypot field, at least 3 seconds between page load and
send, at most 5 messages per IP address in 10 minutes), stored in the
`message` table first, and then two mails go out: a notification to the owner
(reply-to = the visitor) and a short auto-reply to the visitor in the page's
language. If sending fails, the message is kept and shows **Email failed** in
the admin inbox. The public pages stay static; the form adds about 1.5 KB of
client JavaScript.

The rate limit keys on an HMAC of the visitor's IP (the IP itself is never
stored). On Vercel the IP comes from `x-real-ip` / `x-forwarded-for`, which
Vercel's proxy sets. On any other host without a trusted proxy in front,
clients can send their own `x-forwarded-for` and so step around the limit.

Without `RESEND_API_KEY` nothing is sent: each mail is written to
`.data/mail/<timestamp>-<id>.json` (local development, tests, CI). With the
key set, mail goes through Resend.

### Mail settings to fill in once Resend exists

| Variable | Now (`.env.local`) | Later (Vercel env, M9) |
| --- | --- | --- |
| `RESEND_API_KEY` | empty (local outbox) | the Resend API key (`re_…`), Production and Preview |
| `CONTACT_FROM_EMAIL` | `contact@example.com` | an address on the domain verified in Resend, for example `contact@<your domain>` |
| `CONTACT_TO_EMAIL` | empty (= `ADMIN_EMAIL`) | the inbox for notifications, if it is not `ADMIN_EMAIL` |

Setting `RESEND_API_KEY` without `CONTACT_FROM_EMAIL` fails at startup
(`Invalid environment variables`). Resend only sends from a verified domain,
so the domain's SPF, DKIM and DMARC records come first (M9). Until then a
real send fails, and the message is still stored with **Email failed**.

## Messages

**Messages** in the admin lists contact messages in three folders: Inbox
(new and read), Archived and Spam. A message can be marked read or unread,
archived, flagged as spam, moved back, or deleted for good. Every change is
written to `audit_log` (a delete keeps only the message id).
