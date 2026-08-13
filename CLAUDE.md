# Vikado — repo guide

Web-based video editor. React/TS frontend does editing + real-time preview;
Rust backend renders final MP4s with ffmpeg. Local-first: projects live in the
browser (IndexedDB + OPFS), the backend is a stateless render service.

## Layout

- `web/` — Vite + React 19 + TS strict, Tailwind v4 + shadcn/ui, Zustand (+zundo undo).
  - `src/schema/project.ts` — THE project schema (zod). Mirrored by `crates/vikado-types`.
  - `src/generated/` — ts-rs output from the Rust types + `drift-check.ts`. Regenerate with
    `TS_RS_EXPORT_DIR=../../web/src/generated cargo test -p vikado-types export`.
  - `src/engine/` — preview: rAF loop (`PlaybackController`), WebGL2 compositor, media pool.
  - `src/editor/` — UI: timeline (pointer-event gestures), sidebar panels, inspector.
- `crates/vikado-types` — serde+ts-rs schema (source of truth once both sides ship).
- `crates/vikado-renderer` — Project → ffmpeg `filter_complex` compiler (overlay-stack
  model mirroring the preview), ASS emitter for text/subtitles (libass), process supervisor.
  Dev CLI: `cargo run -p vikado-renderer -- project.json assets-dir out.mp4 --fonts web/public/fonts`.
- `crates/vikado-server` — Axum job API (`/api/v1`), SSE progress, serves built frontend.

## Invariants

- All times are f64 seconds; positions/sizes in canvas px. Track 0 = bottom layer.
- Clips on a track never overlap; transitions need adjacent clips (A.end == B.start),
  window centered on the cut, each side needs duration/2 of source headroom.
- Color math (eq/lutrgb ↔ shader) and filter presets must match between
  `web/src/engine/compositor/shaders.ts`, `web/src/schema/filters.ts` and
  `crates/vikado-renderer/src/filtergraph.rs` — change all together.
- Text/subtitles must only use fonts in `web/public/fonts` (same TTFs feed the
  browser preview and libass on the server).

## Commands

- Frontend: `cd web && pnpm dev` (proxy /api → :3000, override `VIKADO_API_URL`),
  `pnpm build` (type-check + drift check), `pnpm vitest run`.
- Backend: `cargo test` (snapshot tests via insta), golden renders (needs ffmpeg):
  `cargo test -p vikado-renderer --test golden_render -- --ignored`.
- Server: `VIKADO_PORT=3111 cargo run -p vikado-server`.
- Docker: `docker compose up --build` → http://localhost:3000.
