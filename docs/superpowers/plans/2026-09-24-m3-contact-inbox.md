# M3 Contact and Inbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the M1 contact form work end to end without a Resend account. A public Server Action validates each message (zod, honeypot, at least 3 s between page load and send), rate-limits it (5 per keyed IP hash per 10 minutes), stores it first, then mails the owner and sends the visitor a localized EN/RO auto-reply built with react-email. If sending fails, the message stays stored with `email_status = failed`. The admin gets a **Messages** inbox: list, read, mark read/unread, archive, spam, delete. The milestone is gated by the spec's acceptance: a submit gives a database row plus mail, the 6th submit in 10 minutes is rejected, and a mail failure still keeps the row.

**Architecture:** Mail goes through a `Mailer` interface (`src/server/email/mailer.ts`), in the style of M2's `MediaStore`. When `RESEND_API_KEY` is set it uses a Resend adapter. Without the key it writes a JSON outbox in `.data/mail/` (dev, tests, CI). On Vercel without a key every send fails, so messages are stored as `failed`. The two mails are React components rendered with `render()` from `react-email` 6, the successor of `@react-email/components`. `submitContact(formData, deps)` (`src/server/contact/submit.ts`) is the whole pipeline behind injected dependencies. It runs, in order: honeypot, zod, fill time, then one transaction (per-IP advisory lock, count of the last 10 minutes, insert), then both mails in parallel, then `email_status`. The public action `sendContactMessage` (`src/server/actions/contact.ts`) only adds the request's IP (`headers()`) and the env. It never expires a cache tag or refreshes the router, so `/en` and `/ro` stay static (`○`). The form is a small client component. It gets its strings as props from the server (no next-intl in the client bundle) and sends the elapsed time since hydration as `elapsedMs`. The inbox reuses M2's `runAdminAction`, which gains `{ publicContent: false }`: `refresh()` the admin page instead of `updateTag('cv')`. Its actions are therefore covered by the M2 `import.meta.glob` admin-guard test without editing it, apart from excluding the new public `contact.ts`.

**Tech Stack:** Next.js 16.3.6 (App Router, `cacheComponents`), React 19.3.0, TypeScript 7.0.2, zod 4.6.5, @t3-oss/env-nextjs 0.13.11, Drizzle ORM 0.45.3, pg 8.23.0, **resend 6.28.1**, **react-email 6.9.5** (bundles @react-email/render 2.1.0), Vitest 5.0.1 + PGlite 0.5.8, Playwright 1.63.0 + @axe-core/playwright 4.13.0, Biome 2.5.14, pnpm 11.27.1, Postgres 18.

**Spec:** `docs/superpowers/specs/2026-09-23-cinematic-cv-design.md` (§2 packages, §4 `message` table, §5 contact rules, §7 row M3, §8 risks, §9 verification). Format and building blocks continue `docs/superpowers/plans/2026-09-24-m2-data-auth-admin.md`.

## Verified facts (checked 2026-09-24 on this machine)

Every command and expected output below was produced by running this plan in a scratch clone of `dev`, one task at a time and in order. For each task the tests were written first and the red run was observed, then the rest of the task was added and the whole suite re-run. Each task was committed and its tree compared with the reference commit. After Task 6 the gate script passed on a fresh clone of the result (`gate=0`). The database was a throwaway `postgres:18-alpine` container; the plan itself uses the repo's `docker compose` Postgres on port 5432.

- **Repo state:** `dev` is at `11a1305 fix(auth): require fresh login to add passkey` (M2 merged and pushed). `origin/main` is still the GitHub default branch, so the worktree is cut from `dev` explicitly. Baseline on `dev`: `pnpm test` = 18 files, 138 tests. `pnpm test:e2e` = 62 tests. `/en` loads 9 module scripts, 145.3 KB gz. The `message` table (`name, email, company, body, locale, ip_hash, status new/read/archived/spam, email_status sent/failed nullable, created_at`, index on `(ip_hash, created_at)`) already exists from M2's `drizzle/0000_init.sql`. **M3 needs no migration.**
- **Registry (`npm view`):**
  - `resend` 6.28.1 is the latest release (published 2026-09-15). Dependencies: `postal-mime` 2.7.6 and `standardwebhooks` 1.1.1. Its only peer is `@react-email/render` (optional). It needs node >= 20.
  - `@react-email/components` 1.0.12 (the spec's pin) is **deprecated on npm**, and so is every `@react-email/<component>` package (`Package no longer supported. Contact Support at https://www.npmjs.com/support for more info.`). The components now ship in the `react-email` package (v6). It exports `Html`, `Head`, `Body`, `Container`, `Heading`, `Text`, `Link`, `Section`, `Hr`, `Preview` and more, and re-exports `render` from `@react-email/render` 2.1.0, which is not deprecated. Peers: `react` / `react-dom` `^18.0 || ^19.0`, fine with 19.3.0.
  - `react-email` 6.10.0 and 6.11.0 were published on 2026-09-23. `pnpm add -E react-email@6.11.0` succeeded only because pnpm 11 wrote `react-email@6.11.0` into `minimumReleaseAgeExclude` in `pnpm-workspace.yaml` (release younger than the minimum age). **6.9.5** (2026-09-08) installs without touching `pnpm-workspace.yaml`.
  - `react-email` also carries its preview CLI's dependencies (esbuild, socket.io, tailwindcss, babel, chokidar…), so the install adds 95 packages. They are server-side only: the package is `"sideEffects": false`, and the public bundle grows by the form alone (see results). esbuild's build script stays denied by the existing `esbuild: false`.
  - No new dev dependency: the Resend SDK is replaced with `vi.mock("resend")`.
- **Next 16.3.6 Server Actions** (`node_modules/next/dist/docs/01-app/02-guides/server-actions.md`): *"An action that does none of the above [`updateTag`, `revalidatePath`, `refresh`, mutating cookies, `redirect`] carries only its return value, and the current route is not re-rendered."* So the contact action returns state only. After M3 the route table still shows `○ /en` and `○ /ro`. `headers()` is read inside the action, never during render, so prerendering is unaffected. `refresh()` (`next/cache`) re-renders the current route from a Server Action; the inbox uses it. Actions run as POSTs to the page and pass Next's `Origin`/`Host` CSRF check; the 1 MB default body limit was already raised to 4.5 MB in M2.
- **Client IP:**
  - `next start` does `req.headers['x-forwarded-for'] ??= socket.remoteAddress` (`node_modules/next/dist/server/base-server.js`, line 612), so it keeps an `x-forwarded-for` the client sent.
  - `@vercel/functions` 3.9.9 `ipAddress()` reads `x-real-ip` (*"Client IP as calculated by Vercel Proxy"*). On Vercel both headers come from Vercel's proxy.
  - Decision: `x-real-ip`, then the first `x-forwarded-for` entry, then the shared bucket `"unknown"`. The trade-off is in `src/server/contact/ip.ts` and the README. Playwright's `extraHTTPHeaders` reach Server Action POSTs, which gives each e2e test its own bucket.
- **Resend SDK 6.28.1:** `resend.emails.send(payload, { idempotencyKey })` resolves to `{ data, error, headers }`. API errors are returned, not thrown (`error.name` is one of `invalid_from_address`, `validation_error`, `rate_limit_exceeded`, …). Network errors reject. `new Resend()` without a key falls back to `process.env.RESEND_API_KEY`, so the adapter always passes the key. Payload fields: `from`, `to`, `replyTo`, `subject`, `html`, `text`.
- **react-email 6.9.5 rendering:**
  - `await render(node)` gives XHTML; `render(node, { plainText: true })` gives text (html-to-text).
  - `<Preview>` text also becomes the document `<title>`.
  - `<Body>` defaults to `lang="en"`, so the auto-reply passes `lang` to both `<Html>` and `<Body>`.
  - Newlines inside text collapse in the plain-text version, so the message body is rendered line by line with `<br />`.
  - Rendering inside a Server Action works after `next build` / `next start`: e2e reads back the mails the built app wrote.
- **@t3-oss/env-nextjs 0.13.11** supports `createFinalSchema(shape, isServer)`. It is used for the cross-field rule "`RESEND_API_KEY` needs `CONTACT_FROM_EMAIL`".
- **PGlite serializes transactions:** the Task 3 parallel-submit test passes even without the advisory lock. Against Postgres 18 with the app's `pg` pool, 12 parallel submissions from one IP stored **10 to 12** rows without the lock (five runs, two script variants) and **5** with it. Task 3, Step 6 repeats that check against the docker database.
- **Admin `notFound()`** inside the admin root `<Suspense>` renders "Page not found" with HTTP **200**, the same as M2's `redirect()` note (the shell has already streamed). The e2e test asserts the page and "no 500", not the status.
- **Local mailer failure mode:** a file where the `.data/mail` folder should be makes every send reject with `EEXIST: file already exists, mkdir '<repo>/.data/mail'`. The e2e mail-outage test uses this; no test hooks are needed in app code.
- **Tailwind 4.3.3** has a built-in `aria-invalid:` variant (compiled to `.aria-invalid\:ring-signal[aria-invalid=true]`).
- **Results after Task 6:** `pnpm test` = 24 files, 190 tests (about 6.5 s). `pnpm test:e2e` = 72 tests (`public` 40, `admin` 30, `security` 2), about 30 s after the build. LHCI desktop = 100 / 100 / 100 / 100 on `/en` and `/ro` (3 runs each). `/en` loads 10 module scripts, **146.8 KB gz** (+1.5 KB, sum of `gzip -9` per script, `noModule` excluded), with no next-intl client runtime. `pnpm lint` checks 190 files.
- **Tooling quirks (unchanged from M2):**
  - A hook rewrites plain `git`, so commands use `/usr/bin/git`.
  - `rtk` filters some output; prefix `rtk proxy` to see exactly what this plan shows.
  - The worktree guard can reject compound one-liners, so commands are one per line.
  - `pnpm typecheck` needs `.env.local` (it loads `next.config.ts`, which validates env).

## Global Constraints

- Exact pins only. The M0–M2 pins stay (next 16.3.6, react/react-dom 19.3.0, typescript 7.0.2, zod 4.6.5, drizzle-orm 0.45.3, better-auth 1.7.5, vitest 5.0.1, @playwright/test 1.63.0, …). New runtime dependencies: `resend` 6.28.1 and `react-email` 6.9.5. No new dev dependency. Not used: `@react-email/components` (deprecated), msw, botid, a mailpit container (see Deviations).
- Spec §5, verbatim: "Contact action: zod + honeypot + min 3 s fill → DB rate limit (5 / ip_hash / 10 min) → insert first → Resend (owner mail + localized auto-reply), CR/LF stripped, visitor only in `replyTo`; Resend failure keeps message with `email_status=failed`." And: "Admin English-only UI, … Messages inbox."
- Spec §4 `message`: "name, email, company, body, locale, ip_hash, status (new/read/archived/spam), email_status (sent/failed)". The table is used as M2 created it; no schema change.
- Spec §7 M3 acceptance, verbatim: "submit = DB row + email; 6th in 10 min rejected; Resend failure still persists".
- Owner decisions:
  - There is no Resend account yet. M3 builds, tests and passes CI with no Resend key.
  - `RESEND_API_KEY` is optional (it must start with `re_`). `CONTACT_FROM_EMAIL` is optional, but required once a key is set. `CONTACT_TO_EMAIL` is optional and defaults to `ADMIN_EMAIL`.
  - `.env.example` holds placeholders only: `RESEND_API_KEY=` empty, with `re_xxxxxxxx` shown in a comment, and `CONTACT_FROM_EMAIL=contact@example.com`. `RESEND_API_KEY` stays empty on purpose: a placeholder key would make every local send call Resend.
  - The owner's real address is written `<owner email>`, and committed files use example.com addresses. Before each commit, `/usr/bin/git diff --cached | grep -cF "$(grep ^ADMIN_EMAIL= .env.local | cut -d= -f2)"` must print `0`.
- No external calls: nothing signs up for, logs into or calls Resend, Vercel or any other service. Unit tests mock the `resend` module; dev, e2e and CI write mail to `.data/mail/`.
- The `cacheComponents` rules from M1 and M2 hold. Public pages read no request data during render. The contact action reads `headers()` only while it runs. `/en` and `/ro` stay `○` in the build output.
- Public JS budget (spec §3): ≤ 160 KB gz before 3D. The form must not pull next-intl or zod into the client bundle. LHCI gate ≥ 95 in all four categories (measured 100).
- The admin is English only. Every admin mutation goes through `runAdminAction` (session re-check, zod, one transaction with an `audit_log` row). The admin-guard test must cover every inbox action.
- Biome is the only linter and formatter; `pnpm lint` prints `No fixes applied.` before each commit.
- Commits use `type(scope): subject`, subject ≤ 50 characters. **No AI attribution of any kind.**
- Out of scope: Resend domain DNS (SPF/DKIM/DMARC) and Vercel env (M9); CSP and security headers (M8); botid; message retention or purge jobs; replying from the admin (the owner replies from their mail client, since the notification's reply-to is the visitor).

## Review Focus

These are inputs the spec implies that ordinary feature tests would not catch. Each one is pinned by a test in the task that owns the code:

1. **A name or address with line breaks (header injection).** A visitor can post `Ana\r\nBcc: victim@example.net` as the name. Every header value (subject, display names, addresses) must come out as one line, and the visitor must never appear in the owner mail's `from` or `to`. Pinned by the Task 2 tests `turns CR, LF and other control characters into single spaces`, `keeps line breaks in the name out of the subject (header injection)` and `goes from the site to the owner; the visitor is only the reply-to`. The Task 1 env test `rejects a CONTACT_FROM_EMAIL with a display name or line break` covers the one header value that comes from configuration.
2. **The form used with someone else's address (auto-reply as a spam relay).** A bot can put a victim's address in the form and spam in the name, company or message. The auto-reply goes to that address, so it must repeat nothing the visitor typed. Pinned by the Task 2 test `repeats nothing the visitor typed, so it cannot relay spam`; the rate limit caps the volume.
3. **Parallel posts from one address racing past the limit.** Several requests sent at once could all count 4 before any inserts. The count and the insert run under a per-IP advisory lock. Pinned by the Task 3 PGlite test `never lets parallel requests from one address past the limit`. PGlite serializes anyway, so Task 3, Step 6 checks the lock against real Postgres (5 stored, not 10).
4. **A mail outage (Resend down, bad key, unverified domain).** The message must still be stored, show **Email failed** in the inbox, and the visitor still sees the confirmation. Pinned by the Task 3 test `keeps the message with email_status failed when sending fails` and the Task 5 e2e test `a message whose notification could not be sent is kept and flagged` (a real I/O failure of the local outbox inside the built app).
5. **A crafted message URL in the admin.** `/admin/messages/not-a-uuid` would make Postgres throw `invalid input syntax for type uuid` (a 500). It must show the not-found page. Pinned by the Task 5 query test `returns null for an unknown or malformed id instead of failing` and the e2e test `a malformed message id shows the not-found page, not a server error`.

## Before you start (workspace)

1. Update the main checkout and cut the worktree from `dev`:

```bash
/usr/bin/git -C /home/mihai/Documents/CV pull --ff-only
/usr/bin/git -C /home/mihai/Documents/CV worktree add .claude/worktrees/m3-contact-inbox -b feat/m3-contact-inbox dev
```

Expected: `Preparing worktree (new branch 'feat/m3-contact-inbox')` and `HEAD is now at 11a1305 fix(auth): require fresh login to add passkey` (or a later `dev` tip). Then call `EnterWorktree` with `path: ".claude/worktrees/m3-contact-inbox"`. **All commands below run from the worktree root.** If this plan file is not committed on `dev`, read it from `/home/mihai/Documents/CV/docs/superpowers/plans/2026-09-24-m3-contact-inbox.md`.

2. Install, create the local env, start Postgres and prepare the dev database. `pnpm build` prerenders `/en` and `/ro` from it; e2e uses its own `cv_e2e` database:

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
docker compose up -d --wait
pnpm db:migrate
pnpm db:seed
pnpm exec playwright install chromium
```

In `.env.local`, set `ADMIN_EMAIL=<owner email>` (the Overseer supplies the real address; it never goes into a committed file). Leave `RESEND_API_KEY` empty.

Expected: `Done in <n>s using pnpm v11.27.1`; `Container cv-db-1  Healthy`; `migrations applied`; `seeded CV content` (or `skipped: CV content already exists (use --reset to replace it)`).

3. Check the baseline:

Run: `pnpm test`
Expected: `Test Files  18 passed (18)`, `Tests  138 passed (138)`.

Run: `pnpm test:e2e`
Expected: `62 passed`. Afterwards `ss -ltn | grep ':3100 '` prints nothing.

## File map

| Path | Responsibility | Task |
|---|---|---|
| `package.json`, `pnpm-lock.yaml` | `resend` 6.28.1, `react-email` 6.9.5 | 1 |
| `src/lib/create-app-env.ts`, `src/env.ts`, `.env.example` | `RESEND_API_KEY`, `CONTACT_FROM_EMAIL`, `CONTACT_TO_EMAIL` (+ key ⇒ sender rule) | 1 |
| `src/server/email/mailer.ts` | `Mail`, `Mailer`, `createResendMailer`, `createLocalMailer`, `createMailer`, `LOCAL_MAIL_DIR` | 1 |
| `src/server/email/index.ts` | `getMailer()`, `getMailAddresses()` from env | 1 |
| `src/server/email/headers.ts` | `headerText()`, `mailbox()`: one-line header values | 2 |
| `src/server/email/templates/{styles.ts,OwnerNotification.tsx,AutoReply.tsx}` | react-email templates; `AUTO_REPLY_COPY` EN/RO | 2 |
| `src/server/email/contact-mails.tsx` | `buildContactMails()`: both rendered `Mail`s for one message | 2 |
| `src/server/contact/{state,schema,ip,submit}.ts` | `ContactState` + constants (client-safe); zod input and error codes; `clientIp`, `hashIp`; `submitContact`, `RATE_LIMIT` | 3 |
| `src/server/actions/contact.ts` | public Server Action `sendContactMessage` | 3 |
| `src/components/sections/{Contact,ContactForm}.tsx`, `messages/{en,ro}.json` | public form (client), server-translated labels | 4 |
| `playwright.config.ts`, `scripts/e2e-db.ts` | e2e mail env (local outbox); reset messages per run | 1, 4 |
| `src/server/admin/run-action.ts` | `{ publicContent: false }` → `refresh()` instead of `updateTag('cv')` | 5 |
| `src/server/admin/schemas/messages.ts`, `src/server/queries/admin/messages.ts`, `src/server/actions/messages.ts` | inbox input, reads, actions | 5 |
| `src/app/admin/(panel)/messages/{page.tsx,[id]/page.tsx}`, `src/components/admin/messages.tsx`, `src/app/admin/(panel)/layout.tsx` | inbox pages, badges, nav entry | 5 |
| `tests/unit/{env,mailer,contact-mails,contact-ip}.test.ts` | unit tests | 1–3 |
| `tests/db/{contact,contact-action,admin-messages,admin-guard}.test.ts` | PGlite tests | 3, 5 |
| `tests/e2e/{contact-outbox.ts,contact.spec.ts,hero-projects-contact.spec.ts,admin-messages.spec.ts}` | e2e | 4, 5 |
| `README.md` | contact, mail settings to fill in, inbox | 6 |

---

### Task 1: Mail settings and the mailer (Resend or local outbox)

**Owner:** backend-engineer

**Files:**
- Create: `src/server/email/mailer.ts`, `src/server/email/index.ts`, `tests/unit/mailer.test.ts`
- Modify: `package.json`, `pnpm-lock.yaml`, `src/lib/create-app-env.ts`, `src/env.ts`, `.env.example`, `playwright.config.ts`, `tests/unit/env.test.ts`

**Interfaces:**
- Consumes: `createAppEnv` / `env` (M0–M2), `ADMIN_EMAIL`.
- Produces:
  - `env.RESEND_API_KEY?: string` (starts with `re_`), `env.CONTACT_FROM_EMAIL?: string`, `env.CONTACT_TO_EMAIL?: string` (both lower-cased emails). A key without `CONTACT_FROM_EMAIL` fails validation (`Invalid environment variables`).
  - `type Mail = { from: string; to: string; replyTo?: string; subject: string; html: string; text: string; idempotencyKey?: string }` and `type Mailer = { send(mail: Mail): Promise<{ id: string }> }` from `@/server/email/mailer`.
  - `createResendMailer(apiKey)` (throws `Resend refused the email (<name>): <message>` on an API error), `createLocalMailer(dir)` (one `<timestamp>-<uuid>.json` per mail), `createMailer({ resendApiKey?, onVercel, localDir })`, `LOCAL_MAIL_DIR` (`<cwd>/.data/mail`).
  - `getMailer(): Mailer` and `getMailAddresses(): { from: string; ownerInbox: string }` from `@/server/email` (`from` falls back to `contact@example.com`, `ownerInbox` to `ADMIN_EMAIL`).
  - e2e servers always use the local outbox (`RESEND_API_KEY: ""` in `playwright.config.ts`).

- [ ] **Step 1: Add the mail dependencies**

```bash
pnpm add -E resend@6.28.1 react-email@6.9.5
```

Expected: `[WARN] 7 deprecated subdependencies found: …` (the same list as in M2), `Packages: +95`, then

```
dependencies:
+ react-email 6.9.5
+ resend 6.28.1

Done in <n>s using pnpm v11.27.1
```

exit 0. Only `package.json` and `pnpm-lock.yaml` change (`/usr/bin/git diff --stat`: `package.json | 2 +`, `pnpm-lock.yaml | 776 +++…`); `pnpm-workspace.yaml` stays untouched. **Do not use `react-email@6.11.0`**: it is younger than pnpm 11's minimum release age, and pnpm would add it to `minimumReleaseAgeExclude`.

Run: `pnpm install --frozen-lockfile`
Expected: exit 0, `Done in <n>s using pnpm v11.27.1`.

- [ ] **Step 2: Write the failing tests**

In `tests/unit/env.test.ts`, insert these tests directly **before** `it("refuses to expose DATABASE_URL to client code", () => {`:

```ts
  it("runs without any mail settings (local outbox)", () => {
    const env = createAppEnv({
      ...BASE,
      RESEND_API_KEY: "",
      CONTACT_FROM_EMAIL: "",
      CONTACT_TO_EMAIL: "",
    });

    expect(env.RESEND_API_KEY).toBeUndefined();
    expect(env.CONTACT_FROM_EMAIL).toBeUndefined();
    expect(env.CONTACT_TO_EMAIL).toBeUndefined();
  });

  it("accepts a Resend key together with a sender address", () => {
    const env = createAppEnv({
      ...BASE,
      RESEND_API_KEY: "re_123456789",
      CONTACT_FROM_EMAIL: "contact@example.com",
      CONTACT_TO_EMAIL: "Inbox@Example.com",
    });

    expect(env.RESEND_API_KEY).toBe("re_123456789");
    expect(env.CONTACT_FROM_EMAIL).toBe("contact@example.com");
    expect(env.CONTACT_TO_EMAIL).toBe("inbox@example.com");
  });

  it("rejects a Resend key without a sender address", () => {
    expect(() =>
      createAppEnv({ ...BASE, RESEND_API_KEY: "re_123456789" }),
    ).toThrow("Invalid environment variables");
  });

  it("rejects a RESEND_API_KEY that does not start with re_", () => {
    expect(() =>
      createAppEnv({
        ...BASE,
        RESEND_API_KEY: "sk_live_123",
        CONTACT_FROM_EMAIL: "contact@example.com",
      }),
    ).toThrow("Invalid environment variables");
  });

  it("rejects a CONTACT_FROM_EMAIL with a display name or line break", () => {
    for (const value of [
      "CV <contact@example.com>",
      "a@example.com\r\nBcc: x@example.com",
    ]) {
      expect(() =>
        createAppEnv({ ...BASE, CONTACT_FROM_EMAIL: value }),
      ).toThrow("Invalid environment variables");
    }
  });

  it("refuses to expose RESEND_API_KEY to client code", () => {
    const env = createAppEnv(
      {
        ...BASE,
        RESEND_API_KEY: "re_123456789",
        CONTACT_FROM_EMAIL: "contact@example.com",
      },
      { isServer: false },
    );

    expect(() => env.RESEND_API_KEY).toThrow(
      "Attempted to access a server-side environment variable on the client",
    );
  });
```

Create `tests/unit/mailer.test.ts`:

```ts
import { mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createLocalMailer,
  createMailer,
  createResendMailer,
  type Mail,
} from "@/server/email/mailer";

// The Resend SDK is replaced by a stub: tests never reach the network.
const resend = vi.hoisted(() => ({
  keys: [] as Array<string | undefined>,
  send: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: resend.send };
    constructor(key?: string) {
      resend.keys.push(key);
    }
  },
}));

const MAIL: Mail = {
  from: "CV contact form <contact@example.com>",
  to: "owner@example.com",
  replyTo: "ana@example.org",
  subject: "New message from Ana Pop",
  html: "<p>Hello</p>",
  text: "Hello",
};

beforeEach(() => {
  resend.keys.length = 0;
  resend.send.mockReset();
});

describe("createLocalMailer", () => {
  it("writes each mail as a JSON file in the outbox", async () => {
    const dir = path.join(
      await mkdtemp(path.join(tmpdir(), "cv-mail-")),
      "outbox",
    );

    const { id } = await createLocalMailer(dir).send(MAIL);

    expect(await readdir(dir)).toEqual([`${id}.json`]);
    const stored = JSON.parse(
      await readFile(path.join(dir, `${id}.json`), "utf8"),
    );
    expect(stored).toEqual(MAIL);
  });

  it("fails when the outbox cannot be written", async () => {
    const blocked = path.join(
      await mkdtemp(path.join(tmpdir(), "cv-mail-")),
      "outbox",
    );
    await writeFile(blocked, "not a directory");

    await expect(createLocalMailer(blocked).send(MAIL)).rejects.toThrow();
  });
});

describe("createResendMailer", () => {
  it("sends through the Resend SDK with an idempotency key", async () => {
    resend.send.mockResolvedValue({
      data: { id: "email_123" },
      error: null,
      headers: null,
    });

    const result = await createResendMailer("re_test_key").send({
      ...MAIL,
      idempotencyKey: "contact/42/owner",
    });

    expect(result).toEqual({ id: "email_123" });
    expect(resend.keys).toEqual(["re_test_key"]);
    expect(resend.send).toHaveBeenCalledWith(MAIL, {
      idempotencyKey: "contact/42/owner",
    });
  });

  it("throws when Resend answers with an error", async () => {
    resend.send.mockResolvedValue({
      data: null,
      error: {
        name: "invalid_from_address",
        message: "The example.com domain is not verified.",
        statusCode: 403,
      },
      headers: null,
    });

    await expect(createResendMailer("re_test_key").send(MAIL)).rejects.toThrow(
      "Resend refused the email (invalid_from_address): The example.com domain is not verified.",
    );
  });

  it("lets network errors through", async () => {
    resend.send.mockRejectedValue(new TypeError("fetch failed"));

    await expect(createResendMailer("re_test_key").send(MAIL)).rejects.toThrow(
      "fetch failed",
    );
  });
});

describe("createMailer", () => {
  it("uses Resend when a key is set", async () => {
    resend.send.mockResolvedValue({
      data: { id: "email_1" },
      error: null,
      headers: null,
    });

    const mailer = createMailer({
      resendApiKey: "re_live",
      onVercel: true,
      localDir: "/nonexistent",
    });

    expect(await mailer.send(MAIL)).toEqual({ id: "email_1" });
  });

  it("writes to the local outbox without a key", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "cv-mail-"));

    await createMailer({ onVercel: false, localDir: dir }).send(MAIL);

    expect(await readdir(dir)).toHaveLength(1);
    expect(resend.send).not.toHaveBeenCalled();
  });

  it("fails every send on Vercel without a key (read-only filesystem)", async () => {
    const mailer = createMailer({ onVercel: true, localDir: "/nonexistent" });

    await expect(mailer.send(MAIL)).rejects.toThrow(
      "RESEND_API_KEY is not set",
    );
  });
});
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `pnpm exec vitest run tests/unit/env.test.ts tests/unit/mailer.test.ts`
Expected: `Test Files  2 failed (2)`, `Tests  4 failed | 19 passed (23)`. `tests/unit/mailer.test.ts` fails to load with `Error: Cannot find package '@/server/email/mailer'`, and the four failing env tests are:

