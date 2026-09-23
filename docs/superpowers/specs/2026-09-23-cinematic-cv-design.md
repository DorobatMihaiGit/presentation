# Plan: Cinematic fullstack CV — `/home/mihai/Documents/CV`

## Context
User wants new project in new folder `CV`: personal CV/portfolio site as fullstack developer, with animations realistic "like real videos". Goal: impress recruiters/clients. Greenfield (folder not exist). Decisions confirmed with user:

| Topic | Decision |
|---|---|
| Purpose | Personal CV / portfolio |
| Realism | Hybrid: real-time 3D (R3F) + scroll-scrubbed pre-rendered frame sequences (Apple style) |
| Backend | Next.js API/server actions + Postgres + admin panel (edit CV, read messages) |
| Assets | Authored in Blender (not installed yet; iGPU Intel Iris Xe, no NVIDIA) |
| Concept | **A: "The Stack"** — exploded product film |
| Deploy | Vercel + Neon Postgres |
| Media host | **Vercel only** (no R2) |
| Languages | English + Romanian |

Machine facts: Node 24.0.0, npm 11.3.0, Docker, psql 18.6, uv/uvx, Python 3.12, 31 GB RAM. Missing: blender, ffmpeg, KTX-Software. Trap: `/home/mihai/package.json` has `packageManager: yarn` — corepack hijacks pnpm under home; fix by project-level `packageManager` field.

---

## 1. Concept A — "The Stack" storyboard
Monolith of 5 precision-machined layers in dark studio (glass / titanium / ceramic / PCB / base plate) = literally "full stack". Apple product-film vocabulary: exploded view, light sweeps, macro depth of field. Hard-surface only → EEVEE renders photoreal fast on Iris Xe. Same `.blend` feeds pre-rendered shots AND glTF → look + camera match at handoff.

| Section | Scene | Tech |
|---|---|---|
| Preloader | Black, hairline progress (real asset %), hero poster already visible | DOM |
| Hero (pin 200vh) | **Shot S1, 150 frames**: macro dolly over anodized aluminium, softbox sweep reveals engraved name/role, pull back to monolith. Last frame hands off to real-time; pointer moves rim light + parallax | Sequence → R3F |
| About (pin 150vh) | Stack yaws 30°, glass layer lifts, DOF racks to glass; bio + counters in DOM | R3F |
| Skills (pin 300vh) | **Shot S2, 180 frames**: exploded view — Interface (glass) / API (titanium) / Data (ceramic) / Infra (PCB) / Craft (base). Then interactive: hover layer = emissive edge, DOM skill chips anchored to projected 3D points | Sequence → R3F |
| Experience | Camera macro-tracks along PCB; traces = timeline, each job = engraved chip, light pulse travels with scroll (shader uniform) | R3F, 1 mesh + 1 shader |
| Projects | DOM grid, AVIF covers, tilt, muted video on hover; detail route `/[locale]/projects/[slug]` with View Transition | DOM + `<video>` |
| Contact (pin 100vh) | **Shot S3, 120 frames**: layers re-assemble and click shut, "Let's build" engraved; on submit success LED on base plate pulses | Sequence → R3F |
| Footer | Slow turntable idle, render stops offscreen | R3F on demand |

Total 450 frames × 2 aspects (landscape + portrait camera, not crop).

---

## 2. Plugins / tools needed (answer to "what plugins")

