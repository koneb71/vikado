# vikado-web

The Vikado editor frontend: Vite + React 19 + TypeScript (strict), Tailwind v4 with
shadcn/ui, Zustand (+ zundo for undo, immer for updates) and zod for schema validation.

Everything a user does — importing media, editing the timeline, and real-time preview
through a WebGL2 compositor — happens here, in the browser. Projects are stored in
IndexedDB; media files are stored in OPFS, keyed by the SHA-256 of their bytes. The
only thing this app sends to the Rust backend is a render request: the project JSON
plus the source files it references.

## Development

Every command below runs from this directory (`web/`), except the type re-export at
the end, which runs from the repository root.

Install dependencies:

```sh
pnpm install
```

Start the dev server on <http://localhost:5173>:

```sh
pnpm dev
```

Vite proxies `/api` to `http://localhost:3000`, where `vikado-server` is expected to
be listening. Point it somewhere else with `VIKADO_API_URL`:

```sh
VIKADO_API_URL=http://192.168.1.20:3000 pnpm dev
```

Set `PORT` to move the dev server itself:

```sh
PORT=5200 pnpm dev
```

Type-check and build for production:

```sh
pnpm build
```

`pnpm build` is `tsc -b && vite build`, so it also type-checks
`src/generated/drift-check.ts`. That file asserts that the hand-written zod schema in
`src/schema/project.ts` is assignable to the types exported from the Rust
`vikado-types` crate — if the two schemas diverge, the build fails there.

Run the unit tests:

```sh
pnpm test
```

Lint with oxlint:

```sh
pnpm lint
```

## What lives in `src/`

| Directory | Contents |
| --- | --- |
| `schema/` | `project.ts` — the zod project schema, the contract with the renderer. Also the filter preset matrices and the bundled font list. |
| `generated/` | ts-rs output from the Rust `vikado-types` crate, plus the compile-time drift check. **Generated — never edit by hand.** |
| `engine/` | Preview runtime: `PlaybackController` (rAF loop), `frameGraph.ts` (the shared layer stack, also used by the exporter), `compositor/` (WebGL2 + GLSL), `AudioGraph`, `TextRenderer`, `MediaPool`. |
| `editor/` | The UI: `timeline/` (pointer-event gestures, snapping), `sidebar/` panels, `inspector/`, `preview/`, hotkeys. |
| `media/` | Import pipeline: content-addressed OPFS storage, the IndexedDB wrapper (saved projects plus the thumbnail and waveform caches), format probing, screen/webcam recording, thumbnails, waveforms. |
| `captions/` | Auto-captions: a web worker running Whisper via `@huggingface/transformers`, plus PCM extraction and cue post-processing. |
| `export/` | Both export engines: `localExport.ts` renders and encodes in the browser with WebCodecs, `exportClient.ts` drives the render service (create job → upload assets → submit → SSE progress → download), and `ExportDialog.tsx` picks between them. |
| `state/` | Zustand stores: `projectStore` (undoable, autosaved to IndexedDB), `playbackStore` (playhead and selection; transient), `uiStore` (timeline zoom, scroll, snapping, dock height; transient). |
| `lib/` | Helpers shared across the app: timeline operations, keyframe sampling, clipboard, SRT parsing, freeze-frame capture, formatting. |
| `components/ui/` | shadcn/ui primitives. |
| `projects/` | The project-list screen shown before an editor session. |
| `assets/` | Images available to `import` from application code. Assets served by URL live in `public/` instead. |

`public/fonts/` holds the bundled OFL TTFs. They are the only fonts text and
subtitles may use, because the same files feed the browser preview and libass on the
render server.

## Regenerating the types

After any change to the Rust schema, re-export the TypeScript bindings from the repo
root:

```sh
TS_RS_EXPORT_DIR=../../web/src/generated cargo test -p vikado-types export
```

## See also

- [`../README.md`](../README.md) — what Vikado is, and how to run the whole stack.
- [`../CONTRIBUTING.md`](../CONTRIBUTING.md) — how to work on the project.
- [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) — the preview/render parity
  contracts every visual feature has to satisfy.
- [`../CHANGELOG.md`](../CHANGELOG.md) — what shipped in each release.