```
FAIL  tests/unit/env.test.ts > createAppEnv > accepts a Resend key together with a sender address
FAIL  tests/unit/env.test.ts > createAppEnv > rejects a Resend key without a sender address
FAIL  tests/unit/env.test.ts > createAppEnv > rejects a RESEND_API_KEY that does not start with re_
FAIL  tests/unit/env.test.ts > createAppEnv > rejects a CONTACT_FROM_EMAIL with a display name or line break
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
  BLOB_READ_WRITE_TOKEN?: string;
  RESEND_API_KEY?: string;
  CONTACT_FROM_EMAIL?: string;
  CONTACT_TO_EMAIL?: string;
  NEXT_PUBLIC_ASSET_BASE?: string;
};

const email = z.email().transform((value) => value.toLowerCase());

export function createAppEnv(
  runtimeEnv: RuntimeEnv,
  options: { isServer?: boolean } = {},
) {
  return createEnv({
    server: {
      DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
      SITE_URL: z.url({ protocol: /^https?$/ }).optional(),
      BETTER_AUTH_SECRET: z.string().min(32),
      ADMIN_EMAIL: email,
      BLOB_READ_WRITE_TOKEN: z.string().min(1).optional(),
      // Contact form mail (M3). No key = mails go to .data/mail/ instead.
      RESEND_API_KEY: z.string().startsWith("re_").optional(),
      CONTACT_FROM_EMAIL: email.optional(),
      CONTACT_TO_EMAIL: email.optional(),
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
      RESEND_API_KEY: runtimeEnv.RESEND_API_KEY,
      CONTACT_FROM_EMAIL: runtimeEnv.CONTACT_FROM_EMAIL,
      CONTACT_TO_EMAIL: runtimeEnv.CONTACT_TO_EMAIL,
      NEXT_PUBLIC_ASSET_BASE: runtimeEnv.NEXT_PUBLIC_ASSET_BASE,
    },
    // Resend only sends from a verified domain, so a key without a sender
    // address is a configuration mistake: fail at boot, not on the first message.
    createFinalSchema: (shape, isServer) =>
      z.object(shape).superRefine((env, ctx) => {
        if (isServer && env.RESEND_API_KEY && !env.CONTACT_FROM_EMAIL) {
          ctx.addIssue({
            code: "custom",
            path: ["CONTACT_FROM_EMAIL"],
            message: "Required when RESEND_API_KEY is set",
          });
        }
      }),
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
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  CONTACT_FROM_EMAIL: process.env.CONTACT_FROM_EMAIL,
  CONTACT_TO_EMAIL: process.env.CONTACT_TO_EMAIL,
  NEXT_PUBLIC_ASSET_BASE: process.env.NEXT_PUBLIC_ASSET_BASE,
});
```

In `.env.example`, insert this block directly **before** the line `# Optional absolute base URL for /public media (sequences, glb). Empty = same origin.`. The key stays empty on purpose: a placeholder key would make every local send call Resend.

```bash
# Contact form mail (Resend). Empty RESEND_API_KEY = nothing is sent: every
# mail is written to .data/mail/ as JSON instead (local dev, tests, CI).
# Resend keys look like re_xxxxxxxx. With a key set, CONTACT_FROM_EMAIL is
# required and must be on a domain verified in Resend.
RESEND_API_KEY=
CONTACT_FROM_EMAIL=contact@example.com
# Where new-message notifications go. Empty = ADMIN_EMAIL.
CONTACT_TO_EMAIL=
```

In `playwright.config.ts`, in `webServer.env`, replace

```ts
      // Local media storage even if .env.local has a Blob token.
      BLOB_READ_WRITE_TOKEN: "",
```

with

```ts
      // Local media storage even if .env.local has a Blob token.
      BLOB_READ_WRITE_TOKEN: "",
      // Mail goes to the .data/mail/ outbox even if .env.local has a Resend key.
      RESEND_API_KEY: "",
```

- [ ] **Step 5: Write the mailer**

Create `src/server/email/mailer.ts`:

```ts
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Resend } from "resend";

/** One rendered email. Header values (addresses, subject) must be single-line. */
export type Mail = {
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  /** Resend drops a repeat of the same key within 24 hours. */
  idempotencyKey?: string;
};

export type Mailer = {
  send(mail: Mail): Promise<{ id: string }>;
};

/** Resend (production). The SDK returns errors instead of throwing; this throws. */
export function createResendMailer(apiKey: string): Mailer {
  const resend = new Resend(apiKey);
  return {
    async send({ idempotencyKey, ...mail }) {
      const { data, error } = await resend.emails.send(
        mail,
        idempotencyKey ? { idempotencyKey } : undefined,
      );
      if (error) {
        throw new Error(
          `Resend refused the email (${error.name}): ${error.message}`,
        );
      }
      return { id: data.id };
    },
  };
}

/**
 * Local outbox (dev, tests, CI: no RESEND_API_KEY). Each mail becomes one
 * JSON file; names start with a timestamp, so `ls` lists them in order.
 */
export function createLocalMailer(dir: string): Mailer {
  return {
    async send(mail) {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const id = `${stamp}-${crypto.randomUUID()}`;
      await mkdir(dir, { recursive: true });
      await writeFile(
        path.join(dir, `${id}.json`),
        `${JSON.stringify(mail, null, 2)}\n`,
      );
      return { id };
    },
  };
}

export const LOCAL_MAIL_DIR = path.join(process.cwd(), ".data", "mail");

/**
 * Resend when a key is set; otherwise the local outbox. Vercel's filesystem is
 * read-only, so a deploy without a key fails every send: messages are still
 * stored, with email_status = failed.
 */
export function createMailer(options: {
  resendApiKey?: string;
  onVercel: boolean;
  localDir: string;
}): Mailer {
  if (options.resendApiKey) {
    return createResendMailer(options.resendApiKey);
  }
  if (options.onVercel) {
    return {
      async send() {
        throw new Error(
          "RESEND_API_KEY is not set: mail cannot be sent from Vercel without it.",
        );
      },
    };
  }
  return createLocalMailer(options.localDir);
}
```

Create `src/server/email/index.ts`:

```ts
import { env } from "@/env";
import { createMailer, LOCAL_MAIL_DIR, type Mailer } from "./mailer";

export type { Mail, Mailer } from "./mailer";

/** The app's mail transport (see createMailer). */
export function getMailer(): Mailer {
  return createMailer({
    resendApiKey: env.RESEND_API_KEY,
    onVercel: Boolean(process.env.VERCEL),
    localDir: LOCAL_MAIL_DIR,
  });
}

/** Sender and owner inbox. CONTACT_TO_EMAIL defaults to ADMIN_EMAIL. */
export function getMailAddresses(): { from: string; ownerInbox: string } {
  return {
    from: env.CONTACT_FROM_EMAIL ?? "contact@example.com",
    ownerInbox: env.CONTACT_TO_EMAIL ?? env.ADMIN_EMAIL,
  };
}
```

- [ ] **Step 6: Run the tests to see them pass**

Run: `pnpm exec vitest run tests/unit/env.test.ts tests/unit/mailer.test.ts`
Expected: `Test Files  2 passed (2)`, `Tests  31 passed (31)`.

Run: `pnpm test`
Expected: `Test Files  19 passed (19)`, `Tests  152 passed (152)`.

Run: `pnpm typecheck`
Expected: `✓ Types generated successfully`, exit 0.

Run: `rtk proxy pnpm lint`
Expected: `Checked 165 files in <n>ms. No fixes applied.`

- [ ] **Step 7: Commit**

```bash
/usr/bin/git add .env.example package.json pnpm-lock.yaml playwright.config.ts src tests
/usr/bin/git diff --cached | grep -cF "$(grep ^ADMIN_EMAIL= .env.local | cut -d= -f2)"
/usr/bin/git commit -m "feat(email): add resend and local outbox mailers"
```

The `grep -c` line must print `0`.

---

### Task 2: Contact mails with react-email (owner notification, EN/RO auto-reply)

**Owner:** backend-engineer

**Files:**
- Create: `src/server/email/headers.ts`, `src/server/email/templates/styles.ts`, `src/server/email/templates/OwnerNotification.tsx`, `src/server/email/templates/AutoReply.tsx`, `src/server/email/contact-mails.tsx`, `tests/unit/contact-mails.test.ts`

**Interfaces:**
- Consumes: `Mail` (Task 1), `Locale` from `@/i18n/routing`.
- Produces:
  - `headerText(value: string, max = 200): string` (control characters, including CR and LF, become single spaces; trimmed; shortened with `…`) and `mailbox(name, address): string` (`"Name" <address>`, quotes and backslashes escaped) from `@/server/email/headers`.
  - `type ContactMailInput = { message: { id; name; email; company: string | null; body; locale: Locale; createdAt: Date }; owner: { name; publicEmail }; from: string; ownerInbox: string; siteUrl: string }`.
  - `buildContactMails(input): Promise<{ owner: Mail; autoReply: Mail }>` from `@/server/email/contact-mails`:
    - Owner notification: from `"CV contact form" <from>`, to `ownerInbox`, `replyTo` = the visitor, subject `New message from <name>`, a link to `<siteUrl>/admin/messages/<id>`, idempotency key `contact-<id>-owner`.
    - Auto-reply: from `"<owner name>" <from>`, to the visitor, `replyTo` = the profile's public address, subject from `AUTO_REPLY_COPY[locale]`, idempotency key `contact-<id>-reply`.
  - `AUTO_REPLY_COPY` (EN/RO strings, typed `Record<Locale, …>` so both languages must exist).

- [ ] **Step 1: Write the failing test**

Create `tests/unit/contact-mails.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  buildContactMails,
  type ContactMailInput,
} from "@/server/email/contact-mails";
import { headerText, mailbox } from "@/server/email/headers";

const VISITOR = "ana@example.org";

function input(overrides: Partial<ContactMailInput["message"]> = {}) {
  return {
    message: {
      id: "0b6f3a52-6b1f-4a8e-9a55-2f1f0f9d8c11",
      name: "Ana Pop",
      email: VISITOR,
      company: "Acme",
      body: "Hello!\nWe need a <b>dashboard</b> & an API.",
      locale: "en",
      createdAt: new Date("2026-09-24T10:00:00Z"),
      ...overrides,
    },
    owner: { name: "Alex Marin", publicEmail: "hello@example.com" },
    from: "contact@example.com",
    ownerInbox: "owner@example.com",
    siteUrl: "https://cv.example.com",
  } satisfies ContactMailInput;
}

describe("headerText", () => {
  it("turns CR, LF and other control characters into single spaces", () => {
    expect(headerText("Ana\r\nBcc: victim@example.net\t\u0000x")).toBe(
      "Ana Bcc: victim@example.net x",
    );
  });

  it("shortens long values with an ellipsis", () => {
    expect(headerText("a".repeat(20), 10)).toBe(`${"a".repeat(9)}…`);
  });
});

describe("mailbox", () => {
  it("quotes the display name and escapes quotes and backslashes", () => {
    expect(mailbox('Alex "AM" Marin\\', "contact@example.com")).toBe(
      '"Alex \\"AM\\" Marin\\\\" <contact@example.com>',
    );
  });
});

describe("buildContactMails: owner notification", () => {
  it("goes from the site to the owner; the visitor is only the reply-to", async () => {
    const { owner } = await buildContactMails(input());

    expect(owner.from).toBe('"CV contact form" <contact@example.com>');
    expect(owner.to).toBe("owner@example.com");
    expect(owner.replyTo).toBe(VISITOR);
    expect(owner.from).not.toContain(VISITOR);
    expect(owner.to).not.toContain(VISITOR);
    expect(owner.subject).toBe("New message from Ana Pop");
    expect(owner.idempotencyKey).toBe(
      "contact-0b6f3a52-6b1f-4a8e-9a55-2f1f0f9d8c11-owner",
    );
  });

  it("shows the message escaped, with a link to the inbox", async () => {
    const { owner } = await buildContactMails(input());

    expect(owner.html).toContain("&lt;b&gt;dashboard&lt;/b&gt; &amp; an API.");
    expect(owner.html).not.toContain("<b>dashboard</b>");
    expect(owner.html).toContain(
      'href="https://cv.example.com/admin/messages/0b6f3a52-6b1f-4a8e-9a55-2f1f0f9d8c11"',
    );
    expect(owner.text).toContain(
      "Hello!\nWe need a <b>dashboard</b> & an API.",
    );
    expect(owner.text).toContain("Acme");
    expect(owner.text).toContain("English");
  });

  it("keeps line breaks in the name out of the subject (header injection)", async () => {
    const { owner } = await buildContactMails(
      input({ name: "Ana\r\nBcc: victim@example.net" }),
    );

    expect(owner.subject).toBe("New message from Ana Bcc: victim@example.net");
    expect(owner.subject).not.toMatch(/[\r\n]/);
  });
});

describe("buildContactMails: auto-reply", () => {
  it("answers in English from the owner, replies go to the public address", async () => {
    const { autoReply } = await buildContactMails(input());

    expect(autoReply.from).toBe('"Alex Marin" <contact@example.com>');
    expect(autoReply.to).toBe(VISITOR);
    expect(autoReply.replyTo).toBe("hello@example.com");
    expect(autoReply.subject).toBe("Thanks for your message");
    expect(autoReply.html).toContain('lang="en"');
    expect(autoReply.text).toContain("within two working days");
    expect(autoReply.text).toContain("Alex Marin");
  });

  it("answers in Romanian for a message sent from /ro", async () => {
    const { autoReply } = await buildContactMails(input({ locale: "ro" }));

    expect(autoReply.subject).toBe("Mulțumesc pentru mesaj");
    expect(autoReply.html).toContain('<html dir="ltr" lang="ro">');
    expect(autoReply.html).not.toContain('lang="en"');
    expect(autoReply.text).toContain("în două zile lucrătoare");
  });

  it("repeats nothing the visitor typed, so it cannot relay spam", async () => {
    const { autoReply } = await buildContactMails(
      input({
        name: "Cheap pills https://spam.example",
        company: "Spam Inc",
        body: "Visit https://spam.example now",
      }),
    );

    for (const part of [autoReply.subject, autoReply.html, autoReply.text]) {
      expect(part).not.toContain("spam.example");
      expect(part).not.toContain("Spam Inc");
    }
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm exec vitest run tests/unit/contact-mails.test.ts`
Expected: `Error: Cannot find package '@/server/email/contact-mails'`, `Test Files  1 failed (1)`, `Tests  no tests`.

- [ ] **Step 3: One-line header values**

Create `src/server/email/headers.ts`. The regular expression is `/[\x00-\x1f\x7f]+/g`: every C0 control character, including CR and LF, plus DEL.

```ts
// Anything that ends up in a mail header (subject, display names, addresses)
// must be one line: a CR or LF there could start a new header such as `Bcc:`.

// biome-ignore lint/suspicious/noControlCharactersInRegex: matching control characters is the point.
const CONTROL = /[\x00-\x1f\x7f]+/g;

/** Single-line header value: control characters become spaces, then trimmed and shortened. */
export function headerText(value: string, max = 200): string {
  const line = value.replace(CONTROL, " ").replace(/ {2,}/g, " ").trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

/** `"Display Name" <address>` with the name quoted per RFC 5322. */
export function mailbox(name: string, address: string): string {
  const quoted = headerText(name, 100).replace(/[\\"]/g, "\\$&");
  return `"${quoted}" <${headerText(address, 254)}>`;
}
```

- [ ] **Step 4: The templates**

Create `src/server/email/templates/styles.ts`:

```ts
import type { CSSProperties } from "react";

// Inline styles only: most mail clients drop <style> blocks and classes.
export const body: CSSProperties = {
  backgroundColor: "#f4f4f5",
  fontFamily: "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  margin: 0,
  padding: "24px 0",
};

export const container: CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: 8,
  margin: "0 auto",
  maxWidth: 560,
  padding: 32,
};

export const heading: CSSProperties = {
  color: "#0b0c0f",
  fontSize: 20,
  lineHeight: "28px",
  margin: "0 0 16px",
};

export const text: CSSProperties = {
  color: "#27272a",
  fontSize: 15,
  lineHeight: "24px",
  margin: "0 0 12px",
};

export const label: CSSProperties = {
  color: "#71717a",
  fontSize: 12,
  letterSpacing: "0.04em",
  margin: "0 0 2px",
  textTransform: "uppercase",
};

export const muted: CSSProperties = {
  color: "#71717a",
  fontSize: 13,
  lineHeight: "20px",
  margin: 0,
};

export const link: CSSProperties = { color: "#0b57d0" };
```

Create `src/server/email/templates/OwnerNotification.tsx`. The body is rendered line by line with `<br />`, because a single text node loses its line breaks in the plain-text version:

```tsx
import { Fragment } from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "react-email";
import type { Locale } from "@/i18n/routing";
import * as s from "./styles";

export type OwnerNotificationProps = {
  name: string;
  email: string;
  company: string | null;
  body: string;
  locale: Locale;
  receivedAt: Date;
  inboxUrl: string;
};

const LANGUAGE: Record<Locale, string> = { en: "English", ro: "Română" };

/** New-message mail for the owner (English, like the admin). */
export function OwnerNotification(props: OwnerNotificationProps) {
  const rows = [
    ["Name", props.name],
    ["Email", props.email],
    ["Company", props.company ?? "—"],
    ["Language", LANGUAGE[props.locale]],
    ["Received", `${props.receivedAt.toISOString().slice(0, 16)} UTC`],
  ] as const;

  return (
    <Html lang="en">
      <Head />
      <Preview>{props.body.slice(0, 120)}</Preview>
      <Body lang="en" style={s.body}>
        <Container style={s.container}>
          <Heading as="h1" style={s.heading}>
            New message from the CV site
          </Heading>
          {rows.map(([label, value]) => (
            <Section key={label}>
              <Text style={s.label}>{label}</Text>
              <Text style={s.text}>{value}</Text>
            </Section>
          ))}
          <Hr />
          <Text style={s.text}>
            {props.body.split(/\r?\n/).map((line, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: lines have no identity and never reorder.
              <Fragment key={index}>
                {index > 0 ? <br /> : null}
                {line}
              </Fragment>
            ))}
          </Text>
          <Hr />
          <Text style={s.text}>
            <Link href={props.inboxUrl} style={s.link}>
              Open in the admin inbox
            </Link>
          </Text>
          <Text style={s.muted}>
            Reply to this email to answer {props.name} directly.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
```

Create `src/server/email/templates/AutoReply.tsx`:

```tsx
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from "react-email";
import type { Locale } from "@/i18n/routing";
import * as s from "./styles";

export type AutoReplyProps = {
  locale: Locale;
  ownerName: string;
  siteUrl: string;
};

// Deliberately generic: the auto-reply never repeats what the visitor typed
// (name, company, message), so a form submitted with someone else's address
// cannot be used to relay spam to them.
export const AUTO_REPLY_COPY = {
  en: {
    subject: "Thanks for your message",
    greeting: "Hello,",
    body: "Thanks for getting in touch. Your message reached me, and I reply to every message within two working days.",
    automatic:
      "This is an automatic confirmation, so there is no need to answer it.",
  },
  ro: {
    subject: "Mulțumesc pentru mesaj",
    greeting: "Bună,",
    body: "Îți mulțumesc că mi-ai scris. Mesajul tău a ajuns la mine și răspund fiecărui mesaj în două zile lucrătoare.",
    automatic:
      "Acesta este un mesaj automat de confirmare; nu e nevoie să îi răspunzi.",
  },
} satisfies Record<Locale, Record<string, string>>;

/** Confirmation sent to the visitor in the language of the page they used. */
export function AutoReply({ locale, ownerName, siteUrl }: AutoReplyProps) {
  const copy = AUTO_REPLY_COPY[locale];
  const pageUrl = `${siteUrl}/${locale}`;

  return (
    <Html lang={locale}>
      <Head />
      <Preview>{copy.body}</Preview>
      <Body lang={locale} style={s.body}>
        <Container style={s.container}>
          <Heading as="h1" style={s.heading}>
            {copy.subject}
          </Heading>
          <Text style={s.text}>{copy.greeting}</Text>
          <Text style={s.text}>{copy.body}</Text>
          <Text style={s.text}>{ownerName}</Text>
          <Text style={s.muted}>
            {copy.automatic}{" "}
            <Link href={pageUrl} style={s.link}>
              {pageUrl}
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
```

- [ ] **Step 5: Compose the two mails**

Create `src/server/email/contact-mails.tsx`:

```tsx
import { render } from "react-email";
import type { Locale } from "@/i18n/routing";
import { headerText, mailbox } from "./headers";
import type { Mail } from "./mailer";
import { AUTO_REPLY_COPY, AutoReply } from "./templates/AutoReply";
import { OwnerNotification } from "./templates/OwnerNotification";

export type ContactMailInput = {
  message: {
    id: string;
    name: string;
    email: string;
    company: string | null;
    body: string;
    locale: Locale;
    createdAt: Date;
  };
  /** The CV owner, from the profile: signs the auto-reply and receives replies to it. */
  owner: { name: string; publicEmail: string };
  /** Verified sender address (CONTACT_FROM_EMAIL). */
  from: string;
  /** Where notifications go (CONTACT_TO_EMAIL, default ADMIN_EMAIL). */
  ownerInbox: string;
  siteUrl: string;
};

/**
 * The two mails for one stored message. The visitor's address appears only
 * as the owner mail's reply-to and as the auto-reply's recipient.
 */
export async function buildContactMails(
  input: ContactMailInput,
): Promise<{ owner: Mail; autoReply: Mail }> {
  const { message } = input;

  const notification = (
    <OwnerNotification
      name={message.name}
      email={message.email}
      company={message.company}
      body={message.body}
      locale={message.locale}
      receivedAt={message.createdAt}
      inboxUrl={`${input.siteUrl}/admin/messages/${message.id}`}
    />
  );
  const reply = (
    <AutoReply
      locale={message.locale}
      ownerName={input.owner.name}
      siteUrl={input.siteUrl}
    />
  );

  return {
    owner: {
      from: mailbox("CV contact form", input.from),
      to: input.ownerInbox,
      replyTo: headerText(message.email, 254),
      subject: headerText(`New message from ${message.name}`, 150),
      html: await render(notification),
      text: await render(notification, { plainText: true }),
      idempotencyKey: `contact-${message.id}-owner`,
    },
    autoReply: {
      from: mailbox(input.owner.name, input.from),
      to: headerText(message.email, 254),
      replyTo: input.owner.publicEmail,
      subject: AUTO_REPLY_COPY[message.locale].subject,
      html: await render(reply),
      text: await render(reply, { plainText: true }),
      idempotencyKey: `contact-${message.id}-reply`,
    },
  };
}
```

- [ ] **Step 6: Run the tests to see them pass**

Run: `pnpm exec vitest run tests/unit/contact-mails.test.ts`
Expected: `Test Files  1 passed (1)`, `Tests  9 passed (9)`.

Run: `pnpm test`
Expected: `Test Files  20 passed (20)`, `Tests  161 passed (161)`.

Run: `pnpm typecheck`
Expected: `✓ Types generated successfully`, exit 0.

Run: `rtk proxy pnpm lint`
Expected: `Checked 171 files in <n>ms. No fixes applied.`

- [ ] **Step 7: Commit**

```bash
/usr/bin/git add src tests
/usr/bin/git diff --cached | grep -cF "$(grep ^ADMIN_EMAIL= .env.local | cut -d= -f2)"
/usr/bin/git commit -m "feat(email): render contact mails in en and ro"
```

The `grep -c` line must print `0`.

---

### Task 3: The contact pipeline and the public Server Action

**Owner:** backend-engineer. security-auditor: read this task's diff against Review Focus items 1–4 before Task 4 starts.

