## What changed

<!-- One or two sentences. What does this pull request do? -->

## Why

<!-- The problem being solved, or a link to the issue. -->

## How it was tested

<!-- Commands you ran, and what you looked at. For visual changes, say how you
     compared the browser preview against an exported MP4. -->

## Checklist

- [ ] `cd web && pnpm build && pnpm vitest run` passes.
- [ ] `cargo test --workspace`, `cargo fmt --all --check` and
      `cargo clippy --workspace -- -D warnings` pass.
- [ ] **Schema change:** new fields have a serde default *and* a zod default,
      the bindings were regenerated with
      `TS_RS_EXPORT_DIR=../../web/src/generated cargo test -p vikado-types export`,
      and `web/src/generated/` is committed. (N/A if the schema is untouched.)
- [ ] **Visual change:** implemented in both the preview and the renderer, with
      a filtergraph snapshot covering it, and preview and export were compared
      by eye. (N/A if nothing visual changed.)
- [ ] **Renderer change:** snapshot diffs were read line by line, not blindly
      accepted, and the graph was smoke-rendered through real ffmpeg
      (`cargo test -p vikado-renderer --test golden_render -- --ignored`).
      (N/A if the emitted graph is unchanged.)

<!-- See CONTRIBUTING.md for the schema recipe and the preview/render parity rule. -->
