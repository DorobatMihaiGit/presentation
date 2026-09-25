# M5 Motion Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the site its motion core without Blender. One requestAnimationFrame loop (GSAP's ticker drives Lenis, ScrollTrigger and React Three Fiber's `advance()`) scrubs a procedural three.js "stack" behind a pinned hero: shot S1 dollies over the anodized base plate, a softbox sweep reveals the etched name, and the camera pulls back to the monolith. The 3D loads as one lazy chunk after the load event, never for reduced motion, Save-Data, software WebGL or visitors who switch **Motion** off. Posters captured from the same scene (`pnpm assets:posters`) are the LCP image, the tier-0 hero and the fallback when WebGL is lost or too slow. The milestone is gated by the spec's M5 acceptance, adapted: no long task over 50 ms while scrolling the hero on this Intel Iris Xe, tab memory under 400 MB, reduced motion = posters, LCP element = the hero poster, public JS before 3D at most 160 KB gz, the lazy 3D chunk at most 350 KB gz and loaded after LCP, LHCI at least 95 everywhere, the 72 existing e2e tests green and axe clean.

**Architecture:** Everything 3D lives in `src/experience/`. Three small modules load with the page: `motion-preference.ts` (the **Motion** switch, `prefers-reduced-motion`, Save-Data), `gpu-tier.ts` (tier 0–3 from the WebGL renderer string) and `StageLoader.tsx`, which waits for the load event and an idle callback, picks a tier and `next/dynamic`-imports `Stage.tsx` (`ssr: false`). `Stage` is a fixed, full-viewport, `aria-hidden` R3F `<Canvas frameloop="never">` under the page. Its `Director` starts the single loop (`scroll/loop.ts`), creates one ScrollTrigger per `[data-scene]` section writing progress into a zustand vanilla store (`director/store.ts`), and calls `advance()` only when the store says something changed and the tab is visible. `HeroShot` turns hero progress into a camera pose, an environment rotation (the sweep) and the etching's opacity (`director/shots.ts`), framed like `object-fit: cover` of a 16:9 or 828×1792 reference frame (`director/framing.ts`), which is exactly how the poster `<img>` is cropped. The model is procedural (`scenes/`), behind `StackModel`: shots only find objects by the asset-contract names, so a `stack.glb` can replace it. The hero section is 300lvh with a sticky frame while the stage is up; the SSR poster fades out once the first live frame is drawn. A frame monitor steps a tier down after sustained slow back-to-back frames and falls back to the poster below tier 1; a lost WebGL context does the same. Posters are captured by `scripts/posters.ts` from the production build (`?capture=hero&p=0|1`) and committed with content-hashed names; a unit test fails when the scene code changes without a recapture.

**Tech Stack:** Next.js 16.3.6 (App Router, `cacheComponents`), React 19.3.0, TypeScript 7.0.2, **three 0.186.0**, **@react-three/fiber 9.8.0**, **postprocessing 6.39.5**, **gsap 3.15.0** (ScrollTrigger), **lenis 1.3.26**, **zustand 5.0.15**, **@types/three 0.186.0** (dev), sharp 0.35.4 and @playwright/test 1.63.0 for the poster script, Vitest 5.0.1, Playwright 1.63.0 + @axe-core/playwright 4.13.0, @lhci/cli 0.15.1, Biome 2.5.14, pnpm 11.27.1.

**Spec:** `docs/superpowers/specs/2026-09-23-cinematic-cv-design.md` (§1 storyboard, §3 render layers, scroll orchestration, GPU tiers, realism, budgets, accessibility, §7 M5/M6 rows, §8 risks), amended by Task 1 for the owner's 2026-09-24 decision (no Blender). Object names and shots: the asset contract v1 (quoted in Task 3's `stack-layout.ts`). Format and building blocks continue `docs/superpowers/plans/2026-09-24-m3-contact-inbox.md`.

## Verified facts (checked 2026-09-25 on this machine)

Every command and expected output below was produced by running this plan in a scratch clone of `dev`, one task at a time and in order: tests first and the red run observed, then the implementation and the whole suite re-run, then one commit per task. After Task 9 the gate script passed on a fresh clone of the result (`gate=0`). The database was a throwaway `postgres:18-alpine` container; the plan itself uses the repo's `docker compose` Postgres on port 5432.