### npm runtime (versions verified on registry 2026-09-23; re-pin at M0)
| Package | Version | Purpose |
|---|---|---|
| next | 16.3.6 | App Router, `proxy.ts`, cacheComponents |
| react / react-dom | 19.3.0 | pinned `<19.4` (R3F peer) |
| three | 0.186.0 | WebGL renderer, AgX tone mapping, KTX2/meshopt loaders |
| @react-three/fiber | 9.8.0 | React renderer for three (v10 = WebGPU alpha, skip) |
| @react-three/drei | 10.7.8 | useGLTF, Environment, Lightformer, PerformanceMonitor, AdaptiveDpr, ContactShadows |
| @react-three/postprocessing / postprocessing | 3.1.2 / 6.39.5 | Bloom, DOF, N8AO, AgX ToneMapping, SMAA, Vignette, ChromaticAberration |
| gsap / @gsap/react | 3.15.0 / 2.1.2 | ScrollTrigger, SplitText, CustomEase (all plugins free) |
| lenis | 1.3.26 | Smooth native scroll |
| zustand | 5.0.15 | Per-frame scroll store, no React re-renders |
| detect-gpu | 5.0.70 | GPU tier signal |
| maath | 0.10.8 | Damping/easing helpers |
| next-intl | 4.14.6 | EN/RO routing + UI strings |
| drizzle-orm / drizzle-kit / drizzle-zod | 0.45.3 / 0.31.11 / 0.8.3 | ORM, migrations, validators (Prisma 8 RC churn avoided) |
| pg | 8.23.0 | Postgres driver (local + Neon) |
| @vercel/functions | 3.9.9 | `attachDatabasePool` (Fluid compute) |
| better-auth (+ @better-auth/passkey) | 1.7.5 | Admin auth, passkey, TOTP 2FA |
| zod | 4.6.5 | Validation |
| resend / @react-email/components | 6.28.1 / 1.0.12 | Contact email + templates |
| @vercel/blob | 2.8.0 | Admin uploads only (images, CV PDF) |
| tailwindcss / @tailwindcss/postcss | 4.3.3 | Styling |
| shadcn CLI, react-hook-form, @hookform/resolvers, @dnd-kit/react, react-markdown, sonner | 4.21.0 / 7.88.0 / 5.9.1 / 0.5.0 / 10.1.0 / 2.0.8 | Admin UI |
| @t3-oss/env-nextjs | 0.13.11 | Typed env |
| @vercel/analytics / speed-insights / og | 2.0.1 / 2.0.0 / 1.0.3 | Analytics, RUM, OG images |
| botid (optional) | 1.5.11 | Contact bot protection |

Not used: Theatre.js (stale since 2024), motion/framer (GSAP covers it), WebGPU renderer (R3F 10/drei 11 still alpha).

### npm dev
typescript 7.0.2, @biomejs/biome 2.5.14 (ESLint blocked by TS 7), vitest 5.0.1 + jsdom + @testing-library/react + msw, @electric-sql/pglite 0.5.8 (in-process DB tests), @playwright/test 1.63.0 + @axe-core/playwright, @lhci/cli 0.15.1, sharp 0.35.4 (AVIF/WebP encode), @gltf-transform/cli 4.5.0, leva + r3f-perf (dev overlay), pnpm 11.27.1.

### System tools
Blender 5.2 LTS (official tarball → `~/opt`, symlink `~/.local/bin/blender`), KTX-Software ≥ 4.4 (`ktx`, for gltf-transform KTX2), ffmpeg (apt), mesa-utils + vulkan-tools (GPU diag), git-lfs (frames in repo), Docker `postgres:18-alpine`, neonctl, vercel CLI.

### Blender add-ons / assets
Built-in: glTF 2.0 exporter, Node Wrangler, Geometry Nodes (PCB traces), OIDN denoiser, Cycles bake (CPU, lightmaps/AO). Free extensions: Camera Shakify (real handheld camera shake), Bool Tool, LoopTools. Assets: Poly Haven CC0 HDRIs/textures/models.

### MCP servers
| Server | Use |
|---|---|
| mcp-for-blender (`claude mcp add blender -- uvx mcp-for-blender`) | Claude drives Blender via Python: build scenes, fetch Poly Haven assets. Localhost only, `BLENDER_MCP_SAFE_MODE=1`, `DISABLE_TELEMETRY=true`, ensure version includes CVE-2026-10662 fix |
| (alt) official Blender Lab MCP 1.0.3 | bpy execution, needs Blender ≥ 5.1 |
| next-devtools-mcp | Next 16 runtime introspection |
| @neondatabase/mcp-server-neon | Neon branches / SQL |
| claude-in-chrome (already here) | Real-GPU visual checks, screenshots, console |

