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
| `pnpm lhci` | Lighthouse CI, desktop preset, on port 3200, for `/en`, `/ro` and `/en/projects/ledger-lens`; asserts >= 0.95 in all 4 categories. Run `SITE_URL=http://localhost:3200 pnpm build` first |
| `pnpm lhci:windows` | The same Lighthouse runs and budgets on Windows, where `lhci autorun` fails on Chrome's temp profile; performance >= 0.65 there (see "On Windows") |
| `pnpm assets:posters` | Capture the hero and section posters from the 3D scene into `public/posters` + `src/experience/posters.json` (port 3400). Run `pnpm build` first |
| `pnpm assets:textures` | Download the Poly Haven (CC0) detail maps once, convert them to WebP in `public/textures` + `src/experience/textures.json` |
| `pnpm perf:local` | Long tasks, frame rate per section and memory while scrolling the whole page on the live stage, and after three trips to a project page and back, on this machine's GPU (port 3300). Run `pnpm build` first |
| `pnpm db:generate --name <name>` | Drizzle Kit: write a SQL migration in `drizzle/` from schema changes (no database needed) |
| `pnpm db:migrate` | Apply pending migrations to `DATABASE_URL` |
| `pnpm db:seed` | Load the fixture CV into an empty database; `--reset` replaces all CV content |
| `pnpm admin:create` | Create the owner account for `ADMIN_EMAIL` or reset its password; `--reset-2fa` also removes TOTP and passkeys |

## Motion and 3D