- **Repo state:** `dev` is at `7890354 docs: document contact mail and inbox` (M0–M3 merged). `origin/main` is still the GitHub default branch, so the worktree is cut from `dev` explicitly. Baseline on `dev`: `pnpm test` = 24 files, 190 tests; `pnpm test:e2e` = 72 tests; `/en` loads 10 module scripts, 146.8 KB gz; LHCI 100 / 100 / 100 / 100. `git-lfs` is **not installed** here, although `.gitattributes` routes `public/seq/**`, `public/3d/**` and `*.blend` through LFS.
- **Registry (`npm view`, 2026-09-25):**
  - `three` 0.186.0 (MIT, 2026-09-08). 0.186.1 came out on 2026-09-24, too young for pnpm 11's minimum release age, so the spec pin 0.186.0 stays. `@types/three` 0.186.0.
  - `@react-three/fiber` 9.8.0 (MIT, 2026-09-22; peers `react`/`react-dom` `>=19 <19.4`, `three >=0.156`). 9.8.1 is from 2026-09-24. v10 is still alpha.
  - `postprocessing` 6.39.5 (Zlib, peer `three >= 0.168.0 < 0.187.0`).
  - `gsap` 3.15.0: licence "Standard 'no charge' license" (all plugins, ScrollTrigger included, free since 3.13). `@gsap/react` 2.1.2 is not needed (plain effects).
  - `lenis` 1.3.26 (MIT): `autoRaf` defaults to `false`, writes the scroll position with `behavior: "instant"` (so the site's CSS `scroll-behavior: smooth` does not double-smooth), and has `respectReducedMotion` on by default.
  - `zustand` 5.0.15 (MIT; `zustand/vanilla` `createStore`).
  - `@react-three/drei` 10.7.8, `@react-three/postprocessing` 3.1.2, `detect-gpu` 5.0.70, `maath` 0.10.8 exist but are **not used** (next bullets).
  - All installs in this plan leave `pnpm-workspace.yaml` untouched (no release-age exclusions, no new build scripts).
- **three 0.186.0 features:** `AgXToneMapping` (constant 6) and `NeutralToneMapping` exist; `MeshPhysicalMaterial` has `anisotropy`, `anisotropyRotation`, `iridescence`, `iridescenceIOR`, `iridescenceThicknessRange`, `transmission`; `three/addons/geometries/RoundedBoxGeometry.js` exists; `scene.environmentRotation` rotates the environment map; `renderer.compileAsync()` exists (tried, no measurable gain here, not used). R3F 9.8.0 applies `gl={{ toneMapping }}` after its own ACES default, and in `frameloop="never"` mode `advance(t)` treats `t` as seconds. With three 0.186, R3F logs one console **warning** `THREE.Clock: This module has been deprecated` (not an error).
- **Bundle measurements (turbopack build, sum of `gzip -9` per script):**
  - Lazy chunk with drei `Environment` + `Lightformer` + `ContactShadows` and `@react-three/postprocessing` (`Bloom`, `SMAA`, `ToneMapping`): **391.9 KB gz**, over the 350 budget. drei's `Environment` module statically imports the EXR, RGBE and gain-map (HDR JPG) loaders; `@react-three/postprocessing` ships one bundled `index.js`, so N8AO and every other effect come along.
  - After an own PMREM environment and `postprocessing` used directly: **359.6 KB gz**.
  - Single-package measurements (esbuild, three/react external): drei `ContactShadows` alone **48.2 KB gz**; `postprocessing` with Bloom + ToneMapping 17.5 KB, with SMAA 71.7 KB (SMAA embeds its lookup textures), with FXAA 18.8 KB; R3F 56.4 KB; gsap + ScrollTrigger 44.1 KB; lenis 5.3 KB; zustand 0.3 KB. R3F imports `* as THREE`, so all of three (184.4 KB gz) lands in the chunk regardless.
  - Final (this plan): **one lazy chunk, 303.7 KB gz**; `/en` and `/ro` load 10 module scripts, **149.7 KB gz** before 3D (+2.9 KB: the loader, tier classifier and Motion switch).
- **drei `PerformanceMonitor` does not fit on-demand rendering:** it computes `fps = frames.length / msPassed * 1000` over wall time (`@react-three/drei/core/PerformanceMonitor.js`), so the idle gaps between scroll-driven frames read as a low frame rate and trigger `onDecline`. The plan's `frame-monitor.ts` measures only back-to-back rendered ticks.
- **detect-gpu** fetches its benchmark data from `https://unpkg.com/detect-gpu@{version}/dist/benchmarks` by default (README), which breaks the self-host rule; the plan classifies the WebGL renderer string instead.
- **Headless Chromium and WebGL (Playwright 1.63.0, Chromium 153.0.8010.12):**
  - default headless: `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`, WebGL 2 works;
  - headless with `--use-angle=vulkan --enable-features=Vulkan --enable-gpu`: `ANGLE (Intel, Vulkan 1.4.318 (Intel(R) Iris(R) Xe Graphics (ADL GT2) (0x000046A6)), Intel open-source Mesa driver)`: the real GPU without a window;
  - headed default: `ANGLE (Intel, Mesa Intel(R) Iris(R) Xe Graphics (ADL GT2), OpenGL ES 3.2)`; `--use-angle=gl` headless still falls back to SwiftShader.
  - LHCI launches `/usr/bin/google-chrome` 153 headless (chrome-launcher). It takes the tier-0 path (10 scripts, no 3D chunk in its network log), so LHCI measures the poster page; the 3D path is measured by `pnpm perf:local` and the e2e budgets.
- **Chrome's LCP ignores full-viewport images:** with a static test page, an `<img>` covering the whole 1280×720 viewport was never an LCP candidate (LCP = the `<h1>`), the same image at 90 % or at 99 % height, clipped by `overflow: hidden` or by `clip-path` became the LCP element (size 571 392 to 912 640 px²). A 110 % image was ignored too. Hence Task 7 clips the poster to the area the scrim leaves visible.
- **Measuring (Chromium via Playwright):** `new PerformanceObserver(…).observe({ type: "longtask", buffered: true })` from `addInitScript` records long tasks from the first script on; `CDPSession.send("Performance.getMetrics")` gives `JSHeapUsedSize`; a browser-level `browser.newBrowserCDPSession()` + `SystemInfo.getProcessInfo` lists the renderer and GPU process ids, whose private memory is read from `/proc/<pid>/smaps_rollup` (`Private_Clean + Private_Dirty + SwapPss`).
- **Posters:** `pnpm assets:posters` (Task 6) takes 27 s with the GPU and 39 s with `POSTERS_SOFTWARE=1` (SwiftShader, bytes differ slightly). GPU captures are byte-identical between runs. 16 files, 207 KB in total; the 1920-wide AVIF first frame is 16.7 KB.
- **Tier 1 decision (measured, `?tier=` forced, 20 wheel steps):** on the Iris Xe every tier holds 60 fps even at 2560×1440 (median and p95 16.7 ms). On SwiftShader at 1280×720 (a stand-in for a weak GPU, since it rasterizes on the CPU) tier 1 has p95 **233 ms** per frame, tier 2 **550 ms**, tier 3 **583 ms**: tier 1 costs well under half of tier 2. So tier 1 is a live light scene (DPR 1, no transmission pass, no postfx, MSAA), not posters: the runtime monitor drops a device that still cannot hold 40 fps to posters within about a second of scrolling.
- **Results after Task 9:**
  - `pnpm test` = 33 files, 241 tests. `pnpm test:e2e` = **89 tests** (the 72 existing + 17 new), about 35 s after the build. `pnpm lint` checks 231 files.
  - `pnpm perf:local` (Iris Xe, 1440×900, tier chosen by the classifier = 2): **0 long tasks while scrolling** 2700 px through the pinned hero and past it, 60 fps, frame p95 16.7 ms; tab memory **142.9 MB** (renderer 86.2 MB + GPU process 56.7 MB private), JS heap 12.6 MB. Mounting the stage at idle after the load event causes three long tasks of about **51, 76–103 and 125–128 ms** (chunk evaluation; renderer + model + PMREM environment; first frame with shader compilation), before any scrolling.
  - LHCI desktop = **100 / 100 / 100 / 100** on `/en` and `/ro` in all 3 runs; LCP 595–637 ms, TBT 0 ms, CLS 0; LCP element `div.sticky > div.stage > picture > img.size-full`.
- **Tooling quirks (unchanged from M3, one new):**
  - A hook rewrites plain `git`, so commands use `/usr/bin/git`. The worktree guard can reject compound one-liners, so commands are one per line.
  - `rtk` filters output; prefix `rtk proxy` to see exactly what this plan shows. **New:** without `rtk proxy`, `pnpm exec vitest …` is rewritten into a JSON-reporter run that writes a `.vitest/` folder into the repo, and `pnpm exec biome … --write` may not write. Always use `rtk proxy pnpm exec vitest …` and `rtk proxy pnpm exec biome …`.
  - `pnpm typecheck` needs `.env.local` (it loads `next.config.ts`, which validates env).

## Global Constraints

- Exact pins only. The M0–M3 pins stay (next 16.3.6, react/react-dom 19.3.0, typescript 7.0.2, vitest 5.0.1, @playwright/test 1.63.0, …). New runtime dependencies: `three` 0.186.0, `@react-three/fiber` 9.8.0, `zustand` 5.0.15, `gsap` 3.15.0, `lenis` 1.3.26, `postprocessing` 6.39.5. New dev dependency: `@types/three` 0.186.0. Not used: `@react-three/drei`, `@react-three/postprocessing`, `detect-gpu`, `maath`, `@gsap/react`, Theatre.js (see Verified facts and Deviations).
- Owner decision 2026-09-24, binding: **no Blender**. No frame sequences, no SequencePlayer, no Git LFS, no `public/seq`. All 3D is procedural three.js; posters are captured from the three.js scene by a script.
- Asset contract v1, binding: object names `layer_interface`, `layer_api`, `layer_data`, `layer_infra`, `layer_craft`, `engrave_hero`, `engrave_contact`, `led_status`, `pcb_traces`; footprint 0.40 × 0.40 m, height 0.25 m, base plate on the ground centred on the origin, metres, each layer's origin at the centre of its bottom face; AgX tone mapping; no baked grain or vignette. Shots find objects only by these names (the `StackModel` seam).
- Spec §3, verbatim: "Lenis (`autoRaf:false`) + GSAP ticker drives Lenis, ScrollTrigger and `r3f.advance()`. … Skip render when nothing changed / tab hidden." And: "L0 R3F canvas — `frameloop="never"`, driven by one shared ticker." And: "L1 DOM — all text SSR, semantic (SEO, a11y, LCP)."
- Spec §3 budgets: "public JS before 3D ≤ 160 KB gz …, lazy 3D chunk ≤ 350 KB gz (after LCP, `requestIdleCallback`)". Spec §3 accessibility: "canvases `aria-hidden` … reduced-motion → T0". Visible "Motion off" toggle.
- Spec §7 M5 acceptance, verbatim: "no long task > 50 ms on Iris Xe; tab memory < 400 MB; reduced-motion = posters; LCP = poster". Plus, from the brief: LHCI ≥ 95 in all categories, the 72 existing e2e tests stay green, axe stays clean.
- Tiers (spec §3, adapted): T0 = reduced motion, Save-Data, **Motion** off, no WebGL 2 or a software renderer: posters and CSS only, no pin, no Lenis, no 3D download. T1 = light live scene (DPR 1, no transmission, no postfx). T2 = reference (Iris Xe): DPR ≤ 1.5, bloom, AgX, FXAA. T3 = discrete / pro GPUs: DPR ≤ 2 (T3-only effects arrive in M6). Runtime downgrade on slow frames; `webglcontextlost` → posters.
- Self-host everything the page loads at runtime: no HDRI or benchmark downloads, no CDN fonts. Posters are served from `public/posters` (or `NEXT_PUBLIC_ASSET_BASE`), `Cache-Control: public, max-age=31536000, immutable`.
- The `cacheComponents` rules hold: `/en` and `/ro` stay `○` (static). Nothing 3D renders on the server; the text stays SSR DOM.
- Biome is the only linter and formatter; `rtk proxy pnpm lint` prints `No fixes applied.` before each commit.
- Commits use `type(scope): subject`, subject ≤ 50 characters. **No AI attribution of any kind.** The owner's real address never enters a committed file: before each commit, `/usr/bin/git diff --cached | grep -cF "$(grep ^ADMIN_EMAIL= .env.local | cut -d= -f2)"` must print `0`.
- Port 3020 is the owner's dev server: never use it. Ports here: 3100 (e2e), 3200 (LHCI), 3300 (`perf:local`), 3400 (`assets:posters`).
- Out of scope (M6+): shots S2 (exploded skills) and S3 (contact), the PCB light-pulse shader, pointer rim light and parallax, T3 effects (bokeh DOF, N8AO, chromatic aberration), CSS grain/vignette overlay, View Transitions, final look-dev, an artist-made `stack.glb`.

## Review Focus

These are inputs the spec implies that ordinary feature tests would not catch. Each one is pinned by a test in the task that owns the code:

1. **A full-bleed poster is not an LCP candidate.** Chrome treats an image whose visible rect covers the whole viewport as a background and skips it, so a naive full-bleed poster silently makes the `<h1>` the LCP element. The poster is clipped to the part of the frame the scrim leaves visible. Pinned by the Task 7 e2e tests `the hero poster is the LCP element (desktop)` and `a phone gets the portrait poster` (Task 7, Step 4 shows them failing without the clip).
2. **Visitors without a real GPU (VMs, remote desktops, headless crawlers, old laptops with WebGL blocklisted).** Chromium then renders WebGL on SwiftShader at a few frames per second. They must get the poster page and never download the 3D chunk. Pinned by the Task 5 e2e test `a software renderer gets posters and never downloads the 3D chunk` and the Task 2 unit test `puts software renderers and missing WebGL 2 on posters (tier 0)`.
3. **The GPU goes away mid-visit (driver reset, too many tabs, sleep).** A lost WebGL context must bring the poster back instead of leaving a frozen or black canvas. Pinned by the Task 5 e2e test `a lost WebGL context falls back to the poster`.
4. **On-demand rendering fooling the performance monitor.** Frames are only drawn while something moves, so an fps counter over wall time would downgrade every fast machine after the first idle second. Pinned by the Task 4 unit test `ignores idle gaps between on-demand frames` (and `declines after enough back-to-back frames below 40 fps` for the real case).
5. **Scene edits without new posters.** Anyone changing materials, lights or camera keys must recapture the posters, or the LCP image, the reduced-motion hero and the live canvas drift apart and the crossfade jumps. Pinned by the Task 6 unit test `were captured from the current scene code` (a hash over the scene sources), which runs in CI.

## Before you start (workspace)

1. Update the main checkout and cut the worktree from `dev`:

```bash
/usr/bin/git -C /home/mihai/Documents/CV pull --ff-only
/usr/bin/git -C /home/mihai/Documents/CV worktree add .claude/worktrees/m5-motion-core -b feat/m5-motion-core dev
```

Expected: `Preparing worktree (new branch 'feat/m5-motion-core')` and `HEAD is now at 7890354 docs: document contact mail and inbox` (or a later `dev` tip). Then call `EnterWorktree` with `path: ".claude/worktrees/m5-motion-core"`. **All commands below run from the worktree root.** If this plan file is not committed on `dev`, read it from `/home/mihai/Documents/CV/docs/superpowers/plans/2026-09-25-m5-motion-core.md`.

2. Install, create the local env, start Postgres and prepare the dev database (`pnpm build` prerenders `/en` and `/ro` from it; e2e uses its own `cv_e2e` database):

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
docker compose up -d --wait
pnpm db:migrate
pnpm db:seed
pnpm exec playwright install chromium
```

In `.env.local`, set `ADMIN_EMAIL=<owner email>` (the Overseer supplies the real address; it never goes into a committed file).

Expected: `Done in <n>s using pnpm v11.27.1`; `Container cv-db-1  Healthy`; `migrations applied`; `seeded CV content` (or `skipped: CV content already exists (use --reset to replace it)`).

3. Check the baseline:

Run: `rtk proxy pnpm test`
Expected: `Test Files  24 passed (24)`, `Tests  190 passed (190)`.

Run: `pnpm test:e2e`
Expected: `72 passed`. Afterwards `ss -ltn | grep ':3100 '` prints nothing.

4. Tasks 6 and 8 need this machine's GPU (Intel Iris Xe). Check that headless Chromium reaches it:

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
await browser.close();
EOF
node .data/webgl-probe.mjs
rm .data/webgl-probe.mjs
```

Expected: `ANGLE (Intel, Vulkan 1.4.318 (Intel(R) Iris(R) Xe Graphics (ADL GT2) (0x000046A6)), Intel open-source Mesa driver)`. (`.data/` is git-ignored; the script sits there so Node finds the repo's `@playwright/test`.) On a machine that prints `SwiftShader`, posters still work with `POSTERS_SOFTWARE=1`, but `pnpm perf:local` skips its tests.

## File map

| Path | Responsibility | Task |
|---|---|---|
| `docs/superpowers/specs/2026-09-23-cinematic-cv-design.md`, `.gitattributes` (deleted), `README.md` (prerequisites) | amendment "three.js only, no Blender"; no LFS | 1 |
| `src/experience/motion-preference.ts`, `src/experience/use-motion.ts` | `resolveMotion`, `motionEnabled`, `setMotionChoice`, `subscribeMotion`, `MOTION_STORAGE_KEY`; `useMotion()` | 2 |
| `src/experience/gpu-tier.ts` | `Tier`, `LiveTier`, `GpuSignals`, `classifyTier`, `tierOverride`, `lowerTier`, `readGpuSignals` | 2 |
| `src/experience/MotionToggle.tsx`, `src/components/site/SiteHeader.tsx`, `messages/{en,ro}.json` | the **Motion** switch in the header, EN/RO labels | 2 (header overlay: 5) |
| `src/experience/scenes/{stack-layout,pcb-traces,textures,materials}.ts` | contract names and layout, trace ribbon, canvas textures, materials per tier | 3 |
| `src/experience/scenes/{StackModel,StudioLights}.tsx` | procedural model behind the `StackModel` seam; PMREM studio environment + contact shadow | 3 |
| `src/experience/scene-ids.ts`, `src/experience/capture-mode.ts` | `SCENE_IDS`; `captureFromSearch` (`?capture=<scene>&p=`) | 4 |
| `src/experience/director/{store,frame-monitor,framing,shots}.ts` | `createStageStore`; `createFrameMonitor`; `orientationOf`, `coverViewOffset`, `REFERENCE_SIZE`; `HERO_KEYS`, `sampleCameraKeys`, `heroFrame` | 4 |
| `src/experience/scroll/loop.ts` | `startLoop` (GSAP ticker → Lenis → callback), `trackSections` (ScrollTriggers → store) | 5 |
| `src/experience/director/{Director,HeroShot}.tsx`, `src/experience/postfx/Effects.tsx` | on-demand rendering, shot registry; hero camera; Bloom + AgX + FXAA | 5 |
| `src/experience/{Stage,StageLoader}.tsx`, `src/app/[locale]/page.tsx` | lazy fixed canvas; load/idle/tier gate, `html[data-motion|data-canvas|data-tier]` | 5 |
| `src/components/sections/Hero.tsx`, `src/app/globals.css`, `src/components/ui/Stage.tsx` (deleted) | pinned full-bleed hero, stage layer, scrim, capture CSS | 5, 7 |
| `src/experience/poster-shots.ts`, `scripts/{posters,poster-sources}.ts`, `public/posters/*`, `src/experience/posters.json` | poster list, widths, manifest types, `srcSet`; capture script; source hash; committed posters | 6 |
| `src/components/sections/HeroPoster.tsx`, `next.config.ts`, `.env.example` | art-directed `<picture>` LCP poster; immutable cache header | 7 |
| `tests/e2e/budgets.spec.ts`, `playwright.perf.config.ts`, `tests/perf/hero.perf.ts` | JS budgets (CI); GPU long-task/memory harness (`pnpm perf:local`) | 8 |
| `tests/unit/{gpu-tier,motion-preference,stack-model,stage-store,frame-monitor,framing,shots,capture-mode,posters}.test.ts` | unit tests | 2, 3, 4, 6 |
| `tests/e2e/{motion,stage,poster}.spec.ts` | e2e | 2, 5, 7 |
| `package.json`, `pnpm-lock.yaml` | dependencies (3, 4, 5), `assets:posters` (6), `perf:local` (8) | 3–8 |
| `README.md` | "Motion and 3D", scripts table | 9 |

---

### Task 1: Amend the spec for the three.js-only decision

**Owner:** frontend-engineer (docs only; M5's specialist records the decision the rest of the plan builds on).

**Files:**
- Modify: `docs/superpowers/specs/2026-09-23-cinematic-cv-design.md`, `README.md`
- Delete: `.gitattributes`

**Interfaces:**
- Consumes: the owner's decision of 2026-09-24 (no Blender).
- Produces: the amended spec every later task argues from; no Git LFS in the repo.

- [ ] **Step 1: Apply the amendment**

Save this patch as `.data/spec-amendment.diff` (`mkdir -p .data` first; the folder is git-ignored) and apply it (it adds a dated "Amendment 2026-09-24" section and edits every line that assumed Blender, frame sequences or LFS):

````diff
diff --git a/docs/superpowers/specs/2026-09-23-cinematic-cv-design.md b/docs/superpowers/specs/2026-09-23-cinematic-cv-design.md
--- a/docs/superpowers/specs/2026-09-23-cinematic-cv-design.md
+++ b/docs/superpowers/specs/2026-09-23-cinematic-cv-design.md
@@ -6,9 +6,9 @@ User wants new project in new folder `CV`: personal CV/portfolio site as fullsta
 | Topic | Decision |
 |---|---|
 | Purpose | Personal CV / portfolio |
-| Realism | Hybrid: real-time 3D (R3F) + scroll-scrubbed pre-rendered frame sequences (Apple style) |
+| Realism | Real-time 3D (three.js / R3F), scroll-scrubbed; posters captured from the same scene (amended 2026-09-24) |
 | Backend | Next.js API/server actions + Postgres + admin panel (edit CV, read messages) |
-| Assets | Authored in Blender (not installed yet; iGPU Intel Iris Xe, no NVIDIA) |
+| Assets | Built procedurally in three.js; an artist-made `stack.glb` may replace the model later (amended 2026-09-24: no Blender; iGPU Intel Iris Xe, no NVIDIA) |
 | Concept | **A: "The Stack"** — exploded product film |
 | Deploy | Vercel + Neon Postgres |
 | Media host | **Vercel only** (no R2) |
@@ -16,23 +16,35 @@ User wants new project in new folder `CV`: personal CV/portfolio site as fullsta
 
 Machine facts: Node 24.0.0, npm 11.3.0, Docker, psql 18.6, uv/uvx, Python 3.12, 31 GB RAM. Missing: blender, ffmpeg, KTX-Software. Trap: `/home/mihai/package.json` has `packageManager: yarn` — corepack hijacks pnpm under home; fix by project-level `packageManager` field.
 
+## Amendment 2026-09-24: three.js only, no Blender
+
+Owner decision: Blender cannot run on the owner's side, so all 3D is built procedurally in three.js / React Three Fiber.
+- Shots S1 (hero), S2 (skills, exploded view) and S3 (contact) are real-time, scroll-scrubbed camera and object moves. There are no pre-rendered frame sequences: no SequencePlayer, no Blender scripts, no Git LFS, no `public/seq`, and milestone M4 is dropped.
+- Posters (LCP, reduced motion, no WebGL, low-end devices) are captured from the three.js scene by `pnpm assets:posters` (Playwright + Chromium) and committed, content-hashed, under `public/posters`.
+- The object names of the asset contract (`layer_interface` … `layer_craft`, `engrave_hero`, `engrave_contact`, `led_status`, `pcb_traces`) still bind, so an artist-made `stack.glb` can replace the procedural model.
+- Tier 1 becomes a light live scene (DPR 1, no transmission, no postfx) instead of sequences.
+- Lighting is an environment map baked once from softbox planes (Lightformer style), no HDRI download; AgX tone mapping.
+- M5 measured further deviations (drei, `@react-three/postprocessing`, `detect-gpu` and SMAA dropped for bundle size; an own frame monitor instead of drei's PerformanceMonitor). The M5 plan (`docs/superpowers/plans/2026-09-25-m5-motion-core.md`) records the numbers.
+
+The lines below that mentioned Blender, frame sequences or LFS were edited to match.
+
 ---
 
 ## 1. Concept A — "The Stack" storyboard
-Monolith of 5 precision-machined layers in dark studio (glass / titanium / ceramic / PCB / base plate) = literally "full stack". Apple product-film vocabulary: exploded view, light sweeps, macro depth of field. Hard-surface only → EEVEE renders photoreal fast on Iris Xe. Same `.blend` feeds pre-rendered shots AND glTF → look + camera match at handoff.
+Monolith of 5 precision-machined layers in dark studio (glass / titanium / ceramic / PCB / base plate) = literally "full stack". Apple product-film vocabulary: exploded view, light sweeps, macro depth of field. Hard-surface only → `MeshPhysicalMaterial` renders it convincingly in real time on Iris Xe. Posters are captured from the same scene and camera, so poster and canvas match at handoff.
 
 | Section | Scene | Tech |
 |---|---|---|
 | Preloader | Black, hairline progress (real asset %), hero poster already visible | DOM |
-| Hero (pin 200vh) | **Shot S1, 150 frames**: macro dolly over anodized aluminium, softbox sweep reveals engraved name/role, pull back to monolith. Last frame hands off to real-time; pointer moves rim light + parallax | Sequence → R3F |
+| Hero (pin 200vh) | **Shot S1** (real-time, scroll-scrubbed): macro dolly over anodized aluminium, softbox sweep reveals engraved name/role, pull back to monolith; pointer moves rim light + parallax | Poster (frame 0) → R3F |
 | About (pin 150vh) | Stack yaws 30°, glass layer lifts, DOF racks to glass; bio + counters in DOM | R3F |
-| Skills (pin 300vh) | **Shot S2, 180 frames**: exploded view — Interface (glass) / API (titanium) / Data (ceramic) / Infra (PCB) / Craft (base). Then interactive: hover layer = emissive edge, DOM skill chips anchored to projected 3D points | Sequence → R3F |
+| Skills (pin 300vh) | **Shot S2** (real-time): exploded view — Interface (glass) / API (titanium) / Data (ceramic) / Infra (PCB) / Craft (base). Then interactive: hover layer = emissive edge, DOM skill chips anchored to projected 3D points | R3F |
 | Experience | Camera macro-tracks along PCB; traces = timeline, each job = engraved chip, light pulse travels with scroll (shader uniform) | R3F, 1 mesh + 1 shader |
 | Projects | DOM grid, AVIF covers, tilt, muted video on hover; detail route `/[locale]/projects/[slug]` with View Transition | DOM + `<video>` |
-| Contact (pin 100vh) | **Shot S3, 120 frames**: layers re-assemble and click shut, "Let's build" engraved; on submit success LED on base plate pulses | Sequence → R3F |
+| Contact (pin 100vh) | **Shot S3** (real-time): layers re-assemble and click shut, "Let's build" engraved; on submit success LED on base plate pulses | R3F |
 | Footer | Slow turntable idle, render stops offscreen | R3F on demand |
 
-Total 450 frames × 2 aspects (landscape + portrait camera, not crop).
+Every shot has a landscape and a portrait camera (re-framed, not cropped); posters are captured for both.
 
 ---
 
@@ -45,12 +57,12 @@ Total 450 frames × 2 aspects (landscape + portrait camera, not crop).
 | react / react-dom | 19.3.0 | pinned `<19.4` (R3F peer) |
 | three | 0.186.0 | WebGL renderer, AgX tone mapping, KTX2/meshopt loaders |
 | @react-three/fiber | 9.8.0 | React renderer for three (v10 = WebGPU alpha, skip) |
-| @react-three/drei | 10.7.8 | useGLTF, Environment, Lightformer, PerformanceMonitor, AdaptiveDpr, ContactShadows |
-| @react-three/postprocessing / postprocessing | 3.1.2 / 6.39.5 | Bloom, DOF, N8AO, AgX ToneMapping, SMAA, Vignette, ChromaticAberration |
+| @react-three/drei | 10.7.8 | not used since M5 (bundle size; see the amendment) |
+| postprocessing | 6.39.5 | Bloom, AgX ToneMapping, FXAA (M5); DOF, N8AO, ChromaticAberration for T3 (M6). `@react-three/postprocessing` not used |
 | gsap / @gsap/react | 3.15.0 / 2.1.2 | ScrollTrigger, SplitText, CustomEase (all plugins free) |
 | lenis | 1.3.26 | Smooth native scroll |
 | zustand | 5.0.15 | Per-frame scroll store, no React re-renders |
-| detect-gpu | 5.0.70 | GPU tier signal |
+| detect-gpu | 5.0.70 | not used: tiers come from the WebGL renderer string (`src/experience/gpu-tier.ts`) |
 | maath | 0.10.8 | Damping/easing helpers |
 | next-intl | 4.14.6 | EN/RO routing + UI strings |
 | drizzle-orm / drizzle-kit / drizzle-zod | 0.45.3 / 0.31.11 / 0.8.3 | ORM, migrations, validators (Prisma 8 RC churn avoided) |
@@ -72,16 +84,15 @@ Not used: Theatre.js (stale since 2024), motion/framer (GSAP covers it), WebGPU
 typescript 7.0.2, @biomejs/biome 2.5.14 (ESLint blocked by TS 7), vitest 5.0.1 + jsdom + @testing-library/react + msw, @electric-sql/pglite 0.5.8 (in-process DB tests), @playwright/test 1.63.0 + @axe-core/playwright, @lhci/cli 0.15.1, sharp 0.35.4 (AVIF/WebP encode), @gltf-transform/cli 4.5.0, leva + r3f-perf (dev overlay), pnpm 11.27.1.
 
 ### System tools
-Blender 5.2 LTS (official tarball → `~/opt`, symlink `~/.local/bin/blender`), KTX-Software ≥ 4.4 (`ktx`, for gltf-transform KTX2), ffmpeg (apt), mesa-utils + vulkan-tools (GPU diag), git-lfs (frames in repo), Docker `postgres:18-alpine`, neonctl, vercel CLI.
+mesa-utils + vulkan-tools (GPU diag), Docker `postgres:18-alpine`, neonctl, vercel CLI. (Blender, KTX-Software, ffmpeg and git-lfs dropped 2026-09-24.)
 
 ### Blender add-ons / assets
-Built-in: glTF 2.0 exporter, Node Wrangler, Geometry Nodes (PCB traces), OIDN denoiser, Cycles bake (CPU, lightmaps/AO). Free extensions: Camera Shakify (real handheld camera shake), Bool Tool, LoopTools. Assets: Poly Haven CC0 HDRIs/textures/models.
+Dropped 2026-09-24 (no Blender).
 
 ### MCP servers
 | Server | Use |
 |---|---|
-| mcp-for-blender (`claude mcp add blender -- uvx mcp-for-blender`) | Claude drives Blender via Python: build scenes, fetch Poly Haven assets. Localhost only, `BLENDER_MCP_SAFE_MODE=1`, `DISABLE_TELEMETRY=true`, ensure version includes CVE-2026-10662 fix |
-| (alt) official Blender Lab MCP 1.0.3 | bpy execution, needs Blender ≥ 5.1 |
+| ~~mcp-for-blender / Blender Lab MCP~~ | dropped 2026-09-24 (no Blender) |
 | next-devtools-mcp | Next 16 runtime introspection |
 | @neondatabase/mcp-server-neon | Neon branches / SQL |
 | claude-in-chrome (already here) | Real-GPU visual checks, screenshots, console |
@@ -99,13 +110,10 @@ CV/
   package.json            packageManager pnpm@11.27.1, engines node 24
   next.config.ts proxy.ts drizzle.config.ts biome.json vitest.config.ts playwright.config.ts lighthouserc.json
   docker-compose.yml      postgres:18-alpine (+ mailpit)
-  .gitattributes          LFS for public/seq/**, public/3d/**, *.blend
   messages/en.json ro.json      UI strings only; CV content in DB
-  public/3d/              hashed .glb/.ktx2 + HDR gainmap
-  public/seq/<shot>/<variant>/  hashed AVIF/WebP frames + manifest.json
-  public/basis/           KTX2 transcoder wasm
-  blender/ scenes/*.blend  scripts/{scene_setup,render_sequence,export_gltf,bake_lightmaps,lookdev_check}.py  hdri/ renders/(gitignored)
-  scripts/assets/ encode-sequence.ts optimize-glb.sh make-video.sh check-budgets.ts
+  public/posters/         content-hashed AVIF/WebP posters (scripts/posters.ts)
+  public/3d/              optional artist-made stack.glb (later)
+  scripts/posters.ts poster-sources.ts
   src/
     app/[locale]/{layout,page}.tsx projects/[slug]/page.tsx
     app/admin/(auth)/login  app/admin/(panel)/{profile,experience,skills,projects,media,messages}
@@ -116,51 +124,49 @@ CV/
       Stage.tsx                      persistent R3F canvas, dynamic ssr:false, mounted after LCP
       director/{store.ts,Director.tsx}   scroll progress → camera clip time, uniforms, postfx
       scenes/{StackScene,PcbTimeline}.tsx
-      sequence/{SequencePlayer.ts,decode.worker.ts,manifest.ts,lru.ts}
+      posters.json poster-shots.ts   poster manifest (generated) + shot list
       postfx/Effects.tsx  gpu-tier.ts  scroll/{LenisProvider.tsx,gsap.ts}  capture-mode.ts
   tests/{unit,e2e,visual,perf}
 ```
 
 ### Render layers (fixed, full viewport)
-- L-1 `<canvas>` 2D — plays pre-rendered sequences (already AgX tone-mapped in Blender, kept out of WebGL composer → no double tone map).
-- L0 R3F canvas — `frameloop="never"`, driven by one shared ticker. Handoff = opacity crossfade on matching frame, hidden inside fast camera moves.
+- L-1 (dropped 2026-09-24: no pre-rendered sequences).
+- L0 R3F canvas — `frameloop="never"`, driven by one shared ticker. Handoff = the SSR poster (same camera, same crop) fades out over the first live frame.
 - L1 DOM — all text SSR, semantic (SEO, a11y, LCP).
 - L2 overlay — CSS film grain + vignette over everything. Grain never baked into frames (kills compression).
 
 ### Scroll orchestration — one RAF loop
-Lenis (`autoRaf:false`) + GSAP ticker drives Lenis, ScrollTrigger and `r3f.advance()`. Each section = one ScrollTrigger (`pin`, `scrub`) writing progress into zustand vanilla store. Director reads store per tick: `AnimationMixer.setTime(p * clip.duration)` on Blender-exported camera clip, scrubbed GSAP timelines for uniforms/DOF/bloom, sequence frame index. Skip render when nothing changed / tab hidden.
+Lenis (`autoRaf:false`) + GSAP ticker drives Lenis, ScrollTrigger and `r3f.advance()`. Each section = one ScrollTrigger (`pin`, `scrub`) writing progress into zustand vanilla store. Director reads store per tick: camera keyframes per shot and orientation (`src/experience/director/shots.ts`), scrubbed uniforms/DOF/bloom. Skip render when nothing changed / tab hidden.
 
-### SequencePlayer
-- Manifest per shot: frames, variants (1920/1280/640 landscape, 828 portrait; AVIF + WebP), poster; content-hashed, `Cache-Control: immutable`.
-- Progressive passes: 640w every 6th frame → full width every 6th → every 2nd → all. Draw nearest best frame.
-- Decode in 2 workers (`createImageBitmap`), LRU window ±10 desktop / ±6 mobile, `bitmap.close()` on evict, velocity-based skip. WebP fallback if AVIF decode > 20 ms.
-- Frame 0 of S1 = SSR `<Image priority>` → LCP element.
+### Posters (replace the SequencePlayer, amended 2026-09-24)
+- `pnpm assets:posters` renders chosen shot frames (`?capture=<scene>&p=<progress>`) from the production build in Chromium; variants 1920/1280/640 landscape, 828 portrait; AVIF + WebP; content-hashed, `Cache-Control: immutable`.
+- Frame 0 of S1 = SSR poster (`<picture>`, `fetchpriority="high"`) → LCP element; reduced motion gets the last frame.
+- A unit test fails when the scene code changed after the posters were captured.
 
 ### GPU tiers
 | Tier | Who | Gets |
 |---|---|---|
 | T0 | reduced-motion, saveData, no WebGL | posters + CSS fades, no pin/Lenis |
-| T1 | low-end phones | sequences only (portrait/1280w), no R3F, DPR 1 |
+| T1 | low-end phones, older Intel graphics | light live scene: DPR 1, no transmission, no postfx |
 | T2 | Iris Xe (reference), M1, recent phones | R3F DPR ≤ 1.5, AgX, bloom, SMAA |
 | T3 | discrete / M Pro | DPR ≤ 2, bokeh DOF, N8AO, chromatic aberration |
-Runtime downgrade via drei `PerformanceMonitor`; `webglcontextlost` → plates/posters. Visible "Motion off" toggle.
+Runtime downgrade by a frame monitor (back-to-back frames slower than 40 fps → one tier down; below T1 → posters); `webglcontextlost` → posters. Visible "Motion off" toggle.
 
 ### Realism techniques
-Baked lightmaps + AO (Cycles CPU bake, one-off), Poly Haven studio HDRI in both Blender and three, `Lightformer` softboxes, `MeshPhysicalMaterial` (clearcoat, anisotropy brushed titanium, iridescent glass edge), AgX on both pipelines, Macbeth chart screenshot compare (`lookdev_check.py`), Camera Shakify micro-shake, subtle DOF + grain.
+Environment map baked once (PMREM) from `Lightformer`-style softboxes, `MeshPhysicalMaterial` (transmission, clearcoat, anisotropy brushed titanium, iridescent glass), canvas-drawn PCB and etching textures, AgX tone mapping, subtle DOF + grain (M6).
 
 ### Asset pipeline
-1. Blender 5.2 headless: `blender -b blender/scenes/stack.blend --gpu-backend opengl --python-exit-code 1 -P blender/scripts/render_sequence.py -- --shot S1 --aspect landscape --w 1920 --h 1080` — EEVEE 64–128 samples, PNG, resumable (`use_overwrite=False`, `use_placeholder=True`). OpenGL backend because Intel Vulkan shows artifacts.
-2. `encode-sequence.ts` (sharp): AVIF q~50 effort 6, WebP q75, 4 widths, hashes, manifest, poster.
-3. `make-video.sh` (ffmpeg): MP4 H.264 + AV1 WebM fallback loops for T1/reduced-data.
-4. `export_gltf.py` → `gltf-transform optimize --compress meshopt --texture-compress ktx2 --texture-size 2048`; `gltf-transform validate` 0 errors.
-5. **Hosting (Vercel only)**: sequences + glb in `public/` tracked with Git LFS (enable LFS in Vercel project settings), served by Vercel CDN with immutable headers. Base URL behind `NEXT_PUBLIC_ASSET_BASE` env so moving to external CDN later = config change only. Vercel Blob only for admin uploads.
+1. The scene is code (`src/experience/scenes`); nothing is rendered offline.
+2. `pnpm build && pnpm assets:posters` (Playwright + Chromium, GPU or SwiftShader, sharp): AVIF q50 effort 6, WebP q75, hashed names, `src/experience/posters.json`.
+3. An optional artist-made `stack.glb` (same object names) goes through `gltf-transform optimize --compress meshopt`; `gltf-transform validate` 0 errors.
+4. **Hosting (Vercel only)**: posters (and a later glb) are plain files in `public/`, served by Vercel CDN with immutable headers. Base URL behind `NEXT_PUBLIC_ASSET_BASE` env so moving to external CDN later = config change only. Vercel Blob only for admin uploads.
 6. `check-budgets.ts` fails CI on breach.
 
 ### Performance budgets (CI-enforced)
-LCP ≤ 2.0 s desktop / ≤ 2.5 s mobile, CLS < 0.05, INP < 200 ms · public JS before 3D ≤ 160 KB gz (revised 2026-09-23: Next 16 + React 19 + next-intl baseline measured 143 KB gz at M0), lazy 3D chunk ≤ 350 KB gz (after LCP, `requestIdleCallback`) · initial transfer ≤ 1.5 MB · per shot ≤ 9 MB desktop / ≤ 5 MB mobile; **total `public/seq` + `public/3d` ≤ 80 MB** (Vercel deploy size) · glb ≤ 1.5 MB, ≤ 100 draw calls, ≥ 55 fps on Iris Xe 1080p · fonts: 2 variable woff2, latin + latin-ext (Romanian ș ț ă â î).
+LCP ≤ 2.0 s desktop / ≤ 2.5 s mobile, CLS < 0.05, INP < 200 ms · public JS before 3D ≤ 160 KB gz (revised 2026-09-23: Next 16 + React 19 + next-intl baseline measured 143 KB gz at M0), lazy 3D chunk ≤ 350 KB gz (after LCP, `requestIdleCallback`) · initial transfer ≤ 1.5 MB · posters ≤ 400 KB in total; **total `public/posters` + `public/3d` ≤ 80 MB** (Vercel deploy size) · glb ≤ 1.5 MB, ≤ 100 draw calls, ≥ 55 fps on Iris Xe 1080p · fonts: 2 variable woff2, latin + latin-ext (Romanian ș ț ă â î).
 
 ### Accessibility
-SSR DOM in logical order, canvases `aria-hidden`, skip link, `lang` per locale, contrast ≥ 4.5:1 (scrim over plates), SplitText `aria:'auto'`, reduced-motion → T0, no autoplay audio.
+SSR DOM in logical order, canvases `aria-hidden`, skip link, `lang` per locale, contrast ≥ 4.5:1 (scrim over posters and canvas), SplitText `aria:'auto'`, reduced-motion → T0, no autoplay audio.
 
 ---
 
@@ -201,30 +207,28 @@ Public reads: `'use cache'` + `cacheTag('cv')`; admin mutations `updateTag('cv')
 | M1 | Design system, 6 sections with fixture content, next-intl, metadata, hreflang, JSON-LD Person, sitemap | frontend | Lighthouse ≥ 95 all categories; 0 axe violations; both locales |
 | M2 | Drizzle schema/migrations/seed, Better Auth, admin CRUD, Blob uploads, cached queries | backend | RO headline edited in admin shows on `/ro`; `/admin` redirects logged-out; actions 401 without session; RO→EN fallback |
 | M3 | Contact action, rate limit, Resend + react-email EN/RO, inbox | backend | submit = DB row + email; 6th in 10 min rejected; Resend failure still persists |
-| M4 | Install Blender 5.2, KTX, ffmpeg, git-lfs; Blender MCP; bpy scripts; greybox stack; 10-frame timing test; glb + sequence pipeline | devops + user | `pnpm assets:build S1` → hashed files + manifest; validate 0 errors; EEVEE ≤ 10 s/frame measured; budgets pass |
-| M5 | Motion core: Lenis + GSAP ticker, R3F advance, Stage, gpu-tier, SequencePlayer, T0 path, greybox Hero | frontend | no long task > 50 ms on Iris Xe; tab memory < 400 MB; reduced-motion = posters; LCP = poster |
-| M6 | Real-time scenes (Stack, exploded Skills, PCB shader, Contact LED), tiered postfx, matched-camera handoffs, project View Transitions | frontend | T2 ≥ 55 fps; T1 mounts no R3F; handoff invisible at normal scroll |
-| M7 | Final lookdev + renders (EEVEE; Cycles CPU overnight only if hero needs it), portrait variants, real content EN/RO via admin | user + frontend | all shots in manifest; budgets pass; no fallback badges |
+| M4 | Dropped 2026-09-24 (no Blender): the stack is built procedurally in M5 | — | — |
+| M5 | Motion core: Lenis + GSAP ticker, R3F advance, Stage, gpu-tier, procedural StackScene, poster capture, T0 path, real-time Hero (S1) | frontend + devops + tester | no long task > 50 ms on Iris Xe; tab memory < 400 MB; reduced-motion = posters; LCP = poster |
+| M6 | Real-time scenes (exploded Skills S2, PCB shader, Contact S3 + LED), tiered postfx, project View Transitions | frontend | T2 ≥ 55 fps; T1 light scene ≥ 55 fps or posters; poster → canvas handoff invisible |
+| M7 | Final lookdev (materials, lighting, camera polish; optional artist glb), posters recaptured, real content EN/RO via admin | user + frontend | posters current; budgets pass; no fallback badges |
 | M8 | Hardening: LHCI, a11y audit, security headers/CSP, OG images, analytics, error boundaries, dep audit | tester + security + frontend | LHCI mobile perf ≥ 90, a11y 100, SEO 100, BP ≥ 95; 0 high findings |
 | M9 | Production: domain, Resend DNS (SPF/DKIM/DMARC), Neon prod branch, Vercel prod env, smoke tests | devops | prod smoke e2e green; real-domain email delivered; immutable cache headers on assets |
 
-Specialists: frontend-engineer (M1, M5, M6, M7, M8 fixes) · backend-engineer (M2, M3) · devops-engineer (M0, M4, CI, M9) · tester (harness from M0, gate of every milestone, visual baselines from M5, LHCI) · code-reviewer (every milestone; M5 dispose/bitmap.close/worker lifecycle) · security-auditor (M2 authz, M3 abuse/header injection, M8 CSP, Blender MCP risk, M9 pre-launch).
+Specialists: frontend-engineer (M1, M5, M6, M7, M8 fixes) · backend-engineer (M2, M3) · devops-engineer (M0, M4, CI, M9) · tester (harness from M0, gate of every milestone, visual baselines from M5, LHCI) · code-reviewer (every milestone; M5 dispose/WebGL lifecycle) · security-auditor (M2 authz, M3 abuse/header injection, M8 CSP, M9 pre-launch).
 
 ## 8. Risks
 | Risk | Mitigation |
 |---|---|
-| iGPU render time / Intel Vulkan bugs | EEVEE + `--gpu-backend opengl`, iterate at 50% res / 16 samples, resumable frame ranges, AC power + `powerprofilesctl set performance` |
-| Blender learning curve | greybox first with three primitives (same names + camera clip); MCP work captured into `blender/scripts/*.py` |
+| iGPU real-time cost | tiers, DPR cap, render only on change, frame monitor → lower tier → posters |
 | **Vercel-only hosting limits** | Hobby Fast Data Transfer ~100 GB/mo ≈ 3–4k full desktop visits; deploy size cap → `public` media ≤ 80 MB budget; only current asset version kept; `NEXT_PUBLIC_ASSET_BASE` allows later CDN move; Pro ($20/mo) if limits hit or site advertises paid services (Hobby non-commercial clause). Verify exact limits at M0 |
-| Mobile GPU / memory | portrait sequences, T1 no real-time, decode window ±6, DPR cap, dispose, context-loss fallback |
+| Mobile GPU / memory | portrait cameras, T1 light scene, DPR cap, dispose, context-loss fallback |
 | Safari quirks | size canvas once to `lvh` (WebKit 219780 leak), pre-sized variants, no WebGPU, real iOS test before M8 |
-| Plate vs real-time mismatch | AgX both sides, plates outside composer, baked lightmaps, Macbeth compare |
+| Poster vs real-time mismatch | posters captured from the same scene, camera and crop; stale-poster unit test |
 | Dependency churn | exact pins, React 19.3.x, Biome not ESLint, Renovate weekly grouped |
-| Blender MCP runs arbitrary Python | localhost, safe mode, no secrets in Blender env, save before session |
 | Neon cold start | public pages cached; DB hit only by admin/revalidation |
 
 ## 9. Verification (end-to-end)
-- Unit (Vitest): frame-index math, pass scheduler, LRU, tier classifier, zod schemas, locale fallback, rate limiter, PGlite query tests.
+- Unit (Vitest): camera keyframes, cover crop, frame monitor, tier classifier, zod schemas, locale fallback, rate limiter, PGlite query tests.
 - E2E (Playwright in `mcr.microsoft.com/playwright:v1.63.0-noble`): both locales, admin login/CRUD, contact flow (msw-mocked Resend), axe a11y, visual snapshots at scroll p = 0 / 0.5 / 1 using `?capture=1` deterministic mode.
 - Perf: LHCI budgets in CI; `pnpm perf:local` on real Iris Xe (rAF p95 ≤ 20 ms, ≥ 55 fps); `assets:check` budget script.
 - Manual: claude-in-chrome screenshots + console on real GPU each motion milestone; real iPhone/Android check before M8; prod smoke `curl -I` cache headers + Playwright against prod URL at M9.
````

```bash
/usr/bin/git apply .data/spec-amendment.diff
```

Expected: no output. (If `git apply` rejects a hunk because the spec changed on `dev` meanwhile, make the same edits by hand; the `-`/`+` lines are the exact old and new text.)

- [ ] **Step 2: Drop Git LFS**

`git-lfs` is not installed here and nothing will be tracked with it any more (posters are small plain files). Delete `.gitattributes` and the README prerequisite:

```bash
/usr/bin/git rm -q .gitattributes
```

```diff
diff --git a/README.md b/README.md
--- a/README.md
+++ b/README.md
@@ -12,8 +12,6 @@ Design spec: [`docs/superpowers/specs/2026-09-23-cinematic-cv-design.md`](docs/s
   pinned in `package.json#packageManager` (pnpm 11.27.1). Run pnpm only inside
   this repo: `/home/mihai/package.json` pins yarn for everything else under `~`.
 - Docker with Compose v2 (local Postgres)
-- git-lfs (`sudo apt install git-lfs && git lfs install`) before committing
-  anything under `public/seq/`, `public/3d/` or any `*.blend` file
 
 ## Setup
 
```

- [ ] **Step 3: Check**

Run: `grep -c 'Amendment 2026-09-24' docs/superpowers/specs/2026-09-23-cinematic-cv-design.md`
Expected: `1`.

Run: `grep -n 'SequencePlayer\|public/seq' docs/superpowers/specs/2026-09-23-cinematic-cv-design.md`
Expected: only line 22 (the amendment itself) and line 141 (`### Posters (replace the SequencePlayer, amended 2026-09-24)`).

Run: `rtk proxy pnpm lint`
Expected: `Checked 190 files in <n>ms. No fixes applied.` (Biome does not check Markdown.)

- [ ] **Step 4: Commit**

```bash
/usr/bin/git add -A docs README.md .gitattributes
/usr/bin/git status --short
/usr/bin/git commit -m "docs(spec): amend for three.js-only 3D"
```

`git status --short` shows `D  .gitattributes`, `M  README.md`, `M  docs/superpowers/specs/2026-09-23-cinematic-cv-design.md`.

---

### Task 2: Motion preference, GPU tiers and the Motion switch

**Owner:** frontend-engineer.

**Files:**
- Create: `src/experience/motion-preference.ts`, `src/experience/use-motion.ts`, `src/experience/gpu-tier.ts`, `src/experience/MotionToggle.tsx`, `tests/unit/motion-preference.test.ts`, `tests/unit/gpu-tier.test.ts`, `tests/e2e/motion.spec.ts`
- Modify: `src/components/site/SiteHeader.tsx`, `messages/en.json`, `messages/ro.json`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `motion-preference.ts`: `type MotionChoice = "on" | "off"`, `MOTION_STORAGE_KEY = "cv-motion"`, `resolveMotion({ choice, reducedMotion, saveData }): boolean`, `motionEnabled(): boolean`, `setMotionChoice(choice): void`, `subscribeMotion(listener): () => void`.
  - `use-motion.ts`: `useMotion(): boolean | null` (null until hydrated).
  - `gpu-tier.ts`: `type Tier = 0 | 1 | 2 | 3`, `type LiveTier = Exclude<Tier, 0>`, `type GpuSignals`, `classifyTier(signals): Tier`, `tierOverride(search): Tier | null`, `lowerTier(tier: LiveTier): LiveTier | null`, `readGpuSignals(): GpuSignals`.
  - `MotionToggle.tsx`: `MotionToggle({ labels: { label, on, off } })`, a `<button aria-pressed>` named "Motion" / "Animație".
  - Messages: `Motion.label`, `Motion.on`, `Motion.off`.

- [ ] **Step 1: Write the failing unit tests**

`tests/unit/motion-preference.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { resolveMotion } from "@/experience/motion-preference";

describe("resolveMotion", () => {
  it("animates by default", () => {
    expect(
      resolveMotion({ choice: null, reducedMotion: false, saveData: false }),
    ).toBe(true);
  });

  it("stops for prefers-reduced-motion and for Save-Data", () => {
    expect(
      resolveMotion({ choice: null, reducedMotion: true, saveData: false }),
    ).toBe(false);
    expect(
      resolveMotion({ choice: null, reducedMotion: false, saveData: true }),
    ).toBe(false);
  });

  it("lets the visitor's toggle override both", () => {
    expect(
      resolveMotion({ choice: "on", reducedMotion: true, saveData: true }),
    ).toBe(true);
    expect(
      resolveMotion({ choice: "off", reducedMotion: false, saveData: false }),
    ).toBe(false);
  });
});
```

`tests/unit/gpu-tier.test.ts` (renderer strings as Chrome reports them; the SwiftShader one is what headless Chromium prints here):

```ts
import { describe, expect, it } from "vitest";
import {
  classifyTier,
  type GpuSignals,
  lowerTier,
  tierOverride,
} from "@/experience/gpu-tier";

const desktop = (renderer: string): GpuSignals => ({
  webgl2: true,
  renderer,
  mobile: false,
  cores: 8,
  memoryGb: 16,
});

describe("classifyTier", () => {
  it("gives the reference laptop (Intel Iris Xe) tier 2", () => {
    expect(
      classifyTier(
        desktop(
          "ANGLE (Intel, Mesa Intel(R) Iris(R) Xe Graphics (ADL GT2), OpenGL ES 3.2)",
        ),
      ),
    ).toBe(2);
  });

  it("gives discrete and pro GPUs tier 3", () => {
    expect(
      classifyTier(
        desktop("ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11)"),
      ),
    ).toBe(3);
    expect(
      classifyTier(
        desktop(
          "ANGLE (Apple, ANGLE Metal Renderer: Apple M3 Pro, Unspecified Version)",
        ),
      ),
    ).toBe(3);
  });

  it("gives an Apple M1 and older Intel graphics their own tiers", () => {
    expect(
      classifyTier(
        desktop(
          "ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)",
        ),
      ),
    ).toBe(2);
    expect(
      classifyTier(
        desktop(
          "ANGLE (Intel, Mesa Intel(R) UHD Graphics 620 (KBL GT2), OpenGL 4.6)",
        ),
      ),
    ).toBe(1);
  });

  it("puts software renderers and missing WebGL 2 on posters (tier 0)", () => {
    expect(
      classifyTier(
        desktop(
          "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)",
        ),
      ),
    ).toBe(0);
    expect(classifyTier(desktop("llvmpipe (LLVM 19.1.1, 256 bits)"))).toBe(0);
    expect(classifyTier({ ...desktop(""), webgl2: false })).toBe(0);
  });

  it("gives low-end phones tier 1 and recent phones tier 2", () => {
    const phone = (renderer: string, cores = 8, memoryGb = 8): GpuSignals => ({
      webgl2: true,
      renderer,
      mobile: true,
      cores,
      memoryGb,
    });
    expect(classifyTier(phone("Mali-G52 MC2"))).toBe(1);
    expect(classifyTier(phone("Adreno (TM) 610"))).toBe(2);
    expect(classifyTier(phone("Adreno (TM) 506"))).toBe(1);
    expect(classifyTier(phone("Apple GPU", 6, 4))).toBe(1);
    expect(classifyTier(phone("Apple GPU", 6, 8))).toBe(2);
    // A phone never gets tier 3, whatever it reports.
    expect(classifyTier(phone("NVIDIA Tegra X1"))).toBe(2);
  });
});

describe("tierOverride", () => {
  it("reads ?tier=0..3 and ignores anything else", () => {
    expect(tierOverride("?tier=2")).toBe(2);
    expect(tierOverride("?capture=hero&tier=0")).toBe(0);
    expect(tierOverride("?tier=4")).toBeNull();
    expect(tierOverride("?tier=high")).toBeNull();
    expect(tierOverride("")).toBeNull();
  });
});

describe("lowerTier", () => {
  it("steps down one tier and gives up below tier 1", () => {
    expect(lowerTier(3)).toBe(2);
    expect(lowerTier(2)).toBe(1);
    expect(lowerTier(1)).toBeNull();
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `rtk proxy pnpm exec vitest run tests/unit/motion-preference.test.ts tests/unit/gpu-tier.test.ts`
Expected: `Test Files  2 failed (2)`, with `Error: Cannot find package '@/experience/gpu-tier' imported from …/tests/unit/gpu-tier.test.ts` (and the same for `@/experience/motion-preference`).

- [ ] **Step 3: Write the failing e2e test**

`tests/e2e/motion.spec.ts` (Task 5 extends it once the stage exists):

```ts
import { expect, test } from "@playwright/test";

test("the Motion switch is on by default and remembers being turned off", async ({
  page,
}) => {
  await page.goto("/en");
  const motion = page
    .getByRole("banner")
    .getByRole("button", { name: "Motion" });

  await expect(motion).toHaveAttribute("aria-pressed", "true");

  await motion.click();
  await expect(motion).toHaveAttribute("aria-pressed", "false");

  await page.reload();
  await expect(motion).toHaveAttribute("aria-pressed", "false");
});

test("the Motion switch is translated", async ({ page }) => {
  await page.goto("/ro");

  await expect(
    page.getByRole("banner").getByRole("button", { name: "Animație" }),
  ).toBeVisible();
});

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("starts with motion off, and the visitor can turn it on", async ({
    page,
  }) => {
    await page.goto("/en");
    const motion = page
      .getByRole("banner")
      .getByRole("button", { name: "Motion" });

    await expect(motion).toHaveAttribute("aria-pressed", "false");
    await motion.click();
    await expect(motion).toHaveAttribute("aria-pressed", "true");
  });
});
```

Run: `pnpm test:e2e tests/e2e/motion.spec.ts`
Expected: `3 failed`, each with `Error: element(s) not found`.

- [ ] **Step 4: Implement the preference, the hook and the tiers**

`src/experience/motion-preference.ts`:

```ts
/**
 * Whether the site may animate: the visitor's "Motion" toggle wins, then
 * prefers-reduced-motion and Save-Data (both mean "posters only", tier 0).
 * Loaded before the 3D chunk, so it stays tiny and dependency-free.
 */
export type MotionChoice = "on" | "off";

export const MOTION_STORAGE_KEY = "cv-motion";

export function resolveMotion(input: {
  choice: MotionChoice | null;
  reducedMotion: boolean;
  saveData: boolean;
}): boolean {
  if (input.choice !== null) {
    return input.choice === "on";
  }
  return !input.reducedMotion && !input.saveData;
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const listeners = new Set<() => void>();
/** undefined = storage not read yet. */
let choice: MotionChoice | null | undefined;

function currentChoice(): MotionChoice | null {
  if (choice === undefined) {
    try {
      const stored = localStorage.getItem(MOTION_STORAGE_KEY);
      choice = stored === "on" || stored === "off" ? stored : null;
    } catch {
      choice = null;
    }
  }
  return choice;
}

/** useSyncExternalStore snapshot: a boolean, so it is stable between calls. */
export function motionEnabled(): boolean {
  const connection = (
    navigator as Navigator & { connection?: { saveData?: boolean } }
  ).connection;
  return resolveMotion({
    choice: currentChoice(),
    reducedMotion: matchMedia(REDUCED_MOTION).matches,
    saveData: connection?.saveData === true,
  });
}

export function setMotionChoice(next: MotionChoice): void {
  choice = next;
  try {
    localStorage.setItem(MOTION_STORAGE_KEY, next);
  } catch {
    // Storage blocked (private mode): the choice lasts until the next load.
  }
  for (const listener of listeners) {
    listener();
  }
}

/** useSyncExternalStore subscription: the toggle and the OS setting. */
export function subscribeMotion(listener: () => void): () => void {
  const query = matchMedia(REDUCED_MOTION);
  listeners.add(listener);
  query.addEventListener("change", listener);
  return () => {
    listeners.delete(listener);
    query.removeEventListener("change", listener);
  };
}
```

`src/experience/use-motion.ts` (no `useSyncExternalStore`: during hydration it would report the server snapshot and let effects act on a guess):

```ts
import { useEffect, useState } from "react";
import { motionEnabled, subscribeMotion } from "./motion-preference";

/**
 * The motion preference, or null before hydration has finished: the server
 * cannot know it, and effects must not act on a guess.
 */
export function useMotion(): boolean | null {
  const [motion, setMotion] = useState<boolean | null>(null);

  useEffect(() => {
    const update = () => setMotion(motionEnabled());
    update();
    return subscribeMotion(update);
  }, []);

  return motion;
}
```

`src/experience/gpu-tier.ts`:

```ts
/**
 * GPU tiers (spec §3, amended 2026-09-24 for the three.js-only pipeline):
 * - 0: posters and CSS only (no WebGL 2, or a software renderer)
 * - 1: light live scene (DPR 1, no transmission, no postfx)
 * - 2: reference (Intel Iris Xe, Apple M1, recent phones): DPR <= 1.5, postfx
 * - 3: discrete or pro GPUs: DPR <= 2
 * Reduced motion, Save-Data and the "Motion" toggle are handled before this
 * (src/experience/motion-preference.ts); they never reach the classifier.
 */
export type Tier = 0 | 1 | 2 | 3;

/** A tier that renders the live stage. */
export type LiveTier = Exclude<Tier, 0>;

export type GpuSignals = {
  webgl2: boolean;
  /** Unmasked WebGL renderer string, or the masked one when unavailable. */
  renderer: string;
  /** Coarse primary pointer (phones, tablets). */
  mobile: boolean;
  cores: number;
  /** navigator.deviceMemory (Chromium only), in GB. */
  memoryGb?: number;
};

const SOFTWARE = /swiftshader|llvmpipe|softpipe|software|basic render/i;
const STRONG =
  /nvidia|geforce|quadro|\brtx\b|radeon (rx|pro)|apple m\d+ (pro|max|ultra)/i;
const WEAK =
  /mali-(t\d+|g[0-5]\d)\b|adreno \(tm\) [1-5]\d\d\b|powervr|intel\(r\) (hd|uhd) graphics/i;

export function classifyTier(signals: GpuSignals): Tier {
  if (!signals.webgl2 || SOFTWARE.test(signals.renderer)) {
    return 0;
  }
  if (WEAK.test(signals.renderer)) {
    return 1;
  }
  if (signals.mobile && (signals.cores <= 4 || (signals.memoryGb ?? 8) <= 4)) {
    return 1;
  }
  if (!signals.mobile && STRONG.test(signals.renderer)) {
    return 3;
  }
  return 2;
}

/** `?tier=0..3` forces a tier (tests, poster capture, manual checks). */
export function tierOverride(search: string): Tier | null {
  const value = new URLSearchParams(search).get("tier");
  return value === "0" || value === "1" || value === "2" || value === "3"
    ? (Number(value) as Tier)
    : null;
}

/** One tier lower for a runtime downgrade; null = give up on live 3D. */
export function lowerTier(tier: LiveTier): LiveTier | null {
  return tier > 1 ? ((tier - 1) as LiveTier) : null;
}

/** Reads the signals from a throwaway WebGL 2 context (browser only). */
export function readGpuSignals(): GpuSignals {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2");
  let renderer = "";
  if (gl) {
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    renderer = String(
      gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
    );
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    webgl2: gl !== null,
    renderer,
    mobile: matchMedia("(pointer: coarse)").matches,
    cores: nav.hardwareConcurrency || 4,
    memoryGb: nav.deviceMemory,
  };
}
```

- [ ] **Step 5: Add the switch to the header**

`src/experience/MotionToggle.tsx` (labels come from the server, so next-intl stays out of the client bundle; below `sm` the word "Motion" is screen-reader-only, which keeps a 320 px header from overflowing):

```tsx
"use client";

import { setMotionChoice } from "./motion-preference";
import { useMotion } from "./use-motion";

export type MotionToggleLabels = { label: string; on: string; off: string };

/**
 * Visible "Motion" switch. Off = posters only (tier 0): no smooth scrolling,
 * no pinned hero, no 3D. The choice is kept in localStorage.
 */
export function MotionToggle({ labels }: { labels: MotionToggleLabels }) {
  // Before hydration the state is unknown: render "off" (no motion yet).
  const on = useMotion() === true;

  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => setMotionChoice(on ? "off" : "on")}
      className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-2 text-sm text-ink-muted ring-1 ring-line transition-colors hover:text-ink"
    >
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full ${on ? "bg-signal" : "bg-line-strong"}`}
      />
      <span className="max-sm:sr-only">{labels.label}</span>
      <span aria-hidden="true" className="font-mono text-label uppercase">
        {on ? labels.on : labels.off}
      </span>
    </button>
  );
}
```

`src/components/site/SiteHeader.tsx` (`flex-wrap` lets the controls drop to a second row on a 320 px phone):

```tsx
import { useTranslations } from "next-intl";
import type { Cv } from "@/content/types";
import { MotionToggle } from "@/experience/MotionToggle";
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
  const motion = useTranslations("Motion");

  return (
    <header
      id="top"
      className="mx-auto flex w-full max-w-content flex-wrap items-center justify-between gap-3 px-gutter pt-6"
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
      <div className="flex items-center gap-2">
        <MotionToggle
          labels={{
            label: motion("label"),
            on: motion("on"),
            off: motion("off"),
          }}
        />
        <LocaleSwitcher locale={cv.locale} />
      </div>
    </header>
  );
}
```

Add the strings after `LocaleSwitcher` in both message files:

```diff
diff --git a/messages/en.json b/messages/en.json
--- a/messages/en.json
+++ b/messages/en.json
@@ -16,6 +16,11 @@
     "en": "English",
     "ro": "Română"
   },
+  "Motion": {
+    "label": "Motion",
+    "on": "On",
+    "off": "Off"
+  },
   "Availability": {
     "open": "Open to new projects",
     "closed": "Not taking new projects"
```

```diff
diff --git a/messages/ro.json b/messages/ro.json
--- a/messages/ro.json
+++ b/messages/ro.json
@@ -16,6 +16,11 @@
     "en": "English",
     "ro": "Română"
   },
+  "Motion": {
+    "label": "Animație",
+    "on": "Pornită",
+    "off": "Oprită"
+  },
   "Availability": {
     "open": "Disponibil pentru proiecte noi",
     "closed": "Nu preiau proiecte noi"
```

- [ ] **Step 6: Run everything**

Run: `rtk proxy pnpm exec vitest run tests/unit/motion-preference.test.ts tests/unit/gpu-tier.test.ts`
Expected: `Test Files  2 passed (2)`, `Tests  10 passed (10)`.

Run: `rtk proxy pnpm test`
Expected: `Test Files  26 passed (26)`, `Tests  200 passed (200)` (`messages.test.ts` confirms EN and RO have the same keys).

Run: `pnpm typecheck`
Expected: `✓ Types generated successfully`, exit 0.

Run: `rtk proxy pnpm lint`
Expected: `Checked 197 files in <n>ms. No fixes applied.`

Run: `pnpm test:e2e`
Expected: `75 passed` (72 + 3). The existing `has no horizontal overflow on a 320px phone` and the axe tests cover the new button.

- [ ] **Step 7: Commit**

```bash
/usr/bin/git add messages src tests
/usr/bin/git status --short
/usr/bin/git diff --cached | grep -cF "$(grep ^ADMIN_EMAIL= .env.local | cut -d= -f2)"
/usr/bin/git commit -m "feat(motion): add motion switch and gpu tiers"
```

The `grep -c` line must print `0`.

---

### Task 3: The procedural stack model

**Owner:** frontend-engineer.

**Files:**
- Create: `src/experience/scenes/stack-layout.ts`, `src/experience/scenes/pcb-traces.ts`, `src/experience/scenes/textures.ts`, `src/experience/scenes/materials.ts`, `src/experience/scenes/StackModel.tsx`, `src/experience/scenes/StudioLights.tsx`, `tests/unit/stack-model.test.ts`
- Modify: `package.json`, `pnpm-lock.yaml`

**Interfaces:**
- Consumes: `Tier` (Task 2); `STACK_LAYERS`, `StackLayer` (`src/content/types.ts`, the DB's `stack_layer` enum).
- Produces:
  - `stack-layout.ts`: `STACK_OBJECTS` (`engraveHero`, `engraveContact`, `led`, `pcbTraces` → contract names), `layerObjectName(layer)`, `STACK_FOOTPRINT` 0.4, `STACK_HEIGHT` 0.25, `STACK_GAP` 0.005, `LAYER_HEIGHT`, `stackLayout(explode = 0): LayerPlacement[]` (bottom-up; `explode` is for M6's S2).
  - `pcb-traces.ts`: `PCB_TRACE_PATH`, `traceRibbon(path, width): { positions, uvs, indices }` (U runs 0 → 1 along the trace).
  - `textures.ts`: `ENGRAVE_HERO_TEXT` (placeholder `["Mihai Dorobat", "Full-stack Engineer"]`), `ENGRAVE_CONTACT_TEXT`, `etchingTexture(lines)`, `pcbTexture()`.
  - `materials.ts`: `createStackMaterials(tier, { pcb, etchHero, etchContact }): StackMaterials`, `disposeMaterials()`.
  - `StackModel.tsx`: `StackModel({ tier })`, the seam. `StudioLights.tsx`: `StudioLights()` (background, PMREM environment, contact shadow).

- [ ] **Step 1: Install three and React Three Fiber**

```bash
pnpm add -E three@0.186.0 @react-three/fiber@9.8.0
pnpm add -E -D @types/three@0.186.0
```

Expected: `+ @react-three/fiber 9.8.0`, `+ three 0.186.0`, then `+ @types/three 0.186.0`, each `Done in <n>s using pnpm v11.27.1`; `git status --short` shows only `package.json` and `pnpm-lock.yaml`.

- [ ] **Step 2: Write the failing test**

`tests/unit/stack-model.test.ts` (materials are built in Node with plain `Texture`s; the canvas-drawn ones need a DOM and are exercised by the e2e tests of Task 5):

```ts
import { Texture } from "three";
import { describe, expect, it } from "vitest";
import { STACK_LAYERS } from "@/content/types";
import { createStackMaterials } from "@/experience/scenes/materials";
import { PCB_TRACE_PATH, traceRibbon } from "@/experience/scenes/pcb-traces";
import {
  LAYER_HEIGHT,
  STACK_GAP,
  STACK_HEIGHT,
  STACK_OBJECTS,
  stackLayout,
} from "@/experience/scenes/stack-layout";

describe("stackLayout (asset contract v1)", () => {
  it("names the layers layer_<stack layer>, base plate first", () => {
    expect(stackLayout().map((placement) => placement.name)).toEqual([
      "layer_craft",
      "layer_infra",
      "layer_data",
      "layer_api",
      "layer_interface",
    ]);
  });

  it("stacks from the ground up to 0.25 m, origins on bottom faces", () => {
    const layout = stackLayout();
    expect(layout[0].y).toBe(0);
    for (let i = 1; i < layout.length; i += 1) {
      expect(layout[i].y).toBeCloseTo(
        layout[i - 1].y + layout[i - 1].height + STACK_GAP,
      );
    }
    const top = layout[layout.length - 1];
    expect(top.y + top.height).toBeCloseTo(STACK_HEIGHT);
  });

  it("covers every stack_layer enum value exactly once", () => {
    expect(Object.keys(LAYER_HEIGHT).sort()).toEqual([...STACK_LAYERS].sort());
  });

  it("opens gaps between the layers when exploded, never below ground", () => {
    const closed = stackLayout(0);
    const open = stackLayout(1);
    expect(open[0].y).toBe(0);
    expect(open[4].y).toBeGreaterThan(closed[4].y + 0.4);
  });

  it("keeps the contract names of the extra objects", () => {
    expect(STACK_OBJECTS).toEqual({
      engraveHero: "engrave_hero",
      engraveContact: "engrave_contact",
      led: "led_status",
      pcbTraces: "pcb_traces",
    });
  });
});

describe("traceRibbon (pcb_traces)", () => {
  const ribbon = traceRibbon(PCB_TRACE_PATH, 0.004);
  const us = [...ribbon.uvs].filter((_, index) => index % 2 === 0);

  it("runs U from 0 to 1 along the trace, never backwards", () => {
    expect(Math.min(...us)).toBe(0);
    expect(Math.max(...us)).toBe(1);
    for (let segment = 0; segment < PCB_TRACE_PATH.length - 1; segment += 1) {
      const [start, , end] = us.slice(segment * 4, segment * 4 + 4);
      expect(end).toBeGreaterThan(start);
      if (segment > 0) {
        expect(start).toBeCloseTo(us[(segment - 1) * 4 + 2]);
      }
    }
  });

  it("stays on the PCB's top face and faces up", () => {
    const xs = [...ribbon.positions].filter((_, index) => index % 3 === 0);
    const ys = [...ribbon.positions].filter((_, index) => index % 3 === 1);
    expect(Math.max(...xs.map(Math.abs))).toBeLessThan(0.2);
    expect(new Set(ys)).toEqual(new Set([0]));
    // First triangle: a negative (x, z) cross product means a +y normal.
    const [a, b, c] = [...ribbon.indices.slice(0, 3)].map((i) => [
      ribbon.positions[i * 3],
      ribbon.positions[i * 3 + 2],
    ]);
    const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    expect(cross).toBeLessThan(0);
  });
});

describe("createStackMaterials", () => {
  const textures = {
    pcb: new Texture(),
    etchHero: new Texture(),
    etchContact: new Texture(),
  };

  it("uses real glass (transmission) from tier 2", () => {
    const glass = createStackMaterials(2, textures).layers.interface;
    expect(glass.transmission).toBe(1);
    expect(glass.iridescence).toBe(1);
    expect(glass.transparent).toBe(false);
  });

  it("fakes the glass at tier 1 (no transmission pass)", () => {
    const glass = createStackMaterials(1, textures).layers.interface;
    expect(glass.transmission).toBe(0);
    expect(glass.transparent).toBe(true);
  });

  it("brushes the titanium and anodized base (anisotropy)", () => {
    const { layers } = createStackMaterials(2, textures);
    expect(layers.api.anisotropy).toBeGreaterThan(0);
    expect(layers.craft.anisotropy).toBeGreaterThan(0);
    expect(layers.infra.map).toBe(textures.pcb);
  });

  it("starts both etchings invisible", () => {
    const materials = createStackMaterials(2, textures);
    expect(materials.etchHero.opacity).toBe(0);
    expect(materials.etchContact.opacity).toBe(0);
  });
});
```

Run: `rtk proxy pnpm exec vitest run tests/unit/stack-model.test.ts`
Expected: FAIL with `Error: Cannot find package '@/experience/scenes/materials' imported from …/tests/unit/stack-model.test.ts`.

- [ ] **Step 3: Layout, trace and textures**

`src/experience/scenes/stack-layout.ts`:

```ts
import { STACK_LAYERS, type StackLayer } from "@/content/types";

/**
 * Asset contract v1 (docs/superpowers/specs, amendment 2026-09-24): a monolith
 * of five slabs, footprint 0.40 x 0.40 m, 0.25 m tall, base plate on the
 * ground centred on the origin, metres. Each layer's origin is the centre of
 * its own bottom face. An artist-made `stack.glb` must use the same names.
 */
export const STACK_OBJECTS = {
  engraveHero: "engrave_hero",
  engraveContact: "engrave_contact",
  led: "led_status",
  pcbTraces: "pcb_traces",
} as const;

export type LayerObjectName = `layer_${StackLayer}`;

export const layerObjectName = (layer: StackLayer): LayerObjectName =>
  `layer_${layer}`;

export const STACK_FOOTPRINT = 0.4;
export const STACK_HEIGHT = 0.25;
export const STACK_GAP = 0.005;

/** Slab heights; with four gaps they add up to STACK_HEIGHT. */
export const LAYER_HEIGHT: Record<StackLayer, number> = {
  interface: 0.05,
  api: 0.05,
  data: 0.05,
  infra: 0.035,
  craft: 0.045,
};

export type LayerPlacement = {
  layer: StackLayer;
  name: LayerObjectName;
  height: number;
  /** World y of the layer's origin (its bottom face). */
  y: number;
};

/**
 * Bottom-up placement. `explode` (0..1) opens extra space between the
 * layers for shot S2; 0 is the closed monolith.
 */
export function stackLayout(explode = 0): LayerPlacement[] {
  const spread = Math.min(1, Math.max(0, explode)) * 0.12;
  let y = 0;
  return [...STACK_LAYERS].reverse().map((layer, index) => {
    const placement: LayerPlacement = {
      layer,
      name: layerObjectName(layer),
      height: LAYER_HEIGHT[layer],
      y: y + index * spread,
    };
    y += LAYER_HEIGHT[layer] + STACK_GAP;
    return placement;
  });
}
```

`src/experience/scenes/pcb-traces.ts`:

```ts
/**
 * `pcb_traces`: one copper trace snaking over the top of `layer_infra`, in
 * timeline order (M6 moves a light pulse along it). Pure data, so the path
 * and its UVs are unit-tested without WebGL.
 */
export type Point2 = readonly [number, number];

/** Local XZ points on the PCB top face (metres, face spans +-0.2). */
export const PCB_TRACE_PATH: readonly Point2[] = [
  [-0.17, -0.16],
  [-0.06, -0.16],
  [-0.02, -0.12],
  [-0.02, -0.05],
  [0.03, 0],
  [0.15, 0],
  [0.17, 0.02],
  [0.17, 0.09],
  [0.11, 0.15],
  [-0.1, 0.15],
  [-0.15, 0.1],
  [-0.15, 0.03],
];

export type Ribbon = {
  positions: Float32Array;
  uvs: Float32Array;
  indices: Uint16Array;
};

/**
 * Flat ribbon (one quad per segment, lying in the XZ plane at y = 0) whose
 * U coordinate runs 0 -> 1 along the path length, V across its width.
 */
export function traceRibbon(path: readonly Point2[], width: number): Ribbon {
  const lengths = [0];
  for (let i = 1; i < path.length; i += 1) {
    const [x0, z0] = path[i - 1];
    const [x1, z1] = path[i];
    lengths.push(lengths[i - 1] + Math.hypot(x1 - x0, z1 - z0));
  }
  const total = lengths[lengths.length - 1];
  const segments = path.length - 1;
  const positions = new Float32Array(segments * 4 * 3);
  const uvs = new Float32Array(segments * 4 * 2);
  const indices = new Uint16Array(segments * 6);
  const half = width / 2;

  for (let i = 0; i < segments; i += 1) {
    const [x0, z0] = path[i];
    const [x1, z1] = path[i + 1];
    const length = Math.hypot(x1 - x0, z1 - z0);
    // Unit normal in the plane, extended by half a width at both ends so
    // consecutive quads overlap at the corners.
    const nx = -(z1 - z0) / length;
    const nz = (x1 - x0) / length;
    const ex = ((x1 - x0) / length) * half;
    const ez = ((z1 - z0) / length) * half;
    const corners = [
      [x0 - ex + nx * half, z0 - ez + nz * half],
      [x0 - ex - nx * half, z0 - ez - nz * half],
      [x1 + ex + nx * half, z1 + ez + nz * half],
      [x1 + ex - nx * half, z1 + ez - nz * half],
    ];
    const u0 = lengths[i] / total;
    const u1 = lengths[i + 1] / total;
    corners.forEach(([x, z], corner) => {
      const v = (i * 4 + corner) * 3;
      positions[v] = x;
      positions[v + 1] = 0;
      positions[v + 2] = z;
      const t = (i * 4 + corner) * 2;
      uvs[t] = corner < 2 ? u0 : u1;
      uvs[t + 1] = corner % 2 === 0 ? 1 : 0;
    });
    const base = i * 4;
    indices.set(
      [base, base + 2, base + 1, base + 1, base + 2, base + 3],
      i * 6,
    );
  }
  return { positions, uvs, indices };
}
```

`src/experience/scenes/textures.ts` (the etching uses the page's Mona Sans through `--font-mona-sans`; the PCB pattern is seeded, so every poster capture draws the same board):

```ts
import { CanvasTexture, SRGBColorSpace } from "three";

/**
 * Placeholder etching for `engrave_hero` until the owner confirms the copy.
 * Two lines: name, then role.
 */
export const ENGRAVE_HERO_TEXT = [
  "Mihai Dorobat",
  "Full-stack Engineer",
] as const;
export const ENGRAVE_CONTACT_TEXT = ["Let's build"] as const;

function canvas(width: number, height: number) {
  const element = document.createElement("canvas");
  element.width = width;
  element.height = height;
  const context = element.getContext("2d");
  if (!context) {
    throw new Error("2D canvas unavailable");
  }
  return { element, context };
}

/** The page's Mona Sans (next/font), so the etching matches the headings. */
function sansFamily(): string {
  const family = getComputedStyle(document.documentElement)
    .getPropertyValue("--font-mona-sans")
    .trim();
  return family ? `${family}, sans-serif` : "sans-serif";
}

/** White-on-transparent text for an alpha map; line 1 large, the rest small. */
export function etchingTexture(lines: readonly string[]): CanvasTexture {
  const { element, context } = canvas(2048, 512);
  const family = sansFamily();
  context.fillStyle = "#fff";
  context.textAlign = "center";
  context.textBaseline = "middle";
  const [title, ...rest] = lines;
  context.font = `600 ${rest.length ? 196 : 240}px ${family}`;
  context.letterSpacing = "-4px";
  context.fillText(title, 1024, rest.length ? 200 : 256, 1900);
  context.font = `500 76px ${family}`;
  context.letterSpacing = "18px";
  rest.forEach((line, index) => {
    context.fillText(line.toUpperCase(), 1024, 380 + index * 90, 1900);
  });
  const texture = new CanvasTexture(element);
  texture.anisotropy = 8;
  return texture;
}

/** Solder mask, copper pours, pads and silkscreen for `layer_infra`. */
export function pcbTexture(): CanvasTexture {
  const size = 1024;
  const { element, context } = canvas(size, size);
  context.fillStyle = "#0e2419";
  context.fillRect(0, 0, size, size);

  // Deterministic pseudo-random layout (same poster every capture).
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  context.lineCap = "round";
  context.lineJoin = "round";
  for (let i = 0; i < 90; i += 1) {
    let x = Math.round(random() * 32) * 32;
    let y = Math.round(random() * 32) * 32;
    context.strokeStyle = random() > 0.2 ? "#b8733f" : "#1f5a3c";
    context.lineWidth = random() > 0.7 ? 10 : 5;
    context.beginPath();
    context.moveTo(x, y);
    for (let step = 0; step < 4; step += 1) {
      const length = 32 + Math.round(random() * 6) * 32;
      const direction = Math.floor(random() * 4);
      if (direction === 0) x += length;
      else if (direction === 1) x -= length;
      else if (direction === 2) y += length;
      else {
        x += length * 0.7;
        y += length * 0.7;
      }
      context.lineTo(x, y);
    }
    context.stroke();
    context.fillStyle = "#d4a373";
    context.beginPath();
    context.arc(x, y, 9, 0, Math.PI * 2);
    context.fill();
  }
  context.fillStyle = "#cfd8d3";
  context.font = "600 34px monospace";
  context.fillText("INFRA-04  REV C", 40, size - 40);

  const texture = new CanvasTexture(element);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}
```

- [ ] **Step 4: Materials**

`src/experience/scenes/materials.ts` (glass: transmission + iridescence; titanium and the anodized base: anisotropy; ceramic: clearcoat; PCB: the canvas map; tier 1 fakes the glass without the transmission pass):

```ts
import {
  type Material,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  type Texture,
} from "three";
import type { StackLayer } from "@/content/types";
import type { Tier } from "../gpu-tier";

export type StackMaterials = {
  layers: Record<StackLayer, MeshPhysicalMaterial>;
  copper: MeshPhysicalMaterial;
  etchHero: MeshStandardMaterial;
  etchContact: MeshStandardMaterial;
  led: MeshStandardMaterial;
};

function etching(alphaMap: Texture) {
  // Frosted etching: invisible until a shot raises opacity; emissive adds
  // the glint while the softbox sweep passes over it.
  return new MeshStandardMaterial({
    color: "#f2f6fb",
    alphaMap,
    transparent: true,
    opacity: 0,
    roughness: 0.9,
    metalness: 0,
    emissive: "#e8f3ff",
    emissiveIntensity: 0,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
}

/** Tier 1 drops transmission (an extra full-scene render pass per frame). */
export function createStackMaterials(
  tier: Tier,
  textures: {
    pcb: Texture;
    etchHero: Texture;
    etchContact: Texture;
  },
): StackMaterials {
  const transmissive = tier >= 2;
  return {
    layers: {
      interface: new MeshPhysicalMaterial({
        color: "#e4f3ff",
        roughness: 0.04,
        metalness: 0,
        ior: 1.5,
        transmission: transmissive ? 1 : 0,
        thickness: 0.05,
        attenuationColor: "#bfe2ff",
        attenuationDistance: 0.6,
        transparent: !transmissive,
        opacity: transmissive ? 1 : 0.4,
        iridescence: 1,
        iridescenceIOR: 1.3,
        iridescenceThicknessRange: [140, 420],
        specularIntensity: 1,
      }),
      api: new MeshPhysicalMaterial({
        color: "#c9ced6",
        metalness: 1,
        roughness: 0.3,
        anisotropy: 0.9,
        anisotropyRotation: Math.PI / 2,
      }),
      data: new MeshPhysicalMaterial({
        color: "#e6e1d6",
        metalness: 0,
        roughness: 0.45,
        clearcoat: 0.8,
        clearcoatRoughness: 0.14,
      }),
      infra: new MeshPhysicalMaterial({
        map: textures.pcb,
        metalness: 0.15,
        roughness: 0.55,
        clearcoat: 0.4,
        clearcoatRoughness: 0.3,
      }),
      craft: new MeshPhysicalMaterial({
        color: "#6f7a8c",
        metalness: 1,
        roughness: 0.4,
        anisotropy: 0.45,
        clearcoat: 0.25,
        clearcoatRoughness: 0.2,
      }),
    },
    copper: new MeshPhysicalMaterial({
      color: "#c27a46",
      metalness: 1,
      roughness: 0.26,
      emissive: "#ff9d5c",
      emissiveIntensity: 0,
    }),
    etchHero: etching(textures.etchHero),
    etchContact: etching(textures.etchContact),
    led: new MeshStandardMaterial({
      color: "#0a1720",
      emissive: "#7cc5ff",
      emissiveIntensity: 0.8,
      roughness: 0.3,
    }),
  };
}

export function disposeMaterials(materials: StackMaterials): void {
  const all: Material[] = [
    ...Object.values(materials.layers),
    materials.copper,
    materials.etchHero,
    materials.etchContact,
    materials.led,
  ];
  for (const material of all) {
    material.dispose();
  }
}
```

- [ ] **Step 5: The model and the studio**

`src/experience/scenes/StackModel.tsx`:

```tsx
import { useEffect, useMemo } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  PlaneGeometry,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { StackLayer } from "@/content/types";
import type { Tier } from "../gpu-tier";
import { createStackMaterials, disposeMaterials } from "./materials";
import { PCB_TRACE_PATH, traceRibbon } from "./pcb-traces";
import {
  LAYER_HEIGHT,
  STACK_FOOTPRINT,
  STACK_OBJECTS,
  stackLayout,
} from "./stack-layout";
import {
  ENGRAVE_CONTACT_TEXT,
  ENGRAVE_HERO_TEXT,
  etchingTexture,
  pcbTexture,
} from "./textures";

/**
 * The seam between the director and the model. Shots only look objects up by
 * their asset-contract names (`scene.getObjectByName("engrave_hero")`), so an
 * artist-made `stack.glb` with the same names can replace ProceduralStack
 * without touching the director.
 */
export function StackModel({ tier }: { tier: Tier }) {
  return <ProceduralStack tier={tier} />;
}

const HALF = STACK_FOOTPRINT / 2;
const SURFACE = 0.0008;

function createGeometries() {
  const layers = Object.fromEntries(
    Object.entries(LAYER_HEIGHT).map(([layer, height]) => [
      layer,
      new RoundedBoxGeometry(
        STACK_FOOTPRINT,
        height,
        STACK_FOOTPRINT,
        4,
        layer === "interface" ? 0.008 : 0.005,
      ).translate(0, height / 2, 0),
    ]),
  ) as Record<StackLayer, RoundedBoxGeometry>;

  const ribbon = traceRibbon(PCB_TRACE_PATH, 0.004);
  const traces = new BufferGeometry();
  traces.setAttribute("position", new BufferAttribute(ribbon.positions, 3));
  traces.setAttribute("uv", new BufferAttribute(ribbon.uvs, 2));
  traces.setIndex(new BufferAttribute(ribbon.indices, 1));
  traces.computeVertexNormals();

  return {
    layers,
    traces,
    etchHero: new PlaneGeometry(0.34, 0.085).rotateX(-Math.PI / 2),
    etchContact: new PlaneGeometry(0.16, 0.04),
    led: new CylinderGeometry(0.0035, 0.0035, 0.002, 24).rotateX(Math.PI / 2),
  };
}

function ProceduralStack({ tier }: { tier: Tier }) {
  const geometries = useMemo(createGeometries, []);
  const textures = useMemo(
    () => ({
      pcb: pcbTexture(),
      etchHero: etchingTexture(ENGRAVE_HERO_TEXT),
      etchContact: etchingTexture(ENGRAVE_CONTACT_TEXT),
    }),
    [],
  );
  const materials = useMemo(
    () => createStackMaterials(tier, textures),
    [tier, textures],
  );

  useEffect(() => () => disposeMaterials(materials), [materials]);
  useEffect(
    () => () => {
      for (const texture of Object.values(textures)) texture.dispose();
      for (const geometry of Object.values(geometries.layers))
        geometry.dispose();
      geometries.traces.dispose();
      geometries.etchHero.dispose();
      geometries.etchContact.dispose();
      geometries.led.dispose();
    },
    [geometries, textures],
  );

  return (
    <group name="stack">
      {stackLayout().map(({ layer, name, height, y }) => (
        <mesh
          key={name}
          name={name}
          position-y={y}
          geometry={geometries.layers[layer]}
          material={materials.layers[layer]}
        >
          {layer === "interface" ? (
            <mesh
              name={STACK_OBJECTS.engraveHero}
              position={[0, height + SURFACE, 0.035]}
              geometry={geometries.etchHero}
              material={materials.etchHero}
              renderOrder={1}
            />
          ) : null}
          {layer === "infra" ? (
            <mesh
              name={STACK_OBJECTS.pcbTraces}
              position-y={height + SURFACE}
              geometry={geometries.traces}
              material={materials.copper}
            />
          ) : null}
          {layer === "craft" ? (
            <>
              <mesh
                name={STACK_OBJECTS.engraveContact}
                position={[0.06, height / 2, HALF + SURFACE]}
                geometry={geometries.etchContact}
                material={materials.etchContact}
                renderOrder={1}
              />
              <mesh
                name={STACK_OBJECTS.led}
                position={[-0.165, height / 2, HALF + 0.001]}
                geometry={geometries.led}
                material={materials.led}
              />
            </>
          ) : null}
        </mesh>
      ))}
    </group>
  );
}
```

`src/experience/scenes/StudioLights.tsx` (drei's `Environment` would pull three HDR loaders into the chunk, and `ContactShadows` 48 KB gz; this bakes the same softbox look once with `PMREMGenerator.fromScene`, and the shadow is a blurred canvas square):

```tsx
import { useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import {
  CanvasTexture,
  Color,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
} from "three";

type Softbox = {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number];
  intensity: number;
  color?: string;
};

/**
 * Softboxes of a dark studio, drawn the way drei's Lightformer draws them:
 * unlit planes brighter than 1 that only exist inside the environment map.
 */
const SOFTBOXES: Softbox[] = [
  // Overhead
  {
    position: [0, 3, 0.6],
    rotation: [Math.PI / 2, 0, 0],
    scale: [3.2, 1.6],
    intensity: 2.2,
  },
  // Key strip, front left: the one the sweep drags across
  {
    position: [-2.4, 1.1, 2.2],
    rotation: [0, Math.PI / 4, 0],
    scale: [0.7, 3.6],
    intensity: 5,
  },
  // Cool rim, back right
  {
    position: [2.6, 0.8, -1.6],
    rotation: [0, -Math.PI / 1.6, 0],
    scale: [0.5, 3],
    intensity: 2.4,
    color: "#cfe6ff",
  },
  // Floor bounce
  {
    position: [0, -2, 0],
    rotation: [-Math.PI / 2, 0, 0],
    scale: [10, 10],
    intensity: 0.25,
  },
  // Dim wall behind the camera, so brushed metal never reflects pure black
  {
    position: [0, 0.5, 4],
    rotation: [0, Math.PI, 0],
    scale: [10, 6],
    intensity: 0.6,
  },
];

function studioScene(): Scene {
  const studio = new Scene();
  const plane = new PlaneGeometry(1, 1);
  for (const box of SOFTBOXES) {
    const mesh = new Mesh(
      plane,
      new MeshBasicMaterial({
        color: new Color(box.color ?? "#ffffff").multiplyScalar(box.intensity),
        side: DoubleSide,
        toneMapped: false,
      }),
    );
    mesh.position.set(...box.position);
    mesh.rotation.set(...box.rotation);
    mesh.scale.set(box.scale[0], box.scale[1], 1);
    studio.add(mesh);
  }
  return studio;
}

/** Soft square falloff, baked once: the monolith's contact shadow. */
function shadowTexture(): CanvasTexture {
  const size = 256;
  const element = document.createElement("canvas");
  element.width = size;
  element.height = size;
  const context = element.getContext("2d");
  if (context) {
    context.filter = "blur(18px)";
    context.fillStyle = "#fff";
    context.fillRect(size * 0.22, size * 0.22, size * 0.56, size * 0.56);
  }
  return new CanvasTexture(element);
}

/**
 * Studio lighting without an HDRI: the softbox scene is rendered once into a
 * PMREM environment map (like three's RoomEnvironment). Shots rotate it
 * (`scene.environmentRotation`) to sweep the reflections.
 */
export function StudioLights() {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const shadow = useMemo(shadowTexture, []);

  useEffect(() => () => shadow.dispose(), [shadow]);

  useEffect(() => {
    const studio = studioScene();
    const pmrem = new PMREMGenerator(gl);
    const target = pmrem.fromScene(studio, 0.02);
    pmrem.dispose();
    studio.traverse((object) => {
      if (object instanceof Mesh) {
        object.geometry.dispose();
        object.material.dispose();
      }
    });
    scene.environment = target.texture;
    return () => {
      scene.environment = null;
      target.dispose();
    };
  }, [gl, scene]);

  return (
    <>
      <color attach="background" args={["#0b0c0f"]} />
      <mesh rotation-x={-Math.PI / 2} position-y={0.0002} renderOrder={-1}>
        <planeGeometry args={[0.62, 0.62]} />
        <meshBasicMaterial
          color="#000000"
          alphaMap={shadow}
          transparent
          opacity={0.85}
          depthWrite={false}
        />
      </mesh>
    </>
  );
}
```

- [ ] **Step 6: Run everything**

Run: `rtk proxy pnpm exec vitest run tests/unit/stack-model.test.ts`
Expected: `Test Files  1 passed (1)`, `Tests  11 passed (11)`.

Run: `rtk proxy pnpm test`
Expected: `Test Files  27 passed (27)`, `Tests  211 passed (211)`.

Run: `pnpm typecheck`
Expected: exit 0.

Run: `rtk proxy pnpm lint`
Expected: `Checked 204 files in <n>ms. No fixes applied.`

Nothing imports the model yet, so the build and e2e are unchanged; Task 5 renders it.

- [ ] **Step 7: Commit**

```bash
/usr/bin/git add package.json pnpm-lock.yaml src tests
/usr/bin/git status --short
/usr/bin/git commit -m "feat(stage): add procedural stack model"
```

---

### Task 4: Director math: scroll store, frame monitor, framing and the hero shot

**Owner:** frontend-engineer.

**Files:**
- Create: `src/experience/scene-ids.ts`, `src/experience/capture-mode.ts`, `src/experience/director/store.ts`, `src/experience/director/frame-monitor.ts`, `src/experience/director/framing.ts`, `src/experience/director/shots.ts`, `tests/unit/capture-mode.test.ts`, `tests/unit/stage-store.test.ts`, `tests/unit/frame-monitor.test.ts`, `tests/unit/framing.test.ts`, `tests/unit/shots.test.ts`
- Modify: `package.json`, `pnpm-lock.yaml`

**Interfaces:**
- Consumes: `SceneId` (`src/components/ui/Section.tsx`).
- Produces:
  - `scene-ids.ts`: `SCENE_IDS` (dependency-free, safe for the pre-3D bundle).
  - `capture-mode.ts`: `type Capture = { scene: SceneId; progress: number }`, `captureFromSearch(search): Capture | null`.
  - `store.ts`: `createStageStore()` → zustand vanilla store with `progress: Record<SceneId, number>`, `active: SceneId`, `opacity`, `dirty`, `setProgress`, `setOpacity`, `setActive`, `invalidate`, `consume(): boolean`; `type StageStore`.
  - `frame-monitor.ts`: `createFrameMonitor({ budgetMs = 25, samples = 45 })` → `{ tick(now, rendered): "decline" | null }`.
  - `framing.ts`: `type Orientation`, `REFERENCE_SIZE` (landscape 1920×1080, portrait 828×1792), `orientationOf(w, h)`, `coverViewOffset(w, h, referenceAspect): ViewOffset`.
  - `shots.ts`: `type Vec3`, `type CameraKey`, `clamp01`, `smoothstep`, `sampleCameraKeys(keys, p)`, `HERO_KEYS`, `type HeroFrame`, `heroFrame(p, orientation)`.

- [ ] **Step 1: Install zustand**

```bash
pnpm add -E zustand@5.0.15
```

Expected: `+ zustand 5.0.15`. (R3F already depends on it; the vanilla store is imported directly, so it becomes a direct dependency.)

- [ ] **Step 2: Write the failing tests**

`tests/unit/capture-mode.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { captureFromSearch } from "@/experience/capture-mode";

describe("captureFromSearch", () => {
  it("reads the scene and progress", () => {
    expect(captureFromSearch("?capture=hero&p=0.5")).toEqual({
      scene: "hero",
      progress: 0.5,
    });
    expect(captureFromSearch("?capture=hero")).toEqual({
      scene: "hero",
      progress: 0,
    });
  });

  it("ignores unknown scenes and progress outside 0..1", () => {
    expect(captureFromSearch("")).toBeNull();
    expect(captureFromSearch("?capture=projects&p=0")).toBeNull();
    expect(captureFromSearch("?capture=hero&p=2")).toBeNull();
    expect(captureFromSearch("?capture=hero&p=-0.1")).toBeNull();
    expect(captureFromSearch("?capture=hero&p=abc")).toBeNull();
  });
});
```

`tests/unit/stage-store.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createStageStore } from "@/experience/director/store";

describe("createStageStore", () => {
  it("starts dirty, so the first frame always renders", () => {
    const store = createStageStore();

    expect(store.getState().consume()).toBe(true);
    expect(store.getState().consume()).toBe(false);
  });

  it("asks for a frame only when progress really changes", () => {
    const store = createStageStore();
    store.getState().consume();

    store.getState().setProgress("hero", 0.00005);
    expect(store.getState().consume()).toBe(false);

    store.getState().setProgress("hero", 0.4);
    expect(store.getState().progress.hero).toBe(0.4);
    expect(store.getState().consume()).toBe(true);
  });

  it("clamps progress and opacity to 0..1", () => {
    const store = createStageStore();

    store.getState().setProgress("skills", 1.7);
    store.getState().setOpacity(-0.2);

    expect(store.getState().progress.skills).toBe(1);
    expect(store.getState().opacity).toBe(0);
  });

  it("marks a frame due when the active section or the size changes", () => {
    const store = createStageStore();
    store.getState().consume();

    store.getState().setActive("hero");
    expect(store.getState().consume()).toBe(false);

    store.getState().setActive("about");
    expect(store.getState().active).toBe("about");
    expect(store.getState().consume()).toBe(true);

    store.getState().invalidate();
    expect(store.getState().consume()).toBe(true);
  });
});
```

`tests/unit/frame-monitor.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createFrameMonitor } from "@/experience/director/frame-monitor";

/** Feeds `count` back-to-back rendered ticks `interval` ms apart. */
function run(
  monitor: ReturnType<typeof createFrameMonitor>,
  start: number,
  interval: number,
  count: number,
) {
  const verdicts = [];
  for (let i = 0; i < count; i += 1) {
    verdicts.push(monitor.tick(start + i * interval, true));
  }
  return verdicts.filter((verdict) => verdict !== null);
}

describe("createFrameMonitor", () => {
  it("stays quiet at 60 fps", () => {
    const monitor = createFrameMonitor({ samples: 10 });

    expect(run(monitor, 0, 16.7, 100)).toEqual([]);
  });

  it("declines after enough back-to-back frames below 40 fps", () => {
    const monitor = createFrameMonitor({ samples: 10 });

    expect(run(monitor, 0, 40, 11)).toEqual(["decline"]);
  });

  it("ignores idle gaps between on-demand frames", () => {
    const monitor = createFrameMonitor({ samples: 10 });
    const verdicts = [];
    // Two fast frames, then nothing to draw for a while, many times over.
    for (let burst = 0; burst < 20; burst += 1) {
      const start = burst * 1000;
      verdicts.push(monitor.tick(start, true));
      verdicts.push(monitor.tick(start + 16.7, true));
      verdicts.push(monitor.tick(start + 33.4, false));
    }

    expect(verdicts.filter((verdict) => verdict !== null)).toEqual([]);
  });
});
```

`tests/unit/framing.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  coverViewOffset,
  orientationOf,
  REFERENCE_SIZE,
} from "@/experience/director/framing";

describe("orientationOf", () => {
  it("matches the CSS (orientation: portrait) rule, square included", () => {
    expect(orientationOf(1440, 900)).toBe("landscape");
    expect(orientationOf(390, 844)).toBe("portrait");
    expect(orientationOf(800, 800)).toBe("portrait");
  });
});

describe("coverViewOffset", () => {
  const wide = REFERENCE_SIZE.landscape.width / REFERENCE_SIZE.landscape.height;

  it("is the identity at the reference aspect", () => {
    expect(coverViewOffset(1920, 1080, wide)).toEqual({
      fullWidth: 1920,
      fullHeight: 1080,
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
    });
  });

  it("crops the sides of a narrower viewport, like object-fit: cover", () => {
    const view = coverViewOffset(1440, 1080, wide);

    expect(view.fullHeight).toBe(1080);
    expect(view.fullWidth).toBeCloseTo(1920);
    expect(view.x).toBeCloseTo(240);
    expect(view.y).toBe(0);
  });

  it("crops top and bottom of a wider viewport", () => {
    const view = coverViewOffset(2560, 1080, wide);

    expect(view.fullWidth).toBe(2560);
    expect(view.fullHeight).toBeCloseTo(1440);
    expect(view.y).toBeCloseTo(180);
    expect(view.x).toBe(0);
  });
});
```

`tests/unit/shots.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  HERO_KEYS,
  heroFrame,
  sampleCameraKeys,
  smoothstep,
} from "@/experience/director/shots";

const distance = (a: readonly number[], b: readonly number[]) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe("sampleCameraKeys", () => {
  for (const orientation of ["landscape", "portrait"] as const) {
    const keys = HERO_KEYS[orientation];

    it(`passes through every ${orientation} key`, () => {
      for (const key of keys) {
        const sample = sampleCameraKeys(keys, key.at);
        expect(distance(sample.position, key.position)).toBeLessThan(1e-9);
        expect(distance(sample.target, key.target)).toBeLessThan(1e-9);
      }
    });

    it(`clamps ${orientation} progress outside 0..1`, () => {
      expect(sampleCameraKeys(keys, -1)).toEqual(sampleCameraKeys(keys, 0));
      expect(sampleCameraKeys(keys, 2)).toEqual(sampleCameraKeys(keys, 1));
    });

    it(`moves the ${orientation} camera without jumps`, () => {
      let previous = sampleCameraKeys(keys, 0).position;
      for (let step = 1; step <= 1000; step += 1) {
        const next = sampleCameraKeys(keys, step / 1000).position;
        expect(distance(previous, next)).toBeLessThan(0.01);
        previous = next;
      }
    });
  }
});

describe("heroFrame", () => {
  it("hides the etching at the start and shows it at the end", () => {
    expect(heroFrame(0, "landscape").engrave).toBe(0);
    expect(heroFrame(1, "landscape").engrave).toBe(1);
  });

  it("glints only while the sweep passes over the etching", () => {
    expect(heroFrame(0.2, "landscape").glint).toBe(0);
    expect(heroFrame(0.5, "landscape").glint).toBe(1);
    expect(heroFrame(0.8, "landscape").glint).toBe(0);
  });

  it("sweeps the environment one way as progress grows", () => {
    const start = heroFrame(0, "portrait").envRotation;
    const middle = heroFrame(0.5, "portrait").envRotation;
    const end = heroFrame(1, "portrait").envRotation;

    expect(start).toBeLessThan(middle);
    expect(middle).toBeLessThan(end);
  });

  it("frames the finished monolith from further away than the macro start", () => {
    for (const orientation of ["landscape", "portrait"] as const) {
      const origin = [0, 0.125, 0];
      expect(
        distance(heroFrame(1, orientation).position, origin),
      ).toBeGreaterThan(
        2.5 * distance(heroFrame(0, orientation).position, origin),
      );
    }
  });
});

describe("smoothstep", () => {
  it("is 0 before, 1 after and 0.5 halfway", () => {
    expect(smoothstep(0.2, 0.4, 0.1)).toBe(0);
    expect(smoothstep(0.2, 0.4, 0.5)).toBe(1);
    expect(smoothstep(0.2, 0.4, 0.3)).toBeCloseTo(0.5);
  });
});
```

- [ ] **Step 3: Run them to see them fail**

Run: `rtk proxy pnpm exec vitest run tests/unit/capture-mode.test.ts tests/unit/stage-store.test.ts tests/unit/frame-monitor.test.ts tests/unit/framing.test.ts tests/unit/shots.test.ts`
Expected: `Test Files  5 failed (5)`, one `Error: Cannot find package '@/experience/…'` per file (`capture-mode`, `director/frame-monitor`, `director/framing`, `director/shots`, `director/store`).

- [ ] **Step 4: Implement**

`src/experience/scene-ids.ts`:

```ts
import type { SceneId } from "@/components/ui/Section";

/** Every section that hosts a scene, in page order. */
export const SCENE_IDS = [
  "hero",
  "about",
  "skills",
  "experience",
  "contact",
] as const satisfies readonly SceneId[];
```

`src/experience/capture-mode.ts`:

```ts
import type { SceneId } from "@/components/ui/Section";
import { SCENE_IDS } from "./scene-ids";

/**
 * `?capture=<scene>&p=<0..1>`: deterministic poster capture (scripts/posters.ts).
 * The page hides its DOM, skips Lenis and ScrollTrigger, renders the scene at
 * the given progress and sets `data-canvas="captured"` on <html>.
 */
export type Capture = { scene: SceneId; progress: number };

export function captureFromSearch(search: string): Capture | null {
  const params = new URLSearchParams(search);
  const scene = params.get("capture");
  const progress = Number(params.get("p") ?? "0");
  if (
    !SCENE_IDS.includes(scene as SceneId) ||
    !Number.isFinite(progress) ||
    progress < 0 ||
    progress > 1
  ) {
    return null;
  }
  return { scene: scene as SceneId, progress };
}
```

`src/experience/director/store.ts`:

```ts
import { createStore } from "zustand/vanilla";
import type { SceneId } from "@/components/ui/Section";

/** Changes smaller than this do not trigger a new frame. */
const EPSILON = 1e-4;

export type StageState = {
  /** Scroll progress through each section's ScrollTrigger, 0..1. */
  progress: Record<SceneId, number>;
  /** The section crossing the middle of the viewport; picks the shot. */
  active: SceneId;
  /** Opacity of the fixed canvas layer (fades out after the hero). */
  opacity: number;
  /** Something changed since the last rendered frame. */
  dirty: boolean;
  setProgress: (scene: SceneId, value: number) => void;
  setOpacity: (value: number) => void;
  setActive: (scene: SceneId) => void;
  /** Forces a frame (resize, tier change, new textures). */
  invalidate: () => void;
  /** Returns whether a frame is due and clears the flag. */
  consume: () => boolean;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function createStageStore() {
  return createStore<StageState>()((set, get) => ({
    progress: { hero: 0, about: 0, skills: 0, experience: 0, contact: 0 },
    active: "hero",
    opacity: 1,
    dirty: true,
    setProgress: (scene, value) => {
      const next = clamp01(value);
      const { progress } = get();
      if (Math.abs(progress[scene] - next) < EPSILON) {
        return;
      }
      set({ progress: { ...progress, [scene]: next }, dirty: true });
    },
    setOpacity: (value) => {
      const next = clamp01(value);
      if (Math.abs(get().opacity - next) < EPSILON) {
        return;
      }
      set({ opacity: next, dirty: true });
    },
    setActive: (scene) => {
      if (get().active !== scene) {
        set({ active: scene, dirty: true });
      }
    },
    invalidate: () => set({ dirty: true }),
    consume: () => {
      if (!get().dirty) {
        return false;
      }
      set({ dirty: false });
      return true;
    },
  }));
}

export type StageStore = ReturnType<typeof createStageStore>;
```

`src/experience/director/frame-monitor.ts`:

```ts
/**
 * Runtime downgrade signal for on-demand rendering. drei's PerformanceMonitor
 * divides rendered frames by wall time, so the idle gaps between scroll-driven
 * frames read as a low frame rate. This monitor only measures the interval
 * between two back-to-back rendered ticks, which is what scrolling feels like.
 */
export type FrameMonitorOptions = {
  /** Mean interval above this is too slow (default 25 ms = 40 fps). */
  budgetMs?: number;
  /** Back-to-back intervals per verdict. */
  samples?: number;
};

export function createFrameMonitor({
  budgetMs = 25,
  samples = 45,
}: FrameMonitorOptions = {}) {
  let previous: number | null = null;
  let intervals: number[] = [];

  return {
    /**
     * Call once per ticker tick. Returns "decline" when the last `samples`
     * back-to-back rendered frames were too slow on average.
     */
    tick(now: number, rendered: boolean): "decline" | null {
      if (!rendered) {
        previous = null;
        return null;
      }
      if (previous !== null) {
        intervals.push(now - previous);
      }
      previous = now;
      if (intervals.length < samples) {
        return null;
      }
      const mean = intervals.reduce((sum, value) => sum + value, 0) / samples;
      intervals = [];
      return mean > budgetMs ? "decline" : null;
    },
  };
}
```

`src/experience/director/framing.ts`:

```ts
/**
 * Camera framing shared by the live canvas and the poster script. Each shot is
 * authored for a reference aspect (`cam_S1_landscape` 16:9, `cam_S1_portrait`
 * 828x1792). Any other viewport sees a centred "object-fit: cover" crop of the
 * reference frame, exactly like the poster <img>, so the poster-to-canvas
 * crossfade lines up at every size.
 */
export type Orientation = "landscape" | "portrait";

export const REFERENCE_SIZE: Record<
  Orientation,
  { width: number; height: number }
> = {
  landscape: { width: 1920, height: 1080 },
  portrait: { width: 828, height: 1792 },
};

/** Same rule as the CSS media query `(orientation: portrait)`. */
export function orientationOf(width: number, height: number): Orientation {
  return height >= width ? "portrait" : "landscape";
}

export type ViewOffset = {
  fullWidth: number;
  fullHeight: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Arguments for `PerspectiveCamera.setViewOffset` (camera.aspect must be the
 * reference aspect): the viewport becomes a centred window into a virtual
 * reference-aspect frame that covers it.
 */
export function coverViewOffset(
  width: number,
  height: number,
  referenceAspect: number,
): ViewOffset {
  if (width / height > referenceAspect) {
    const fullHeight = width / referenceAspect;
    return {
      fullWidth: width,
      fullHeight,
      x: 0,
      y: (fullHeight - height) / 2,
      width,
      height,
    };
  }
  const fullWidth = height * referenceAspect;
  return {
    fullWidth,
    fullHeight: height,
    x: (fullWidth - width) / 2,
    y: 0,
    width,
    height,
  };
}
```

`src/experience/director/shots.ts` (the keys were framed on this machine by capturing `?capture=hero&p=…` screenshots; landscape keeps the monolith right of the copy, portrait in the lower half; final framing is M7 look-dev):

```ts
import type { Orientation } from "./framing";

export type Vec3 = readonly [number, number, number];

export type CameraKey = {
  /** Shot progress (0..1) at which the camera passes this key. */
  at: number;
  position: Vec3;
  target: Vec3;
};

export const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** 0 below `from`, 1 above `to`, smooth in between. */
export function smoothstep(from: number, to: number, value: number): number {
  const t = clamp01((value - from) / (to - from));
  return t * t * (3 - 2 * t);
}

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t;
  return (
    0.5 *
    (2 * p1 +
      (p2 - p0) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (3 * p1 - p0 - 3 * p2 + p3) * t2 * t)
  );
}

function spline(points: readonly Vec3[], index: number, t: number): Vec3 {
  const p0 = points[Math.max(0, index - 1)];
  const p1 = points[index];
  const p2 = points[Math.min(points.length - 1, index + 1)];
  const p3 = points[Math.min(points.length - 1, index + 2)];
  return [
    catmullRom(p0[0], p1[0], p2[0], p3[0], t),
    catmullRom(p0[1], p1[1], p2[1], p3[1], t),
    catmullRom(p0[2], p1[2], p2[2], p3[2], t),
  ];
}

/**
 * Camera position and target at `progress`: a Catmull-Rom spline through the
 * keys (the camera never stops at a key), clamped to the first and last key.
 */
export function sampleCameraKeys(
  keys: readonly CameraKey[],
  progress: number,
): { position: Vec3; target: Vec3 } {
  const p = clamp01(progress);
  let index = 0;
  while (index < keys.length - 2 && p > keys[index + 1].at) {
    index += 1;
  }
  const from = keys[index];
  const to = keys[Math.min(keys.length - 1, index + 1)];
  const span = to.at - from.at;
  const t = span > 0 ? clamp01((p - from.at) / span) : 0;
  return {
    position: spline(
      keys.map((key) => key.position),
      index,
      t,
    ),
    target: spline(
      keys.map((key) => key.target),
      index,
      t,
    ),
  };
}

/**
 * Shot S1 (hero), metres, stack centred on the origin (asset contract):
 * macro dolly along the anodized base plate, up the front faces, over the
 * glass top where a softbox sweep reveals `engrave_hero`, then a pull-back to
 * the whole monolith. Landscape keeps the monolith right of the copy; portrait
 * keeps it in the lower half.
 */
export const HERO_KEYS: Record<Orientation, readonly CameraKey[]> = {
  landscape: [
    { at: 0, position: [0.34, 0.03, 0.34], target: [0.06, 0.022, 0.19] },
    { at: 0.28, position: [0.02, 0.12, 0.42], target: [-0.02, 0.1, 0.19] },
    { at: 0.55, position: [-0.05, 0.52, 0.3], target: [-0.07, 0.25, 0.02] },
    { at: 1, position: [0.6, 0.5, 1.1], target: [-0.34, 0.12, 0] },
  ],
  portrait: [
    { at: 0, position: [0.3, 0.035, 0.42], target: [0.04, 0.03, 0.19] },
    { at: 0.28, position: [0.02, 0.13, 0.52], target: [0, 0.12, 0.19] },
    { at: 0.55, position: [0, 0.62, 0.36], target: [0, 0.25, 0.04] },
    { at: 1, position: [0.7, 0.85, 1.6], target: [0.1, 0.3, 0] },
  ],
};

export type HeroFrame = {
  position: Vec3;
  target: Vec3;
  /** Environment yaw in radians: moves the softbox reflections (the sweep). */
  envRotation: number;
  /** Visibility of the `engrave_hero` etching, 0..1. */
  engrave: number;
  /** Extra glow while the sweep passes over the etching, 0..1. */
  glint: number;
};

export function heroFrame(
  progress: number,
  orientation: Orientation,
): HeroFrame {
  const p = clamp01(progress);
  const { position, target } = sampleCameraKeys(HERO_KEYS[orientation], p);
  const sweep = smoothstep(0.3, 0.7, p);
  const glint = Math.max(0, 1 - Math.abs(p - 0.5) / 0.12);
  return {
    position,
    target,
    envRotation: -0.9 + sweep * 1.8,
    engrave: smoothstep(0.38, 0.52, p),
    glint: glint * glint * (3 - 2 * glint),
  };
}
```

- [ ] **Step 5: Run everything**

Run: `rtk proxy pnpm exec vitest run tests/unit/capture-mode.test.ts tests/unit/stage-store.test.ts tests/unit/frame-monitor.test.ts tests/unit/framing.test.ts tests/unit/shots.test.ts`
Expected: `Test Files  5 passed (5)`, `Tests  24 passed (24)`.

Run: `rtk proxy pnpm test`
Expected: `Test Files  32 passed (32)`, `Tests  235 passed (235)`.

Run: `pnpm typecheck` and `rtk proxy pnpm lint`
Expected: exit 0; `Checked 215 files in <n>ms. No fixes applied.`

- [ ] **Step 6: Commit**

```bash
/usr/bin/git add package.json pnpm-lock.yaml src tests
/usr/bin/git status --short
/usr/bin/git commit -m "feat(director): add scroll store and hero shot"
```

---

### Task 5: The live stage behind a pinned hero

**Owner:** frontend-engineer.

**Files:**
- Create: `src/experience/scroll/loop.ts`, `src/experience/director/HeroShot.tsx`, `src/experience/director/Director.tsx`, `src/experience/postfx/Effects.tsx`, `src/experience/Stage.tsx`, `src/experience/StageLoader.tsx`, `tests/e2e/stage.spec.ts`
- Modify: `src/app/[locale]/page.tsx`, `src/components/sections/Hero.tsx`, `src/components/site/SiteHeader.tsx`, `src/app/globals.css`, `tests/e2e/motion.spec.ts`, `package.json`, `pnpm-lock.yaml`
- Delete: `src/components/ui/Stage.tsx` (the M1 CSS placeholder; only the hero used it)

**Interfaces:**
- Consumes: everything from Tasks 2–4.
- Produces:
  - `scroll/loop.ts`: `startLoop(onTick(seconds), { smooth }): () => void`, `trackSections(store): () => void`.
  - `Director.tsx`: `Director({ store, layer, capture, onDecline })`, `type ShotProps = { store }`, the `SHOTS` registry (M6 adds about/skills/experience/contact).
  - `HeroShot.tsx`: `HeroShot({ store })`. `Effects.tsx`: `Effects()`.
  - `Stage.tsx` (default export, lazy): `Stage({ tier, capture, onFallback })`. `StageLoader.tsx`: `StageLoader()`.
  - On `<html>`: `data-motion="on|off"`, `data-canvas="poster|loading|live|captured"`, `data-tier="1|2|3"`, `data-capture="<scene>"` in capture mode. CSS: `.stage-layer`, `.hero`, `.hero-poster`, `.hero-scrim`.
  - The hero keeps `[data-stage="hero"]` with class `stage` on its poster frame, so the M1 tests `plays the studio light sweep once` and `skips the light sweep` still hold.

- [ ] **Step 1: Write the failing e2e tests**

`tests/e2e/stage.spec.ts` (headless Chromium renders WebGL on SwiftShader, which the classifier sends to posters, so live tests force a tier with `?tier=`):

```ts
import { expect, type Page, test } from "@playwright/test";

// Headless Chromium renders WebGL with SwiftShader, which the tier classifier
// sends to posters, so these tests force a live tier with ?tier=.

/** Script URLs in the server HTML: everything else was loaded later. */
async function initialScripts(page: Page, path: string): Promise<Set<string>> {
  const html = await (await page.request.get(path)).text();
  return new Set(
    [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map((match) => match[1]),
  );
}

function recordScripts(page: Page): string[] {
  const urls: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "script") {
      urls.push(new URL(request.url()).pathname);
    }
  });
  return urls;
}

test("tier 2 puts one hidden canvas behind a pinned hero", async ({ page }) => {
  await page.goto("/en?tier=2");
  const html = page.locator("html");

  await expect(html).toHaveAttribute("data-canvas", "live", {
    timeout: 60_000,
  });
  await expect(html).toHaveAttribute("data-tier", "2");
  const layer = page.locator(".stage-layer");
  await expect(layer).toHaveAttribute("aria-hidden", "true");
  await expect(layer.locator("canvas")).toHaveCount(1);
  await expect(page.locator('[data-stage="hero"]')).toHaveCSS("opacity", "0");

  const { hero, viewport } = await page.evaluate(() => ({
    hero: document.querySelector(".hero")?.getBoundingClientRect().height ?? 0,
    viewport: window.innerHeight,
  }));
  expect(Math.round(hero / viewport)).toBe(3);
});

test("the stage fades out once the hero has scrolled away", async ({
  page,
}) => {
  await page.goto("/en?tier=2");
  await expect(page.locator("html")).toHaveAttribute("data-canvas", "live", {
    timeout: 60_000,
  });

  await page.locator("#about").scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    const about = document.querySelector("#about");
    window.scrollTo(
      0,
      window.scrollY + (about?.getBoundingClientRect().top ?? 0),
    );
  });

  const layer = page.locator(".stage-layer");
  await expect(layer).toHaveCSS("visibility", "hidden");
  await expect(layer).toHaveCSS("opacity", "0");
});

test("a lost WebGL context falls back to the poster", async ({ page }) => {
  await page.goto("/en?tier=2");
  await expect(page.locator("html")).toHaveAttribute("data-canvas", "live", {
    timeout: 60_000,
  });

  await page.evaluate(() => {
    const canvas = document.querySelector(".stage-layer canvas");
    const gl = (canvas as HTMLCanvasElement).getContext("webgl2");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  });

  await expect(page.locator("html")).toHaveAttribute("data-canvas", "poster");
  await expect(page.locator(".stage-layer")).toHaveCount(0);
  await expect(page.locator('[data-stage="hero"]')).toHaveCSS("opacity", "1");
});

test("a software renderer gets posters and never downloads the 3D chunk", async ({
  page,
}) => {
  const initial = await initialScripts(page, "/en");
  const loaded = recordScripts(page);
  await page.goto("/en");

  await expect(page.locator("html")).toHaveAttribute("data-canvas", "poster");
  await page.waitForTimeout(1000);
  expect(loaded.filter((url) => !initial.has(url))).toEqual([]);
});

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("never downloads the 3D chunk", async ({ page }) => {
    const initial = await initialScripts(page, "/en");
    const loaded = recordScripts(page);
    await page.goto("/en?tier=3");

    await expect(page.locator("html")).toHaveAttribute("data-canvas", "poster");
    await page.waitForTimeout(1000);
    expect(loaded.filter((url) => !initial.has(url))).toEqual([]);
  });
});
```

Replace `tests/e2e/motion.spec.ts` with the version that also checks what the switch does to the page:

```ts
import { expect, test } from "@playwright/test";

test("the Motion switch is on by default and remembers being turned off", async ({
  page,
}) => {
  await page.goto("/en");
  const motion = page
    .getByRole("banner")
    .getByRole("button", { name: "Motion" });

  await expect(motion).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("html")).toHaveAttribute("data-motion", "on");

  await motion.click();
  await expect(motion).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("html")).toHaveAttribute("data-motion", "off");
  await expect(page.locator("html")).toHaveAttribute("data-canvas", "poster");

  await page.reload();
  await expect(motion).toHaveAttribute("aria-pressed", "false");
});

test("the Motion switch is translated", async ({ page }) => {
  await page.goto("/ro");

  await expect(
    page.getByRole("banner").getByRole("button", { name: "Animație" }),
  ).toBeVisible();
});

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("starts with motion off: poster only, hero not pinned", async ({
    page,
  }) => {
    await page.goto("/en");
    const html = page.locator("html");

    await expect(html).toHaveAttribute("data-motion", "off");
    await expect(html).toHaveAttribute("data-canvas", "poster");
    await expect(
      page.getByRole("banner").getByRole("button", { name: "Motion" }),
    ).toHaveAttribute("aria-pressed", "false");
    const { hero, viewport } = await page.evaluate(() => ({
      hero: document.querySelector(".hero")?.getBoundingClientRect().height,
      viewport: window.innerHeight,
    }));
    expect(hero).toBeLessThan(1.5 * viewport);
  });

  test("the visitor can still turn motion on", async ({ page }) => {
    await page.goto("/en?tier=1");
    const motion = page
      .getByRole("banner")
      .getByRole("button", { name: "Motion" });
    await motion.click();

    await expect(motion).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("html")).toHaveAttribute("data-motion", "on");
    await expect(page.locator("html")).toHaveAttribute("data-canvas", "live", {
      timeout: 60_000,
    });
  });
});
```

Run: `pnpm test:e2e tests/e2e/motion.spec.ts tests/e2e/stage.spec.ts`
Expected: `8 failed`, `1 passed` (`the Motion switch is translated`); the failures are `expect(locator).toHaveAttribute(expected) failed` on `data-motion` / `data-canvas`.

- [ ] **Step 2: Install GSAP, Lenis and postprocessing**

```bash
pnpm add -E gsap@3.15.0 lenis@1.3.26 postprocessing@6.39.5
```

Expected: `+ gsap 3.15.0`, `+ lenis 1.3.26`, `+ postprocessing 6.39.5`.

- [ ] **Step 3: The loop**

`src/experience/scroll/loop.ts` (the hero is pinned by CSS `position: sticky`, so its ScrollTrigger only measures; the stage fades out while the hero's bottom edge travels from the viewport bottom to 35 %):

```ts
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import type { SceneId } from "@/components/ui/Section";
import type { StageStore } from "../director/store";

/**
 * The page's only requestAnimationFrame loop: GSAP's ticker drives Lenis,
 * Lenis scroll events drive ScrollTrigger, and `onTick` (the director) decides
 * whether R3F renders a frame. `smooth: false` (poster capture) skips Lenis.
 */
export function startLoop(
  onTick: (seconds: number) => void,
  { smooth }: { smooth: boolean },
): () => void {
  gsap.registerPlugin(ScrollTrigger);
  const lenis = smooth ? new Lenis({ autoRaf: false }) : null;
  lenis?.on("scroll", ScrollTrigger.update);
  const tick = (seconds: number) => {
    lenis?.raf(seconds * 1000);
    onTick(seconds);
  };
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);
  return () => {
    gsap.ticker.remove(tick);
    lenis?.destroy();
  };
}

/**
 * One ScrollTrigger per `[data-scene]` section, writing its progress into the
 * store. The hero is pinned with CSS `position: sticky`, so its progress runs
 * from "top top" to "bottom bottom"; the stage fades out as the hero leaves.
 */
export function trackSections(store: StageStore): () => void {
  const triggers: ScrollTrigger[] = [];
  const { setProgress, setOpacity, setActive } = store.getState();

  for (const element of document.querySelectorAll<HTMLElement>(
    "[data-scene]",
  )) {
    const scene = element.dataset.scene as SceneId;
    const pinned = scene === "hero";
    const trigger = ScrollTrigger.create({
      trigger: element,
      start: pinned ? "top top" : "top bottom",
      end: pinned ? "bottom bottom" : "bottom top",
      onUpdate: (self) => setProgress(scene, self.progress),
    });
    setProgress(scene, trigger.progress);
    triggers.push(
      trigger,
      ScrollTrigger.create({
        trigger: element,
        start: "top center",
        end: "bottom center",
        onToggle: (self) => {
          if (self.isActive) setActive(scene);
        },
      }),
    );
    if (pinned) {
      const exit = ScrollTrigger.create({
        trigger: element,
        start: "bottom bottom",
        end: "bottom 35%",
        onUpdate: (self) => setOpacity(1 - self.progress),
      });
      setOpacity(1 - exit.progress);
      triggers.push(exit);
    }
  }
  ScrollTrigger.refresh();
  return () => {
    for (const trigger of triggers) trigger.kill();
  };
}
```

- [ ] **Step 4: The director, the hero shot and the post chain**

`src/experience/director/HeroShot.tsx`:

```tsx
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Mesh, MeshStandardMaterial, PerspectiveCamera } from "three";
import { STACK_OBJECTS } from "../scenes/stack-layout";
import { coverViewOffset, orientationOf, REFERENCE_SIZE } from "./framing";
import { heroFrame } from "./shots";
import type { StageStore } from "./store";

/** Vertical field of view per reference frame (a long product lens). */
const FOV = { landscape: 30, portrait: 42 } as const;

/** Shot S1: applies `heroFrame(progress)` to the camera, environment and etching. */
export function HeroShot({ store }: { store: StageStore }) {
  const etch = useRef<Mesh | undefined>(undefined);

  useFrame((state) => {
    const camera = state.camera as PerspectiveCamera;
    const { width, height } = state.size;
    const orientation = orientationOf(width, height);
    const reference = REFERENCE_SIZE[orientation];
    const frame = heroFrame(store.getState().progress.hero, orientation);

    const view = coverViewOffset(
      width,
      height,
      reference.width / reference.height,
    );
    camera.fov = FOV[orientation];
    camera.aspect = reference.width / reference.height;
    camera.setViewOffset(
      view.fullWidth,
      view.fullHeight,
      view.x,
      view.y,
      view.width,
      view.height,
    );
    camera.position.set(...frame.position);
    camera.lookAt(...frame.target);
    camera.updateProjectionMatrix();

    state.scene.environmentRotation.y = frame.envRotation;
    etch.current ??= state.scene.getObjectByName(STACK_OBJECTS.engraveHero) as
      | Mesh
      | undefined;
    const material = etch.current?.material as MeshStandardMaterial | undefined;
    if (material) {
      material.opacity = 0.2 + frame.engrave * 0.55;
      material.emissiveIntensity = frame.engrave * 0.15 + frame.glint * 1.4;
    }
  });

  return null;
}
```

`src/experience/director/Director.tsx`:

```tsx
import { advance, useThree } from "@react-three/fiber";
import {
  type ComponentType,
  type RefObject,
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import type { SceneId } from "@/components/ui/Section";
import type { Capture } from "../capture-mode";
import { startLoop, trackSections } from "../scroll/loop";
import { createFrameMonitor } from "./frame-monitor";
import { HeroShot } from "./HeroShot";
import type { StageStore } from "./store";

export type ShotProps = { store: StageStore };

/**
 * One shot per section. M6 registers about, skills, experience and contact;
 * until then a section without a shot keeps the last one (the stage has
 * faded out by then anyway).
 */
const SHOTS: Partial<Record<SceneId, ComponentType<ShotProps>>> = {
  hero: HeroShot,
};

type DirectorProps = {
  store: StageStore;
  /** The fixed layer around the canvas; its opacity follows the store. */
  layer: RefObject<HTMLDivElement | null>;
  capture: Capture | null;
  onDecline: () => void;
};

/**
 * Owns the frame loop: renders (R3F `advance`) only when the store says
 * something changed, never while the tab is hidden, and reports sustained
 * slow frames through `onDecline`.
 */
export function Director({ store, layer, capture, onDecline }: DirectorProps) {
  const three = useThree((state) => state.get);
  const active = useSyncExternalStore(
    store.subscribe,
    () => store.getState().active,
  );
  const Shot = SHOTS[active] ?? HeroShot;
  const decline = useRef(onDecline);

  useEffect(() => {
    decline.current = onDecline;
  }, [onDecline]);

  useEffect(() => {
    const root = document.documentElement;
    const monitor = createFrameMonitor();
    let frames = 0;
    let shown = -1;
    let size = three().size;
    let dpr = three().viewport.dpr;
    if (capture) {
      store.getState().setProgress(capture.scene, capture.progress);
    }

    const stopLoop = startLoop(
      (seconds) => {
        if (document.hidden) {
          return;
        }
        const { opacity, consume, invalidate } = store.getState();
        const { size: nextSize, viewport } = three();
        if (nextSize !== size || viewport.dpr !== dpr) {
          size = nextSize;
          dpr = viewport.dpr;
          invalidate();
        }
        if (layer.current && opacity !== shown) {
          shown = opacity;
          layer.current.style.opacity = String(opacity);
          layer.current.style.visibility = opacity > 0 ? "" : "hidden";
        }
        const due = opacity > 0 && consume();
        if (due) {
          advance(seconds);
          frames += 1;
          if (frames === 1) {
            root.dataset.canvas = "live";
            // A second frame, so capture waits for everything drawn once.
            invalidate();
          } else if (frames === 2 && capture) {
            root.dataset.canvas = "captured";
          }
        }
        if (!capture && monitor.tick(seconds * 1000, due) === "decline") {
          decline.current();
        }
      },
      { smooth: !capture },
    );
    const stopSections = capture ? null : trackSections(store);

    return () => {
      stopSections?.();
      stopLoop();
    };
  }, [store, layer, capture, three]);

  return <Shot store={store} />;
}
```

`src/experience/postfx/Effects.tsx`:

```tsx
import { useFrame, useThree } from "@react-three/fiber";
import {
  BloomEffect,
  EffectComposer,
  EffectPass,
  FXAAEffect,
  RenderPass,
  ToneMappingEffect,
  ToneMappingMode,
} from "postprocessing";
import { useEffect, useMemo } from "react";
import { HalfFloatType } from "three";

/**
 * Tier 2+ post chain, built on `postprocessing` directly (the
 * @react-three/postprocessing bundle also ships N8AO and every other effect).
 * The composer renders into a float buffer, where the renderer's tone mapping
 * does not apply, so AgX runs as an effect, before anti-aliasing. FXAA, not
 * SMAA: SMAA embeds its lookup textures (+54 KB gz in the lazy chunk).
 * Tier 3 extras (bokeh DOF, N8AO, chromatic aberration) arrive in M6.
 */
export function Effects() {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const dpr = useThree((state) => state.viewport.dpr);

  const composer = useMemo(() => {
    const composer = new EffectComposer(gl, {
      frameBufferType: HalfFloatType,
      multisampling: 0,
    });
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(
      new EffectPass(
        camera,
        new BloomEffect({
          mipmapBlur: true,
          luminanceThreshold: 0.9,
          intensity: 0.35,
        }),
        new ToneMappingEffect({ mode: ToneMappingMode.AGX }),
      ),
    );
    composer.addPass(new EffectPass(camera, new FXAAEffect()));
    return composer;
  }, [gl, scene, camera]);

  // setSize reads the renderer's pixel ratio, so a DPR change resizes too.
  useEffect(() => {
    if (dpr > 0) composer.setSize(size.width, size.height);
  }, [composer, size, dpr]);

  useEffect(() => () => composer.dispose(), [composer]);

  // Priority 1 takes over rendering from R3F.
  useFrame((_, delta) => composer.render(delta), 1);

  return null;
}
```

- [ ] **Step 5: The stage and its loader**

`src/experience/Stage.tsx`:

```tsx
"use client";

import { Canvas } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgXToneMapping } from "three";
import type { Capture } from "./capture-mode";
import { Director } from "./director/Director";
import { createStageStore } from "./director/store";
import { type LiveTier, lowerTier } from "./gpu-tier";
import { Effects } from "./postfx/Effects";
import { StackModel } from "./scenes/StackModel";
import { StudioLights } from "./scenes/StudioLights";

export type StageProps = {
  tier: LiveTier;
  capture: Capture | null;
  /** Live 3D is over (context lost, or too slow even at tier 1): show posters. */
  onFallback: () => void;
};

const DPR: Record<LiveTier, number | [number, number]> = {
  1: 1,
  2: [1, 1.5],
  3: [1, 2],
};

/**
 * The persistent stage: one fixed, full-viewport canvas behind the page,
 * rendered on demand by the director. Loaded lazily by StageLoader.
 */
export default function Stage({
  tier: initialTier,
  capture,
  onFallback,
}: StageProps) {
  const [tier, setTier] = useState<LiveTier>(initialTier);
  const store = useMemo(createStageStore, []);
  const layer = useRef<HTMLDivElement>(null);

  const decline = useCallback(() => {
    const next = lowerTier(tier);
    if (next === null) {
      onFallback();
    } else {
      setTier(next);
    }
  }, [tier, onFallback]);

  useEffect(() => {
    document.documentElement.dataset.tier = String(tier);
    store.getState().invalidate();
  }, [tier, store]);

  return (
    <div ref={layer} className="stage-layer" aria-hidden="true">
      <Canvas
        frameloop="never"
        dpr={DPR[tier]}
        camera={{ fov: 30, near: 0.01, far: 30, position: [0.7, 0.6, 1.4] }}
        gl={{
          antialias: initialTier === 1,
          powerPreference: "high-performance",
          toneMapping: AgXToneMapping,
        }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener("webglcontextlost", (event) => {
            event.preventDefault();
            onFallback();
          });
        }}
      >
        <Director
          store={store}
          layer={layer}
          capture={capture}
          onDecline={decline}
        />
        <StudioLights />
        <StackModel tier={tier} />
        {tier >= 2 ? <Effects /> : null}
      </Canvas>
    </div>
  );
}
```

`src/experience/StageLoader.tsx`:

```tsx
"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { type Capture, captureFromSearch } from "./capture-mode";
import {
  classifyTier,
  type LiveTier,
  readGpuSignals,
  tierOverride,
} from "./gpu-tier";
import { useMotion } from "./use-motion";

// three.js, R3F, GSAP and Lenis live in this chunk only.
const Stage = dynamic(() => import("./Stage"), { ssr: false });

/**
 * Decides, after the page has loaded (so after the poster, the LCP element),
 * whether this visitor gets the live stage, and at which tier. Sets on <html>:
 * - data-motion="on|off": the visitor's motion preference;
 * - data-canvas="poster|loading|live|captured": what the hero shows.
 *   "loading" and "live" turn on the pinned (scroll-scrubbed) hero.
 */
export function StageLoader() {
  const motion = useMotion();
  const [live, setLive] = useState<{
    tier: LiveTier;
    capture: Capture | null;
  } | null>(null);

  useEffect(() => {
    if (motion === null) {
      return;
    }
    const root = document.documentElement;
    const capture = captureFromSearch(location.search);
    if (capture) {
      root.dataset.capture = capture.scene;
    }
    root.dataset.motion = motion || capture ? "on" : "off";
    if (!motion && !capture) {
      root.dataset.canvas = "poster";
      setLive(null);
      return;
    }
    let cancelled = false;
    const cancel = afterLoadAndIdle(async () => {
      const tier =
        tierOverride(location.search) ??
        (capture ? 2 : classifyTier(readGpuSignals()));
      if (tier === 0) {
        root.dataset.canvas = "poster";
        return;
      }
      if (capture) {
        // The etching is drawn with the page font: wait for it.
        await document.fonts.ready;
      }
      if (!cancelled) {
        root.dataset.canvas = "loading";
        setLive({ tier, capture });
      }
    });
    return () => {
      cancelled = true;
      cancel();
    };
  }, [motion]);

  if (!live) {
    return null;
  }
  return (
    <Stage
      tier={live.tier}
      capture={live.capture}
      onFallback={() => {
        document.documentElement.dataset.canvas = "poster";
        setLive(null);
      }}
    />
  );
}

/** Runs `task` once the load event has fired and the main thread is idle. */
function afterLoadAndIdle(task: () => void): () => void {
  let cancel = () => {};
  // Safari has no requestIdleCallback.
  const idle = window.requestIdleCallback as
    | typeof requestIdleCallback
    | undefined;
  const schedule = () => {
    if (idle) {
      const handle = idle(task, { timeout: 2000 });
      cancel = () => cancelIdleCallback(handle);
    } else {
      const handle = window.setTimeout(task, 200);
      cancel = () => clearTimeout(handle);
    }
  };
  if (document.readyState === "complete") {
    schedule();
  } else {
    window.addEventListener("load", schedule, { once: true });
  }
  return () => {
    window.removeEventListener("load", schedule);
    cancel();
  };
}
```

Mount it first in `main`, so the fixed layer sits under every section:

```diff
diff --git a/src/app/[locale]/page.tsx b/src/app/[locale]/page.tsx
--- a/src/app/[locale]/page.tsx
+++ b/src/app/[locale]/page.tsx
@@ -7,6 +7,7 @@ import { Hero } from "@/components/sections/Hero";
 import { Projects } from "@/components/sections/Projects";
 import { Skills } from "@/components/sections/Skills";
 import { getCv } from "@/content/get-cv";
+import { StageLoader } from "@/experience/StageLoader";
 import {
   languageAlternates,
   localeUrl,
@@ -45,6 +46,7 @@ export default async function HomePage() {
           __html: serializeJsonLd(personJsonLd(cv, siteUrl)),
         }}
       />
+      <StageLoader />
       <Hero cv={cv} />
       <About cv={cv} />
       <Skills cv={cv} />
```

- [ ] **Step 6: The pinned, full-bleed hero**

The header now overlays the hero, so the hero's sticky frame is exactly the viewport, the same box as the fixed canvas (a poster offset by the header height would jump at the crossfade):

```diff
diff --git a/src/components/site/SiteHeader.tsx b/src/components/site/SiteHeader.tsx
--- a/src/components/site/SiteHeader.tsx
+++ b/src/components/site/SiteHeader.tsx
@@ -18,7 +18,7 @@ export function SiteHeader({ cv }: { cv: Cv }) {
   return (
     <header
       id="top"
-      className="mx-auto flex w-full max-w-content flex-wrap items-center justify-between gap-3 px-gutter pt-6"
+      className="absolute inset-x-0 top-0 z-10 mx-auto flex w-full max-w-content flex-wrap items-center justify-between gap-3 px-gutter pt-6"
     >
       <a
         href="#top"
```

Replace `src/components/sections/Hero.tsx` (the poster frame is a CSS studio plate until Task 7):

```tsx
import { useTranslations } from "next-intl";
import { fallbackLang } from "@/content/localize";
import type { Cv } from "@/content/types";

/**
 * Shot S1. The copy is SSR text over a full-bleed poster; once the live stage
 * is up (html[data-canvas="live"]) the poster fades to reveal the canvas behind
 * it, and the section grows to 300lvh so its sticky frame stays pinned for
 * 200lvh of scroll.
 */
export function Hero({ cv }: { cv: Cv }) {
  const t = useTranslations("Hero");
  const availability = useTranslations("Availability");
  const { profile, locale } = cv;

  return (
    <section aria-labelledby="hero-title" data-scene="hero" className="hero">
      <div className="sticky top-0 flex min-h-lvh items-center overflow-hidden">
        <div
          aria-hidden="true"
          data-stage="hero"
          className="stage hero-poster absolute inset-0"
        />
        <div aria-hidden="true" className="hero-scrim absolute inset-0" />
        <div className="relative mx-auto w-full max-w-content px-gutter pt-28 pb-16">
          <div className="md:w-7/12">
            {profile.available ? (
              <p className="inline-flex items-center gap-2 rounded-full bg-canvas/60 px-3 py-1.5 font-mono text-label uppercase text-ink-muted ring-1 ring-line">
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
                className="rounded-full bg-canvas/60 px-6 py-3 font-medium text-ink ring-1 ring-line-strong transition-colors hover:bg-raised"
              >
                {t("secondaryCta")}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
```

Delete the M1 placeholder, then update `src/app/globals.css`: the plate loses its panel radius and border and the slab styles go; the motion-core rules are appended:

```bash
/usr/bin/git rm -q src/components/ui/Stage.tsx
```

```diff
diff --git a/src/app/globals.css b/src/app/globals.css
--- a/src/app/globals.css
+++ b/src/app/globals.css
@@ -126,11 +126,10 @@
     --layer-tint: var(--color-base);
   }
 
-  /* Reserved box for a future 3D scene or frame sequence (M5); a CSS studio plate until then. */
+  /* Studio plate behind a scene poster; also what shows while a poster loads. */
   .stage {
     position: relative;
     overflow: hidden;
-    border-radius: var(--radius-panel);
     background:
       radial-gradient(
         70% 55% at 60% 30%,
@@ -139,22 +138,6 @@
       ),
       radial-gradient(90% 60% at 50% 115%, var(--color-raised), transparent 70%),
       var(--color-surface);
-    box-shadow: inset 0 0 0 1px var(--color-line);
-  }
-
-  .slab {
-    height: 12%;
-    border-radius: var(--radius-control);
-    background:
-      linear-gradient(
-        180deg,
-        color-mix(in oklab, var(--layer-tint) 28%, transparent),
-        transparent 65%
-      ),
-      var(--color-raised);
-    box-shadow:
-      inset 0 1px 0 color-mix(in oklab, var(--layer-tint) 45%, transparent),
-      0 24px 40px -28px var(--color-canvas);
   }
 
   /* One softbox sweep across the plate on load, like the S1 light pass. */
@@ -183,3 +166,62 @@
     transform: translateX(420%) skewX(-12deg);
   }
 }
+
+/*
+ * Motion core (M5). The live stage is a fixed canvas under the page; every
+ * other child of <main> sits above it. html[data-canvas] is set by StageLoader:
+ * "loading" and "live" pin the hero, "live" fades its poster out.
+ */
+.stage-layer {
+  position: fixed;
+  inset: 0;
+  z-index: 0;
+  pointer-events: none;
+}
+
+main > :not(.stage-layer) {
+  position: relative;
+  z-index: 1;
+}
+
+html:is([data-canvas="loading"], [data-canvas="live"]) .hero {
+  height: 300lvh;
+}
+
+.hero-poster {
+  transition: opacity 600ms var(--ease-out-quint);
+}
+
+html[data-canvas="live"] .hero-poster {
+  opacity: 0;
+}
+
+/* Keeps the copy readable over any frame: from the left in landscape, from the top in portrait. */
+.hero-scrim {
+  background: linear-gradient(
+    90deg,
+    var(--color-canvas) 30%,
+    color-mix(in oklab, var(--color-canvas) 55%, transparent) 45%,
+    transparent 68%
+  );
+}
+
+@media (orientation: portrait) {
+  .hero-scrim {
+    background: linear-gradient(
+      180deg,
+      var(--color-canvas) 22%,
+      color-mix(in oklab, var(--color-canvas) 60%, transparent) 40%,
+      transparent 65%
+    );
+  }
+}
+
+/* Poster capture (scripts/posters.ts): only the canvas is visible. */
+html[data-capture] body {
+  visibility: hidden;
+}
+
+html[data-capture] .stage-layer {
+  visibility: visible;
+}
```

- [ ] **Step 7: Run everything**

Run: `pnpm typecheck`
Expected: exit 0.

Run: `rtk proxy pnpm lint`
Expected: `Checked 221 files in <n>ms. No fixes applied.`

Run: `pnpm test:e2e tests/e2e/motion.spec.ts tests/e2e/stage.spec.ts`
Expected: `9 passed`. The tier-2 tests take 4–7 s each on SwiftShader.

Run: `pnpm test:e2e`
Expected: `81 passed` (72 + 4 motion + 5 stage). The M1 hero tests (`plays the studio light sweep once`, `skips the light sweep`), the 320 px overflow test and the axe tests still pass.

Run: `rtk proxy pnpm test`
Expected: `Test Files  32 passed (32)`, `Tests  235 passed (235)`.

- [ ] **Step 8: Look at it on the real GPU (manual, no pass/fail)**

```bash
pnpm build
pnpm exec next start --port 3300
```

Open `http://localhost:3300/en` in Chrome: after about a second the plate gives way to the macro shot of the base plate; scrolling dollies up the front faces, the sweep glints over the etched "Mihai Dorobat / FULL-STACK ENGINEER" around the middle of the pin, and the camera pulls back to the monolith right of the copy; past the hero the stage fades out. `http://localhost:3300/en?capture=hero&p=1` shows only the last frame. Stop the server (Ctrl+C); `ss -ltn | grep ':3300 '` prints nothing.

- [ ] **Step 9: Commit**

```bash
/usr/bin/git add package.json pnpm-lock.yaml src tests
/usr/bin/git status --short
/usr/bin/git commit -m "feat(stage): render the live hero stage"
```

`git status --short` includes `D  src/components/ui/Stage.tsx`.

---

### Task 6: Capture the hero posters from the scene

**Owner:** devops-engineer (asset pipeline script; the posters it writes are committed).

**Files:**
- Create: `src/experience/poster-shots.ts`, `scripts/poster-sources.ts`, `scripts/posters.ts`, `tests/unit/posters.test.ts`, generated `src/experience/posters.json` and `public/posters/*.{avif,webp}`
- Modify: `package.json`

**Interfaces:**
- Consumes: capture mode (`?capture=hero&p=…&tier=2`, `html[data-canvas="captured"]`, Task 5), `REFERENCE_SIZE` and `Orientation` (Task 4).
- Produces:
  - `poster-shots.ts`: `POSTER_SHOTS` (`hero-start` p=0, `hero-end` p=1), `type PosterName`, `POSTER_WIDTHS` (landscape 640/1280/1920, portrait 828), `type PosterSource`, `type PosterImage`, `type PosterManifest`, `srcSet(sources, base = "")`.
  - `scripts/poster-sources.ts`: `POSTER_SOURCES`, `posterSourceHash(root?)`.
  - `pnpm assets:posters` → `public/posters/<name>-<orientation>-<width>.<sha256:8>.<avif|webp>` and `src/experience/posters.json` (`{ sourceHash, shots }`).

**Decision: commit the posters, do not generate them in CI.** A capture needs a production build plus a browser with WebGL: on CI that is SwiftShader, 39 s and slightly different pixels than the GPU the owner looks at; on Vercel's build image there is no browser at all. Committed posters are 16 files, 207 KB, reviewed like any other asset, and byte-identical between GPU runs here. CI still guards them: `posters.test.ts` fails when the scene code no longer matches the hash the posters were captured from.

- [ ] **Step 1: Write the failing test**

`tests/unit/posters.test.ts`:

```ts
import { existsSync, readdirSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  POSTER_SHOTS,
  POSTER_WIDTHS,
  type PosterManifest,
  srcSet,
} from "@/experience/poster-shots";
import posters from "@/experience/posters.json";
import { posterSourceHash } from "../../scripts/poster-sources";

const manifest = posters as PosterManifest;

describe("committed posters", () => {
  it("were captured from the current scene code", () => {
    // Fails after any change to the scene, shots or post chain:
    // run `pnpm build && pnpm assets:posters` and commit the result.
    expect(manifest.sourceHash).toBe(posterSourceHash());
  });

  it("cover every shot, orientation, width and format", () => {
    for (const shot of POSTER_SHOTS) {
      for (const orientation of ["landscape", "portrait"] as const) {
        const image = manifest.shots[shot.name][orientation];
        for (const format of ["avif", "webp"] as const) {
          expect(image[format].map((source) => source.width)).toEqual(
            POSTER_WIDTHS[orientation],
          );
        }
      }
    }
  });

  it("point at files in public/posters, and nothing else is there", () => {
    const referenced = Object.values(manifest.shots)
      .flatMap((shot) => Object.values(shot))
      .flatMap((image) => [...image.avif, ...image.webp])
      .map((source) => source.src.replace("/posters/", ""));

    for (const file of referenced) {
      expect(existsSync(`public/posters/${file}`), file).toBe(true);
    }
    expect(readdirSync("public/posters").sort()).toEqual(referenced.sort());
  });

  it("stay small (spec §3: initial transfer <= 1.5 MB)", () => {
    const total = readdirSync("public/posters").reduce(
      (sum, file) => sum + statSync(`public/posters/${file}`).size,
      0,
    );
    expect(total).toBeLessThan(400 * 1024);
  });
});

describe("srcSet", () => {
  const sources = [
    { width: 640, src: "/posters/a-640.1.avif" },
    { width: 1280, src: "/posters/a-1280.2.avif" },
  ];

  it("lists each file with its width", () => {
    expect(srcSet(sources)).toBe(
      "/posters/a-640.1.avif 640w, /posters/a-1280.2.avif 1280w",
    );
  });

  it("prefixes NEXT_PUBLIC_ASSET_BASE when set", () => {
    expect(srcSet(sources, "https://cdn.example.com")).toBe(
      "https://cdn.example.com/posters/a-640.1.avif 640w, https://cdn.example.com/posters/a-1280.2.avif 1280w",
    );
  });
});
```

Run: `rtk proxy pnpm exec vitest run tests/unit/posters.test.ts`
Expected: FAIL with `Error: Cannot find package '@/experience/poster-shots' imported from …/tests/unit/posters.test.ts`.

- [ ] **Step 2: The shot list and the source hash**

`src/experience/poster-shots.ts`:

```ts
import type { SceneId } from "@/components/ui/Section";
import type { Orientation } from "./director/framing";

/** Frames captured as posters by scripts/posters.ts (`?capture=<scene>&p=<progress>`). */
export const POSTER_SHOTS = [
  // First frame of shot S1: the LCP image, and what the live canvas starts on.
  { name: "hero-start", scene: "hero", progress: 0 },
  // Last frame of S1: the hero for reduced motion (nothing will play).
  { name: "hero-end", scene: "hero", progress: 1 },
] as const satisfies readonly {
  name: string;
  scene: SceneId;
  progress: number;
}[];

export type PosterName = (typeof POSTER_SHOTS)[number]["name"];

/** Encoded widths per reference frame (spec §3: 1920/1280/640 landscape, 828 portrait). */
export const POSTER_WIDTHS: Record<Orientation, readonly number[]> = {
  landscape: [640, 1280, 1920],
  portrait: [828],
};

export type PosterSource = { width: number; src: string };

export type PosterImage = {
  width: number;
  height: number;
  avif: PosterSource[];
  webp: PosterSource[];
};

export type PosterManifest = {
  /** posterSourceHash() of the scene code the posters were captured from. */
  sourceHash: string;
  shots: Record<PosterName, Record<Orientation, PosterImage>>;
};

/** `srcset` value; `base` is NEXT_PUBLIC_ASSET_BASE (empty = same origin). */
export function srcSet(sources: readonly PosterSource[], base = ""): string {
  return sources.map(({ src, width }) => `${base}${src} ${width}w`).join(", ");
}
```

`scripts/poster-sources.ts`:

```ts
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Everything that decides what a poster looks like. Editing any of these
 * files makes the committed posters stale until `pnpm assets:posters` runs
 * again (tests/unit/posters.test.ts compares the hash).
 */
export const POSTER_SOURCES = [
  "src/experience/Stage.tsx",
  "src/experience/director",
  "src/experience/postfx",
  "src/experience/scenes",
];

function files(path: string): string[] {
  if (!statSync(path).isDirectory()) {
    return [path];
  }
  return readdirSync(path).flatMap((name) => files(join(path, name)));
}

/** Short sha256 over the poster sources (paths and contents, sorted). */
export function posterSourceHash(root = process.cwd()): string {
  const hash = createHash("sha256");
  const all = POSTER_SOURCES.flatMap((path) => files(join(root, path)))
    .map((file) => relative(root, file).split("\\").join("/"))
    .sort();
  for (const file of all) {
    hash.update(file);
    hash.update("\0");
    hash.update(readFileSync(join(root, file)));
    hash.update("\0");
  }
  return hash.digest("hex").slice(0, 16);
}
```

Run the test again: now it fails with `Error: Cannot find package '@/experience/posters.json' imported from …/tests/unit/posters.test.ts`. The manifest is generated in Step 4.

- [ ] **Step 3: The capture script**

`scripts/posters.ts`:

```ts
import { type ChildProcess, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import sharp from "sharp";
import {
  type Orientation,
  REFERENCE_SIZE,
} from "@/experience/director/framing";
import {
  POSTER_SHOTS,
  POSTER_WIDTHS,
  type PosterImage,
  type PosterManifest,
  type PosterName,
} from "@/experience/poster-shots";
import { posterSourceHash } from "./poster-sources";

// Captures every POSTER_SHOTS frame from the production build (`?capture=`
// mode, tier 2) and writes content-hashed AVIF + WebP files to public/posters
// and the manifest to src/experience/posters.json. Run after `pnpm build`.
// POSTERS_SOFTWARE=1 renders with SwiftShader instead of the GPU (CI, VMs).

const PORT = 3400;
const BASE = `http://localhost:${PORT}`;
const OUT_DIR = "public/posters";
const MANIFEST = "src/experience/posters.json";
const GPU_ARGS = [
  "--use-angle=vulkan",
  "--enable-features=Vulkan",
  "--enable-gpu",
  "--ignore-gpu-blocklist",
];

async function startServer(): Promise<ChildProcess> {
  if (!existsSync(".next/BUILD_ID")) {
    throw new Error("No production build: run `pnpm build` first.");
  }
  const server = spawn("pnpm", ["exec", "next", "start", "--port", `${PORT}`], {
    stdio: "ignore",
    detached: true,
  });
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      if ((await fetch(`${BASE}/en`)).ok) return server;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`next start did not answer on port ${PORT}`);
}

async function encode(
  png: Buffer,
  name: string,
  orientation: Orientation,
  written: Set<string>,
): Promise<PosterImage> {
  const { width, height } = REFERENCE_SIZE[orientation];
  const image: PosterImage = { width, height, avif: [], webp: [] };
  for (const size of POSTER_WIDTHS[orientation]) {
    const resized = sharp(png).resize({ width: size });
    const files = {
      avif: await resized.clone().avif({ quality: 50, effort: 6 }).toBuffer(),
      webp: await resized.clone().webp({ quality: 75 }).toBuffer(),
    };
    for (const [format, bytes] of Object.entries(files) as [
      "avif" | "webp",
      Buffer,
    ][]) {
      const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 8);
      const file = `${name}-${orientation}-${size}.${hash}.${format}`;
      writeFileSync(join(OUT_DIR, file), bytes);
      written.add(file);
      image[format].push({ width: size, src: `/posters/${file}` });
      console.log(`${file}  ${(bytes.length / 1024).toFixed(1)} KB`);
    }
  }
  return image;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const server = await startServer();
  const browser = await chromium.launch({
    args: process.env.POSTERS_SOFTWARE === "1" ? [] : GPU_ARGS,
  });
  const written = new Set<string>();
  const shots = {} as PosterManifest["shots"];
  try {
    for (const orientation of ["landscape", "portrait"] as const) {
      const page = await browser.newPage({
        viewport: REFERENCE_SIZE[orientation],
        deviceScaleFactor: 1,
      });
      for (const shot of POSTER_SHOTS) {
        await page.goto(
          `${BASE}/en?capture=${shot.scene}&p=${shot.progress}&tier=2`,
        );
        await page.waitForFunction(
          () => document.documentElement.dataset.canvas === "captured",
          null,
          { timeout: 120_000 },
        );
        const png = await page.screenshot();
        shots[shot.name as PosterName] ??= {} as Record<
          Orientation,
          PosterImage
        >;
        shots[shot.name as PosterName][orientation] = await encode(
          png,
          shot.name,
          orientation,
          written,
        );
      }
      await page.close();
    }
  } finally {
    await browser.close();
    if (server.pid) process.kill(-server.pid);
  }

  for (const file of readdirSync(OUT_DIR)) {
    if (!written.has(file)) rmSync(join(OUT_DIR, file));
  }
  const manifest: PosterManifest = { sourceHash: posterSourceHash(), shots };
  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`wrote ${written.size} files and ${MANIFEST}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

```diff
diff --git a/package.json b/package.json
--- a/package.json
+++ b/package.json
@@ -19,7 +19,8 @@
     "db:generate": "drizzle-kit generate",
     "db:migrate": "node --env-file-if-exists=.env.local --import tsx scripts/db-migrate.ts",
     "db:seed": "node --env-file-if-exists=.env.local --import tsx scripts/db-seed.ts",
-    "admin:create": "node --env-file-if-exists=.env.local --import tsx scripts/admin-create.ts"
+    "admin:create": "node --env-file-if-exists=.env.local --import tsx scripts/admin-create.ts",
+    "assets:posters": "node --import tsx scripts/posters.ts"
   },
   "dependencies": {
     "@better-auth/passkey": "1.7.5",
```

- [ ] **Step 4: Capture**

```bash
pnpm build
pnpm assets:posters
```

Expected (hashes and sizes are what this machine's GPU produced; another GPU gives slightly different bytes, hence different names):

```text
$ node --import tsx scripts/posters.ts
hero-start-landscape-640.57bf0525.avif  4.3 KB
hero-start-landscape-640.c62efed9.webp  6.2 KB
hero-start-landscape-1280.1f3925e8.avif  10.2 KB
hero-start-landscape-1280.d7f51043.webp  17.4 KB
hero-start-landscape-1920.0a66ba31.avif  16.7 KB
hero-start-landscape-1920.24b2422e.webp  30.9 KB
hero-end-landscape-640.06f54541.avif  3.2 KB
hero-end-landscape-640.b1589b41.webp  4.8 KB
hero-end-landscape-1280.a2a88683.avif  7.9 KB
hero-end-landscape-1280.cc5b3e71.webp  12.8 KB
hero-end-landscape-1920.11df2752.avif  14.0 KB
hero-end-landscape-1920.352f46d7.webp  23.8 KB
hero-start-portrait-828.5be05b11.avif  10.5 KB
hero-start-portrait-828.38bccfe9.webp  20.4 KB
hero-end-portrait-828.056b9b87.avif  9.5 KB
hero-end-portrait-828.4dabe0c4.webp  15.0 KB
wrote 16 files and src/experience/posters.json

real	0m27.331s
user	0m25.156s
sys	0m0.563s
```

Afterwards `ss -ltn | grep ':3400 '` prints nothing, `ls public/posters | wc -l` prints `16`, and `du -cb public/posters/* | tail -1` prints `212362	total`. Look at `public/posters/hero-start-landscape-1920.*.avif` and `hero-end-portrait-828.*.avif`: the first frame is the macro close-up of the base plate, the last the whole monolith (right of centre in landscape, lower half in portrait). The etching reads "Mihai Dorobat / FULL-STACK ENGINEER".

- [ ] **Step 5: Run everything**

Run: `rtk proxy pnpm exec vitest run tests/unit/posters.test.ts`
Expected: `Tests  6 passed (6)`.

Run: `rtk proxy pnpm test`
Expected: `Test Files  33 passed (33)`, `Tests  241 passed (241)`.

Run: `pnpm typecheck` and `rtk proxy pnpm lint`
Expected: exit 0; `Checked 226 files in <n>ms. No fixes applied.` (Biome accepts the generated JSON as written.)

- [ ] **Step 6: Commit**

```bash
/usr/bin/git add package.json public scripts src tests
/usr/bin/git status --short
/usr/bin/git commit -m "feat(posters): capture hero posters from the scene"
```

`git status --short` lists the 16 files under `public/posters/`, `src/experience/posters.json`, the two scripts, `poster-shots.ts`, the test and `package.json`.

---

### Task 7: The hero poster as the LCP image

**Owner:** frontend-engineer.

**Files:**
- Create: `src/components/sections/HeroPoster.tsx`, `tests/e2e/poster.spec.ts`
- Modify: `src/components/sections/Hero.tsx`, `src/app/globals.css`, `next.config.ts`, `.env.example`

**Interfaces:**
- Consumes: `posters.json`, `PosterManifest`, `srcSet` (Task 6); `env.NEXT_PUBLIC_ASSET_BASE` (M0).
- Produces: `HeroPoster()`, a server component rendering `<div data-stage="hero" class="stage hero-poster">` with an art-directed `<picture>` (AVIF, then WebP; reduced motion → `hero-end`; `(orientation: portrait)` → portrait); `Cache-Control: public, max-age=31536000, immutable` on `/posters/:file`.

- [ ] **Step 1: Write the failing e2e test**

`tests/e2e/poster.spec.ts`:

```ts
import { expect, type Page, test } from "@playwright/test";

type Lcp = { tag?: string; url: string; startTime: number };

function largestContentfulPaint(page: Page): Promise<Lcp> {
  return page.evaluate(
    () =>
      new Promise<Lcp>((resolve) => {
        new PerformanceObserver((list) => {
          const entry = list.getEntries().at(-1) as PerformanceEntry & {
            element?: Element;
            url: string;
          };
          resolve({
            tag: entry.element?.tagName,
            url: new URL(entry.url || location.href).pathname,
            startTime: entry.startTime,
          });
        }).observe({ type: "largest-contentful-paint", buffered: true });
      }),
  );
}

test("the hero poster is the LCP element (desktop)", async ({ page }) => {
  await page.goto("/en");

  const lcp = await largestContentfulPaint(page);
  expect(lcp.tag).toBe("IMG");
  expect(lcp.url).toMatch(
    /^\/posters\/hero-start-landscape-\d+\.[0-9a-f]{8}\.avif$/,
  );
});

test("a phone gets the portrait poster", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en");

  const lcp = await largestContentfulPaint(page);
  expect(lcp.tag).toBe("IMG");
  expect(lcp.url).toMatch(
    /^\/posters\/hero-start-portrait-828\.[0-9a-f]{8}\.avif$/,
  );
});

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("shows the finished monolith instead of the first frame", async ({
    page,
  }) => {
    await page.goto("/en");

    const lcp = await largestContentfulPaint(page);
    expect(lcp.url).toMatch(/^\/posters\/hero-end-landscape-\d+\./);
  });
});

test("posters are cached as immutable", async ({ page, request }) => {
  await page.goto("/en");
  const src = await page
    .locator('[data-stage="hero"] img')
    .evaluate((img: HTMLImageElement) => new URL(img.currentSrc).pathname);

  const response = await request.get(src);
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe(
    "public, max-age=31536000, immutable",
  );
});

test("the 3D chunk is requested only after the LCP", async ({ page }) => {
  await page.goto("/en?tier=2");
  await expect(page.locator("html")).toHaveAttribute("data-canvas", "live", {
    timeout: 60_000,
  });

  const lcp = await largestContentfulPaint(page);
  const html = await (await page.request.get("/en")).text();
  const initial = [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map(
    (match) => match[1],
  );
  const lazy = await page.evaluate(
    (initial) =>
      performance
        .getEntriesByType("resource")
        .filter(
          (entry) =>
            entry.name.endsWith(".js") &&
            !initial.includes(new URL(entry.name).pathname),
        )
        .map((entry) => entry.startTime),
    initial,
  );

  expect(lazy.length).toBeGreaterThan(0);
  for (const start of lazy) {
    expect(start).toBeGreaterThan(lcp.startTime);
  }
});
```

Run: `pnpm test:e2e tests/e2e/poster.spec.ts`
Expected: `4 failed`, `1 passed`: the LCP tests report `Expected: "IMG"` / `Received: "H1"` (desktop) and `Received: "P"` (phone), reduced motion `Received string:  "/en"`, and the cache test times out looking for `[data-stage="hero"] img`. (`the 3D chunk is requested only after the LCP` already passes.)

- [ ] **Step 2: The poster component and its cache header**

`src/components/sections/HeroPoster.tsx` (`<picture>` + `<img fetchPriority="high">`, not `next/image`: the posters are already encoded per width and orientation, `priority` is deprecated in Next 16, and the image optimizer would re-encode AVIF on a cold cache in front of the LCP):

```tsx
import { env } from "@/env";
import { type PosterManifest, srcSet } from "@/experience/poster-shots";
import posterManifest from "@/experience/posters.json";

const { shots } = posterManifest as PosterManifest;
const start = shots["hero-start"];
const end = shots["hero-end"];
const base = env.NEXT_PUBLIC_ASSET_BASE?.replace(/\/$/, "") ?? "";

/**
 * The hero's poster: the LCP element, and what tier 0 keeps. Pre-encoded
 * AVIF/WebP (scripts/posters.ts), art-directed per orientation with the same
 * `(orientation: portrait)` rule the live camera uses, so the canvas that
 * replaces it starts on the same frame. Reduced motion gets the last frame.
 */
export function HeroPoster() {
  const sources = [
    {
      media: "(prefers-reduced-motion: reduce) and (orientation: portrait)",
      image: end.portrait,
    },
    { media: "(prefers-reduced-motion: reduce)", image: end.landscape },
    { media: "(orientation: portrait)", image: start.portrait },
    { media: undefined, image: start.landscape },
  ];
  const fallback = start.landscape.webp[1] ?? start.landscape.webp[0];

  return (
    <div
      aria-hidden="true"
      data-stage="hero"
      className="stage hero-poster absolute inset-0"
    >
      <picture>
        {sources.flatMap(({ media, image }) =>
          (["avif", "webp"] as const).map((format) => (
            <source
              key={`${media ?? "default"}-${format}`}
              media={media}
              type={`image/${format}`}
              srcSet={srcSet(image[format], base)}
              sizes="100vw"
            />
          )),
        )}
        <img
          src={`${base}${fallback.src}`}
          alt=""
          width={start.landscape.width}
          height={start.landscape.height}
          fetchPriority="high"
          className="size-full object-cover"
        />
      </picture>
    </div>
  );
}
```

```diff
diff --git a/src/components/sections/Hero.tsx b/src/components/sections/Hero.tsx
--- a/src/components/sections/Hero.tsx
+++ b/src/components/sections/Hero.tsx
@@ -1,6 +1,7 @@
 import { useTranslations } from "next-intl";
 import { fallbackLang } from "@/content/localize";
 import type { Cv } from "@/content/types";
+import { HeroPoster } from "./HeroPoster";
 
 /**
  * Shot S1. The copy is SSR text over a full-bleed poster; once the live stage
@@ -16,11 +17,7 @@ export function Hero({ cv }: { cv: Cv }) {
   return (
     <section aria-labelledby="hero-title" data-scene="hero" className="hero">
       <div className="sticky top-0 flex min-h-lvh items-center overflow-hidden">
-        <div
-          aria-hidden="true"
-          data-stage="hero"
-          className="stage hero-poster absolute inset-0"
-        />
+        <HeroPoster />
         <div aria-hidden="true" className="hero-scrim absolute inset-0" />
         <div className="relative mx-auto w-full max-w-content px-gutter pt-28 pb-16">
           <div className="md:w-7/12">
```

```diff
diff --git a/next.config.ts b/next.config.ts
--- a/next.config.ts
+++ b/next.config.ts
@@ -6,6 +6,20 @@ const withNextIntl = createNextIntlPlugin();
 
 const nextConfig: NextConfig = {
   cacheComponents: true,
+  async headers() {
+    // Posters are content-hashed (scripts/posters.ts): a new image gets a new name.
+    return [
+      {
+        source: "/posters/:file",
+        headers: [
+          {
+            key: "Cache-Control",
+            value: "public, max-age=31536000, immutable",
+          },
+        ],
+      },
+    ];
+  },
   experimental: {
     serverActions: {
       // Admin uploads are capped at 4 MB (src/server/media/inspect.ts) plus
```

```diff
diff --git a/.env.example b/.env.example
--- a/.env.example
+++ b/.env.example
@@ -29,5 +29,5 @@ CONTACT_FROM_EMAIL=contact@example.com
 # Where new-message notifications go. Empty = ADMIN_EMAIL.
 CONTACT_TO_EMAIL=
 
-# Optional absolute base URL for /public media (sequences, glb). Empty = same origin.
+# Optional absolute base URL for /public media (hero posters, later a glb). Empty = same origin.
 NEXT_PUBLIC_ASSET_BASE=
```

- [ ] **Step 3: See that a full-bleed poster is not the LCP element**

Run: `pnpm test:e2e tests/e2e/poster.spec.ts`
Expected: `3 failed`, `2 passed`. The cache and chunk-order tests pass, but the LCP tests still get `Received: "H1"` / `"P"` / `"/en"`: Chrome ignores an image whose visible rect covers the whole viewport (Verified facts).

- [ ] **Step 4: Clip the poster to the area the scrim leaves visible**

The scrim is solid over the left 30 % (landscape) or the top 22 % (portrait); the poster is clipped there, so nothing visible changes, and the canvas it crossfades into sits under the same solid scrim:

```diff
diff --git a/src/app/globals.css b/src/app/globals.css
--- a/src/app/globals.css
+++ b/src/app/globals.css
@@ -188,7 +188,14 @@ html:is([data-canvas="loading"], [data-canvas="live"]) .hero {
   height: 300lvh;
 }
 
+/*
+ * The poster shows only where the scrim below is not solid. Besides keeping
+ * the copy on a flat background, this matters for LCP: Chrome skips images
+ * whose visible rect covers the whole viewport (it treats them as
+ * backgrounds), and the poster must be the LCP element.
+ */
 .hero-poster {
+  clip-path: inset(0 0 0 30%);
   transition: opacity 600ms var(--ease-out-quint);
 }
 
@@ -207,6 +214,10 @@ html[data-canvas="live"] .hero-poster {
 }
 
 @media (orientation: portrait) {
+  .hero-poster {
+    clip-path: inset(22% 0 0 0);
+  }
+
   .hero-scrim {
     background: linear-gradient(
       180deg,
```

- [ ] **Step 5: Run everything**

Run: `pnpm test:e2e tests/e2e/poster.spec.ts`
Expected: `5 passed`.

Run: `pnpm test:e2e`
Expected: `86 passed`.

Run: `rtk proxy pnpm test`, `pnpm typecheck`, `rtk proxy pnpm lint`
Expected: `Tests  241 passed (241)`; exit 0; `Checked 228 files in <n>ms. No fixes applied.`

- [ ] **Step 6: Commit**

```bash
/usr/bin/git add .env.example next.config.ts src tests
/usr/bin/git status --short
/usr/bin/git commit -m "feat(hero): serve the poster as the lcp image"
```

`src/experience/**` is untouched by this task, so `posters.test.ts` stays green without a recapture.

---

### Task 8: JS budgets and the GPU scroll harness

**Owner:** tester.

**Files:**
- Create: `tests/e2e/budgets.spec.ts`, `playwright.perf.config.ts`, `tests/perf/hero.perf.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: the built app; `html[data-canvas]`, `data-tier`, `?tier=` (Task 5).
- Produces: e2e budget tests (so CI enforces 160 / 350 KB gz); `pnpm perf:local` (Playwright on the real GPU, port 3300) asserting no long task over 50 ms while scrolling the hero and tab memory under 400 MB, and printing one JSON line per run.

- [ ] **Step 1: The budget tests**

`tests/e2e/budgets.spec.ts` (same method as M3's scratch script: `gzip -9` per module script of the server HTML; the lazy side is every script requested that the HTML did not list):

```ts
import { gzipSync } from "node:zlib";
import { expect, type Page, test } from "@playwright/test";

// Spec §3 performance budgets, measured like the M3 plan did (gzip -9 of each
// module script): public JS before 3D <= 160 KB gz, lazy 3D chunk <= 350 KB gz.
const INITIAL_BUDGET_KB = 160;
const LAZY_BUDGET_KB = 350;

const gzKb = (body: Buffer) => gzipSync(body, { level: 9 }).length / 1024;

async function initialScripts(page: Page, path: string): Promise<string[]> {
  const html = await (await page.request.get(path)).text();
  return [...html.matchAll(/<script[^>]*>/g)]
    .map((match) => match[0])
    .filter((tag) => !tag.includes("noModule"))
    .flatMap((tag) => /\ssrc="([^"]+)"/.exec(tag)?.[1] ?? []);
}

for (const path of ["/en", "/ro"]) {
  test(`${path} loads at most ${INITIAL_BUDGET_KB} KB gz of JS before 3D`, async ({
    page,
  }) => {
    let total = 0;
    for (const src of await initialScripts(page, path)) {
      total += gzKb(await (await page.request.get(src)).body());
    }
    console.log(`${path}: ${total.toFixed(1)} KB gz before 3D`);
    expect(total).toBeLessThanOrEqual(INITIAL_BUDGET_KB);
  });
}

test(`the lazy 3D chunk stays within ${LAZY_BUDGET_KB} KB gz`, async ({
  page,
}) => {
  const initial = new Set(await initialScripts(page, "/en"));
  const lazy: Promise<number>[] = [];
  page.on("response", (response) => {
    const { pathname } = new URL(response.url());
    if (
      response.request().resourceType() === "script" &&
      !initial.has(pathname)
    ) {
      lazy.push(response.body().then(gzKb));
    }
  });
  await page.goto("/en?tier=2");
  await expect(page.locator("html")).toHaveAttribute("data-canvas", "live", {
    timeout: 60_000,
  });

  const sizes = await Promise.all(lazy);
  const total = sizes.reduce((sum, size) => sum + size, 0);
  console.log(`lazy: ${sizes.length} chunk(s), ${total.toFixed(1)} KB gz`);
  expect(sizes.length).toBeGreaterThan(0);
  expect(total).toBeLessThanOrEqual(LAZY_BUDGET_KB);
});
```

- [ ] **Step 2: Prove they can fail**

Temporarily set `INITIAL_BUDGET_KB = 140` and `LAZY_BUDGET_KB = 250`, then run `pnpm test:e2e tests/e2e/budgets.spec.ts`.
Expected: `3 failed`: `Expected: <= 140` / `Received:    149.7470703125` for `/en` and `/ro`, `Expected: <= 250` / `Received:    303.7255859375` for the lazy chunk. Restore 160 and 350.

Run: `pnpm test:e2e tests/e2e/budgets.spec.ts`
Expected: `3 passed`, printing `/en: 149.7 KB gz before 3D`, `/ro: 149.7 KB gz before 3D`, `lazy: 1 chunk(s), 303.7 KB gz`.

- [ ] **Step 3: The GPU harness**

`playwright.perf.config.ts`:

```ts
import { defineConfig } from "@playwright/test";

// `pnpm perf:local`: long tasks, frame times and memory while scrolling the
// live hero, on this machine's real GPU (spec §9). Needs `pnpm build` first.
// Not part of CI: GitHub runners have no GPU, and SwiftShader numbers would
// say nothing about Intel Iris Xe.
const PORT = 3300;

export default defineConfig({
  testDir: "./tests/perf",
  testMatch: /.*\.perf\.ts/,
  workers: 1,
  timeout: 180_000,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1440, height: 900 },
    launchOptions: {
      // Headless Chromium on SwiftShader by default; ANGLE on Vulkan reaches
      // the real GPU (Mesa Intel Iris Xe here) without opening a window.
      args: [
        "--use-angle=vulkan",
        "--enable-features=Vulkan",
        "--enable-gpu",
        "--ignore-gpu-blocklist",
      ],
    },
  },
  webServer: {
    command: `next start --port ${PORT}`,
    url: `http://localhost:${PORT}/en`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
```

`tests/perf/hero.perf.ts` (tier "auto" is what a visitor on this machine gets; tier 1 checks the light path meets the same budgets):

```ts
import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";

// Spec §7 M5 acceptance on the reference machine: no long task > 50 ms while
// scrolling the hero, tab memory < 400 MB.
const LONG_TASK_BUDGET_MS = 50;
const MEMORY_BUDGET_MB = 400;

type Sample = { start: number; duration: number };

declare global {
  interface Window {
    __longTasks: Sample[];
    __frames: number[];
  }
}

/** Private (unshared) memory of a process in MB, from /proc (Linux). */
function privateMb(pid: number): number {
  const rollup = readFileSync(`/proc/${pid}/smaps_rollup`, "utf8");
  const kb = (field: string) =>
    Number(new RegExp(`^${field}:\\s+(\\d+) kB`, "m").exec(rollup)?.[1] ?? 0);
  return (kb("Private_Clean") + kb("Private_Dirty") + kb("SwapPss")) / 1024;
}

async function scrollHero(page: Page) {
  const length = await page.evaluate(() => {
    const hero = document.querySelector(".hero");
    return (hero?.getBoundingClientRect().height ?? 0) - window.innerHeight;
  });
  await page.mouse.move(720, 450);
  // Wheel notches like a mouse (Lenis smooths them), through the whole pin
  // and a screen past it, so the stage fade-out is measured too.
  const steps = Math.ceil((length + 900) / 100);
  for (let step = 0; step < steps; step += 1) {
    await page.mouse.wheel(0, 100);
    await page.waitForTimeout(40);
  }
  await page.waitForTimeout(1500);
}

for (const tier of ["auto", "1"] as const) {
  test(`scrolling the hero (tier ${tier}) stays smooth and lean`, async ({
    page,
    browser,
  }, testInfo) => {
    await page.addInitScript(() => {
      window.__longTasks = [];
      window.__frames = [];
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__longTasks.push({
            start: entry.startTime,
            duration: entry.duration,
          });
        }
      }).observe({ type: "longtask", buffered: true });
      const frame = (now: number) => {
        window.__frames.push(now);
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    await page.goto(tier === "auto" ? "/en" : `/en?tier=${tier}`);
    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-canvas", /live|poster/, {
      timeout: 30_000,
    });
    test.skip(
      (await html.getAttribute("data-canvas")) === "poster",
      "No hardware WebGL here: the classifier chose posters.",
    );
    await expect(html).toHaveAttribute("data-canvas", "live");
    await page.waitForTimeout(1000);

    const scrollStart = await page.evaluate(() => performance.now());
    await scrollHero(page);
    const { longTasks, frames, scrolled } = await page.evaluate((start) => {
      const frames = window.__frames.filter((time) => time >= start);
      return {
        longTasks: window.__longTasks,
        frames: frames.slice(1).map((time, i) => time - frames[i]),
        scrolled: window.scrollY,
      };
    }, scrollStart);

    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Performance.enable");
    const { metrics } = await cdp.send("Performance.getMetrics");
    const heapMb =
      (metrics.find((metric) => metric.name === "JSHeapUsedSize")?.value ?? 0) /
      1024 /
      1024;
    const browserCdp = await browser.newBrowserCDPSession();
    const { processInfo } = await browserCdp.send("SystemInfo.getProcessInfo");
    // The busiest renderer is this tab's; the GPU process holds its textures.
    const renderer = processInfo
      .filter((info) => info.type === "renderer")
      .sort((a, b) => b.cpuTime - a.cpuTime)[0];
    const gpu = processInfo.find((info) => info.type === "GPU");
    const rendererMb = privateMb(renderer.id);
    const gpuMb = gpu ? privateMb(gpu.id) : 0;

    const sorted = [...frames].sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
    const during = longTasks.filter((task) => task.start >= scrollStart);
    const before = longTasks.filter((task) => task.start < scrollStart);
    const report = {
      tier: await html.getAttribute("data-tier"),
      scrolledPx: scrolled,
      frames: frames.length,
      frameP95Ms: Number(p95.toFixed(1)),
      fps: Number(
        (1000 / (frames.reduce((a, b) => a + b, 0) / frames.length)).toFixed(1),
      ),
      longTasksWhileScrolling: during.map((task) => Math.round(task.duration)),
      longTasksBeforeScrolling: before.map((task) => Math.round(task.duration)),
      jsHeapMb: Number(heapMb.toFixed(1)),
      rendererPrivateMb: Number(rendererMb.toFixed(1)),
      gpuProcessPrivateMb: Number(gpuMb.toFixed(1)),
      tabMb: Number((rendererMb + gpuMb).toFixed(1)),
    };
    console.log(JSON.stringify(report));
    await testInfo.attach("perf.json", {
      body: JSON.stringify(report, null, 2),
      contentType: "application/json",
    });

    expect(scrolled).toBeGreaterThan(900);
    expect(
      Math.max(0, ...during.map((task) => task.duration)),
    ).toBeLessThanOrEqual(LONG_TASK_BUDGET_MS);
    expect(report.tabMb).toBeLessThan(MEMORY_BUDGET_MB);
  });
}
```

```diff
diff --git a/package.json b/package.json
--- a/package.json
+++ b/package.json
@@ -20,7 +20,8 @@
     "db:migrate": "node --env-file-if-exists=.env.local --import tsx scripts/db-migrate.ts",
     "db:seed": "node --env-file-if-exists=.env.local --import tsx scripts/db-seed.ts",
     "admin:create": "node --env-file-if-exists=.env.local --import tsx scripts/admin-create.ts",
-    "assets:posters": "node --import tsx scripts/posters.ts"
+    "assets:posters": "node --import tsx scripts/posters.ts",
+    "perf:local": "playwright test -c playwright.perf.config.ts"
   },
   "dependencies": {
     "@better-auth/passkey": "1.7.5",
```

- [ ] **Step 4: Run it**

```bash
pnpm build
pnpm perf:local
```

Expected (numbers vary a little per run; the long-task list while scrolling must be empty):

```text
$ playwright test -c playwright.perf.config.ts

Running 2 tests using 1 worker

{"tier":"2","scrolledPx":2700,"frames":201,"frameP95Ms":16.7,"fps":60,"longTasksWhileScrolling":[],"longTasksBeforeScrolling":[51,91,125],"jsHeapMb":11.6,"rendererPrivateMb":87.3,"gpuProcessPrivateMb":57,"tabMb":144.2}
  ✓  1 tests/perf/hero.perf.ts:43:7 › scrolling the hero (tier auto) stays smooth and lean (5.4s)
{"tier":"1","scrolledPx":2700,"frames":203,"frameP95Ms":16.7,"fps":60,"longTasksWhileScrolling":[],"longTasksBeforeScrolling":[52,103,83],"jsHeapMb":9.7,"rendererPrivateMb":87.4,"gpuProcessPrivateMb":56.8,"tabMb":144.1}
  ✓  2 tests/perf/hero.perf.ts:43:7 › scrolling the hero (tier 1) stays smooth and lean (5.4s)

  2 passed (11.7s)
```

Afterwards `ss -ltn | grep ':3300 '` prints nothing. To see the harness fail, set `MEMORY_BUDGET_MB = 100` and rerun: `2 failed` with `Expected: < 100` / `Received:   144.1`. Restore 400.

- [ ] **Step 5: Lint, typecheck, commit**

Run: `pnpm typecheck` and `rtk proxy pnpm lint`
Expected: exit 0; `Checked 231 files in <n>ms. No fixes applied.` (`tests/tsconfig.json` covers `tests/perf`; Vitest only picks up `tests/unit` and `tests/db`, the e2e config only `tests/e2e`.)

```bash
/usr/bin/git add package.json playwright.perf.config.ts tests
/usr/bin/git status --short
/usr/bin/git commit -m "test(perf): add js budgets and gpu scroll harness"
```

---

### Task 9: Docs and the M5 gate

**Owner:** frontend-engineer (README); the Overseer runs the gate in Step 3 itself as evidence.

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: everything above.
- Produces: the "Motion and 3D" documentation; the M5 acceptance evidence.

- [ ] **Step 1: Document motion, posters and the perf checks**

````diff
diff --git a/README.md b/README.md
--- a/README.md
+++ b/README.md
@@ -42,11 +42,57 @@ gave `pnpm admin:create`).
 | `pnpm test` | Vitest unit tests (`tests/unit`) |
 | `pnpm test:e2e` | Playwright e2e (`tests/e2e`, incl. axe); builds and serves on port 3100 |
 | `pnpm lhci` | Lighthouse CI, desktop preset, on port 3200; asserts >= 0.95 in all 4 categories. Run `pnpm build` first |
+| `pnpm assets:posters` | Capture the hero posters from the 3D scene into `public/posters` + `src/experience/posters.json` (port 3400). Run `pnpm build` first |
+| `pnpm perf:local` | Long tasks, frame times and memory while scrolling the live hero, on this machine's GPU (port 3300). Run `pnpm build` first |
 | `pnpm db:generate --name <name>` | Drizzle Kit: write a SQL migration in `drizzle/` from schema changes (no database needed) |
 | `pnpm db:migrate` | Apply pending migrations to `DATABASE_URL` |
 | `pnpm db:seed` | Load the fixture CV into an empty database; `--reset` replaces all CV content |
 | `pnpm admin:create` | Create the owner account for `ADMIN_EMAIL` or reset its password; `--reset-2fa` also removes TOTP and passkeys |
 
+## Motion and 3D
+
+The hero is a real-time three.js scene (React Three Fiber): a procedural
+"stack" of five slabs, scrubbed by scroll. Everything 3D lives in
+`src/experience/` and loads as one lazy chunk after the page has loaded, so
+the first paint is the server-rendered text over a poster image.
+
+- **Tiers.** After the load event, `StageLoader` picks a tier from the WebGL
+  renderer string: 0 = posters only (no WebGL 2 or a software renderer),
+  1 = light scene (DPR 1, no glass transmission, no post-processing), 2 =
+  reference (Intel Iris Xe, DPR up to 1.5, bloom + FXAA), 3 = discrete GPUs
+  (DPR up to 2). If frames stay slower than 40 fps while scrolling, the stage
+  steps down a tier, and below tier 1 it gives up and shows the poster. A lost
+  WebGL context also falls back to the poster.
+- **Motion switch.** The **Motion** button in the header turns all of it off
+  (posters, native scrolling, no pinned hero) and remembers the choice.
+  `prefers-reduced-motion` and Save-Data start with motion off.
+- **Query flags** (any page): `?tier=0..3` forces a tier;
+  `?capture=hero&p=0..1` renders one frame of the hero shot for poster capture.
+- **Posters.** `public/posters` holds content-hashed AVIF/WebP captures of
+  the first and last hero frame, landscape and portrait. They are the LCP
+  image, the tier-0 hero, and what reduced motion shows (the last frame).
+  After changing anything in `src/experience/{Stage.tsx,director,postfx,scenes}`
+  regenerate and commit them, or `pnpm test` fails. The capture runs against
+  the production build; build again afterwards so the page uses the new
+  manifest:
+
+  ```bash
+  pnpm build
+  pnpm assets:posters
+  pnpm build
+  ```
+
+  `POSTERS_SOFTWARE=1 pnpm assets:posters` renders with SwiftShader where no
+  GPU is available (slower, slightly different pixels).
+- **Performance check.** `pnpm build && pnpm perf:local` scrolls the hero on
+  the real GPU and fails on a long task over 50 ms or more than 400 MB of tab
+  memory. The JS budgets (160 KB gz before 3D, 350 KB gz for the 3D chunk)
+  are e2e tests (`tests/e2e/budgets.spec.ts`), so CI enforces them.
+- **Swapping in a modelled stack.** Shots find objects by the asset-contract
+  names (`layer_interface` … `layer_craft`, `engrave_hero`,
+  `engrave_contact`, `led_status`, `pcb_traces`); a `stack.glb` with the same
+  names can replace `ProceduralStack` in `src/experience/scenes/StackModel.tsx`.
+
 ## Local database
 
 `docker compose up -d --wait` starts `postgres:18-alpine` on `127.0.0.1:5432`
````

Run: `rtk proxy pnpm lint`
Expected: `Checked 231 files in <n>ms. No fixes applied.`

```bash
/usr/bin/git add README.md
/usr/bin/git status --short
/usr/bin/git commit -m "docs: document motion, posters and perf checks"
```

- [ ] **Step 2: Check the history**

Run: `/usr/bin/git log --oneline dev..HEAD`
Expected (newest first):

```
docs: document motion, posters and perf checks
test(perf): add js budgets and gpu scroll harness
feat(hero): serve the poster as the lcp image
feat(posters): capture hero posters from the scene
feat(stage): render the live hero stage
feat(director): add scroll store and hero shot
feat(stage): add procedural stack model
feat(motion): add motion switch and gpu tiers
docs(spec): amend for three.js-only 3D
```

No commit message contains AI attribution: `/usr/bin/git log dev..HEAD --format=%B | grep -ciE 'co-authored|claude|generated with'` prints `0`. The owner's address is in no commit: `/usr/bin/git diff dev..HEAD | grep -cF "$(grep ^ADMIN_EMAIL= .env.local | cut -d= -f2)"` prints `0`.

- [ ] **Step 3: Run the full gate on a fresh clone (M5 acceptance)**

This proves the committed branch passes with no local-only files (no `.env.local`, a random `BETTER_AUTH_SECRET`, the docker Postgres from `docker compose up -d --wait`) and adds the GPU checks CI cannot run. Replace `<scratch>` with the session scratchpad directory:

```bash
cat > <scratch>/m5-gate.sh <<'EOF'
#!/usr/bin/env bash
set -e
REPO="$1"
BRANCH="${2:-feat/m5-motion-core}"
CI_DIR="$(mktemp -d)/cv-ci"
/usr/bin/git clone -q --branch "$BRANCH" "$REPO" "$CI_DIR"
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
pnpm perf:local
SITE_URL=http://localhost:3200 pnpm build
pnpm lhci
echo "gate=0"
cd /
rm -rf "$CI_DIR"
EOF
chmod +x <scratch>/m5-gate.sh
rtk proxy <scratch>/m5-gate.sh "$(/usr/bin/git rev-parse --path-format=absolute --git-common-dir)"
```

Expected, in order:
- `✓ Types generated successfully`
- `Checked 231 files … No fixes applied.`
- `Test Files  33 passed (33)`, `Tests  241 passed (241)`
- `migrations applied`; `seeded CV content` (or `skipped: CV content already exists (use --reset to replace it)`)
- `✓ Compiled successfully`, with `│ ├ ○ /en` and `│ └ ○ /ro` still static
- e2e: `/en: 149.7 KB gz before 3D`, `/ro: 149.7 KB gz before 3D`, `lazy: 1 chunk(s), 303.7 KB gz`, the two expected `contact: … failed Error: EEXIST …` web-server lines from M3's outage test, then `89 passed` and `::notice title=🎭 Playwright Run Summary::  89 passed`
- perf: two JSON lines with `"longTasksWhileScrolling":[]` and `"tabMb"` around 143, then `2 passed`
- LHCI: `Checking assertions against 2 URL(s), 6 total run(s)`, `All results processed!`
- finally `gate=0`

Afterwards `ss -ltn | grep -E ':(3100|3200|3300|3400) '` prints nothing. Measured on 2026-09-25 (throwaway Postgres 18 container): `gate=0`; e2e 34.4 s; perf tier 2 `{"frames":204,"frameP95Ms":16.7,"fps":60,"longTasksWhileScrolling":[],"longTasksBeforeScrolling":[52,76,128],"jsHeapMb":12.6,"rendererPrivateMb":86.2,"gpuProcessPrivateMb":56.7,"tabMb":142.9}`; LHCI 100 / 100 / 100 / 100 on `/en` and `/ro` in all 3 runs, LCP 595–637 ms, TBT 0, CLS 0, LCP element the poster `img`.

This covers the spec §7 M5 acceptance and the brief:
- **No long task > 50 ms on Iris Xe (while scrolling the hero):** `tests/perf/hero.perf.ts` (Task 8), tiers auto (= 2) and 1: none. Mount-time long tasks at idle after load are reported separately (see Deviations).
- **Tab memory < 400 MB:** same test, renderer + GPU process private memory 142.9 MB.
- **Reduced motion = posters:** `motion.spec.ts` › `starts with motion off: poster only, hero not pinned`, `stage.spec.ts` › `with reduced motion › never downloads the 3D chunk`, `poster.spec.ts` › `shows the finished monolith instead of the first frame`.
- **LCP = poster:** `poster.spec.ts` › `the hero poster is the LCP element (desktop)` and `a phone gets the portrait poster`; LHCI's LCP element.
- **Public JS before 3D ≤ 160 KB gz, lazy 3D chunk ≤ 350 KB gz, after LCP:** `budgets.spec.ts` (149.7 / 303.7) and `poster.spec.ts` › `the 3D chunk is requested only after the LCP`; the chunk is requested from an idle callback after the load event (`StageLoader`).
- **LHCI ≥ 95:** 100 in all four categories.
- **72 e2e stay green, axe clean:** 89 passed, including the four axe tests.

- [ ] **Step 4: Optional manual check (real browser)**

`pnpm build`, then `pnpm exec next start --port 3300`, open `http://localhost:3300/en` in Chrome. Scroll the hero slowly and quickly; press **Motion** (the hero collapses to the poster, scrolling turns native), press it again. In DevTools › Rendering, emulate `prefers-reduced-motion: reduce` and reload: the finished monolith, no pin. `http://localhost:3300/en?tier=1` shows the light scene (the glass is see-through instead of refractive). No pass/fail here beyond the automated gate.

Merging `feat/m5-motion-core` into `dev` and deciding when to push follow the Overseer flow: **never push unprompted**. CI needs no change: the new unit tests (including the stale-poster check) run in the `check` job, and the new e2e tests (budgets included) run in the Playwright container on SwiftShader.

---

## Self-review

- **Spec coverage (§3, §7 M5 row, amendment, brief):**
  - Single RAF loop: `scroll/loop.ts` (GSAP ticker → `lenis.raf` → callback; Lenis `scroll` → `ScrollTrigger.update`); `Director` calls R3F `advance()` with `frameloop="never"`; zustand vanilla store per section; renders only when the store is dirty and the tab is visible (Tasks 4–5).
  - Persistent stage: fixed, full-viewport, `aria-hidden`, `next/dynamic` with `ssr: false`, mounted after the load event and `requestIdleCallback`; text stays SSR (Task 5).
  - Tiers T0–T3 with the Motion switch, `?tier=` override, runtime downgrade and context-loss fallback (Tasks 2, 4, 5); T1 decision justified by measurement (Verified facts).
  - Procedural StackScene with the contract names, glass (transmission + iridescence), brushed titanium (anisotropy), ceramic (clearcoat), canvas-drawn PCB with a separate `pcb_traces` ribbon (U 0 → 1), anodized aluminium, `led_status`, `engrave_hero`, `engrave_contact`; studio environment from softbox planes; AgX; `StackModel` seam (Task 3).
  - Real-time hero S1: dolly, sweep, etching reveal, pull-back; landscape and portrait framing matched to the poster crop (Tasks 4–5). Other sections: `SHOTS` registry and `stackLayout(explode)` ready for M6.
  - Posters: script, committed AVIF/WebP at the spec widths, manifest, stale check, `<picture>` LCP element, immutable caching, `NEXT_PUBLIC_ASSET_BASE` (Tasks 6–7).
  - Acceptance: Task 9, Step 3.
- **Deliberate deviations (for the Overseer to confirm or overrule):**
  - Spec §1/§3 Blender, SequencePlayer, LFS, M4: replaced per the owner's 2026-09-24 decision (Task 1 amends the spec).
  - **No drei.** `Environment` + `Lightformer` → a PMREM environment baked from softbox planes (same look; drei's module pulls EXR/RGBE/gain-map loaders); `ContactShadows` (48.2 KB gz) → a baked blurred-square shadow texture; `PerformanceMonitor` → `frame-monitor.ts` (drei's counts idle time as slow frames). Measured lazy chunk: 391.9 → 303.7 KB gz.
  - **No `@react-three/postprocessing`**: `postprocessing` used directly (the wrapper bundles N8AO and every effect).
  - **FXAA instead of SMAA at T2** (SMAA +54 KB gz of embedded lookup textures). T3 extras (DOF, N8AO, chromatic aberration) move to M6 with the tiered post chain the spec gives M6 anyway.
  - **No detect-gpu** (runtime fetch from unpkg); tiers come from the renderer string plus `pointer: coarse`, cores and `deviceMemory`.
  - **`<picture>` instead of `<Image priority>`** for the poster (pre-encoded, art-directed; `priority` is deprecated in Next 16; the optimizer would re-encode on a cold cache).
  - **The poster is clipped** (`clip-path`) to the area right of (landscape) or below (portrait) the solid part of the scrim, because Chrome never counts a full-viewport image as LCP.
  - **The header overlays the hero** (absolute), so the hero's sticky frame, the poster and the fixed canvas share one box. The 404 page's own padding clears it.
  - **The hero pin is CSS `position: sticky`** in a 300lvh section (200lvh of scrub), switched on by `html[data-canvas="loading|live"]`; ScrollTrigger only measures. Tier 0 keeps a one-screen hero.
  - **Reduced motion shows the last frame** (`hero-end`, the whole monolith) instead of the first macro frame, via `(prefers-reduced-motion: reduce)` sources in the `<picture>`.
  - **Mount-time long tasks:** mounting the stage at idle after the load event costs three long tasks (about 51, 76–103 and 125–128 ms on the Iris Xe): chunk evaluation, renderer + model + environment, first frame with shader compilation. The acceptance ("while scrolling") holds with zero; `compileAsync` was tried and gave no measurable gain. Splitting the mount over several idle callbacks is an M6 item.
  - **Etching text is a constant** (`ENGRAVE_HERO_TEXT`, placeholder "Mihai Dorobat — Full-stack Engineer" as two lines), not the profile name from the database (the fixtures say "Alex Marin"): changing it means a poster recapture anyway.
  - **Deferred to M6:** pointer rim light and parallax, S2/S3, PCB pulse shader, LED pulse on contact success, CSS grain/vignette overlay.
  - `html[data-canvas]` (not `data-stage`) carries the stage state, because `[data-stage="hero"]` already names the poster frame in M1's tests.
- **Open questions for the owner:**
  1. What should `engrave_hero` say, and should it follow the CV name from the admin (each change then needs `pnpm assets:posters` and a deploy)?
  2. Is the finished monolith right for reduced motion, or should those visitors see the first frame like everyone else?
  3. Is a 200lvh scrub the right hero length, and should the stage stay visible behind About (M6) or fade after the hero as now?
  4. The greybox look: the glass reads dark and the portrait end frame is small; OK to leave for M7 look-dev?
  5. The **Motion** switch sits in the header next to the language switcher, labelled "Motion"/"Animație": right place and wording?
  6. R3F 9.8 + three 0.186 log one `THREE.Clock … deprecated` console warning on live tiers; acceptable until R3F moves to `THREE.Timer`?
- **Placeholder scan:** no TBD or TODO. Every code step has the complete file or the exact diff, taken from the verified commits. `<n>`, `<scratch>` and `<owner email>` appear only where values vary by machine or must stay private. `pnpm-lock.yaml`, `posters.json` and `public/posters/*` come from commands, never typed by hand.
- **Name consistency:**
  - Motion and tiers: `MotionChoice`, `MOTION_STORAGE_KEY`, `resolveMotion`, `motionEnabled`, `setMotionChoice`, `subscribeMotion`, `useMotion`, `MotionToggle`, `MotionToggleLabels`, `Tier`, `LiveTier`, `GpuSignals`, `classifyTier`, `tierOverride`, `lowerTier`, `readGpuSignals`.
  - Model: `STACK_OBJECTS`, `LayerObjectName`, `layerObjectName`, `STACK_FOOTPRINT`, `STACK_HEIGHT`, `STACK_GAP`, `LAYER_HEIGHT`, `LayerPlacement`, `stackLayout`, `PCB_TRACE_PATH`, `traceRibbon`, `ENGRAVE_HERO_TEXT`, `ENGRAVE_CONTACT_TEXT`, `etchingTexture`, `pcbTexture`, `StackMaterials`, `createStackMaterials`, `disposeMaterials`, `StackModel`, `StudioLights`.
  - Director: `SCENE_IDS`, `Capture`, `captureFromSearch`, `StageState`, `createStageStore`, `StageStore`, `createFrameMonitor`, `Orientation`, `REFERENCE_SIZE`, `orientationOf`, `coverViewOffset`, `ViewOffset`, `Vec3`, `CameraKey`, `clamp01`, `smoothstep`, `sampleCameraKeys`, `HERO_KEYS`, `HeroFrame`, `heroFrame`, `startLoop`, `trackSections`, `ShotProps`, `SHOTS`, `Director`, `HeroShot`, `Effects`, `Stage`, `StageProps`, `StageLoader`.
  - Posters: `POSTER_SHOTS`, `PosterName`, `POSTER_WIDTHS`, `PosterSource`, `PosterImage`, `PosterManifest`, `srcSet`, `POSTER_SOURCES`, `posterSourceHash`, `HeroPoster`.
  - DOM contract: `html[data-motion|data-canvas|data-tier|data-capture]`, `.stage-layer`, `.hero`, `.hero-poster`, `.hero-scrim`, `[data-stage="hero"]`, `[data-scene]`. Ports 3100 (e2e), 3200 (LHCI), 3300 (perf), 3400 (posters).
- **Review Focus:** all five items have tests in the owning tasks: T7 full-viewport LCP; T5 (+T2) software renderer; T5 context loss; T4 idle-gap monitor; T6 stale posters.