### Claude Code skills per milestone
high-end-visual-design, design-taste-frontend, apple-design, emil-design-eng (M1 design system, M6 micro-interactions) · gpt-taste (M5/M6 ScrollTrigger pin/scrub) · vercel-react-best-practices (all React) · vercel-react-view-transitions (M6) · improve-animations (post-M6 audit) · web-design-guidelines + security-review (M8) · deploy-to-vercel (M0, M9) · superpowers:test-driven-development + verification-before-completion (every gate).

---

## 3. Architecture

### Single Next.js app (no monorepo)
```
CV/
  package.json            packageManager pnpm@11.27.1, engines node 24
  next.config.ts proxy.ts drizzle.config.ts biome.json vitest.config.ts playwright.config.ts lighthouserc.json
  docker-compose.yml      postgres:18-alpine (+ mailpit)
  .gitattributes          LFS for public/seq/**, public/3d/**, *.blend
  messages/en.json ro.json      UI strings only; CV content in DB
  public/3d/              hashed .glb/.ktx2 + HDR gainmap
  public/seq/<shot>/<variant>/  hashed AVIF/WebP frames + manifest.json
  public/basis/           KTX2 transcoder wasm
  blender/ scenes/*.blend  scripts/{scene_setup,render_sequence,export_gltf,bake_lightmaps,lookdev_check}.py  hdri/ renders/(gitignored)
  scripts/assets/ encode-sequence.ts optimize-glb.sh make-video.sh check-budgets.ts
  src/
    app/[locale]/{layout,page}.tsx projects/[slug]/page.tsx
    app/admin/(auth)/login  app/admin/(panel)/{profile,experience,skills,projects,media,messages}
    app/api/auth/[...all]/route.ts  app/api/blob/upload/route.ts  sitemap.ts robots.ts
    i18n/  server/{db/{schema,client,seed}.ts,auth.ts,queries/,actions/,email/}
    components/sections/{Hero,About,Skills,Experience,Projects,Contact}.tsx
    experience/                      # 3D + motion system
      Stage.tsx                      persistent R3F canvas, dynamic ssr:false, mounted after LCP
      director/{store.ts,Director.tsx}   scroll progress → camera clip time, uniforms, postfx
      scenes/{StackScene,PcbTimeline}.tsx
      sequence/{SequencePlayer.ts,decode.worker.ts,manifest.ts,lru.ts}
      postfx/Effects.tsx  gpu-tier.ts  scroll/{LenisProvider.tsx,gsap.ts}  capture-mode.ts
  tests/{unit,e2e,visual,perf}
```

### Render layers (fixed, full viewport)
- L-1 `<canvas>` 2D — plays pre-rendered sequences (already AgX tone-mapped in Blender, kept out of WebGL composer → no double tone map).
- L0 R3F canvas — `frameloop="never"`, driven by one shared ticker. Handoff = opacity crossfade on matching frame, hidden inside fast camera moves.
- L1 DOM — all text SSR, semantic (SEO, a11y, LCP).
- L2 overlay — CSS film grain + vignette over everything. Grain never baked into frames (kills compression).

### Scroll orchestration — one RAF loop
Lenis (`autoRaf:false`) + GSAP ticker drives Lenis, ScrollTrigger and `r3f.advance()`. Each section = one ScrollTrigger (`pin`, `scrub`) writing progress into zustand vanilla store. Director reads store per tick: `AnimationMixer.setTime(p * clip.duration)` on Blender-exported camera clip, scrubbed GSAP timelines for uniforms/DOF/bloom, sequence frame index. Skip render when nothing changed / tab hidden.