The page sits on one real-time three.js scene (React Three Fiber): a
procedural "stack" of five slabs and one camera that travels through it as
you scroll. The hero dollies over the base plate to the etched name; About
turns the stack and lifts the glass; Skills pins the exploded stack with each
row next to its layer (hover a row to light that layer's edge); Experience
follows a light pulse along the circuit board, lighting each job as it
passes; the stage steps back behind Projects; Contact closes the stack on the
"Let's build" etching and pulses the LED when a message is sent; the footer
turns it slowly. Springs give every move weight: the camera trails the
scroll and settles, never overshoots. A fine pointer tilts the view a few
degrees (never on touch screens). Everything 3D lives in `src/experience/`
and loads lazily after the page has loaded, so the first paint is the
server-rendered text over a poster image; all text stays in the HTML.

- **Tiers.** After the load event, `StageLoader` picks a tier from the WebGL
  renderer string: 0 = posters only (no WebGL 2 or a software renderer),
  1 = light scene (DPR 1, no glass transmission, no post-processing), 2 =
  reference (Intel Iris Xe, DPR up to 1.5, 4x MSAA, bloom + FXAA), 3 = discrete GPUs
  (DPR up to 2, plus ambient occlusion and depth of field from a chunk of
  their own, without MSAA: both on a multisampled buffer cost a third of the
  frame rate on an Iris Xe). If frames stay slower than 40 fps while scrolling, the stage
  steps down a tier, and below tier 1 it gives up and shows the poster. A lost
  WebGL context also falls back to the poster.
- **Motion switch.** The **Motion** button in the header turns all of it off
  (posters, native scrolling, no pinned hero) and remembers the choice.
  `prefers-reduced-motion` and Save-Data start with motion off.
- **Framing.** Each shot is authored for a 16:9 (landscape) or 828x1792
  (portrait) frame and cropped to the screen like `object-fit: cover`,
  keeping the side where the stack is: the right edge in landscape (the copy
  takes the left half), the bottom in portrait (the copy sits on top).
  `tests/e2e/framing.spec.ts` checks, from 1280x720 to 1920x1080 and on
  16:10 and 3:2 screens, that the stack stays on screen and 32 px clear of the copy
  (the stage writes its box to `.stage-layer[data-box]`).
- **Look.** An environment of softbox strips (no HDRI), AgX tone mapping and
  a studio background that lands exactly on the page colour after it
  (`src/experience/scenes/studio.ts`), so the stage meets the page without a
  seam. The circuit board is copper that reflects on a solder mask that does
  not, with FR4 edges; the glass has one soft highlight; the bevels are wide
  enough to draw a clean line along every edge.
- **Leaving for a project page.** Next keeps the home page in a hidden
  `<Activity>` while a project page is open: `StageLoader` drops the stage
  (and its WebGL context) then, and mounts a fresh one on the way back,
  starting on the section on screen.
- **Query flags** (any page): `?tier=0..3` forces a tier and keeps it (no
  runtime step-down); `?capture=<scene>&p=0..1` renders one frame of a scene
  (`hero`, `about`, `skills`, `experience`, `contact`) for poster capture.
- **Posters.** `public/posters` holds content-hashed AVIF/WebP captures of
  the first and last hero frame and one frame per scene section, landscape
  and portrait. The first hero frame is the LCP image; with the stage off
  (tier 0, reduced motion, **Motion** off, a lost context) the hero shows the
  last frame and each section its own poster behind its first screen.
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
- **Textures.** Two 512 px detail maps from Poly Haven (CC0): brushed
  grooves for the metals, smudges for glass and ceramic. `pnpm assets:textures`
  rebuilds them; `tests/unit/textures.test.ts` holds the texture budget
  (256 KB on disk, 512 px).
- **Mounting.** The stage starts in steps, one per idle period (renderer,
  studio light, model, post chain, shader programs, first frame), and hands
  every shader to the GPU before its first use, so no step blocks the page
  for long even without `KHR_parallel_shader_compile`.
- **Performance check.** `pnpm build && pnpm perf:local` scrolls the whole
  page on the real GPU at the auto tier, tier 1 and tier 3, and fails on a
  long task over 50 ms, less than 55 fps in any section (tiers auto and 1)
  or more than 400 MB of tab memory. The JS budgets (160 KB gz before 3D,
  350 KB gz for the 3D chunks, 100 KB gz more for tier 3) are e2e tests
  (`tests/e2e/budgets.spec.ts`), so CI enforces them.
- **On Windows.** Measured on a Tiger Lake Iris Xe laptop (i5-1135G7, ANGLE
  on Vulkan with Intel's driver). Linux and CI keep every budget above; on
  Windows only, `perf:local` allows 70 ms long tasks, 150 ms mount tasks and
  750 MB per tab (Windows counts the GPU driver's memory: the pre-M7 stage
  already used 440 to 584 MB), with the same 55 fps; local e2e runs 2
  workers; and `pnpm lhci:windows` stands in for `pnpm lhci`, whose Chrome
  launcher fails on its temp profile there (EPERM), with a performance
  budget of 0.65 (the stage's mount costs ~0.9 s of TBT under the desktop
  preset on that laptop, before and after M7).
- **Swapping in a modelled stack.** Shots find objects by the asset-contract
  names (`layer_interface` … `layer_craft`, `engrave_hero`,
  `engrave_contact`, `led_status`, `pcb_traces`); a `stack.glb` with the same
  names can replace `ProceduralStack` in `src/experience/scenes/StackModel.tsx`.

## Project pages

Every published project has a page, `/<locale>/projects/<slug>`: title,
summary, role, outcome, stack, live and source links, the cover and the
case study (markdown, written in the admin). The pages are prerendered like
`/en` and `/ro` (a project published later renders on its first visit),
cached under the same `cv` tag, listed in `sitemap.xml` with hreflang
alternates, and describe themselves as a schema.org `CreativeWork`. There is
no 3D on them; the header's section links lead back to the home page.

- **Case studies** render with react-markdown: raw HTML is dropped, only
  http(s), mailto and relative links survive, and images are left out (the
  cover is the project's image). A `#` heading renders as `h2`.
- **Covers** and the headshot come from the media library through the image
  optimizer (resized, served as WebP): `OptimizedImage` renders next/image's
  props as a plain `<img>` on the server, so the pages ship no image
  JavaScript. `next.config.ts` allows `/api/media/**` only; Vercel Blob URLs
  need a `remotePatterns` entry when production storage is set up (M9).
- **View Transitions.** Opening a project from the grid slides the page
  forward and morphs the card's cover into the page's; "All work", "Previous"
  and the header's section links slide back (React `<ViewTransition>`, types
  from `next/link`'s `transitionTypes`; `src/components/motion/`). Browsers
  without View Transitions, reduced motion and **Motion** off swap the page
  without animating; a browser back button never animates.

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

What the admin edits and where the site shows it:

| Admin | Public site |
| --- | --- |
| Profile: name, headline, summary, location, years, availability, email, GitHub, LinkedIn | Hero, About, Contact, header, metadata |
| Profile: avatar | About (next to the summary) |
| Profile: CV PDF (EN, RO) | "Download CV" in the hero and in Contact (`/ro` offers the English PDF, marked `hreflang="en"`, until there is a Romanian one) |
| Experience: role, company, company URL, dates, type, description, highlights | Experience (the company links to its URL) |
| Skills | Skills, project stacks, JSON-LD |
| Projects: title, summary, role, outcome, year, featured, skills, links, cover, case study | Projects grid and the project pages |
| Media: alt text (EN, RO) | Covers and the avatar |

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