**Files:**
- Create: `src/server/contact/state.ts`, `src/server/contact/schema.ts`, `src/server/contact/ip.ts`, `src/server/contact/submit.ts`, `src/server/actions/contact.ts`, `tests/unit/contact-ip.test.ts`, `tests/db/contact.test.ts`, `tests/db/contact-action.test.ts`
- Modify: `tests/db/admin-guard.test.ts`

**Interfaces:**
- Consumes:
  - `formToObject` (M2, drops `__proto__` and friends).
  - `message`, `profile`, `profileI18n` tables; `Db`.
  - `buildContactMails` (Task 2); `Mailer`, `getMailer`, `getMailAddresses` (Task 1).
  - `env.BETTER_AUTH_SECRET`, `siteUrl`.
- Produces:
  - `@/server/contact/state` (no imports, safe for the client bundle):
    - `type ContactField = "name" | "email" | "company" | "message"` and `type ContactFieldError = "required" | "invalid" | "tooLong"`.
    - `type ContactState = { status: "idle" } | { status: "sent" } | { status: "error"; reason: "invalid"; fieldErrors: Partial<Record<ContactField, ContactFieldError>> } | { status: "error"; reason: "tooFast" | "rateLimited" | "failed" }`.
    - `CONTACT_IDLE`, `HONEYPOT_FIELD = "website"`, `MIN_FILL_MS = 3000`.
  - `contactInput` (zod: name 1–100, email ≤ 254, company ≤ 100 or null, message 1–5000, locale `en` / `ro`) and `contactFieldErrors(issues)` from `@/server/contact/schema`.
  - `clientIp(headers: Headers): string` and `hashIp(ip, secret): string` (64 hex characters, HMAC-SHA256 of `contact-ip:<ip>`) from `@/server/contact/ip`.
  - `submitContact(formData, deps: SubmitContactDeps): Promise<ContactState>` and `RATE_LIMIT = { max: 5, windowMinutes: 10 }` from `@/server/contact/submit`, with `SubmitContactDeps = { db; mailer; ipHash; from; ownerInbox; siteUrl }`. Form fields: `name`, `email`, `company`, `message`, `locale`, `elapsedMs`, `website` (honeypot).
  - The Server Action `sendContactMessage(previous: ContactState, formData: FormData): Promise<ContactState>` from `@/server/actions/contact` (public, no session). Unexpected errors come back as `{ status: "error", reason: "failed" }`.
  - The admin-guard test now skips `auth.ts` **and** `contact.ts`.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/contact-ip.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { clientIp, hashIp } from "@/server/contact/ip";

describe("clientIp", () => {
  it("prefers x-real-ip (set by Vercel's proxy)", () => {
    const headers = new Headers({
      "x-real-ip": "198.51.100.4",
      "x-forwarded-for": "203.0.113.7",
    });

    expect(clientIp(headers)).toBe("198.51.100.4");
  });

  it("falls back to the first x-forwarded-for entry (next start sets it)", () => {
    const headers = new Headers({
      "x-forwarded-for": " 203.0.113.7 , 10.0.0.1",
    });

    expect(clientIp(headers)).toBe("203.0.113.7");
  });

  it("uses one shared bucket when no address is known", () => {
    expect(clientIp(new Headers())).toBe("unknown");
  });
});

describe("hashIp", () => {
  const SECRET = "test-secret-that-is-at-least-32-chars";

  it("is a stable keyed SHA-256 that does not contain the address", () => {
    const hash = hashIp("203.0.113.7", SECRET);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashIp("203.0.113.7", SECRET)).toBe(hash);
    expect(hash).not.toContain("203");
  });

  it("changes with the address and with the secret", () => {
    const hash = hashIp("203.0.113.7", SECRET);

    expect(hashIp("203.0.113.8", SECRET)).not.toBe(hash);
    expect(hashIp("203.0.113.7", `${SECRET}-rotated`)).not.toBe(hash);
  });
});
```

Create `tests/db/contact.test.ts` (the pipeline against PGlite with a recording mailer; no module mocks needed):

```ts
import { count, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { type SubmitContactDeps, submitContact } from "@/server/contact/submit";
import { message } from "@/server/db/schema";
import { seedContent } from "@/server/db/seed";
import type { Db } from "@/server/db/types";
import type { Mail, Mailer } from "@/server/email/mailer";
import { form } from "./form";
import { createTestDb } from "./test-db";

let db: Db;
let close: () => Promise<void>;
let sent: Mail[];

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  await seedContent(db);
});

afterAll(async () => {
  await close();
});

beforeEach(async () => {
  await db.delete(message);
  sent = [];
});

const recordingMailer: Mailer = {
  async send(mail) {
    sent.push(mail);
    return { id: `mail-${sent.length}` };
  },
};

function deps(overrides: Partial<SubmitContactDeps> = {}): SubmitContactDeps {
  return {
    db,
    mailer: recordingMailer,
    ipHash: "ip-a",
    from: "contact@example.com",
    ownerInbox: "owner@example.com",
    siteUrl: "https://cv.example.com",
    ...overrides,
  };
}

function contactForm(overrides: Record<string, string> = {}): FormData {
  return form({
    name: "Ana Pop",
    email: "ana@example.org",
    company: "",
    message: "We need a dashboard.",
    locale: "en",
    elapsedMs: "4200",
    website: "",
    ...overrides,
  });
}

async function messageCount(): Promise<number> {
  const [{ value }] = await db.select({ value: count() }).from(message);
  return value;
}

describe("submitContact", () => {
  it("stores the message, then mails the owner and the visitor", async () => {
    const result = await submitContact(contactForm(), deps());

    expect(result).toEqual({ status: "sent" });
    const [row] = await db.select().from(message);
    expect(row).toMatchObject({
      name: "Ana Pop",
      email: "ana@example.org",
      company: null,
      body: "We need a dashboard.",
      locale: "en",
      ipHash: "ip-a",
      status: "new",
      emailStatus: "sent",
    });
    expect(sent.map((mail) => [mail.to, mail.replyTo])).toEqual([
      ["owner@example.com", "ana@example.org"],
      ["ana@example.org", "hello@example.com"],
    ]);
    expect(sent[0].html).toContain(`/admin/messages/${row.id}`);
    expect(sent[1].from).toBe('"Alex Marin" <contact@example.com>');
  });

  it("keeps the message with email_status failed when sending fails", async () => {
    const down: Mailer = {
      async send() {
        throw new Error("Resend refused the email (application_error): down");
      },
    };

    const result = await submitContact(contactForm(), deps({ mailer: down }));

    expect(result).toEqual({ status: "sent" });
    const [row] = await db.select().from(message);
    expect(row.emailStatus).toBe("failed");
    expect(row.body).toBe("We need a dashboard.");
  });

  it("a failed auto-reply alone does not mark the message failed", async () => {
    const visitorBounces: Mailer = {
      async send(mail) {
        if (mail.to === "ana@example.org") {
          throw new Error("Resend refused the email (validation_error): bad");
        }
        return recordingMailer.send(mail);
      },
    };

    await submitContact(contactForm(), deps({ mailer: visitorBounces }));

    const [row] = await db.select().from(message);
    expect(row.emailStatus).toBe("sent");
  });

  it("answers in Romanian for a message sent from /ro", async () => {
    await submitContact(contactForm({ locale: "ro" }), deps());

    const [row] = await db.select().from(message);
    expect(row.locale).toBe("ro");
    expect(sent[1].subject).toBe("Mulțumesc pentru mesaj");
  });

  it("pretends to accept a submission with the honeypot filled, and drops it", async () => {
    const result = await submitContact(
      contactForm({ website: "https://spam.example" }),
      deps(),
    );

    expect(result).toEqual({ status: "sent" });
    expect(await messageCount()).toBe(0);
    expect(sent).toEqual([]);
  });

  it("rejects a form sent less than 3 seconds after the page loaded", async () => {
    for (const elapsedMs of ["2999", "", "soon"]) {
      const result = await submitContact(contactForm({ elapsedMs }), deps());

      expect(result).toEqual({ status: "error", reason: "tooFast" });
    }
    expect(await messageCount()).toBe(0);
  });

  it("reports invalid fields and stores nothing", async () => {
    const result = await submitContact(
      contactForm({
        name: "  ",
        email: "not-an-email",
        company: "c".repeat(101),
        message: "m".repeat(5001),
      }),
      deps(),
    );

    expect(result).toEqual({
      status: "error",
      reason: "invalid",
      fieldErrors: {
        name: "required",
        email: "invalid",
        company: "tooLong",
        message: "tooLong",
      },
    });
    expect(await messageCount()).toBe(0);
  });

  it("accepts 5 messages per address in 10 minutes and rejects the 6th", async () => {
    for (let i = 0; i < 5; i++) {
      expect(await submitContact(contactForm(), deps())).toEqual({
        status: "sent",
      });
    }

    const sixth = await submitContact(contactForm(), deps());

    expect(sixth).toEqual({ status: "error", reason: "rateLimited" });
    expect(await messageCount()).toBe(5);
    expect(sent).toHaveLength(10);
    expect(
      await submitContact(contactForm(), deps({ ipHash: "ip-b" })),
    ).toEqual({ status: "sent" });
  });

  it("only counts the last 10 minutes", async () => {
    await db.insert(message).values(
      Array.from({ length: 5 }, () => ({
        name: "Old",
        email: "old@example.org",
        body: "Earlier",
        locale: "en" as const,
        ipHash: "ip-a",
        createdAt: sql`now() - interval '11 minutes'`,
      })),
    );

    const result = await submitContact(contactForm(), deps());

    expect(result).toEqual({ status: "sent" });
  });

  it("never lets parallel requests from one address past the limit", async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, () => submitContact(contactForm(), deps())),
    );

    expect(results.filter((r) => r.status === "sent")).toHaveLength(5);
    expect(
      await db
        .select({ value: count() })
        .from(message)
        .where(eq(message.ipHash, "ip-a")),
    ).toEqual([{ value: 5 }]);
  });
});
```

Create `tests/db/contact-action.test.ts` (the Server Action wrapper: request headers, env and mailer mocked):

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
import { sendContactMessage } from "@/server/actions/contact";
import { hashIp } from "@/server/contact/ip";
import { CONTACT_IDLE } from "@/server/contact/state";
import { message } from "@/server/db/schema";
import { seedContent } from "@/server/db/seed";
import type { Db } from "@/server/db/types";
import type { Mail } from "@/server/email/mailer";
import { cacheModule, mocks, setupActionDb } from "./action-mocks";
import { form } from "./form";

const SECRET = vi.hoisted(() => "test-secret-that-is-at-least-32-chars");
const request = vi.hoisted(() => ({ headers: new Headers() }));
const outbox = vi.hoisted(() => [] as Mail[]);

vi.mock("@/server/db", () => import("./action-mocks").then((m) => m.dbModule));
vi.mock("next/cache", () =>
  import("./action-mocks").then((m) => m.cacheModule),
);
vi.mock("next/headers", () => ({ headers: async () => request.headers }));
vi.mock("@/env", () => ({ env: { BETTER_AUTH_SECRET: SECRET } }));
vi.mock("@/site", () => ({ siteUrl: "https://cv.example.com" }));
vi.mock("@/server/email", () => ({
  getMailer: () => ({
    send: async (mail: Mail) => {
      outbox.push(mail);
      return { id: String(outbox.length) };
    },
  }),
  getMailAddresses: () => ({
    from: "contact@example.com",
    ownerInbox: "owner@example.com",
  }),
}));

let close: () => Promise<void>;
let realDb: Db;

beforeAll(async () => {
  close = await setupActionDb();
  realDb = mocks.db;
  await seedContent(mocks.db);
});

afterAll(async () => {
  await close();
});

beforeEach(async () => {
  mocks.db = realDb;
  await mocks.db.delete(message);
  outbox.length = 0;
  request.headers = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" });
});

const valid = () =>
  form({
    name: "Ana Pop",
    email: "ana@example.org",
    message: "Hello",
    locale: "en",
    elapsedMs: "5000",
  });

describe("sendContactMessage (public Server Action)", () => {
  it("needs no session and stores a keyed hash of the client IP", async () => {
    const result = await sendContactMessage(CONTACT_IDLE, valid());

    expect(result).toEqual({ status: "sent" });
    const [row] = await mocks.db.select().from(message);
    expect(row.ipHash).toBe(hashIp("203.0.113.7", SECRET));
    expect(outbox.map((mail) => mail.to)).toEqual([
      "owner@example.com",
      "ana@example.org",
    ]);
  });

  it("leaves the static public pages alone (no cache expiry, no refresh)", async () => {
    await sendContactMessage(CONTACT_IDLE, valid());

    expect(mocks.updateTag).not.toHaveBeenCalled();
    expect(cacheModule.refresh).not.toHaveBeenCalled();
  });

  it("answers failed instead of throwing when the database is down", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.db = {
      transaction: async () => {
        throw new Error("connect ECONNREFUSED 127.0.0.1:5432");
      },
    } as unknown as Db;

    const result = await sendContactMessage(CONTACT_IDLE, valid());

    expect(result).toEqual({ status: "error", reason: "failed" });
    expect(error).toHaveBeenCalled();
    expect(outbox).toEqual([]);
    error.mockRestore();
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm exec vitest run tests/unit/contact-ip.test.ts tests/db/contact.test.ts tests/db/contact-action.test.ts`
Expected: `Test Files  3 failed (3)`, `Tests  no tests`, with

```
Error: Cannot find package '@/server/actions/contact' imported from …/tests/db/contact-action.test.ts
Error: Cannot find package '@/server/contact/submit' imported from …/tests/db/contact.test.ts
Error: Cannot find package '@/server/contact/ip' imported from …/tests/unit/contact-ip.test.ts
```

- [ ] **Step 3: State, input and IP helpers**

Create `src/server/contact/state.ts`:

```ts
// Shared by the contact Server Action and the public form (client bundle):
// types and constants only, no imports.

export type ContactField = "name" | "email" | "company" | "message";
export type ContactFieldError = "required" | "invalid" | "tooLong";

/**
 * What the contact action returns. The client shows localized text for each
 * case, so no message strings travel over the wire.
 */
export type ContactState =
  | { status: "idle" }
  | { status: "sent" }
  | {
      status: "error";
      reason: "invalid";
      fieldErrors: Partial<Record<ContactField, ContactFieldError>>;
    }
  | { status: "error"; reason: "tooFast" | "rateLimited" | "failed" };

export const CONTACT_IDLE: ContactState = { status: "idle" };

/** Hidden field that people never see; bots that fill every input do. */
export const HONEYPOT_FIELD = "website";

/** Spec §5: a form sent sooner than this after the page loaded is refused. */
export const MIN_FILL_MS = 3000;
```

Create `src/server/contact/schema.ts`:

```ts
import { z } from "zod";
import { routing } from "@/i18n/routing";
import type { ContactField, ContactFieldError } from "./state";

export const contactInput = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().min(1).max(254).pipe(z.email()),
  company: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((value) => value || null),
  message: z.string().trim().min(1).max(5000),
  locale: z.enum(routing.locales),
});

export type ContactInput = z.output<typeof contactInput>;

const FIELDS = new Set<string>(["name", "email", "company", "message"]);

/** One error code per visible field; the form shows localized text for it. */
export function contactFieldErrors(
  issues: z.core.$ZodIssue[],
): Partial<Record<ContactField, ContactFieldError>> {
  const result: Partial<Record<ContactField, ContactFieldError>> = {};
  for (const issue of issues) {
    const field = String(issue.path[0]);
    if (!FIELDS.has(field) || result[field as ContactField]) {
      continue;
    }
    result[field as ContactField] =
      issue.code === "too_big"
        ? "tooLong"
        : issue.code === "invalid_format"
          ? "invalid"
          : "required";
  }
  return result;
}
```

Create `src/server/contact/ip.ts`:

```ts
import { createHmac } from "node:crypto";

/**
 * The visitor's IP address, used only for the rate limit.
 *
 * On Vercel, `x-real-ip` and `x-forwarded-for` are set by Vercel's proxy and
 * overwrite whatever the client sent, so they can be trusted. `next start`
 * fills `x-forwarded-for` from the socket only when the request has none, so
 * on a server without a trusted proxy in front a client can pick its own
 * address and step around the limit. Without any header, all visitors share
 * one bucket ("unknown").
 */
export function clientIp(headers: Headers): string {
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "unknown";
}

/**
 * Keyed hash of an IP (HMAC-SHA256): stored instead of the address, so the
 * database never holds visitor IPs and a leaked table cannot be reversed by
 * hashing all 2^32 IPv4 addresses without the secret.
 */
export function hashIp(ip: string, secret: string): string {
  return createHmac("sha256", secret).update(`contact-ip:${ip}`).digest("hex");
}
```

- [ ] **Step 4: The pipeline and the action**

Create `src/server/contact/submit.ts`:

```ts
import { and, count, eq, gt, sql } from "drizzle-orm";
import { formToObject } from "@/server/admin/form-data";
import { message, profile, profileI18n } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { buildContactMails } from "@/server/email/contact-mails";
import type { Mailer } from "@/server/email/mailer";
import { contactFieldErrors, contactInput } from "./schema";
import { type ContactState, HONEYPOT_FIELD, MIN_FILL_MS } from "./state";

/** Spec §5: at most 5 messages per ip_hash in 10 minutes. */
export const RATE_LIMIT = { max: 5, windowMinutes: 10 } as const;

export type SubmitContactDeps = {
  db: Db;
  mailer: Mailer;
  /** hashIp(clientIp(headers), secret) */
  ipHash: string;
  from: string;
  ownerInbox: string;
  siteUrl: string;
};

/**
 * The contact pipeline (spec §5): honeypot, zod, minimum fill time, rate
 * limit, insert first, then the owner notification and the auto-reply. A
 * failed notification leaves the message stored with email_status = failed.
 */
export async function submitContact(
  formData: FormData,
  deps: SubmitContactDeps,
): Promise<ContactState> {
  const raw = formToObject(formData);

  // Bots get the same answer as people, so they do not learn to skip the field.
  if (typeof raw[HONEYPOT_FIELD] === "string" && raw[HONEYPOT_FIELD] !== "") {
    return { status: "sent" };
  }

  const parsed = contactInput.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "error",
      reason: "invalid",
      fieldErrors: contactFieldErrors(parsed.error.issues),
    };
  }

  const elapsed = Number(raw.elapsedMs);
  if (!Number.isFinite(elapsed) || elapsed < MIN_FILL_MS) {
    return { status: "error", reason: "tooFast" };
  }

  const input = parsed.data;
  const stored = await deps.db.transaction(async (tx) => {
    // Serializes requests from one address, so parallel posts cannot all pass
    // the count before any of them inserts.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`contact:${deps.ipHash}`}))`,
    );
    const [{ recent }] = await tx
      .select({ recent: count() })
      .from(message)
      .where(
        and(
          eq(message.ipHash, deps.ipHash),
          gt(
            message.createdAt,
            sql`now() - make_interval(mins => ${RATE_LIMIT.windowMinutes})`,
          ),
        ),
      );
    if (recent >= RATE_LIMIT.max) {
      return null;
    }
    const [row] = await tx
      .insert(message)
      .values({
        name: input.name,
        email: input.email,
        company: input.company,
        body: input.message,
        locale: input.locale,
        ipHash: deps.ipHash,
      })
      .returning({ id: message.id, createdAt: message.createdAt });
    return row;
  });
  if (!stored) {
    return { status: "error", reason: "rateLimited" };
  }

  let emailStatus: "sent" | "failed" = "failed";
  try {
    const mails = await buildContactMails({
      message: {
        id: stored.id,
        name: input.name,
        email: input.email,
        company: input.company,
        body: input.message,
        locale: input.locale,
        createdAt: stored.createdAt,
      },
      owner: await loadOwner(deps.db, deps.from),
      from: deps.from,
      ownerInbox: deps.ownerInbox,
      siteUrl: deps.siteUrl,
    });
    const [owner, reply] = await Promise.allSettled([
      deps.mailer.send(mails.owner),
      deps.mailer.send(mails.autoReply),
    ]);
    if (owner.status === "fulfilled") {
      emailStatus = "sent";
    } else {
      console.error("contact: owner notification failed", owner.reason);
    }
    if (reply.status === "rejected") {
      console.warn("contact: auto-reply failed", reply.reason);
    }
  } catch (error) {
    console.error("contact: could not build the mails", error);
  }

  await deps.db
    .update(message)
    .set({ emailStatus })
    .where(eq(message.id, stored.id));
  return { status: "sent" };
}

/** Name and public address from the profile (English row); signs the auto-reply. */
async function loadOwner(
  db: Db,
  fallbackEmail: string,
): Promise<{ name: string; publicEmail: string }> {
  const [row] = await db
    .select({ name: profileI18n.fullName, publicEmail: profile.emailPublic })
    .from(profile)
    .innerJoin(
      profileI18n,
      and(eq(profileI18n.profileId, profile.id), eq(profileI18n.locale, "en")),
    );
  return {
    name: row?.name || "CV",
    publicEmail: row?.publicEmail || fallbackEmail,
  };
}
```

Create `src/server/actions/contact.ts`:

```ts
"use server";

import { headers } from "next/headers";
import { env } from "@/env";
import { clientIp, hashIp } from "@/server/contact/ip";
import type { ContactState } from "@/server/contact/state";
import { submitContact } from "@/server/contact/submit";
import { getDb } from "@/server/db";
import { getMailAddresses, getMailer } from "@/server/email";
import { siteUrl } from "@/site";

/**
 * The public contact form's action: no session (visitors are anonymous). It
 * never expires a cache tag or refreshes the router, so /en and /ro stay
 * static; the answer is only the returned state.
 */
export async function sendContactMessage(
  _previous: ContactState,
  formData: FormData,
): Promise<ContactState> {
  try {
    const ip = clientIp(await headers());
    const { from, ownerInbox } = getMailAddresses();
    return await submitContact(formData, {
      db: getDb(),
      mailer: getMailer(),
      ipHash: hashIp(ip, env.BETTER_AUTH_SECRET),
      from,
      ownerInbox,
      siteUrl,
    });
  } catch (error) {
    console.error("contact: message not stored", error);
    return { status: "error", reason: "failed" };
  }
}
```

Run: `pnpm exec vitest run tests/unit/contact-ip.test.ts tests/db/contact.test.ts tests/db/contact-action.test.ts`
Expected: `Test Files  3 passed (3)`, `Tests  18 passed (18)`.

- [ ] **Step 5: Keep the public action out of the admin guard**

The guard test imports every module in `src/server/actions/`, so it now also imports `contact.ts`. That module's `@/env` import validates `process.env`, which throws under Vitest (and a public action has no session check to test anyway):

Run: `pnpm exec vitest run tests/db/admin-guard.test.ts`
Expected: `FAIL  tests/db/admin-guard.test.ts`, `Error: Invalid environment variables`, `Tests  no tests`.

In `tests/db/admin-guard.test.ts`, replace

```ts
// Every export of every module in src/server/actions/ except auth.ts (sign-in
// and sign-out run before there is a session). A module or action added later
// is covered without touching this test.
const modules = import.meta.glob(
  ["../../src/server/actions/*.ts", "!../../src/server/actions/auth.ts"],
  { eager: true },
) as Record<string, Record<string, AdminFormAction>>;
```

with

```ts
// Every export of every module in src/server/actions/ except the two public
// ones: auth.ts (sign-in and sign-out run before there is a session) and
// contact.ts (the visitor contact form, tests/db/contact-action.test.ts). A
// module or action added later is covered without touching this test.
const modules = import.meta.glob(
  [
    "../../src/server/actions/*.ts",
    "!../../src/server/actions/auth.ts",
    "!../../src/server/actions/contact.ts",
  ],
  { eager: true },
) as Record<string, Record<string, AdminFormAction>>;
```

Run: `pnpm exec vitest run tests/db/admin-guard.test.ts`
Expected: `Test Files  1 passed (1)`, `Tests  20 passed (20)` (the 19 M2 actions + `finds the actions`).

- [ ] **Step 6: Check the advisory lock against real Postgres (not committed)**

PGlite runs one transaction at a time, so Step 4's parallel test would also pass without the lock. This one-off script (in the session scratchpad, not in the repo) proves the lock on the docker database. Replace `<scratch>` with the scratchpad path:

```bash
cat > <scratch>/race.ts <<'EOF'
import { count, eq } from "drizzle-orm";
import { submitContact } from "@/server/contact/submit";
import { createDb } from "@/server/db/create-db";
import { message } from "@/server/db/schema";

async function main() {
  const { db, pool } = createDb(process.env.DATABASE_URL ?? "");
  const ipHash = `race-${Date.now()}`;
  const mailer = { send: async () => ({ id: "x" }) };
  const fields = { name: "A", email: "a@example.org", message: "hi", locale: "en", elapsedMs: "5000" };
  const form = () => {
    const data = new FormData();
    for (const [key, value] of Object.entries(fields)) data.set(key, value);
    return data;
  };
  const deps = { db, mailer, ipHash, from: "c@example.com", ownerInbox: "o@example.com", siteUrl: "http://x" };
  await Promise.all(Array.from({ length: 12 }, () => submitContact(form(), deps)));
  const [{ value }] = await db.select({ value: count() }).from(message).where(eq(message.ipHash, ipHash));
  console.log(`stored ${value}`);
  await db.delete(message).where(eq(message.ipHash, ipHash));
  await pool.end();
}
main();
EOF
cp <scratch>/race.ts scripts/zz-race.ts
node --env-file=.env.local --import tsx scripts/zz-race.ts
rm scripts/zz-race.ts
```

Expected: `stored 5`. Measured with the `pg_advisory_xact_lock` statement removed: `stored 10` (three runs).

- [ ] **Step 7: Run the whole suite**

Run: `pnpm test`
Expected: `Test Files  23 passed (23)`, `Tests  179 passed (179)`.

Run: `pnpm typecheck`
Expected: `✓ Types generated successfully`, exit 0.

Run: `rtk proxy pnpm lint`
Expected: `Checked 179 files in <n>ms. No fixes applied.`

- [ ] **Step 8: Commit**

```bash
/usr/bin/git add src tests
/usr/bin/git status --short
/usr/bin/git diff --cached | grep -cF "$(grep ^ADMIN_EMAIL= .env.local | cut -d= -f2)"
/usr/bin/git commit -m "feat(contact): store, rate-limit and mail messages"
```

`git status --short` must list no `scripts/zz-race.ts`; the `grep -c` line must print `0`.

---

### Task 4: The public contact form

**Owner:** frontend-engineer (form and copy). The e2e harness changes (`playwright.config.ts`, `scripts/e2e-db.ts`, `tests/e2e/contact*.ts`) may go to tester in parallel, since they only depend on Task 3's interfaces.

**Files:**
- Create: `src/components/sections/ContactForm.tsx`, `tests/e2e/contact-outbox.ts`, `tests/e2e/contact.spec.ts`
- Modify: `src/components/sections/Contact.tsx`, `messages/en.json`, `messages/ro.json`, `playwright.config.ts`, `scripts/e2e-db.ts`, `tests/e2e/hero-projects-contact.spec.ts`

**Interfaces:**
- Consumes: `sendContactMessage`, `ContactState`, `ContactField`, `ContactFieldError`, `CONTACT_IDLE`, `HONEYPOT_FIELD` (Task 3); `E2E_ADMIN` (M2).
- Produces:
  - `ContactForm({ locale, labels }: { locale: Locale; labels: ContactFormLabels })` (client component). It sends `name`, `email`, `company`, `message`, `locale`, `elapsedMs` (time since hydration, from `performance.now()`) and the empty honeypot `website`.
  - `ContactFormLabels` (every string, translated on the server).
  - New message keys under `Contact.form`: `sending`, `hint`, `sent`, `honeypot`, `errors.{invalid,tooFast,rateLimited,failed}`, `fieldErrors.{required,invalid,tooLong}`. The M1 key `pending` is removed.
  - e2e helpers `OUTBOX`, `StoredMail`, `contactMails(visitorEmail)` → `{ owner?, reply? }`, and `uniqueVisitor(name)` from `tests/e2e/contact-outbox.ts`.
  - The e2e server sends from `contact@e2e.example.com` to `ADMIN_EMAIL`, and `scripts/e2e-db.ts` deletes all messages before each run (otherwise a re-run within 10 minutes would hit the rate limit).

- [ ] **Step 1: Point the e2e server's mail at the outbox and reset messages per run**

In `playwright.config.ts`, in `webServer.env`, replace

```ts
      // Mail goes to the .data/mail/ outbox even if .env.local has a Resend key.
      RESEND_API_KEY: "",
```

with

```ts
      // Mail goes to the .data/mail/ outbox even if .env.local has a Resend key;
      // notifications go to ADMIN_EMAIL.
      RESEND_API_KEY: "",
      CONTACT_FROM_EMAIL: "contact@e2e.example.com",
      CONTACT_TO_EMAIL: "",
```

Replace `scripts/e2e-db.ts`:

```ts
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";
import { upsertAdmin } from "@/server/auth/admin";
import { createAuth } from "@/server/auth/create-auth";
import { createDb } from "@/server/db/create-db";
import { message } from "@/server/db/schema";
import { seedContent } from "@/server/db/seed";
import { requireEnv } from "./require-env";

// Prepares the e2e database named in DATABASE_URL (playwright.config.ts points
// it at `cv_e2e`, never the dev database): creates it if missing, applies the
// migrations, resets the CV content to the fixtures, deletes contact messages
// and (re)creates the owner account from ADMIN_EMAIL / ADMIN_PASSWORD.
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
    // Messages from an earlier run would count against the contact rate limit.
    await db.delete(message);
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

- [ ] **Step 2: Write the failing e2e tests**

Create `tests/e2e/contact-outbox.ts`:

```ts
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

// Without RESEND_API_KEY (playwright.config.ts clears it) the app writes every
// mail to this folder as JSON; e2e reads it back instead of a real inbox.
export const OUTBOX = path.join(process.cwd(), ".data", "mail");

export type StoredMail = {
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
};

/**
 * The owner notification (reply-to = visitor) and the auto-reply (to =
 * visitor) for one visitor address. Both are sent at once, so file order says
 * nothing about which is which.
 */
export async function contactMails(
  visitorEmail: string,
): Promise<{ owner?: StoredMail; reply?: StoredMail }> {
  let files: string[];
  try {
    files = (await readdir(OUTBOX)).filter((file) => file.endsWith(".json"));
  } catch {
    return {};
  }
  const mails = await Promise.all(
    files.map(
      async (file) =>
        JSON.parse(
          await readFile(path.join(OUTBOX, file), "utf8"),
        ) as StoredMail,
    ),
  );
  return {
    owner: mails.find((mail) => mail.replyTo === visitorEmail),
    reply: mails.find((mail) => mail.to === visitorEmail),
  };
}

/** A visitor address no other test uses. */
export function uniqueVisitor(name: string): string {
  return `${name}.${crypto.randomUUID().slice(0, 8)}@example.org`;
}
```

Create `tests/e2e/contact.spec.ts` (it runs in the `public` project; each `describe` posts from its own RFC 5737 address, so the rate limit of one test never touches another):

```ts
import { expect, type Page, test } from "@playwright/test";
import { E2E_ADMIN } from "./admin-credentials";
import { contactMails, uniqueVisitor } from "./contact-outbox";

// `next start` keeps an x-forwarded-for header it receives, so each test posts
// from its own documentation address (RFC 5737) and gets its own rate-limit
// bucket. On Vercel the proxy overwrites the header.
function postFrom(ip: string) {
  test.use({ extraHTTPHeaders: { "x-forwarded-for": ip } });
}

async function fillContactForm(
  page: Page,
  values: { name: string; email: string; message: string },
) {
  const form = page.getByRole("form", {
    name: /Send a message|Trimite un mesaj/,
  });
  await form.getByRole("textbox", { name: /^(Name|Nume)$/ }).fill(values.name);
  await form.getByRole("textbox", { name: "Email" }).fill(values.email);
  await form
    .getByRole("textbox", { name: /^(Message|Mesaj)$/ })
    .fill(values.message);
  return form;
}

test.describe("sending a message", () => {
  postFrom("192.0.2.10");

  test("the owner and the visitor each get a mail", async ({ page }) => {
    const email = uniqueVisitor("ana");
    await page.goto("/en");
    const form = await fillContactForm(page, {
      name: "Ana Pop",
      email,
      message: "We need a dashboard for our clinic.",
    });
    // Spec §5: a form sent sooner than 3 s after the page loaded is refused.
    await page.waitForTimeout(3_100);

    await form.getByRole("button", { name: "Send message" }).click();

    await expect(form.getByRole("status")).toHaveText(
      "Thanks! Your message is on its way. I reply within two working days.",
    );
    await expect(form.getByRole("textbox", { name: "Name" })).toHaveValue("");
    await expect
      .poll(async () => {
        const { owner, reply } = await contactMails(email);
        return Boolean(owner && reply);
      })
      .toBe(true);
    const { owner, reply } = await contactMails(email);
    expect(owner).toMatchObject({
      from: '"CV contact form" <contact@e2e.example.com>',
      to: E2E_ADMIN.email,
      replyTo: email,
      subject: "New message from Ana Pop",
    });
    expect(owner?.text).toContain("We need a dashboard for our clinic.");
    expect(reply).toMatchObject({
      from: '"Alex Marin" <contact@e2e.example.com>',
      to: email,
      subject: "Thanks for your message",
    });
  });
});

test.describe("sending a message from /ro", () => {
  postFrom("192.0.2.11");

  test("confirms and auto-replies in Romanian", async ({ page }) => {
    const email = uniqueVisitor("ioana");
    await page.goto("/ro");
    const form = await fillContactForm(page, {
      name: "Ioana",
      email,
      message: "Salut!",
    });
    await page.waitForTimeout(3_100);

    await form.getByRole("button", { name: "Trimite mesajul" }).click();

    await expect(form.getByRole("status")).toHaveText(
      "Mulțumesc! Mesajul tău a plecat. Îți răspund în două zile lucrătoare.",
    );
    await expect
      .poll(async () => (await contactMails(email)).reply?.subject)
      .toBe("Mulțumesc pentru mesaj");
  });
});

test.describe("a form sent too quickly", () => {
  postFrom("192.0.2.12");

  test("is refused with a hint to try again", async ({ page }) => {
    const email = uniqueVisitor("bot");
    await page.goto("/en");
    const form = await fillContactForm(page, {
      name: "Quick",
      email,
      message: "Instant",
    });

    await form.getByRole("button", { name: "Send message" }).click();

    await expect(form.getByRole("status")).toHaveText(
      "That was quick. Take a moment to check your message, then send it again.",
    );
    await expect(form.getByRole("textbox", { name: "Name" })).toHaveValue(
      "Quick",
    );
    expect(await contactMails(email)).toEqual({});
  });
});

test.describe("the rate limit", () => {
  postFrom("192.0.2.13");

  test("refuses the sixth message in ten minutes", async ({ page }) => {
    await page.goto("/en");
    await page.waitForTimeout(3_100);
    const form = page.getByRole("form", { name: "Send a message" });

    for (let i = 1; i <= 5; i++) {
      await fillContactForm(page, {
        name: `Sender ${i}`,
        email: uniqueVisitor("limit"),
        message: `Message ${i}`,
      });
      await form.getByRole("button", { name: "Send message" }).click();
      // A sent form is cleared, so an empty name means this one went through.
      await expect(form.getByRole("textbox", { name: "Name" })).toHaveValue("");
    }
    await fillContactForm(page, {
      name: "Sender 6",
      email: uniqueVisitor("limit"),
      message: "Message 6",
    });
    await form.getByRole("button", { name: "Send message" }).click();

    await expect(form.getByRole("status")).toHaveText(
      "You have sent several messages in a short time. Try again in a few minutes, or email me directly.",
    );
    await expect(form.getByRole("textbox", { name: "Name" })).toHaveValue(
      "Sender 6",
    );
  });
});

test("the honeypot field is hidden from people and assistive technology", async ({
  page,
}) => {
  await page.goto("/en");
  const form = page.getByRole("form", { name: "Send a message" });

  await expect(form.getByRole("textbox")).toHaveCount(4);
  const honeypot = form.locator('input[name="website"]');
  await expect(honeypot).toHaveAttribute("tabindex", "-1");
  await expect(honeypot).not.toBeInViewport();
});
```