### SequencePlayer
- Manifest per shot: frames, variants (1920/1280/640 landscape, 828 portrait; AVIF + WebP), poster; content-hashed, `Cache-Control: immutable`.
- Progressive passes: 640w every 6th frame → full width every 6th → every 2nd → all. Draw nearest best frame.
- Decode in 2 workers (`createImageBitmap`), LRU window ±10 desktop / ±6 mobile, `bitmap.close()` on evict, velocity-based skip. WebP fallback if AVIF decode > 20 ms.
- Frame 0 of S1 = SSR `<Image priority>` → LCP element.

### GPU tiers
| Tier | Who | Gets |
|---|---|---|
| T0 | reduced-motion, saveData, no WebGL | posters + CSS fades, no pin/Lenis |
| T1 | low-end phones | sequences only (portrait/1280w), no R3F, DPR 1 |
| T2 | Iris Xe (reference), M1, recent phones | R3F DPR ≤ 1.5, AgX, bloom, SMAA |
| T3 | discrete / M Pro | DPR ≤ 2, bokeh DOF, N8AO, chromatic aberration |
Runtime downgrade via drei `PerformanceMonitor`; `webglcontextlost` → plates/posters. Visible "Motion off" toggle.

### Realism techniques
Baked lightmaps + AO (Cycles CPU bake, one-off), Poly Haven studio HDRI in both Blender and three, `Lightformer` softboxes, `MeshPhysicalMaterial` (clearcoat, anisotropy brushed titanium, iridescent glass edge), AgX on both pipelines, Macbeth chart screenshot compare (`lookdev_check.py`), Camera Shakify micro-shake, subtle DOF + grain.

### Asset pipeline
1. Blender 5.2 headless: `blender -b blender/scenes/stack.blend --gpu-backend opengl --python-exit-code 1 -P blender/scripts/render_sequence.py -- --shot S1 --aspect landscape --w 1920 --h 1080` — EEVEE 64–128 samples, PNG, resumable (`use_overwrite=False`, `use_placeholder=True`). OpenGL backend because Intel Vulkan shows artifacts.
2. `encode-sequence.ts` (sharp): AVIF q~50 effort 6, WebP q75, 4 widths, hashes, manifest, poster.
3. `make-video.sh` (ffmpeg): MP4 H.264 + AV1 WebM fallback loops for T1/reduced-data.
4. `export_gltf.py` → `gltf-transform optimize --compress meshopt --texture-compress ktx2 --texture-size 2048`; `gltf-transform validate` 0 errors.
5. **Hosting (Vercel only)**: sequences + glb in `public/` tracked with Git LFS (enable LFS in Vercel project settings), served by Vercel CDN with immutable headers. Base URL behind `NEXT_PUBLIC_ASSET_BASE` env so moving to external CDN later = config change only. Vercel Blob only for admin uploads.
6. `check-budgets.ts` fails CI on breach.

### Performance budgets (CI-enforced)
LCP ≤ 2.0 s desktop / ≤ 2.5 s mobile, CLS < 0.05, INP < 200 ms · public JS before 3D ≤ 120 KB gz, lazy 3D chunk ≤ 350 KB gz (after LCP, `requestIdleCallback`) · initial transfer ≤ 1.5 MB · per shot ≤ 9 MB desktop / ≤ 5 MB mobile; **total `public/seq` + `public/3d` ≤ 80 MB** (Vercel deploy size) · glb ≤ 1.5 MB, ≤ 100 draw calls, ≥ 55 fps on Iris Xe 1080p · fonts: 2 variable woff2, latin + latin-ext (Romanian ș ț ă â î).

### Accessibility
SSR DOM in logical order, canvases `aria-hidden`, skip link, `lang` per locale, contrast ≥ 4.5:1 (scrim over plates), SplitText `aria:'auto'`, reduced-motion → T0, no autoplay audio.

---

## 4. Data model (Drizzle + Postgres)
Base table + `<entity>_i18n` (PK `(id, locale)`), queries COALESCE requested locale → `en` fallback; admin badges missing RO.

