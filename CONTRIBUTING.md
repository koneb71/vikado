# Contributing to Vikado

Thanks for considering a contribution. Vikado is a local-first, web-based video
editor: the browser does all editing and preview, and a small stateless Rust
service renders the final MP4 with ffmpeg. The project is MIT licensed and lives
at <https://github.com/koneb71/vikado>.

This document covers how to get the project running, how to run every check CI
runs, and the two rules that matter more than anything else in this codebase:
how to change the project schema, and how to keep the browser preview and the
ffmpeg render producing the same image.

If you are new to the codebase, read [README.md](README.md) first, then
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the pipeline in detail.

## Prerequisites

| Tool | Version | Why |
| --- | --- | --- |
| Node.js | 22 or newer | Builds and runs the frontend. CI builds on 22; `docker/Dockerfile` uses `node:22-slim`. |
| pnpm | 11 | The only supported package manager for `web/`. CI pins version 11. |
| Rust | current stable | Builds the three crates. CI uses `dtolnay/rust-toolchain@stable`; there is no `rust-toolchain.toml`, and the workspace is on edition 2021. |
| ffmpeg + ffprobe | on `PATH` | The renderer spawns `ffmpeg`; the golden-render tests also call `ffprobe`. No minimum is enforced, but the emitted graph is kept working on the 5.1 that the Docker image ships — see [ffmpeg versions](#ffmpeg-versions). |
| Docker | optional | Only needed for the container workflows below. |

pnpm is easiest to install through corepack, which ships with Node.

```sh
corepack enable
```

Make sure the Rust components CI checks are installed.

```sh
rustup component add rustfmt clippy
```

Confirm ffmpeg is visible to your shell before running the render service.

```sh
ffmpeg -version
```

You only need ffmpeg for the render service and for the tests that shell out to
it. Frontend-only work needs Node and pnpm alone.

## Running the editor in development

Development uses two processes in two terminals. The frontend is served by Vite
and proxies its API calls to the Rust service.

Terminal 1 — the render service, from the repository root (the relative fonts
path is resolved against the working directory):

```sh
VIKADO_FONTS_DIR=web/public/fonts cargo run -p vikado-server
```

Terminal 2 — install frontend dependencies once:

```sh
cd web && pnpm install
```

Then start the dev server and open <http://localhost:5173>:

```sh
pnpm dev
```

`VIKADO_FONTS_DIR` matters more than it looks. It is the directory libass
searches when the renderer draws text and subtitles, and it must be the same
`web/public/fonts` the browser loads its webfonts from. The server silently
ignores the variable when the path does not exist (see
`crates/vikado-server/src/main.rs`), so a typo produces exports whose text is
drawn with some other font — a preview/export mismatch rather than an error.

### Ports

| Port | Process | Notes |
| --- | --- | --- |
| 5173 | Vite dev server | The editor you open in the browser. Set `PORT` to move it. |
| 3000 | `vikado-server` | Serves the job API under `/api/v1`. Set `VIKADO_PORT` to move it. |
| 3005 | `docker compose up` | Host port mapped to container 3000 in `docker-compose.yml`. `VIKADO_PORT` overrides. |
| 3006 | `docker compose -f docker-compose.dev.yml up` | Host port for the dev server. Deliberately not 3005, so the dev and production stacks can run side by side. `VIKADO_DEV_PORT` overrides. |

Vite proxies `/api` to `http://localhost:3000` by default. If you move the
service, point the frontend at it with `VIKADO_API_URL`:

```sh
VIKADO_PORT=3111 cargo run -p vikado-server
```

```sh
VIKADO_API_URL=http://localhost:3111 pnpm dev
```

### Rendering without the server

The renderer has a dev CLI, which is the fastest way to iterate on the
filtergraph. Files in the assets directory must be named by their sha-256 hex
hash, which is how the editor uploads them. Run it from the repository root:

```sh
cargo run -p vikado-renderer -- project.json assets-dir out.mp4 --fonts web/public/fonts
```

`fixtures/minimal-project.json` is a ready-made project to point it at; stage
`fixtures/media` into an assets directory under hash names first, the same way
`stage_assets` in `crates/vikado-renderer/tests/golden_render.rs` does.

### Docker

A single production container builds the frontend, builds the server, and serves
both. It listens on host port 3005.

```sh
docker compose up --build
```

Both halves also run in containers with hot reload — Vite on 5173, `cargo watch`
rebuilding the server on host port 3006.

```sh
docker compose -f docker-compose.dev.yml up --build
```

### Server environment variables

All are read in `crates/vikado-server/src/main.rs`.

| Variable | Default | Meaning |
| --- | --- | --- |
| `VIKADO_PORT` | `3000` | TCP port; the server binds `0.0.0.0`. |
| `VIKADO_DATA_DIR` | `./data` | Root for per-job workspaces. |
| `VIKADO_STATIC_DIR` | unset | When set, serves a built frontend from this directory with an SPA fallback. |
| `VIKADO_FONTS_DIR` | unset | Fonts directory handed to libass. Ignored if the path does not exist. |
| `VIKADO_MAX_UPLOAD_BYTES` | `2147483648` (2 GiB) | Request body limit for asset uploads. |
| `VIKADO_MAX_CONCURRENT_RENDERS` | `1` | Number of ffmpeg processes allowed at once. |
| `VIKADO_JOB_TTL_HOURS` | `24` | Age at which the sweeper deletes a job workspace. It runs every 10 minutes. |

The API has no authentication of any kind, and CORS is permissive. Anyone who
can reach it can create jobs, upload files, and download renders. The bind
address is not configurable — the server always listens on `0.0.0.0`, so a dev
instance is reachable from your local network. Firewall it during development,
and put it behind an authenticating reverse proxy anywhere else.

## Repository layout

```
crates/vikado-types      The project schema (serde + ts-rs). The source of truth;
                         exports TypeScript bindings into web/src/generated.
crates/vikado-renderer   Project -> ffmpeg filter_complex compiler, the ASS
                         emitter for text and subtitles, the ffmpeg process
                         supervisor and progress parsing, plus the dev CLI.
crates/vikado-server     Axum job API, SSE progress, optional static hosting of
                         the built frontend. The router lives in lib.rs so the
                         integration tests can drive it in-process.
web/src/schema           Hand-kept zod mirror of the schema: validation,
                         defaults, filter matrices, the bundled font list.
web/src/generated        ts-rs output plus drift-check.ts. Generated; do not
                         hand-edit.
web/src/engine           Preview: PlaybackController (rAF loop), frameGraph
                         (the layer stack, shared with the exporter), the WebGL2
                         Compositor and shaders, AudioGraph, TextRenderer,
                         MediaPool.
web/src/editor           UI: timeline, inspector, sidebar panels, preview area.
web/src/media            Import, OPFS storage, metadata probing, thumbnails,
                         waveforms, screen and webcam recording.
web/src/captions         In-browser Whisper transcription worker.
web/src/export           Both export engines: localExport (WebCodecs, in the
                         browser) and the render client (job create, upload,
                         SSE, download).
web/src/lib              Pure helpers: timeline operations, keyframes, SRT,
                         clipboard, clip factories, freeze frame.
fixtures/                Tiny test media (fixtures/media) plus
                         minimal-project.json, both used by the Rust tests.
                         portrait.mp4 is coded landscape with a 90-degree
                         display matrix — use it whenever you touch how a
                         decoded frame reaches the compositor, since that is
                         the case where preview and export can disagree.
                         rotate_tkhd.py regenerates that matrix.
docker/                  Dockerfile (node build -> rust build -> debian+ffmpeg
                         runtime) and Dockerfile.dev.
web/public/fonts/        The bundled OFL TTFs used by BOTH the browser preview
                         and libass on the server.
```

## Tests and checks

CI (`.github/workflows/ci.yml`) runs three jobs: `web`, `rust`, and
`ts-bindings-fresh`. Everything below except `pnpm lint` is what those jobs run,
so a green local run is a good predictor of green CI.

Frontend unit tests (currently 48 tests across 5 files):

```sh
cd web && pnpm vitest run
```

Type-check the frontend and produce a production build. This also type-checks
`web/src/generated/drift-check.ts`, which is the compile-time assertion that the
hand-written zod schema still matches the generated Rust types:

```sh
cd web && pnpm build
```

Lint the frontend with oxlint. CI does not run this yet, and the rules currently
report warnings rather than errors, so it exits 0 either way — read the output
rather than trusting the exit code, and do not add new warnings:

```sh
cd web && pnpm lint
```

The Rust test suite (currently 38 tests, plus 2 that are `#[ignore]`d):

```sh
cargo test --workspace
```

Formatting and lints, both enforced in CI:

```sh
cargo fmt --all --check
```

```sh
cargo clippy --workspace -- -D warnings
```

The two `#[ignore]`d suites need real ffmpeg and the fixture media. CI runs both;
run them locally whenever you touch the filtergraph, the ASS emitter, or the
render lifecycle.

```sh
cargo test -p vikado-renderer --test golden_render -- --ignored
```

```sh
cargo test -p vikado-server --test api -- --ignored
```

The golden render stages `fixtures/media` under content-hash names, renders
through real ffmpeg, and asserts the output's shape with `ffprobe`. The server
suite drives the whole job lifecycle — create, upload, render, download — against
an in-process router.

## Changing the project schema

The schema is defined in two places on purpose, and they are checked against each
other at build time:

- `crates/vikado-types/src/lib.rs` is the **source of truth** (serde + ts-rs).
- `web/src/generated/` is **generated** from it by ts-rs. Never hand-edit it.
- `web/src/schema/project.ts` is a **hand-kept zod mirror** that provides runtime
  validation and, crucially, the defaults the editor applies when it loads a
  saved project.

### Every new field needs a default. This is not optional.

Projects live in the user's browser, in IndexedDB. There is no migration server
and no upgrade step: the next time someone opens a project they saved last month,
the editor parses that old JSON with today's zod schema
(`openProject` in `web/src/state/projectStore.ts` re-parses through
`zProject.parse` precisely so older documents pick up new fields' defaults). The
same document is then POSTed verbatim to the render service, where serde parses
it with today's Rust types.

A field without a default breaks both halves: zod validation fails and the editor
logs the error and opens the document unmigrated, and the render request is
rejected. Add `#[serde(default)]` (or `#[serde(default = "...")]` for a non-`Default`
value) on the Rust side and `.default(...)` on the zod side, every time.

`SCHEMA_VERSION` is 1 and the server rejects any other value with
`422 UNSUPPORTED_SCHEMA`, so schema growth is additive: add defaulted fields
rather than bumping the version.

### The recipe

1. **Add the field to the Rust type** in `crates/vikado-types/src/lib.rs` with a
   serde default. In a plain struct (`Transform`, `TextStyle`, `Project`, …):

   ```rust
   #[serde(default)]
   pub sharpen: f64,
   ```

   `Clip` is an enum of struct variants, so a per-clip field goes inside the
   relevant variant and takes no `pub`:

   ```rust
   #[serde(default)]
   sharpen: f64,
   ```

   Rust fields are snake_case. Every container whose fields need it — including
   each `Clip` variant — carries `#[serde(rename_all = "camelCase")]`, so the
   wire name is camelCase. `Transform`, `Crop`, `Transition` and `Keyframe` do
   not carry the attribute because their field names are single words; add it if
   you give one of them a multi-word field.

2. **Add the field to the zod mirror** in `web/src/schema/project.ts` with a
   matching default:

   ```ts
   sharpen: z.number().default(0),
   ```

3. **Regenerate the TypeScript bindings.** Run this from the repository root; the
   export directory is resolved relative to the crate:

   ```sh
   TS_RS_EXPORT_DIR=../../web/src/generated cargo test -p vikado-types export
   ```

   Commit the regenerated files. The `ts-bindings-fresh` CI job re-runs this
   command and fails on any diff. Note that a plain `cargo test` also runs those
   export tests, and without the environment variable ts-rs writes its default
   `crates/vikado-types/bindings/` instead. That copy is not used by anything;
   `web/src/generated/` is the one the frontend compiles against.

4. **Update the clip factories** in `web/src/lib/clipFactory.ts` (`clipFromAsset`,
   `newTextClip`) so newly created clips carry the field explicitly rather than
   relying on the zod default.

5. **Update the Rust test fixtures**: the constructors in
   `crates/vikado-renderer/tests/graph_snapshots.rs` and
   `crates/vikado-renderer/tests/golden_render.rs` build `Clip` values as
   literals, and a serde default does nothing for a literal, so the tests stop
   compiling until you add the field there too. `fixtures/minimal-project.json`
   is deserialized by `vikado-types`' `fixture_roundtrip` test and does *not*
   need the field (that is the point of the serde default) — add it there only
   when you want the round-trip covered.

6. **Implement the feature on both sides** — see the parity rule below — and add a
   filtergraph snapshot that exercises it.

7. **Verify**:

   ```sh
   cd web && pnpm build && pnpm vitest run
   ```

   ```sh
   cargo test --workspace
   ```

## The preview/render parity rule

Since the in-browser exporter landed, three things can render a project: the live
preview, an export on the user's device, and an export on the render service. Only
two implementations exist, though — the preview and the local export share
`web/src/engine/frameGraph.ts`, so a visual feature added there is automatically
correct in both. The rule below is therefore about one boundary: the browser
implementation versus the ffmpeg one in `crates/vikado-renderer/src/filtergraph.rs`.

This is the central design constraint of the project:

> The browser preview and the ffmpeg render must produce the same image.

Every visual feature is therefore implemented twice — once in GLSL or Canvas2D
for the preview, once as ffmpeg filters for the export. The two implementations
are not independent; they are a contract, and each side carries a comment naming
its counterpart. **If you change one side, you must change the other in the same
commit.**

### The existing contracts

| Contract | Preview side | Renderer side |
| --- | --- | --- |
| Color math | `web/src/engine/compositor/shaders.ts` (`LAYER_FRAG_SRC`) | `filtergraph.rs`: `eq` and `lutrgb` |
| Filter presets | `web/src/schema/filters.ts` (4x4 matrices) | `preset_chain()` in `filtergraph.rs` |
| Chroma key | `LAYER_FRAG_SRC` keying block | `colorkey` in `filtergraph.rs` |
| Keyframes | `sampleTrack` / `easeProgress` in `web/src/lib/keyframes.ts` | `kf_expr()` in `filtergraph.rs` |
| Text and subtitles | `web/src/engine/TextRenderer.ts`, `web/src/schema/fonts.ts` | `crates/vikado-renderer/src/ass.rs` + libass |
| Crop | `PlaybackController.layerFor` | `crop=` in `filtergraph.rs` |
| Transitions | `transitionWindow` in `web/src/engine/activeClips.ts`, `PlaybackController.pushTransitionLayers` | transition handling in `filtergraph.rs` |
| Background blur | `PlaybackController.backdropLayer` | cover-scale, `crop`, `gblur` in `filtergraph.rs` |

The specifics worth knowing before you touch any of them:

**Color math.** Brightness `b` maps to `eq brightness=b`, contrast `c` to
`eq contrast=1+c`, saturation `s` to `eq saturation=1+s`. Temperature `w` shifts
red up and blue down by `0.1w` in the shader's 0..1 space, which is the same
shift as `lutrgb`'s `±25.5w` on a 0..255 scale. Luma is BT.601
(`0.299, 0.587, 0.114`), which is what `eq` uses.

**Chroma key, and why it is `colorkey` and not `chromakey`.** ffmpeg's YUV
`chromakey` filter was tried first and rejected. It compares limited-range video
planes against a full-range key color, which introduces a colorspace-dependent
threshold offset (roughly 0.046 on BT.601) that a browser cannot reproduce: the
preview would key more aggressively than the export, and the gap would move with
the source's colorspace. Both sides now key on decoded RGB with the same
euclidean distance, `|rgb - key| / sqrt(3)`, and ramp alpha over
`[similarity, similarity + blend]`. Do not "simplify" this back to `chromakey`.

**Keyframes.** The four easings are `linear` (`p`), `ease-in` (`p²`), `ease-out`
(`p(2-p)`) and `ease-in-out` (`p²(3-2p)`). A property with any keyframes ignores
its static transform value; between keyframes the value interpolates using the
*left* keyframe's easing, and outside the range it clamps to the nearest
keyframe. `kf_expr()` compiles exactly that into an ffmpeg expression, using
`st(0)`/`ld(0)` to reuse the progress term inside the easing warps. Text clips
are the one exception: the ASS emitter cannot animate a transform, so the
inspector hides the keyframe toggles for text (`allowKf` in
`web/src/editor/inspector/InspectorPanel.tsx`) rather than let the preview
animate something the export would hold still.

**Text.** The same TTFs in `web/public/fonts` feed the browser (as webfonts) and
libass (via `fontsdir`), which is why text may only use fonts listed in
`web/src/schema/fonts.ts`. The editor measures each text block and stores
`measuredWidth` / `measuredHeight` in the clip so the ASS emitter can anchor
left- and right-aligned text at the same place the preview draws it; a measured
width of 0 means "unknown" and the renderer falls back to centering. The padding
constant in `ass.rs` (`fontSize * 0.25`) mirrors `TextRenderer`'s.

**Crop.** Both sides clamp `x` to at most `1 - w` (and `y` to `1 - h`) so
hand-edited project JSON with an out-of-range rect degrades identically.

**Transitions.** A transition belongs to the outgoing clip (`transitionOut`) and
only applies when the next clip on the same track starts exactly where this one
ends. The window is centered on the cut — `[cut - d/2, cut + d/2]` — so each side
needs `d/2` of source headroom; the renderer extends its trim by that much and
clamps at 0, so a clip without headroom simply runs short. The preview draws
transitions by compositing two ordinary layers (`pushTransitionLayers` varies
opacity for the fades, a scissor rect for the wipes, an x offset for the
slides); the renderer does the equivalent with `fade`, `geq` alpha masks, and an
overlay `x` expression. `TRANSITION_FRAG_SRC` in `shaders.ts` is unused
groundwork for a future render-to-texture path — it is not linked or executed,
so changing it changes nothing you can see.

**Background blur.** This contract is deliberately approximate. Both sides crop,
flip and key the source, cover-fit it to the stage, and blur it behind the clip;
the preview does that on a 192px-wide Canvas2D scratch canvas with
`filter: blur(5px)` while the renderer uses `gblur=sigma=30` at full size.
Geometry and content match, the exact blur kernel does not, and matching it is
not a goal — keep changes on the geometry side symmetrical and expect the
softness to differ slightly.

### Checklist for a visual feature

1. Implement it in the preview: the shader, `Compositor`, or `PlaybackController`.
2. Implement it in `crates/vikado-renderer/src/filtergraph.rs` (or `ass.rs` for
   text), and write a comment on both sides naming the counterpart file.
3. Add a case to `crates/vikado-renderer/tests/graph_snapshots.rs` that exercises
   the new emission, and review the resulting snapshot by hand.
4. Smoke-render the emitted graph through real ffmpeg — either extend the golden
   render, or point the dev CLI at a project that uses the feature. A graph that
   snapshots cleanly can still be rejected by ffmpeg.
5. Compare preview and export by eye at the same timestamps, including at the
   boundaries (clip start/end, transition windows, keyframe segments).

### ffmpeg versions

The emitted graph has to be accepted by both the ffmpeg in the Docker image and
whatever recent ffmpeg contributors have locally. `docker/Dockerfile` runs on
`debian:bookworm-slim`, which ships ffmpeg 5.1, and filter syntax has changed in
places since then. Two workarounds already in the code exist for exactly this
reason, and are worth knowing before you add a third:

- `emit_graph` strips the trailing `;` from the script, because ffmpeg 5.x and
  older parse it as an empty filter chain and fail with `No such filter: ''`.
- `atempo_chain()` chains factors so that every individual `atempo` stays within
  0.5..=2.0, which is the range portable across versions.

If you rely on newer filter syntax, either guard it or pick a formulation that
works on both, and say which ffmpeg versions you tested in the pull request.

## Snapshot tests

The filtergraph is covered by [insta](https://insta.rs) snapshots in
`crates/vikado-renderer/tests/snapshots/`. A changed `.snap` means **the ffmpeg
command you are shipping to users changed** — that diff is the review surface for
renderer work, for you and for reviewers.

When a snapshot test fails, insta writes a `.snap.new` next to the old one. Read
it. Confirm every line of the diff is a change you meant to make, and that the
lines you did not intend to touch are untouched.

Review interactively with cargo-insta (`cargo install cargo-insta`):

```sh
cargo insta review
```

Or accept everything in one go, once you have read the diff:

```sh
INSTA_UPDATE=always cargo test -p vikado-renderer
```

Never accept a snapshot you have not read. "The test went green" is not a review.

## Code style

- Rust is formatted with `cargo fmt` and must pass
  `cargo clippy --workspace -- -D warnings`.
- TypeScript is strict, linted with oxlint, and imports through the `@/` alias
  that maps to `web/src/`.
- **Comment the why, not the what.** This codebase is unusually comment-heavy in
  two places, deliberately: parity contracts and ffmpeg workarounds. If you write
  a filter chain that looks odd, say what it is compensating for. If you write
  either half of a contract, name the file holding the other half so the next
  person finds it. If you rule an approach out — as the `chromakey`/`colorkey`
  comment does — record why, so nobody re-litigates it a year from now.
- Times are `f64` seconds everywhere; positions and sizes are canvas pixels at
  the project's resolution; track index 0 is the bottom layer.
- Clips on a track never overlap and are sorted by start time. Timeline
  operations that could break that invariant belong in `web/src/lib/timelineOps.ts`,
  which is unit-tested.
- Prefer adding to an existing module over adding a dependency.

## Commits and pull requests

- Branch off `main` and open your pull request against `main`.
- Keep pull requests focused. A schema change plus its two implementations plus
  its tests is one coherent change; three unrelated features is three pull
  requests.
- Write commit subjects in the imperative mood ("Add wipe-up transition"), and
  use the body to explain why when the reason is not obvious from the diff.
- Include generated files when the Rust schema changed. `web/src/generated/` is
  checked in and CI diffs it against a fresh export.
- CI must be green: frontend build and tests, `cargo fmt --all --check`, clippy
  with warnings denied, the full Rust suite, the two ffmpeg-backed suites, and
  the bindings freshness check.
- Say how you tested. For anything visual, say that you compared preview against
  export and what you looked at.

## Good first contributions

These are small, self-contained, and touch the parts of the codebase worth
learning first.

**Add a filter preset.** Add the variant to `FilterPreset` in
`crates/vikado-types/src/lib.rs` and to `FILTER_PRESETS` in
`web/src/schema/project.ts`, add its 4x4 matrix to `FILTER_MATRICES` in
`web/src/schema/filters.ts` (it is a `Record<FilterPreset, number[]>`, so the
type checker will tell you if you forget), add the matching ffmpeg chain to
`preset_chain()` in `filtergraph.rs`, regenerate the bindings, and add a
snapshot. The sidebar picker renders the list automatically. This is the
smallest possible end-to-end tour of the parity rule.

**Add a transition.** Add the variant to `TransitionType` and `TRANSITION_TYPES`,
implement it in `pushTransitionLayers` in `PlaybackController`, then in the
incoming-side handling in `emit_graph` (some transitions are alpha work in the
clip chain, slides are an `x` expression at the overlay stage). Snapshot it and
render it for real.

**Add a text style preset.** `TEXT_PRESETS` in
`web/src/editor/sidebar/TextPanel.tsx`. UI only, no schema change — a good first
patch if you want to start without touching Rust.

**Add caption languages.** `CAPTION_LANGUAGES` in
`web/src/captions/transcriber.ts` is the list offered in the auto-captions
picker; the codes are Whisper language codes and the model is multilingual, so
this is mostly a matter of picking codes and labels and testing the result.

**UI polish and accessibility.** Keyboard shortcuts, focus handling, empty
states, and clearer inspector copy are all welcome and easy to review.

**A screenshot for the README.** There isn't one yet. Load a project with a few
clips, a title and some captions, take a screenshot of the editor at a desktop
width, and add it as `docs/screenshot.png`. Related: the editor has no
responsive layout, so the panels overlap below roughly 1000px — making the
sidebar and inspector collapsible would be a real improvement.

**Documentation.** If something in this file or the README was wrong or
confusing while you were setting up, fixing it is a genuinely useful pull
request.

Larger ideas — new effects, better scrubbing performance, a smarter media
prober — are welcome too; please open an issue first so the design can be
discussed before you write the parity implementation twice.