In `tests/e2e/hero-projects-contact.spec.ts`, replace the M1 test `contact form is labelled and cannot submit before M3` (from its `test(` line down to the line before `test("plays the studio light sweep once"`) with:

```ts
test("contact form is labelled", async ({ page }) => {
  await page.goto("/en");
  const form = page.getByRole("form", { name: "Send a message" });

  await expect(form.getByLabel("Name")).toHaveAttribute("autocomplete", "name");
  await expect(form.getByLabel("Email")).toHaveAttribute("type", "email");
  await expect(form.getByLabel("Company (optional)")).toBeVisible();
  await expect(form.getByLabel("Message")).toBeVisible();
  await expect(
    form.getByRole("button", { name: "Send message" }),
  ).toBeEnabled();
});
```

- [ ] **Step 3: Run them to see them fail**

Run: `pnpm exec playwright test --project=public contact.spec hero-projects-contact --reporter=line`
Expected (after the build): `6 failed`, `6 passed`. The four `contact.spec.ts` sending tests fail with `Error: locator.click: Test timeout of 30000ms exceeded.` (the M1 button is disabled). The honeypot test fails with `expect(locator).toHaveAttribute(expected) failed … element(s) not found`. `contact form is labelled` fails with `expect(locator).toBeEnabled() failed`.

- [ ] **Step 4: The copy**

In `messages/en.json`, replace everything from the line `    "form": {` down to and including the line `  },` that closes `"Contact"` (the line just before `  "NotFound": {`) with:

```json
    "form": {
      "title": "Send a message",
      "name": "Name",
      "email": "Email",
      "company": "Company (optional)",
      "message": "Message",
      "submit": "Send message",
      "sending": "Sending…",
      "hint": "I read every message myself.",
      "sent": "Thanks! Your message is on its way. I reply within two working days.",
      "honeypot": "Leave this field empty",
      "errors": {
        "invalid": "Check the highlighted fields.",
        "tooFast": "That was quick. Take a moment to check your message, then send it again.",
        "rateLimited": "You have sent several messages in a short time. Try again in a few minutes, or email me directly.",
        "failed": "Something went wrong and your message was not sent. Please email me directly."
      },
      "fieldErrors": {
        "required": "Fill in this field.",
        "invalid": "Enter a valid email address.",
        "tooLong": "This is too long."
      }
    }
  },
```

In `messages/ro.json`, the same replacement:

```json
    "form": {
      "title": "Trimite un mesaj",
      "name": "Nume",
      "email": "Email",
      "company": "Companie (opțional)",
      "message": "Mesaj",
      "submit": "Trimite mesajul",
      "sending": "Se trimite…",
      "hint": "Citesc personal fiecare mesaj.",
      "sent": "Mulțumesc! Mesajul tău a plecat. Îți răspund în două zile lucrătoare.",
      "honeypot": "Lasă acest câmp gol",
      "errors": {
        "invalid": "Verifică câmpurile marcate.",
        "tooFast": "A fost foarte rapid. Mai citește o dată mesajul, apoi trimite-l din nou.",
        "rateLimited": "Ai trimis mai multe mesaje într-un timp scurt. Încearcă din nou peste câteva minute sau scrie-mi direct pe email.",
        "failed": "Ceva nu a mers și mesajul nu a fost trimis. Te rog să îmi scrii direct pe email."
      },
      "fieldErrors": {
        "required": "Completează acest câmp.",
        "invalid": "Introdu o adresă de email validă.",
        "tooLong": "Textul este prea lung."
      }
    }
  },
```

Both blocks end with the `  },` that closes `"Contact"`, so the files stay valid JSON. `tests/unit/messages.test.ts` checks that both files have the same keys.

- [ ] **Step 5: The form**

Create `src/components/sections/ContactForm.tsx`:

```tsx
"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import type { Locale } from "@/i18n/routing";
import { sendContactMessage } from "@/server/actions/contact";
import {
  CONTACT_IDLE,
  type ContactField,
  type ContactFieldError,
  type ContactState,
  HONEYPOT_FIELD,
} from "@/server/contact/state";

/**
 * Every visible string, translated on the server by <Contact>, so next-intl
 * stays out of the public client bundle.
 */
export type ContactFormLabels = {
  title: string;
  name: string;
  email: string;
  company: string;
  message: string;
  submit: string;
  sending: string;
  hint: string;
  sent: string;
  honeypot: string;
  errors: Record<"invalid" | "tooFast" | "rateLimited" | "failed", string>;
  fieldErrors: Record<ContactFieldError, string>;
};

const fieldClass =
  "mt-2 w-full rounded-control bg-canvas px-4 py-3 text-ink ring-1 ring-line-strong aria-invalid:ring-signal";

function statusText(
  state: ContactState,
  pending: boolean,
  labels: ContactFormLabels,
): string {
  if (pending) {
    return labels.sending;
  }
  if (state.status === "sent") {
    return labels.sent;
  }
  if (state.status === "error") {
    return labels.errors[state.reason];
  }
  return labels.hint;
}

export function ContactForm({
  locale,
  labels,
}: {
  locale: Locale;
  labels: ContactFormLabels;
}) {
  const [state, formAction, pending] = useActionState(
    sendContactMessage,
    CONTACT_IDLE,
  );
  const formRef = useRef<HTMLFormElement>(null);
  // When the form became usable; the server refuses anything sent within 3 s.
  const openedAt = useRef<number | null>(null);

  useEffect(() => {
    openedAt.current = performance.now();
  }, []);

  useEffect(() => {
    if (state.status === "sent") {
      formRef.current?.reset();
    }
  }, [state]);

  const errorFor = (field: ContactField) =>
    state.status === "error" && state.reason === "invalid"
      ? state.fieldErrors[field]
      : undefined;

  /** id, name and the ARIA wiring to the field's error text. */
  const fieldProps = (field: ContactField) => ({
    id: `contact-${field}`,
    name: field,
    "aria-invalid": errorFor(field) ? true : undefined,
    "aria-describedby": `contact-${field}-error`,
    className: fieldClass,
  });

  const fieldError = (field: ContactField) => {
    const error = errorFor(field);
    return (
      <span
        id={`contact-${field}-error`}
        className="mt-1 block text-sm text-signal"
      >
        {error ? labels.fieldErrors[error] : ""}
      </span>
    );
  };

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const elapsed =
          openedAt.current === null ? 0 : performance.now() - openedAt.current;
        data.set("elapsedMs", String(Math.round(elapsed)));
        startTransition(() => formAction(data));
      }}
      aria-labelledby="contact-form-title"
      className="relative flex flex-col gap-5 rounded-panel bg-surface p-6 ring-1 ring-line md:col-span-7 md:p-8"
    >
      <h3 id="contact-form-title" className="text-heading text-ink">
        {labels.title}
      </h3>
      <input type="hidden" name="locale" value={locale} />
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="text-sm text-ink-muted">
          {labels.name}
          <input
            {...fieldProps("name")}
            type="text"
            autoComplete="name"
            required
            maxLength={100}
          />
          {fieldError("name")}
        </label>
        <label className="text-sm text-ink-muted">
          {labels.email}
          <input
            {...fieldProps("email")}
            type="email"
            autoComplete="email"
            required
            maxLength={254}
          />
          {fieldError("email")}
        </label>
      </div>
      <label className="text-sm text-ink-muted">
        {labels.company}
        <input
          {...fieldProps("company")}
          type="text"
          autoComplete="organization"
          maxLength={100}
        />
        {fieldError("company")}
      </label>
      <label className="text-sm text-ink-muted">
        {labels.message}
        <textarea
          {...fieldProps("message")}
          className={`${fieldClass} resize-y`}
          rows={5}
          required
          maxLength={5000}
        />
        {fieldError("message")}
      </label>
      {/* Honeypot: off screen, out of the tab order, hidden from assistive technology. */}
      <div
        aria-hidden="true"
        className="absolute top-0 -left-[9999px] h-px w-px overflow-hidden"
      >
        <label>
          {labels.honeypot}
          <input
            type="text"
            name={HONEYPOT_FIELD}
            tabIndex={-1}
            autoComplete="off"
          />
        </label>
      </div>
      <p role="status" className="text-sm text-ink-muted">
        {statusText(state, pending, labels)}
      </p>
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-signal px-6 py-3 font-medium text-signal-ink disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? labels.sending : labels.submit}
      </button>
    </form>
  );
}
```

Replace `src/components/sections/Contact.tsx`:

```tsx
import { useLocale, useTranslations } from "next-intl";
import { Section } from "@/components/ui/Section";
import type { Cv } from "@/content/types";
import { ContactForm, type ContactFormLabels } from "./ContactForm";

const SOCIAL_LABELS = { github: "GitHub", linkedin: "LinkedIn" } as const;

export function Contact({ cv }: { cv: Cv }) {
  const t = useTranslations("Contact");
  const locale = useLocale();
  const { profile } = cv;
  const labels: ContactFormLabels = {
    title: t("form.title"),
    name: t("form.name"),
    email: t("form.email"),
    company: t("form.company"),
    message: t("form.message"),
    submit: t("form.submit"),
    sending: t("form.sending"),
    hint: t("form.hint"),
    sent: t("form.sent"),
    honeypot: t("form.honeypot"),
    errors: {
      invalid: t("form.errors.invalid"),
      tooFast: t("form.errors.tooFast"),
      rateLimited: t("form.errors.rateLimited"),
      failed: t("form.errors.failed"),
    },
    fieldErrors: {
      required: t("form.fieldErrors.required"),
      invalid: t("form.fieldErrors.invalid"),
      tooLong: t("form.fieldErrors.tooLong"),
    },
  };

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
        <ContactForm locale={locale} labels={labels} />
      </div>
    </Section>
  );
}
```

- [ ] **Step 6: Run everything**

Run: `pnpm test`
Expected: `Test Files  23 passed (23)`, `Tests  179 passed (179)` (the messages parity test covers the new keys).

Run: `pnpm typecheck`
Expected: `✓ Types generated successfully`, exit 0.

Run: `rtk proxy pnpm lint`
Expected: `Checked 182 files in <n>ms. No fixes applied.`

Run: `pnpm test:e2e`
Expected: `67 passed` (`public` 40, `admin` 25, `security` 2). The axe tests on `/en` and `/ro` (desktop and phone) cover the new form and the hidden honeypot.

- [ ] **Step 7: Check that the pages stay static and within budget**

Run: `pnpm build`
Expected: the route table still shows `│ ├ ○ /en` and `│ └ ○ /ro`.

Measure the public JavaScript with a scratch script (not in the repo; replace `<scratch>` with the session scratchpad):

```bash
cat > <scratch>/jsbudget.sh <<'EOF'
#!/usr/bin/env bash
# Serves the current build on port 3300 and sums gzip -9 sizes of the module
# scripts each public page loads (noModule scripts excluded).
set -euo pipefail
pnpm exec next start --port 3300 > /dev/null 2>&1 &
server=$!
trap 'kill "$server" 2>/dev/null || true' EXIT
until curl -s -o /dev/null http://localhost:3300/en; do sleep 0.5; done
for page in /en /ro; do
  total=0
  n=0
  for src in $(curl -s "http://localhost:3300$page" | grep -o '<script[^>]*src="[^"]*"[^>]*>' | grep -v noModule | grep -o 'src="[^"]*"' | cut -d'"' -f2 | sort -u); do
    total=$((total + $(curl -s "http://localhost:3300$src" | gzip -9 -c | wc -c)))
    n=$((n + 1))
  done
  echo "$page: $n scripts, $(awk "BEGIN { printf \"%.1f\", $total / 1024 }") KB gz"
done
EOF
chmod +x <scratch>/jsbudget.sh
<scratch>/jsbudget.sh
```

Expected: `/en: 10 scripts, 146.8 KB gz` and `/ro: 10 scripts, 146.8 KB gz` (on `dev`: 9 scripts, 145.3 KB gz; budget 160). Afterwards `ss -ltn | grep ':3300 '` prints nothing.

- [ ] **Step 8: Commit**

```bash
/usr/bin/git add messages playwright.config.ts scripts src tests
/usr/bin/git status --short
/usr/bin/git diff --cached | grep -cF "$(grep ^ADMIN_EMAIL= .env.local | cut -d= -f2)"
/usr/bin/git commit -m "feat(contact): send the public contact form"
```

`.data/` (the e2e outbox) is git-ignored since M2; the `grep -c` line must print `0`.

---

### Task 5: The admin Messages inbox