| Table | Key columns |
|---|---|
| profile (singleton) / profile_i18n | email_public, location, avatar_media_id, socials jsonb, available, years_exp / full_name, headline, summary_md, seo_*, cv_pdf_media_id |
| experience / experience_i18n | company, url, logo, start/end_date, employment_type, sort_order, is_published / role_title, description_md, highlights[] |
| skill_category / _i18n, skill | slug, **layer enum (interface/api/data/infra/craft → 3D layer)** / name, level 1–5, years, featured |
| project / project_i18n | slug, repo/live url, cover/video media, year, featured, published / title, summary, body_md, role, outcome |
| project_skill, experience_skill | joins |
| media | blob_url, kind, mime, w/h, bytes, lqip, alt_en, alt_ro |
| message | name, email, company, body, locale, ip_hash, status (new/read/archived/spam), email_status (sent/failed) |
| user/session/account/verification/passkey | generated by Better Auth CLI |
| audit_log | user_id, action, entity, diff jsonb |

Public reads: `'use cache'` + `cacheTag('cv')`; admin mutations `updateTag('cv')`. Local: Docker PG18; prod: Neon pooled; tests: PGlite.

## 5. Admin + auth + contact
- Better Auth, single owner: email+password with `disableSignUp`, passkey + TOTP, `pnpm admin:create` seed CLI, `ADMIN_EMAIL` allowlist.
- `proxy.ts` = optimistic cookie redirect only; **every** layout + server action re-checks session (CVE-2025-29927 lesson).
- Admin English-only UI, EN/RO side-by-side forms: Profile, Experience (drag reorder), Skills (mapped to stack layers), Projects (markdown preview), Media library (Blob client upload, type/size limits, LQIP), Messages inbox.
- Contact action: zod + honeypot + min 3 s fill → DB rate limit (5 / ip_hash / 10 min) → insert first → Resend (owner mail + localized auto-reply), CR/LF stripped, visitor only in `replyTo`; Resend failure keeps message with `email_status=failed`.

---

## 6. Execution flow (per CLAUDE.md teammate orchestration)
1. After plan approval: spec copied to `CV/docs/superpowers/specs/2026-09-23-cinematic-cv-design.md`; writing-plans skill → detailed task plan per milestone; user picks execution method.
2. M0 by devops teammate: create `CV/`, `git init -b main`, initial commit, create `dev` branch; all work in git worktree off `dev`.
3. Overseer (main session) never edits files — specialists do. Overseer runs tests/builds itself as evidence; caveman-reviewer on diffs; commits via caveman-commit; asks before any push.

## 7. Milestones
| M | Scope | Owner | Acceptance |
|---|---|---|---|
| M0 | Scaffold via `npx create-next-app@16.3.6` (npx bypasses corepack trap), pin pnpm, TS 7 + Biome, Tailwind 4, env validation, docker-compose PG18, git-lfs, GitHub Actions (typecheck, biome, vitest, build), Vercel project + Neon integration, `ENABLE_EXPERIMENTAL_COREPACK=1` | devops | `pnpm dev` serves `/en` + `/ro`; CI green; preview URL live; `pnpm -v` in CV = 11.27.1 |
| M1 | Design system, 6 sections with fixture content, next-intl, metadata, hreflang, JSON-LD Person, sitemap | frontend | Lighthouse ≥ 95 all categories; 0 axe violations; both locales |
| M2 | Drizzle schema/migrations/seed, Better Auth, admin CRUD, Blob uploads, cached queries | backend | RO headline edited in admin shows on `/ro`; `/admin` redirects logged-out; actions 401 without session; RO→EN fallback |
| M3 | Contact action, rate limit, Resend + react-email EN/RO, inbox | backend | submit = DB row + email; 6th in 10 min rejected; Resend failure still persists |
| M4 | Install Blender 5.2, KTX, ffmpeg, git-lfs; Blender MCP; bpy scripts; greybox stack; 10-frame timing test; glb + sequence pipeline | devops + user | `pnpm assets:build S1` → hashed files + manifest; validate 0 errors; EEVEE ≤ 10 s/frame measured; budgets pass |
| M5 | Motion core: Lenis + GSAP ticker, R3F advance, Stage, gpu-tier, SequencePlayer, T0 path, greybox Hero | frontend | no long task > 50 ms on Iris Xe; tab memory < 400 MB; reduced-motion = posters; LCP = poster |
| M6 | Real-time scenes (Stack, exploded Skills, PCB shader, Contact LED), tiered postfx, matched-camera handoffs, project View Transitions | frontend | T2 ≥ 55 fps; T1 mounts no R3F; handoff invisible at normal scroll |
| M7 | Final lookdev + renders (EEVEE; Cycles CPU overnight only if hero needs it), portrait variants, real content EN/RO via admin | user + frontend | all shots in manifest; budgets pass; no fallback badges |
| M8 | Hardening: LHCI, a11y audit, security headers/CSP, OG images, analytics, error boundaries, dep audit | tester + security + frontend | LHCI mobile perf ≥ 90, a11y 100, SEO 100, BP ≥ 95; 0 high findings |
| M9 | Production: domain, Resend DNS (SPF/DKIM/DMARC), Neon prod branch, Vercel prod env, smoke tests | devops | prod smoke e2e green; real-domain email delivered; immutable cache headers on assets |

Specialists: frontend-engineer (M1, M5, M6, M7, M8 fixes) · backend-engineer (M2, M3) · devops-engineer (M0, M4, CI, M9) · tester (harness from M0, gate of every milestone, visual baselines from M5, LHCI) · code-reviewer (every milestone; M5 dispose/bitmap.close/worker lifecycle) · security-auditor (M2 authz, M3 abuse/header injection, M8 CSP, Blender MCP risk, M9 pre-launch).

## 8. Risks
| Risk | Mitigation |
|---|---|
| iGPU render time / Intel Vulkan bugs | EEVEE + `--gpu-backend opengl`, iterate at 50% res / 16 samples, resumable frame ranges, AC power + `powerprofilesctl set performance` |
| Blender learning curve | greybox first with three primitives (same names + camera clip); MCP work captured into `blender/scripts/*.py` |
| **Vercel-only hosting limits** | Hobby Fast Data Transfer ~100 GB/mo ≈ 3–4k full desktop visits; deploy size cap → `public` media ≤ 80 MB budget; only current asset version kept; `NEXT_PUBLIC_ASSET_BASE` allows later CDN move; Pro ($20/mo) if limits hit or site advertises paid services (Hobby non-commercial clause). Verify exact limits at M0 |
| Mobile GPU / memory | portrait sequences, T1 no real-time, decode window ±6, DPR cap, dispose, context-loss fallback |
| Safari quirks | size canvas once to `lvh` (WebKit 219780 leak), pre-sized variants, no WebGPU, real iOS test before M8 |
| Plate vs real-time mismatch | AgX both sides, plates outside composer, baked lightmaps, Macbeth compare |
| Dependency churn | exact pins, React 19.3.x, Biome not ESLint, Renovate weekly grouped |
| Blender MCP runs arbitrary Python | localhost, safe mode, no secrets in Blender env, save before session |
| Neon cold start | public pages cached; DB hit only by admin/revalidation |

## 9. Verification (end-to-end)
- Unit (Vitest): frame-index math, pass scheduler, LRU, tier classifier, zod schemas, locale fallback, rate limiter, PGlite query tests.
- E2E (Playwright in `mcr.microsoft.com/playwright:v1.63.0-noble`): both locales, admin login/CRUD, contact flow (msw-mocked Resend), axe a11y, visual snapshots at scroll p = 0 / 0.5 / 1 using `?capture=1` deterministic mode.
- Perf: LHCI budgets in CI; `pnpm perf:local` on real Iris Xe (rAF p95 ≤ 20 ms, ≥ 55 fps); `assets:check` budget script.
- Manual: claude-in-chrome screenshots + console on real GPU each motion milestone; real iPhone/Android check before M8; prod smoke `curl -I` cache headers + Playwright against prod URL at M9.