**Owner:** backend-engineer (full slice: pipeline option, reads, actions, pages; the pages reuse M2's admin components and tokens, no design work).

**Files:**
- Create: `src/server/admin/schemas/messages.ts`, `src/server/queries/admin/messages.ts`, `src/server/actions/messages.ts`, `src/components/admin/messages.tsx`, `src/app/admin/(panel)/messages/page.tsx`, `src/app/admin/(panel)/messages/[id]/page.tsx`, `tests/db/admin-messages.test.ts`, `tests/e2e/admin-messages.spec.ts`
- Modify: `src/server/admin/run-action.ts`, `src/app/admin/(panel)/layout.tsx`, `tests/db/admin-guard.test.ts`

**Interfaces:**
- Consumes: `runAdminAction`, `notFound`, `ActionResult`, `ActionButton`, `secondaryButton`, `requireAdmin`, `getDb` (M2); `cacheModule`, `mocks`, `OWNER`, `setupActionDb` (M2 test harness); `OUTBOX`, `signInAsOwner` (e2e).
- Produces:
  - `runAdminAction(formData, schema, run, options?: { publicContent?: boolean })`. With `publicContent: false`, success calls `refresh()` instead of `updateTag(CV_TAG)`; the default is unchanged.
  - `MESSAGE_STATUSES`, `type MessageStatus`, `messageStatusInput` (`{ id: uuid, status }`), `messageIdInput` from `@/server/admin/schemas/messages`.
  - From `@/server/queries/admin/messages`:
    - `MESSAGE_VIEWS` (`inbox` = new + read, `archived`, `spam`) and `type MessageView`.
    - `listMessages(db, view)`: rows with a 140-character `preview`, newest first.
    - `countMessages(db)` → `{ inbox, unread, archived, spam }`.
    - `getMessage(db, id)` → the row, or `null` (also for a non-UUID id).
  - Server Actions `setMessageStatus` (messages `Marked as read.`, `Marked as unread.`, `Archived.`, `Marked as spam.`; 404 `This message no longer exists.`) and `deleteMessage` (redirects to the message's folder; the audit row has no diff) from `@/server/actions/messages`.
  - Pages `/admin/messages` (`?view=archived|spam`) and `/admin/messages/[id]`. The nav entry is **Messages**.

- [ ] **Step 1: Write the failing tests**

Create `tests/db/admin-messages.test.ts`:

```ts
import { eq, sql } from "drizzle-orm";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { deleteMessage, setMessageStatus } from "@/server/actions/messages";
import { IDLE } from "@/server/admin/action-result";
import { auditLog, message } from "@/server/db/schema";
import {
  countMessages,
  getMessage,
  listMessages,
} from "@/server/queries/admin/messages";
import { cacheModule, mocks, OWNER, setupActionDb } from "./action-mocks";
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

type Status = "new" | "read" | "archived" | "spam";

async function addMessage(name: string, status: Status, minutesAgo: number) {
  const [row] = await mocks.db
    .insert(message)
    .values({
      name,
      email: `${name.toLowerCase()}@example.org`,
      body: `Hello from ${name}`,
      locale: "en",
      ipHash: "hash",
      status,
      emailStatus: "sent",
      createdAt: sql`now() - make_interval(mins => ${minutesAgo})`,
    })
    .returning({ id: message.id });
  return row.id;
}

let ids: Record<string, string>;

beforeEach(async () => {
  await mocks.db.delete(message);
  await mocks.db.delete(auditLog);
  ids = {
    ana: await addMessage("Ana", "new", 1),
    dan: await addMessage("Dan", "read", 30),
    old: await addMessage("Old", "archived", 60),
    bot: await addMessage("Bot", "spam", 5),
  };
  mocks.session = OWNER;
  mocks.updateTag.mockClear();
  cacheModule.refresh.mockClear();
});

describe("message queries", () => {
  it("lists new and read messages in the inbox, newest first", async () => {
    const inbox = await listMessages(mocks.db, "inbox");

    expect(inbox.map((m) => [m.name, m.status])).toEqual([
      ["Ana", "new"],
      ["Dan", "read"],
    ]);
    expect(inbox[0].preview).toBe("Hello from Ana");
  });

  it("lists archived and spam messages separately", async () => {
    expect(
      (await listMessages(mocks.db, "archived")).map((m) => m.name),
    ).toEqual(["Old"]);
    expect((await listMessages(mocks.db, "spam")).map((m) => m.name)).toEqual([
      "Bot",
    ]);
  });

  it("counts each folder and the unread messages", async () => {
    expect(await countMessages(mocks.db)).toEqual({
      inbox: 2,
      unread: 1,
      archived: 1,
      spam: 1,
    });
  });

  it("returns null for an unknown or malformed id instead of failing", async () => {
    expect(
      await getMessage(mocks.db, "00000000-0000-4000-8000-000000000000"),
    ).toBeNull();
    expect(await getMessage(mocks.db, "not-a-uuid")).toBeNull();
    expect((await getMessage(mocks.db, ids.ana))?.body).toBe("Hello from Ana");
  });
});

describe("message actions", () => {
  it("marks a message read, audits it and refreshes only the admin page", async () => {
    const result = await setMessageStatus(
      IDLE,
      form({ id: ids.ana, status: "read" }),
    );

    expect(result).toEqual({ status: "ok", message: "Marked as read." });
    const [row] = await mocks.db
      .select()
      .from(message)
      .where(eq(message.id, ids.ana));
    expect(row.status).toBe("read");
    const [entry] = await mocks.db.select().from(auditLog);
    expect(entry).toMatchObject({
      userId: OWNER.userId,
      action: "update",
      entity: "message",
      entityId: ids.ana,
      diff: { status: "read" },
    });
    expect(cacheModule.refresh).toHaveBeenCalledTimes(1);
    expect(mocks.updateTag).not.toHaveBeenCalled();
  });

  it("archives, flags as spam and moves back to the inbox", async () => {
    for (const [status, text] of [
      ["archived", "Archived."],
      ["spam", "Marked as spam."],
      ["new", "Marked as unread."],
    ] as const) {
      expect(
        await setMessageStatus(IDLE, form({ id: ids.dan, status })),
      ).toEqual({ status: "ok", message: text });
    }
    expect((await getMessage(mocks.db, ids.dan))?.status).toBe("new");
  });

  it("rejects an unknown status", async () => {
    const result = await setMessageStatus(
      IDLE,
      form({ id: ids.ana, status: "deleted" }),
    );

    expect(result).toMatchObject({ status: "error", code: 400 });
  });

  it("answers 404 for a message that no longer exists", async () => {
    const result = await setMessageStatus(
      IDLE,
      form({ id: "00000000-0000-4000-8000-000000000000", status: "read" }),
    );

    expect(result).toEqual({
      status: "error",
      code: 404,
      message: "This message no longer exists.",
    });
  });

  it("deletes a message without copying its content into the audit log", async () => {
    await expect(deleteMessage(IDLE, form({ id: ids.bot }))).rejects.toThrow(
      "NEXT_REDIRECT /admin/messages?view=spam",
    );

    expect(await getMessage(mocks.db, ids.bot)).toBeNull();
    const [entry] = await mocks.db.select().from(auditLog);
    expect(entry).toMatchObject({
      action: "delete",
      entity: "message",
      entityId: ids.bot,
      diff: null,
    });
    expect(mocks.updateTag).not.toHaveBeenCalled();
  });
});
```

In `tests/db/admin-guard.test.ts`, replace

```ts
    expect(ACTIONS.map(([name]) => name)).toContain("saveProfile");
```

with

```ts
    expect(ACTIONS.map(([name]) => name)).toEqual(
      expect.arrayContaining([
        "saveProfile",
        "setMessageStatus",
        "deleteMessage",
      ]),
    );
```

Create `tests/e2e/admin-messages.spec.ts`:

```ts
import { rename, rm, writeFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { type Browser, expect, test } from "@playwright/test";
import { signInAsOwner } from "./admin-login";
import { OUTBOX } from "./contact-outbox";

/**
 * Sends one message through the public form in a fresh context that posts
 * from `ip` (next start keeps the x-forwarded-for it receives).
 */
async function sendFromSite(
  browser: Browser,
  ip: string,
  values: { name: string; message: string },
) {
  const context = await browser.newContext({
    extraHTTPHeaders: { "x-forwarded-for": ip },
  });
  const page = await context.newPage();
  await page.goto("/en");
  const form = page.getByRole("form", { name: "Send a message" });
  await form.getByRole("textbox", { name: "Name" }).fill(values.name);
  await form
    .getByRole("textbox", { name: "Email" })
    .fill(`${values.name.toLowerCase().replace(/\W+/g, ".")}@example.org`);
  await form.getByRole("textbox", { name: "Message" }).fill(values.message);
  await page.waitForTimeout(3_100);
  await form.getByRole("button", { name: "Send message" }).click();
  await expect(form.getByRole("status")).toHaveText(/^Thanks!/);
  await context.close();
}

test("a message from the site can be read, archived, flagged and deleted", async ({
  browser,
  page,
}) => {
  const name = `Visitor ${crypto.randomUUID().slice(0, 6)}`;
  await sendFromSite(browser, "192.0.2.20", {
    name,
    message: "Could you build our booking system?",
  });
  await signInAsOwner(page);

  await page.getByRole("link", { name: "Messages" }).click();
  const row = page.getByRole("listitem").filter({ hasText: name });
  await expect(row).toContainText("New");
  await row.getByRole("link", { name }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
  // Next keeps the list page mounted but hidden, so match visible text only.
  await expect(
    page
      .getByText("Could you build our booking system?")
      .filter({ visible: true }),
  ).toBeVisible();
  await expect(page.getByText("Emailed")).toBeVisible();
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.map((v) => v.id)).toEqual([]);

  await page.getByRole("button", { name: "Mark as read" }).click();
  await expect(
    page.getByRole("button", { name: "Mark as unread" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Archive" }).click();
  await expect(
    page.getByRole("button", { name: "Move to inbox" }),
  ).toBeVisible();

  await page.goto("/admin/messages");
  await expect(
    page.getByRole("listitem").filter({ hasText: name }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: /^Archived/ }).click();
  await page.getByRole("link", { name }).click();
  await page.getByRole("button", { name: "Mark as spam" }).click();
  await expect(page.getByRole("button", { name: "Not spam" })).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL("/admin/messages?view=spam");
  await expect(page.getByRole("link", { name })).toHaveCount(0);
});

test("a message whose notification could not be sent is kept and flagged", async ({
  browser,
  page,
}) => {
  const name = `Outage ${crypto.randomUUID().slice(0, 6)}`;
  // Simulate a mail outage: a file where the outbox folder should be makes
  // every send fail, like Resend being down.
  const parked = `${OUTBOX}.parked-${Date.now()}`;
  await rename(OUTBOX, parked).catch(() => {});
  await writeFile(OUTBOX, "e2e: mail outage\n");
  try {
    await sendFromSite(browser, "192.0.2.21", {
      name,
      message: "Sent while mail was down.",
    });
  } finally {
    await rm(OUTBOX, { force: true });
    await rename(parked, OUTBOX).catch(() => {});
  }

  await signInAsOwner(page);
  await page.goto("/admin/messages");
  const row = page.getByRole("listitem").filter({ hasText: name });
  await expect(row).toContainText("Email failed");
  await row.getByRole("link", { name }).click();
  await expect(
    page.getByText("Sent while mail was down.").filter({ visible: true }),
  ).toBeVisible();
});

test("a malformed message id shows the not-found page, not a server error", async ({
  page,
}) => {
  await signInAsOwner(page);

  const response = await page.goto("/admin/messages/not-a-uuid");

  // notFound() runs inside the admin <Suspense> after the shell has streamed,
  // so the status stays 200 (like redirect() in M2); the point is no 500.
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Page not found",
  );
});

for (const path of ["/admin/messages", "/admin/messages?view=spam"]) {
  test(`${path} has no axe violations`, async ({ page }) => {
    await signInAsOwner(page);
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).analyze();

    expect(violations.map((v) => v.id)).toEqual([]);
  });
}
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm exec vitest run tests/db/admin-messages.test.ts tests/db/admin-guard.test.ts`
Expected: `Test Files  2 failed (2)`, `Tests  1 failed | 19 passed (20)`: `Error: Cannot find package '@/server/actions/messages'`, and `finds the actions` fails with `AssertionError: expected [ 'createExperience', …(18) ] to deeply equal ArrayContaining{…}`.

Run: `pnpm exec playwright test --project=admin --no-deps admin-messages --reporter=line`
Expected (after the build): `5 failed`:
- the triage test with `locator.click: Test timeout of 30000ms exceeded.` (`waiting for getByRole('link', { name: 'Messages' })`);
- the outage test with `Expected substring: "Email failed"`, `element(s) not found`;
- the malformed-id test with `Expected: 200`, `Received: 404`;
- both axe tests (`- Expected  - 1`, `+ Received  + 5`).

The server log also shows `contact: owner notification failed Error: EEXIST: file already exists, mkdir '<worktree>/.data/mail'`: the simulated outage already works.

- [ ] **Step 3: Let admin actions skip the public cache**

In `src/server/admin/run-action.ts`:

Replace `import { updateTag } from "next/cache";` with

```ts
import { refresh, updateTag } from "next/cache";
```

Replace the doc comment's last point and the signature (from ` * 4. on success expires the public CV cache` down to `): Promise<ActionResult> {`) with

```ts
 * 4. on success expires the public CV cache (`updateTag`), then redirects or
 *    returns a message. Actions on data the public site never shows (contact
 *    messages) pass `publicContent: false`: the CV cache stays warm and only
 *    the current admin page re-renders (`refresh`).
 */
export async function runAdminAction<S extends z.ZodType>(
  formData: FormData,
  schema: S,
  run: (input: z.output<S>, ctx: ActionContext) => Promise<ActionOutcome>,
  options: { publicContent?: boolean } = {},
): Promise<ActionResult> {
```

and replace the single line `  updateTag(CV_TAG);` (just before `if (outcome.redirectTo) {`) with

```ts
  if (options.publicContent === false) {
    refresh();
  } else {
    updateTag(CV_TAG);
  }
```

- [ ] **Step 4: Input, reads and actions**

Create `src/server/admin/schemas/messages.ts`:

```ts
import { z } from "zod";

export const MESSAGE_STATUSES = ["new", "read", "archived", "spam"] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export const messageStatusInput = z.object({
  id: z.uuid(),
  status: z.enum(MESSAGE_STATUSES),
});

export const messageIdInput = z.object({ id: z.uuid() });
```

Create `src/server/queries/admin/messages.ts`:

```ts
import { count, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import type { MessageStatus } from "@/server/admin/schemas/messages";
import { message } from "@/server/db/schema";
import type { Db } from "@/server/db/types";

/** Inbox = new and read; archived and spam are folders of their own. */
export const MESSAGE_VIEWS = {
  inbox: ["new", "read"],
  archived: ["archived"],
  spam: ["spam"],
} as const satisfies Record<string, readonly MessageStatus[]>;

export type MessageView = keyof typeof MESSAGE_VIEWS;

export function listMessages(db: Db, view: MessageView) {
  return db
    .select({
      id: message.id,
      name: message.name,
      email: message.email,
      company: message.company,
      preview: sql<string>`left(${message.body}, 140)`,
      locale: message.locale,
      status: message.status,
      emailStatus: message.emailStatus,
      createdAt: message.createdAt,
    })
    .from(message)
    .where(inArray(message.status, [...MESSAGE_VIEWS[view]]))
    .orderBy(desc(message.createdAt));
}

export async function countMessages(db: Db) {
  const rows = await db
    .select({ status: message.status, value: count() })
    .from(message)
    .groupBy(message.status);
  const by = (status: MessageStatus) =>
    rows.find((row) => row.status === status)?.value ?? 0;
  return {
    inbox: by("new") + by("read"),
    unread: by("new"),
    archived: by("archived"),
    spam: by("spam"),
  };
}

/** One message, or null (also for an id that is not a UUID: no 500 on a crafted URL). */
export async function getMessage(db: Db, id: string) {
  if (!z.uuid().safeParse(id).success) {
    return null;
  }
  const [row] = await db.select().from(message).where(eq(message.id, id));
  return row ?? null;
}
```

Create `src/server/actions/messages.ts`:

```ts
"use server";

import { eq } from "drizzle-orm";
import type { ActionResult } from "@/server/admin/action-result";
import { notFound, runAdminAction } from "@/server/admin/run-action";
import {
  type MessageStatus,
  messageIdInput,
  messageStatusInput,
} from "@/server/admin/schemas/messages";
import { message } from "@/server/db/schema";

const DONE: Record<MessageStatus, string> = {
  new: "Marked as unread.",
  read: "Marked as read.",
  archived: "Archived.",
  spam: "Marked as spam.",
};

export async function setMessageStatus(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(
    formData,
    messageStatusInput,
    async ({ id, status }, { db, audit }) => {
      const updated = await db
        .update(message)
        .set({ status })
        .where(eq(message.id, id))
        .returning({ id: message.id });
      if (updated.length === 0) {
        return notFound("This message no longer exists.");
      }
      await audit({
        action: "update",
        entity: "message",
        entityId: id,
        diff: { status },
      });
      return { status: "ok", message: DONE[status] };
    },
    { publicContent: false },
  );
}

/** Deletes for good; the audit entry keeps the id only, not the visitor's text. */
export async function deleteMessage(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(
    formData,
    messageIdInput,
    async ({ id }, { db, audit }) => {
      const [row] = await db
        .delete(message)
        .where(eq(message.id, id))
        .returning({ status: message.status });
      if (!row) {
        return notFound("This message no longer exists.");
      }
      await audit({ action: "delete", entity: "message", entityId: id });
      const view =
        row.status === "archived" || row.status === "spam"
          ? `?view=${row.status}`
          : "";
      return {
        status: "ok",
        message: "Deleted.",
        redirectTo: `/admin/messages${view}`,
      };
    },
    { publicContent: false },
  );
}
```

Run: `pnpm exec vitest run tests/db/admin-messages.test.ts tests/db/admin-guard.test.ts`
Expected: `Test Files  2 passed (2)`, `Tests  31 passed (31)` (the guard now checks 21 actions).

- [ ] **Step 5: Pages and navigation**

Create `src/components/admin/messages.tsx`:

```tsx
import type { ReactNode } from "react";

// Small read-only pieces shared by the inbox list and the message page.

const badge =
  "rounded-full px-2 py-0.5 font-mono text-label uppercase ring-1 ring-line-strong";

export function Badge({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "signal";
}) {
  return (
    <span
      className={`${badge} ${tone === "signal" ? "text-signal" : "text-ink-muted"}`}
    >
      {children}
    </span>
  );
}

/** Whether the owner notification went out (null: not attempted yet). */
export function EmailStatus({
  status,
  quietWhenSent = false,
}: {
  status: "sent" | "failed" | null;
  quietWhenSent?: boolean;
}) {
  if (status === "failed") {
    return <Badge tone="signal">Email failed</Badge>;
  }
  if (status === null) {
    return <Badge>Email pending</Badge>;
  }
  return quietWhenSent ? null : <Badge>Emailed</Badge>;
}

const RECEIVED = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export function Received({ at }: { at: Date }) {
  return (
    <time
      dateTime={at.toISOString()}
      className="font-mono text-label text-ink-subtle"
    >
      {RECEIVED.format(at)} UTC
    </time>
  );
}

/** The inbox folder a message with this status lives in. */
export function folderHref(status: "new" | "read" | "archived" | "spam") {
  return status === "archived" || status === "spam"
    ? `/admin/messages?view=${status}`
    : "/admin/messages";
}
```

Create `src/app/admin/(panel)/messages/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Badge, EmailStatus, Received } from "@/components/admin/messages";
import { secondaryButton } from "@/components/admin/styles";
import { requireAdmin } from "@/server/auth";
import { getDb } from "@/server/db";
import {
  countMessages,
  listMessages,
  MESSAGE_VIEWS,
  type MessageView,
} from "@/server/queries/admin/messages";

export const metadata: Metadata = { title: "Messages" };

const VIEWS: ReadonlyArray<{ view: MessageView; label: string }> = [
  { view: "inbox", label: "Inbox" },
  { view: "archived", label: "Archived" },
  { view: "spam", label: "Spam" },
];

export default async function MessagesPage({
  searchParams,
}: PageProps<"/admin/messages">) {
  await requireAdmin();
  const { view: requested } = await searchParams;
  const view: MessageView =
    typeof requested === "string" && requested in MESSAGE_VIEWS
      ? (requested as MessageView)
      : "inbox";
  const db = getDb();
  const [items, counts] = await Promise.all([
    listMessages(db, view),
    countMessages(db),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-title text-ink">Messages</h1>
      <nav aria-label="Folders">
        <ul className="flex flex-wrap gap-2">
          {VIEWS.map((item) => (
            <li key={item.view}>
              <Link
                href={
                  item.view === "inbox"
                    ? "/admin/messages"
                    : `/admin/messages?view=${item.view}`
                }
                aria-current={item.view === view ? "page" : undefined}
                className={`${secondaryButton} aria-[current=page]:bg-raised`}
              >
                {item.label} ({counts[item.view]})
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {items.length === 0 ? (
        <p className="text-ink-muted">No messages here.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-2 rounded-panel bg-surface p-4 ring-1 ring-line"
            >
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href={`/admin/messages/${item.id}`}
                  className={`text-ink underline underline-offset-4 ${item.status === "new" ? "font-semibold" : ""}`}
                >
                  {item.name}
                </Link>
                <span className="text-sm text-ink-muted">
                  {item.email}
                  {item.company ? ` · ${item.company}` : ""}
                </span>
                {item.status === "new" ? <Badge>New</Badge> : null}
                <EmailStatus status={item.emailStatus} quietWhenSent />
                <Received at={item.createdAt} />
              </div>
              <p className="text-sm text-ink-muted">{item.preview}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

Create `src/app/admin/(panel)/messages/[id]/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/admin/ActionButton";
import {
  Badge,
  EmailStatus,
  folderHref,
  Received,
} from "@/components/admin/messages";
import { deleteMessage, setMessageStatus } from "@/server/actions/messages";
import type { MessageStatus } from "@/server/admin/schemas/messages";
import { requireAdmin } from "@/server/auth";
import { getDb } from "@/server/db";
import { getMessage } from "@/server/queries/admin/messages";

export const metadata: Metadata = { title: "Message" };

const LANGUAGE = { en: "English", ro: "Romanian" } as const;

/** The status buttons offered for each status (spec §5: read/archived/spam). */
const MOVES: Record<
  MessageStatus,
  ReadonlyArray<{ status: MessageStatus; label: string }>
> = {
  new: [
    { status: "read", label: "Mark as read" },
    { status: "archived", label: "Archive" },
    { status: "spam", label: "Mark as spam" },
  ],
  read: [
    { status: "new", label: "Mark as unread" },
    { status: "archived", label: "Archive" },
    { status: "spam", label: "Mark as spam" },
  ],
  archived: [
    { status: "read", label: "Move to inbox" },
    { status: "spam", label: "Mark as spam" },
  ],
  spam: [{ status: "read", label: "Not spam" }],
};

export default async function MessagePage({
  params,
}: PageProps<"/admin/messages/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const item = await getMessage(getDb(), id);
  if (!item) {
    notFound();
  }

  const details = [
    [
      "Email",
      <a
        key="email"
        href={`mailto:${item.email}`}
        className="text-ink underline underline-offset-4"
      >
        {item.email}
      </a>,
    ],
    ["Company", item.company ?? "—"],
    ["Language", LANGUAGE[item.locale]],
    ["Received", <Received key="received" at={item.createdAt} />],
    [
      "Notification",
      <EmailStatus key="email-status" status={item.emailStatus} />,
    ],
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={folderHref(item.status)}
        className="self-start text-sm text-ink-muted underline underline-offset-4"
      >
        Back to messages
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-title text-ink">{item.name}</h1>
        <Badge>{item.status}</Badge>
      </div>
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr]">
        {details.map(([term, value]) => (
          <div key={term} className="contents">
            <dt className="text-sm text-ink-muted">{term}</dt>
            <dd className="text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="whitespace-pre-wrap rounded-panel bg-surface p-6 text-ink ring-1 ring-line">
        {item.body}
      </p>
      <div className="flex flex-wrap gap-2">
        {MOVES[item.status].map((move) => (
          <ActionButton
            key={move.status}
            action={setMessageStatus}
            fields={{ id: item.id, status: move.status }}
            label={move.label}
          />
        ))}
        <ActionButton
          action={deleteMessage}
          fields={{ id: item.id }}
          label="Delete"
          confirmMessage={`Delete the message from ${item.name}? This cannot be undone.`}
        />
      </div>
    </div>
  );
}
```

In `src/app/admin/(panel)/layout.tsx`, add the nav entry between Media and Security:

```ts
  { href: "/admin/media", label: "Media" },
  { href: "/admin/messages", label: "Messages" },
  { href: "/admin/security", label: "Security" },
```

- [ ] **Step 6: Run everything**

Run: `pnpm test`
Expected: `Test Files  24 passed (24)`, `Tests  190 passed (190)`.

Run: `pnpm typecheck`
Expected: `✓ Types generated successfully`, exit 0.

Run: `rtk proxy pnpm lint`
Expected: `Checked 190 files in <n>ms. No fixes applied.`

Run: `pnpm test:e2e`
Expected: `72 passed` (`public` 40, `admin` 30, `security` 2). The web server log shows two `contact: … failed Error: EEXIST …` lines from the outage test; that is the test working. Afterwards `ls .data` lists `mail` and `media` as folders (the outage test restores the outbox).

- [ ] **Step 7: Commit**

```bash
/usr/bin/git add src tests
/usr/bin/git diff --cached | grep -cF "$(grep ^ADMIN_EMAIL= .env.local | cut -d= -f2)"
/usr/bin/git commit -m "feat(admin): add the messages inbox"
```

The `grep -c` line must print `0`.

---

### Task 6: Docs and the M3 gate

**Owner:** backend-engineer (README); the Overseer runs the gate in Step 4 itself as evidence.

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: everything above.
- Produces: contact, mail-setting and inbox documentation, including the table of values the owner fills in once Resend exists; the M3 acceptance evidence.

- [ ] **Step 1: Document contact mail and the inbox**

Append to the end of `README.md` (after the `## Media uploads` section):

````markdown
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
````

Run: `rtk proxy pnpm lint`
Expected: `Checked 190 files in <n>ms. No fixes applied.` (Biome does not check Markdown.)

- [ ] **Step 2: Commit**

```bash
/usr/bin/git add README.md
/usr/bin/git status --short
/usr/bin/git commit -m "docs: document contact mail and inbox"
```

`git status --short` must print only `M  README.md`.

- [ ] **Step 3: Check the history**

Run: `/usr/bin/git log --oneline dev..HEAD`
Expected (newest first):

```
docs: document contact mail and inbox
feat(admin): add the messages inbox
feat(contact): send the public contact form
feat(contact): store, rate-limit and mail messages
feat(email): render contact mails in en and ro
feat(email): add resend and local outbox mailers
```

No commit message contains AI attribution: `/usr/bin/git log dev..HEAD --format=%B | grep -ciE 'co-authored|claude|generated with'` prints `0`. The owner's address is in no commit: `/usr/bin/git diff dev..HEAD | grep -cF "$(grep ^ADMIN_EMAIL= .env.local | cut -d= -f2)"` prints `0`.

- [ ] **Step 4: Run the full CI sequence on a fresh clone (M3 acceptance)**

This proves the committed branch passes with no local-only files: no `.env.local`, no Resend key, a random `BETTER_AUTH_SECRET`, and the docker Postgres (`docker compose up -d --wait` must be running). Put it in a script, since the worktree guard rejects long compound one-liners. Replace `<scratch>` with the session scratchpad directory:

```bash
cat > <scratch>/m3-gate.sh <<'EOF'
#!/usr/bin/env bash
set -e
REPO="$1"
CI_DIR="$(mktemp -d)/cv-ci"
/usr/bin/git clone -q --branch feat/m3-contact-inbox "$REPO" "$CI_DIR"
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
chmod +x <scratch>/m3-gate.sh
<scratch>/m3-gate.sh "$(/usr/bin/git rev-parse --path-format=absolute --git-common-dir)"
```

Expected, in order:
- `✓ Types generated successfully`
- `Checked 190 files … No fixes applied.`
- `Test Files  24 passed (24)`, `Tests  190 passed (190)`
- `migrations applied`
- `seeded CV content` (or `skipped: CV content already exists (use --reset to replace it)`)
- `✓ Compiled successfully` with the route table below
- `72 passed` plus `::notice title=🎭 Playwright Run Summary::  72 passed`, with the two expected `contact: … failed Error: EEXIST …` web-server lines from the outage test
- `Checking assertions against 2 URL(s), 6 total run(s)`, `All results processed!`
- finally `gate=0`

Afterwards `ss -ltn | grep -E ':(3100|3200) '` prints nothing. Measured on 2026-09-24 (throwaway Postgres 18 container): `gate=0`, e2e 30.2 s, LHCI 100 / 100 / 100 / 100 on `/en` and `/ro` in all 3 runs.

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
├ ◐ /admin/messages
├   /admin/messages/[id]
│ └ ◐ /admin/messages/[id]
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

This covers the spec §7 M3 acceptance:
- **Submit = DB row + email:** `tests/db/contact.test.ts` › `stores the message, then mails the owner and the visitor` (Task 3). The e2e `contact.spec.ts` › `the owner and the visitor each get a mail` reads both mails from the built app's outbox (Task 4), and `admin-messages.spec.ts` › `a message from the site can be read, archived, flagged and deleted` finds the row in the inbox (Task 5).
- **6th in 10 min rejected:** `contact.test.ts` › `accepts 5 messages per address in 10 minutes and rejects the 6th`, `only counts the last 10 minutes` and `never lets parallel requests from one address past the limit` (Task 3, plus the Step 6 Postgres check). The e2e test is `contact.spec.ts` › `refuses the sixth message in ten minutes` (Task 4).
- **Resend failure still persists:** `contact.test.ts` › `keeps the message with email_status failed when sending fails` (Task 3); `mailer.test.ts` › `throws when Resend answers with an error` (mocked SDK, Task 1); and the e2e `admin-messages.spec.ts` › `a message whose notification could not be sent is kept and flagged` (Task 5).
- **Inbox through `runAdminAction`, guarded:** `tests/db/admin-guard.test.ts`, one 401 case per action, 21 by Task 5.
- **Public pages still static and fast:** `○ /en`, `○ /ro`; 146.8 KB gz; LHCI 100s.

- [ ] **Step 5: Optional manual check (real browser)**

With `docker compose up -d --wait` and `pnpm dev`, open `http://localhost:3000/en#contact`, wait a few seconds, and send a message. The form says "Thanks! …", and `ls .data/mail` shows two new JSON files: the owner notification, with `replyTo` set to your address, and the auto-reply. Then sign in at `/admin`, open **Messages**, open the message, and archive and delete it. There is no pass/fail here beyond the automated gate.

Merging `feat/m3-contact-inbox` into `dev` and deciding when to push follow the Overseer flow: **never push unprompted**. No CI change is needed: CI sets no Resend key, so every job uses the local outbox.

---

## Self-review

- **Spec coverage (§4, §5, §7 M3 row, brief):**
  - Contact action: zod (Task 3 `contactInput`), honeypot (`website`, a silent fake success), minimum 3 s fill (`MIN_FILL_MS`, measured on the client from hydration), DB rate limit 5 / ip_hash / 10 min (`RATE_LIMIT`, advisory lock), insert first, then the owner mail and the localized auto-reply (Tasks 2–3). CR/LF are stripped from every header value (`headerText`, `mailbox`). The visitor appears only as the owner mail's `replyTo`. A failure keeps the row with `email_status = failed`.
  - `ip_hash`: HMAC-SHA256 with a server secret (Task 3 `hashIp`). The IP comes from `x-real-ip`, then `x-forwarded-for`, then `"unknown"`; the spoofing trade-off is documented in code and the README.
  - react-email EN/RO: Task 2 (`AUTO_REPLY_COPY` typed per locale; owner mail in English like the admin).
  - Mailer abstraction with a Resend adapter, a local adapter and a forced failure: Task 1. The failure is forced by the injected mailer in unit tests and by a blocked outbox in e2e. The Resend adapter is tested only against a mocked `resend` module.
  - Placeholders and README instructions: Tasks 1 and 6.
  - Inbox (list, read, mark read/unread, archived, spam, delete, English only, through `runAdminAction`, covered by the guard test): Task 5.
  - Acceptance: Task 6, Step 4.
- **Deliberate deviations (for the Overseer to confirm or overrule):**
  - Spec §2 `@react-email/components 1.0.12`: replaced by `react-email` **6.9.5**. The spec's package and all the per-component packages are deprecated upstream, and `react-email` 6 is where the components now live. 6.9.5 rather than 6.11.0 because 6.11.0 is younger than pnpm 11's minimum release age.
  - Spec §9 "contact flow (msw-mocked Resend)": unit tests replace the SDK with `vi.mock("resend")`, and e2e uses the local outbox. No msw dependency, and no network in any test.
  - Spec §3 `docker-compose.yml … (+ mailpit)`: no mailpit. The Resend path is HTTP, not SMTP, so mailpit would test a transport production never uses; the JSON outbox is what e2e reads.
  - The `ip_hash` key comes from `BETTER_AUTH_SECRET` (the HMAC message is `contact-ip:<ip>`) instead of a new env variable: one fewer secret to manage. Rotating the auth secret also resets the rate-limit buckets and unlinks old hashes, which is harmless.
  - `email_status` tracks the **owner notification** only. A failed auto-reply, for example a typo in the visitor's address, is logged and does not mark the message failed.
  - The visitor sees "Thanks!" even when the notification failed, because the message is stored and shows in the inbox. A database failure answers with `failed` ("… please email me directly").
  - Honeypot hits get a fake success and are not stored. A too-fast submit gets a visible message instead, since a person using autofill can simply send again. Without JavaScript the form has no `elapsedMs` and is always "too fast"; the mailto link next to it remains.
  - `runAdminAction` gains `{ publicContent: false }`: inbox changes `refresh()` the admin page and leave the prerendered CV alone.
  - A malformed message id renders the not-found page with HTTP 200 (streaming, as in M2), not 404.
- **Deferred on purpose:** Resend domain verification (SPF, DKIM, DMARC), the real `CONTACT_FROM_EMAIL` and the Vercel env (M9); retention of messages and `ip_hash` (see open questions); botid (spec: optional); CSP (M8).
- **Open questions for the owner:**
  1. Should opening a message mark it read automatically? Today it takes an explicit **Mark as read**, because an automatic mutation on render could also fire on prefetch.
  2. Retention: keep messages and `ip_hash` forever, or purge `ip_hash` (or whole messages) after N days? This matters for a privacy notice (M8).
  3. Is the auto-reply copy right (EN/RO in `src/server/email/templates/AutoReply.tsx`)? Its reply-to is the profile's public address, `hello@…` in the fixtures.
  4. Is `CONTACT_TO_EMAIL` a different inbox from `ADMIN_EMAIL`, or should it stay empty?
  5. Which domain or subdomain will send mail (`CONTACT_FROM_EMAIL`, for example `contact@<domain>`)? Its DNS records are set up in M9.
- **Placeholder scan:** no TBD or TODO. Every code step has the complete file or the exact block with its anchor, taken from the verified commits. `<n>`, `<scratch>`, `<worktree>` and `<owner email>` appear only where values vary by machine or must stay private. `pnpm-lock.yaml` comes from the `pnpm add` command, never typed by hand.
- **Name consistency:**
  - Mail: `Mail`, `Mailer`, `createResendMailer`, `createLocalMailer`, `createMailer`, `LOCAL_MAIL_DIR`, `getMailer`, `getMailAddresses`, `headerText`, `mailbox`, `buildContactMails`, `ContactMailInput`, `AUTO_REPLY_COPY`, `OwnerNotification`, `AutoReply`.
  - Contact: `ContactState`, `ContactField`, `ContactFieldError`, `CONTACT_IDLE`, `HONEYPOT_FIELD` (`website`), `MIN_FILL_MS`, `contactInput`, `contactFieldErrors`, `clientIp`, `hashIp`, `submitContact`, `SubmitContactDeps`, `RATE_LIMIT`, `sendContactMessage`, `ContactForm`, `ContactFormLabels`.
  - Inbox: `publicContent`, `MESSAGE_STATUSES`, `MessageStatus`, `messageStatusInput`, `messageIdInput`, `MESSAGE_VIEWS`, `MessageView`, `listMessages`, `countMessages`, `getMessage`, `setMessageStatus`, `deleteMessage`, `Badge`, `EmailStatus`, `Received`, `folderHref`.
  - e2e: `OUTBOX`, `contactMails`, `uniqueVisitor`.
  - Form field names are the same in the schema, the tests and the form (`name`, `email`, `company`, `message`, `locale`, `elapsedMs`, `website`). The e2e ports stay 3100 (e2e) and 3200 (LHCI); the budget script uses 3300.
- **Review Focus:** all five items have tests in the owning tasks: T2 (+T1) header injection; T2 no relay; T3 lock (+ the Step 6 Postgres check); T3 + T5 e2e outage; T5 query + e2e malformed id.

## Placeholders the owner fills in (weekend, after creating the Resend account)

| Value | Where now | Where later | Notes |
|---|---|---|---|
| `RESEND_API_KEY` | `.env.local` (optional; leave empty to keep using `.data/mail/`) | Vercel env, Production + Preview (M9) | starts with `re_`; with it set, `CONTACT_FROM_EMAIL` is required or the app refuses to start |
| `CONTACT_FROM_EMAIL` | `.env.local` (`contact@example.com` placeholder) | Vercel env (M9) | an address on the domain verified in Resend (SPF/DKIM/DMARC in M9); before verification, sends fail and messages are stored with **Email failed** |
| `CONTACT_TO_EMAIL` | `.env.local`, empty = `ADMIN_EMAIL` (`<owner email>`) | Vercel env if different (M9) | only if notifications should go to another inbox |
