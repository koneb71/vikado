# Vikado architecture

This document describes how Vikado is put together, for people who want to understand or
extend the engine. It is a reference, not a tutorial: every claim is anchored to a file in
this repository, and the file is the authority when the two disagree.

Repository: <https://github.com/koneb71/vikado>. Version 0.1.0, MIT.

- [1. The hybrid model](#1-the-hybrid-model)
- [2. Repository layout](#2-repository-layout)
- [3. The project document](#3-the-project-document)
- [4. Schema as contract](#4-schema-as-contract)
- [5. The preview engine](#5-the-preview-engine)
- [6. The render pipeline](#6-the-render-pipeline)
- [7. Parity contracts](#7-parity-contracts)
- [8. The render service](#8-the-render-service)
- [9. Test surface](#9-test-surface)
- [10. Known limitations and deferred work](#10-known-limitations-and-deferred-work)

---

## 1. The hybrid model

Vikado splits the work of a video editor across two runtimes that are good at different
things.

The **browser** owns interactive editing. It holds the project document, runs the timeline
UI, and paints the preview with a WebGL2 compositor driven by an animation-frame loop. Media
decoding is the browser's own `<video>`/`<audio>` pipeline; compositing is one draw call per
layer. That is fast enough to scrub and play in real time and costs nothing to run — no
server round-trip sits between a slider drag and the frame you see.

The **Rust backend** owns the final encode. `crates/vikado-renderer` compiles the same
project document into a single ffmpeg `filter_complex` graph and supervises one ffmpeg
process. ffmpeg gives frame-accurate output, real H.264/AAC encoding, and libass text
rendering — none of which a browser does well today.

```
  browser — all editing, media stays local            server — stateless encode
 ┌───────────────────────────────────────────────┐    ┌──────────────────────────────────────────┐
 │ timeline UI ──▶ project store (Zustand)       │    │ Axum job API /api/v1                     │
 │                       │        │              │    │       │                                  │
 │     autosave ◀────────┘        ▼              │    │       ▼                                  │
 │        ▼              PlaybackController      │    │ vikado-renderer                          │
 │    IndexedDB                   │              │    │  ├ inputs.rs      (one -i per clip)      │
 │    (projects)                  ▼              │    │  ├ filtergraph.rs (filter_complex)       │
 │    OPFS ──▶ MediaPool ──▶ Compositor (WebGL2) │    │  ├ ass.rs         (libass overlays)      │
 │    (media, keyed by sha-256)                  │    │  └ ffmpeg.rs      (supervise + progress) │
 └───────────────────────────────────────────────┘    └──────────────────────────────────────────┘

   browser ── project JSON + source files (by content hash) ──▶ server
   browser ◀────────────── rendered MP4 stream ──────────────── server
```

**What it buys.** Editing is local-first: projects live in IndexedDB and media in OPFS
(`web/src/media/db.ts`, `web/src/media/opfs.ts`), so nothing is uploaded until you press
Export. The server is stateless and holds no accounts, no library, and no project database —
it is a pure function from (project JSON + source files) to an MP4, which makes self-hosting
a single container (`docker/Dockerfile`).

**What it costs.** Every visual feature has to exist twice — once in GLSL/Canvas2D, once as
an ffmpeg filter chain — and the two implementations must agree. That is the central design
constraint of this codebase and the subject of [section 7](#7-parity-contracts). It also
means there is no offline export: without a reachable render service you can edit but not
export.

---

## 2. Repository layout

| Path | Contents |
| --- | --- |
| `crates/vikado-types/src/lib.rs` | The schema: serde + ts-rs types shared by both sides. Source of truth for the wire format. |
| `crates/vikado-renderer/src/inputs.rs` | Clip → ffmpeg `-i` input mapping. |
| `crates/vikado-renderer/src/filtergraph.rs` | Project → `filter_complex` script. |
| `crates/vikado-renderer/src/ass.rs` | Text clips + subtitle cues → one ASS file for libass. |
| `crates/vikado-renderer/src/ffmpeg.rs` | Argument assembly, `-progress` parsing, stderr capture, cancellation. |
| `crates/vikado-renderer/src/main.rs` | `vikado-render` dev CLI (no HTTP). |
| `crates/vikado-server/src/lib.rs` | The `/api/v1` router (a library so tests can drive it in-process). |
| `crates/vikado-server/src/jobs.rs` | Job registry, per-job workspaces, TTL sweep. |
| `crates/vikado-server/src/main.rs` | Binary: env config, sweeper task, `axum::serve`. |
| `web/src/schema/project.ts` | The zod mirror of the schema + defaults and pure helpers. |
| `web/src/generated/` | ts-rs output from `vikado-types` + `drift-check.ts`. |
| `web/src/engine/` | Preview: `PlaybackController`, `MediaPool`, `AudioGraph`, `TextRenderer`, `activeClips.ts`, `compositor/`. |
| `web/src/editor/` | UI: timeline, inspector, sidebar panels, preview area. |
| `web/src/media/` | Import, OPFS storage, probing, thumbnails, waveforms, recording. |
| `web/src/captions/` | In-browser Whisper worker and cue post-processing. |
| `web/src/export/` | Render client (`exportClient.ts`) and the export dialog. |
| `web/public/fonts/` | The bundled OFL TTFs used by **both** the browser preview and libass. |
| `fixtures/` | Tiny test media and `minimal-project.json`, used by the Rust tests. |

---

## 3. The project document

Everything the editor knows about a video is one JSON document. Both runtimes agree on its
shape (`crates/vikado-types/src/lib.rs`, mirrored by `web/src/schema/project.ts`).

**Project.** `schemaVersion` (currently `1`), identity and name, `fps`, `width`/`height`,
`canvasBackground` (`#rrggbb`), an ordered array of `tracks`, an array of `assets`, an
optional `subtitles` track, and ISO timestamps. `Project::duration()` in Rust and
`projectDuration()` in TypeScript both take the max clip end and the max subtitle cue end.

**Track.** `kind` is `video`, `audio`, or `text`. A `video` track accepts video *and* image
clips (`trackAcceptsClip` in `web/src/schema/project.ts`). `muted` and `hidden` are
per-track. **Track index 0 is the bottom layer**; the renderer overlays tracks in array order
and the preview draws them in the same order.

**Clip.** A tagged union on `type`: `video`, `image`, `audio`, `text`. Every clip has `id`,
`start` and `duration` in timeline seconds, plus `fadeIn`/`fadeOut`. Media clips carry
`assetId`; `video` and `audio` additionally carry `sourceIn` (trim offset into the source),
`speed` and `volume`. `video` and `image` clips carry a `transform`, optional per-property
`keyframes`, `adjustments`, an optional `filter` preset, `flipH`/`flipV`, an optional
`chromaKey`, `backgroundBlur`, an optional `crop`, and an optional `transitionOut` into the
next clip on the same track. `text` clips carry `text`, `style`, a `transform`, `keyframes`,
and the editor-measured `measuredWidth`/`measuredHeight` — they have no `adjustments`,
`filter` or `transitionOut`.

Invariants that both sides rely on:

- **All times are `f64` seconds.** The UI snaps edits to the frame grid with
  `snapToFrame(t, fps)`; nothing downstream assumes frame integers.
- **Positions and sizes are canvas pixels** at `project.width × project.height`.
  `transform.x`/`y` are offsets of the layer's centre from the canvas centre, y down;
  `transform.scale` is relative to a "contain" fit of the media inside the canvas, so
  `scale: 1` means "fit".
- **Clips on a track never overlap** and are sorted by `start`. `web/src/lib/timelineOps.ts`
  enforces this on every move/trim (`clampStart`, `sortTrack`). The preview's
  `visualLayersAt` stops at the first clip covering `t` because of it, and the renderer
  depends on it when it gives every clip on a track its own `enable` window.
- **Transitions need adjacency.** A `transitionOut` only fires when the next clip starts
  exactly at this clip's end (`|next.start - clip.end| < 1e-6`), on both sides. The window is
  centred on the cut, so each side needs `duration / 2` of source headroom.
- **Assets are content-addressed.** `Asset.hash` is the sha-256 hex of the file bytes. It is
  the OPFS filename (`web/src/media/opfs.ts`), the upload field name, and the filename inside
  the server's per-job assets directory. `Asset.name` is display-only and is never used as a
  path.

### A real (abridged) project

Derived from `fixtures/minimal-project.json`: the text track and the three unreferenced assets
have been dropped and `subtitles` replaced with `null`. Everything else is verbatim.

```json
{
  "schemaVersion": 1,
  "id": "Rpx-rzOX1zsRzCN-Wl02m",
  "name": "Untitled project",
  "fps": 30,
  "width": 1920,
  "height": 1080,
  "tracks": [
    {
      "id": "nyb3NdpbroqtPKxSwJ3WF",
      "kind": "video",
      "name": "Track 1",
      "muted": false,
      "hidden": false,
      "clips": [
        {
          "type": "video",
          "id": "j9YxAOUD6IBTfw0c93ymq",
          "start": 0.8333333333333334,
          "duration": 5,
          "assetId": "klNI_IajgpupuXsRu0M6T",
          "sourceIn": 0,
          "volume": 1,
          "muted": false,
          "transform": { "x": 0, "y": 0, "scale": 1, "rotation": 0, "opacity": 1 },
          "adjustments": { "brightness": 0, "contrast": 0, "saturation": 0, "temperature": 0 },
          "filter": null,
          "fadeIn": 0,
          "fadeOut": 0,
          "transitionOut": null
        }
      ]
    }
  ],
  "assets": [
    {
      "id": "klNI_IajgpupuXsRu0M6T",
      "kind": "video",
      "name": "countdown.mp4",
      "hash": "9481f3fd1efab428b122b3dd55dcf64f8b956d628ff8470b69a3c122c92a59ca",
      "duration": 5,
      "width": 1280,
      "height": 720,
      "fps": 29.80132450331126,
      "hasAudio": true,
      "mimeType": "video/mp4"
    }
  ],
  "subtitles": null,
  "createdAt": "2026-08-12T12:54:35.685Z",
  "updatedAt": "2026-08-12T13:35:54.416Z"
}
```

Note the fields that are *absent*: `canvasBackground` on the project, and `speed`, `flipH`,
`keyframes`, `chromaKey`, `backgroundBlur`, `crop` on the clip. Both sides default them —
`#[serde(default = ...)]` in Rust, `.default(...)` in zod — so documents written before those
fields existed still load.

### Editor state and persistence

`web/src/state/projectStore.ts` is a Zustand store wrapped in `immer` (structural mutation
inside reducers) and `zundo`'s `temporal` middleware (undo/redo, `partialize`d to the
document only, history `limit: 200`). Opening a project re-parses it through `zProject` so
older documents pick up new defaults — a cheap forward migration; there is no versioned
migration ladder. A subscriber debounces `db.saveProject` by 500 ms on every document change.
Playback state (`currentTime`, `isPlaying`) lives in a separate store
(`web/src/state/playbackStore.ts`) so transport updates never touch the undo history.

---

## 4. Schema as contract

The Rust crate is the source of truth for the wire format; TypeScript gets it two ways.

```
crates/vikado-types/src/lib.rs
        │  #[derive(TS)] + #[ts(export)]
        │  TS_RS_EXPORT_DIR=../../web/src/generated cargo test -p vikado-types export
        ▼
web/src/generated/*.ts   ── type-level assignability check ──▶  web/src/schema/project.ts
   (generated, do not edit)      web/src/generated/drift-check.ts        (hand-written zod)
```

The generated files are pure types. The hand-written zod schema is what actually validates
documents in the browser, provides defaults, and exposes runtime constants
(`FILTER_PRESETS`, `TRANSITION_TYPES`, `MIN_SPEED`/`MAX_SPEED`, `DEFAULT_TEXT_STYLE`, …).
Keeping two definitions is deliberate: zod gives runtime parsing and defaulting that ts-rs
output cannot.

`web/src/generated/drift-check.ts` ties them together with a compile-time assertion that
every hand-written type is assignable to the generated one:

```ts
type Assignable<A, B> = A extends B ? true : never
const _project: Assignable<Hand.Project, GenProject> = true
```

The reverse direction is intentionally not asserted, because the TypeScript side narrows some
fields to literals (`schemaVersion: 1`, `fontWeight: 400 | 700`) that Rust models as plain
numbers. `pnpm build` runs `tsc -b`, so a drift makes the frontend build fail.

CI enforces the other half — that the checked-in bindings are actually fresh. The
`ts-bindings-fresh` job in `.github/workflows/ci.yml` re-exports and diffs:

```sh
TS_RS_EXPORT_DIR=../../web/src/generated cargo test -p vikado-types export
```

```sh
git diff --exit-code web/src/generated
```

Always set `TS_RS_EXPORT_DIR`. Without it, ts-rs writes to its default location,
`crates/vikado-types/bindings/` — a second copy of the same files that nothing imports and
that the drift check does not look at.

Additionally, `vikado-types`' own `fixture_roundtrip` test deserializes
`fixtures/minimal-project.json` (a document written by the frontend), asserts its
`schemaVersion`, and round-trips it through serde.

**After any schema change**: edit `crates/vikado-types/src/lib.rs`, re-export the bindings
with the command above, update `web/src/schema/project.ts` to match, and run `cd web && pnpm
build`.

---

## 5. The preview engine

One `PlaybackController` is constructed per mounted preview canvas
(`web/src/editor/preview/PreviewArea.tsx`) and disposed with it. It reads the stores
transiently via `getState()` inside the loop, so playback causes no React re-renders.

```
requestAnimationFrame ──▶ tick()
                            ├─ read project + playback stores
                            ├─ advance transport clock, write currentTime
                            ├─ syncMedia()  : element currentTime / rate / play-pause,
                            │                 AudioGraph.scheduleAudible()
                            └─ drawFrame()  : activeClips → DrawLayer[] → Compositor.draw()
```

### 5.1 The transport clock

`web/src/engine/PlaybackController.ts`.

While playing, time is derived from an anchor rather than accumulated per frame:

```ts
private clockNow(): number {
  return this.audio.running ? this.audio.now() * 1000 : performance.now()
}
// ...
t = (nowMs - this.anchorMs) / 1000
```

The `AudioContext` clock is preferred because audio scheduled against it can never drift from
the transport. Before the first user gesture the context is suspended (autoplay policy), so
the loop falls back to `performance.now()`. Three events invalidate the anchor and force a
re-anchor: starting playback, an *external* seek (detected by comparing `playback.currentTime`
against `lastWrittenTime`, the value the controller itself last wrote), and a switch between
the two clock sources. Each re-anchor bumps `anchorGen`, which is folded into the audio
envelope signature so previously scheduled envelopes are recomputed.

Two robustness details worth preserving:

- `safeTick()` wraps `tick()` in a try/catch and logs. One bad frame must not kill the loop.
- rAF is throttled or suspended in background tabs, so `start()` also installs a 50 ms
  `setInterval` watchdog that calls `safeTick()` whenever more than 150 ms has passed since
  the last tick, keeping the transport and audio advancing when rAF stops firing. The 150 ms
  gate caps the watchdog near five ticks per second, and background-tab timer clamping makes
  it slower still: it is a liveness floor, not a playback path.

`start()` also registers capture-phase `pointerdown`/`keydown` listeners that call
`AudioGraph.unlock()`, since `AudioContext.resume()` only works inside a genuine gesture.

### 5.2 What is on stage

`web/src/engine/activeClips.ts` is pure and is the preview's model of the timeline:
`visualLayersAt(project, t)` (bottom-up, skipping hidden and audio tracks, one clip per track),
`audibleClipsAt(project, t)`, `activeCueAt(project, t)`, and `fadeEnvelope(clip, localTime)`.
`transitionWindow()` detects that `t` falls in `[cut - d/2, cut + d/2]` between two adjacent
clips and returns the outgoing clip, the incoming clip, and progress `0..1`. The Rust renderer
implements the same semantics for the whole timeline at once.

### 5.3 MediaPool

`web/src/engine/MediaPool.ts` keeps one off-DOM element per **pool key**, sourced from an OPFS
blob URL. The key defaults to the asset id, so a clip and its split twin share one element and
one decode.

Audio-track clips deliberately break that rule. `PlaybackController.audioKey()` returns
`aclip:<clipId>` for `type: 'audio'` clips, so a detached audio clip gets its own element: it
plays a different source range than the video clip that shares its asset, and a single shared
element would be seek-fought between the two every frame.

Entries hold the element, a `ready` promise, and `lastUsed`. `acquire()` dedupes concurrent
creations through a `pending` map (the render loop retries every frame while a load is in
flight); `peek()` is the synchronous lookup the loop actually uses, because rAF cannot await.
Video elements are LRU-capped at `MAX_LIVE_VIDEOS = 6` — images and audio are cheap and are
kept. Eviction fires an `onEvict` callback that tears down the element's audio-graph nodes
before the element itself is torn down.

`syncMedia()` corrects an element only when it is off: while playing, drift beyond
`SYNC_TOLERANCE_S = 0.08` triggers a seek; while paused, the tolerance tightens to `1/120` s
so scrubbing lands on the right frame. `playbackRate` follows `clip.speed`.

### 5.4 AudioGraph

`web/src/engine/AudioGraph.ts` wires each element as:

```
element → MediaElementAudioSourceNode → clipGain → master → destination
```

Loudness is owned by the graph, not by the elements: after `connect()`, `el.muted = false` and
`el.volume = 1` and stay there. Per-clip volume and fades are **scheduled** on `clipGain` —
`setValueAtTime` plus `linearRampToValueAtTime` at the fade boundaries, mapped from timeline
seconds into context time by the controller's anchor — rather than written every frame. That
removes fade zipper noise and lets gain exceed 1 (clip volume goes to 2), which
`HTMLMediaElement.volume` cannot. Each chain caches the JSON `signature` of what it scheduled
(clip id, volume, fades, start, duration, speed, track mute, and `anchorGen`) and skips the
work when nothing changed. The master gain ramps to 0 while the transport is paused so seeks
never blip, and pausing clears the cached signatures so resume reschedules from scratch.

### 5.5 Compositor

`web/src/engine/compositor/Compositor.ts` is a WebGL2 layer compositor: one static unit quad
(4 vertices, `TRIANGLE_STRIP`), one program, one draw call per layer with per-layer uniforms.
The canvas backing store is set to the project's pixel size and CSS scales it to fit; stage
coordinates are therefore project pixels. The context is created with `alpha: false` and
`preserveDrawingBuffer: true` — the latter keeps the drawing buffer readable after a frame, so
the canvas can be captured; no current code does read it back (clip thumbnails in
`web/src/media/thumbnails.ts` and freeze frames in `web/src/lib/freezeFrame.ts` both decode
into their own off-DOM elements so they never disturb playback). Blending is
`blendFuncSeparate(SRC_ALPHA, ONE_MINUS_SRC_ALPHA, ONE, ONE_MINUS_SRC_ALPHA)`.

`layerMatrix()` builds the quad → clip-space `mat3`. The `fitMode` decides the base fit:

| `fitMode` | Meaning | Used by |
| --- | --- | --- |
| `contain` (default) | `min(SW/w, SH/h)` — media fits inside the stage at `scale: 1` | video and image clips |
| `cover` | `max(SW/w, SH/h)` — media fills the stage | background-blur backdrops |
| `none` | source pixels map 1:1 to stage pixels | text and subtitles |

then applies `transform.scale`, flips (negative width/height), rotation, and the `x`/`y`
pixel offset converted to clip space. Textures are cached per `DrawLayer.key` and re-uploaded
each frame only when `dynamic` is set (video and the blur backdrop canvas); a failed
`texImage2D` (element not ready) is swallowed so the previous texture stays on screen.

Two extras exist purely for transitions: `scissor` (stage-px rect, used for wipes) and
`offsetX` (extra pixel translation, used for slides). `PlaybackController.pushTransitionLayers`
composes transitions out of ordinary layers — crossfade is B drawn over A at opacity `p`,
fade-black is A out then B in, wipes scissor B, slides translate B. `shaders.ts` also exports a
`TRANSITION_FRAG_SRC` program for a proper two-texture blend, but it is **not linked today**;
it is waiting on a render-to-texture pass (see the comment in the `Compositor` constructor).

### 5.6 TextRenderer

`web/src/engine/TextRenderer.ts` rasterises text to a 2D canvas that is then uploaded as an
ordinary layer with `fitMode: 'none'`. Results are cached by `JSON.stringify([text, style])`
with a 100-entry cap. Line breaks are explicit `\n` only — no automatic wrapping — which
sidesteps browser-versus-libass wrapping differences. Metrics: padding is `0.25 × fontSize`
around the glyphs (for outline and background bleed), line height is `1.25 × fontSize`, the
background box is a `roundRect` with radius `0.15 × fontSize`, and the outline is
`strokeText` with `lineWidth = outlineWidth * 2`. The padding constant is load-bearing: the
ASS emitter subtracts exactly this padding from `measuredWidth` when anchoring left/right
aligned text (see [section 7](#7-parity-contracts)).

---

## 6. The render pipeline

`crates/vikado-renderer/src/lib.rs::render` is the whole flow:

```
Project ─▶ inputs::collect_inputs      one ClipInput per media-backed clip
        ─▶ ass::emit_ass               overlays.ass (skipped when there are no events)
        ─▶ filtergraph::emit_graph     graph.txt
        ─▶ ffmpeg::build_args          argv
        ─▶ ffmpeg::run                 spawn, parse -progress, capture stderr, cancel
        ─▶ out.mp4
```

### 6.1 Inputs

`inputs.rs` gives **every media-backed clip its own `-i`**, even when two clips reference the
same file. That keeps the graph free of `split` bookkeeping — ffmpeg reads the file
independently per input. Hidden non-audio tracks are skipped entirely. Image clips are looped
stills: the input carries `-loop 1 -t <clip duration + transition extensions>` and the filter
chain trims nothing off them.

### 6.2 The per-clip visual chain

`filtergraph.rs::emit_graph` builds one prepared stream per visual clip, in this order:

| Step | Emitted | Notes |
| --- | --- | --- |
| trim | `trim=start=…:end=…` then `setpts=PTS-STARTPTS` (`setpts=(PTS-STARTPTS)/speed` when `speed ≠ 1`) | images skip the trim and get `setpts=PTS-STARTPTS` alone; source consumed scales with `speed` and with any transition lead-in |
| crop | `crop=w='iw*w':h='ih*h':x='iw*x':y='ih*y'` | normalized rect; `x`/`y` clamped to `≤ 1-w` / `≤ 1-h` |
| rate | `fps=<project fps>` | |
| flips | `hflip`, `vflip` | |
| alpha | `format=rgba` | everything downstream keys and fades in RGBA |
| chroma key | `colorkey=color=0x…:similarity=…:blend=…` | see the parity note below |
| *(split)* | `split` into main + backdrop | only when `backgroundBlur`; the backdrop branch reuses everything above |
| fit | `scale=w='min(W/iw,H/ih)*iw*s':h=…` | `eval=init`, or `eval=frame` with a keyframe expression for animated scale |
| colour | `eq=brightness=b:contrast=1+c:saturation=1+s`, `lutrgb` for temperature | identity values are skipped for readability |
| preset | `preset_chain(preset)` | `hue`, `colorchannelmixer`, `negate`, `lutrgb` |
| rotate | `rotate=…:c=black@0:ow=…:oh=…` | canvas sized from the asset's dimensions at the clip's **max** scale, because `rotate`'s `ow`/`oh` are evaluated once at init |
| opacity | `colorchannelmixer=aa=…`, or `geq` on alpha when keyframed | |
| fades | `fade=t=in/out:…:alpha=1` | suppressed on a side that has a transition |
| transition | alpha ramp (`fade`) or a `geq` alpha mask for wipes | slides are handled at the overlay stage instead |
| shift | `setpts=PTS+<timeline start>/TB` | moves the prepared stream into timeline time |

The backdrop branch for `backgroundBlur` is `scale` (cover) → `crop` to the stage →
`gblur=sigma=30` → the same fades → the same time shift.

### 6.3 The overlay stack

A base canvas is generated at the project's background colour, size, fps and duration, and
each prepared stream is overlaid onto the accumulating base in track order (track 0 first):

```
color=c=0x000000:s=1920x1080:r=30:d=9[base0];
[base0][c0]overlay=x='(main_w-overlay_w)/2+0':y='…':eof_action=pass:enable='between(t,0,4.5)'[base1];
```

`x`/`y` centre the layer and add `transform.x`/`y` (or a keyframe expression evaluated in
timeline time). `enable` is the clip's on-screen window, extended by `duration/2` on each side
that has a transition. Slide transitions add a term to `x` that animates the incoming clip in
from an edge. A background-blur backdrop is overlaid immediately below its own clip, full
stage, with its enable window *shrunk* to exclude transition halves — an opaque full-stage
layer switching on mid-crossfade would hard-cut the blend, and the preview suppresses it the
same way.

### 6.4 Audio

Every non-text track contributes; a clip is skipped when it is muted, its track is muted, its
volume is zero, or (for video) its asset has no audio stream. A clip on a hidden video track
is also skipped, because `collect_inputs` never gave it an ffmpeg input — see
[section 10](#10-known-limitations-and-deferred-work). Each surviving clip becomes:

```
atrim=start=…:end=source_in+duration*speed, asetpts=PTS-STARTPTS,
  [atempo…], aresample=48000, aformat=channel_layouts=stereo,
  [volume=…], [afade=t=in…], [afade=t=out…], adelay=<start ms>|<start ms>
```

`atempo_chain()` decomposes the rate into factors inside ffmpeg's portable `0.5..=2.0` range —
`0.25 → 0.5,0.5`; `4 → 2,2`; `3 → 2,1.5` — which is what makes speed changes pitch-corrected.
All chains are mixed with a silence bed so the output always has an audio stream and so the
mix length is pinned to the project duration:

```
anullsrc=r=48000:cl=stereo:d=9[asilence];
[asilence][a0][a1][a2]amix=inputs=4:duration=first:normalize=0[aout]
```

`normalize=0` is essential: with amix's default normalization every clip's level would depend
on how many other clips happen to be mixed at that moment, which the preview (independent gain
nodes) does not do.

### 6.5 Text, subtitles, and the final encode

Text clips and subtitle cues are emitted into one ASS file (`ass.rs`) and burned in with
`subtitles=f='…':fontsdir='…'` applied to the *top* of the overlay stack. `PlayResX`/`PlayResY`
are the canvas size, so ASS pixel coordinates are canvas pixels. `WrapStyle: 2` disables
automatic wrapping (explicit `\N` only, matching the preview). An export downscale, if
requested, is appended last as `scale=<w>:<h>:flags=lanczos`, so everything above it stays in
canvas pixels.

The graph is written to `graph.txt` and passed as `-filter_complex_script` (argv length
limits). The trailing `;` is stripped because ffmpeg ≤ 5.x parses it as an empty chain.
`ffmpeg::build_args` then adds `-c:v libx264 -preset <tier> -crf <tier> -pix_fmt yuv420p -c:a
aac -b:a <tier>k -movflags +faststart -t <duration> -progress pipe:1`. The tiers live on
`RenderQuality` in `vikado-types`: draft = crf 28 / veryfast / 128k, standard = crf 23 /
medium / 192k, high = crf 18 / medium / 192k. `RenderOptions::output_size` clamps `scale` to
`0.25..=1.0` and rounds to even dimensions.

A complete emitted graph for a one-clip project (from
`crates/vikado-renderer/tests/snapshots/graph_snapshots__single_clip.snap`):

```
[0:v]trim=start=0:end=5,setpts=PTS-STARTPTS,fps=30,format=rgba,scale=w='min(1920/iw\,1080/ih)*iw*1':h='min(1920/iw\,1080/ih)*ih*1':eval=init,setpts=PTS+0/TB[c0];
color=c=0x000000:s=1920x1080:r=30:d=5[base0];
[base0][c0]overlay=x='(main_w-overlay_w)/2+0':y='(main_h-overlay_h)/2+0':eof_action=pass:enable='between(t,0,5)'[base1];
[base1]null[vout];
[0:a]atrim=start=0:end=5,asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,adelay=0|0[a0];
anullsrc=r=48000:cl=stereo:d=5[asilence];
[asilence][a0]amix=inputs=2:duration=first:normalize=0[aout]
```

### 6.6 Progress and supervision

`ffmpeg::run` spawns the child with `kill_on_drop(true)`, piping both streams. stdout carries
`-progress` key/value lines; the loop parses `out_time_us=` and reports
`ratio = out_time / duration` clamped to `0..=1`. A concurrent task keeps the **last 60
lines** of stderr, which is what an `FfmpegError::Failed` reports. The whole loop selects
against a `CancellationToken` (a small local implementation in `ffmpeg.rs`, avoiding a
`tokio-util` dependency); cancellation kills the child and returns `FfmpegError::Canceled`. On
success a final `ratio: 1.0` progress event is pushed so clients always see completion.

---

## 7. Parity contracts

Every visual feature is implemented twice. The two implementations are held together by
comments in both files that name each other — the "contract" comments. **Change one side and
you must change the other**, and the filtergraph snapshot tests are where you review the
result.

| Feature | Preview implementation | Renderer implementation | Contract note |
| --- | --- | --- | --- |
| Colour adjustments | `web/src/engine/compositor/shaders.ts` (`LAYER_FRAG_SRC`) | `eq` + `lutrgb` in `filtergraph.rs` | brightness `b` → `eq brightness=b`; contrast `c` → `contrast=1+c`; saturation `s` → `saturation=1+s`; temperature `w` → shader `r += 0.1w, b -= 0.1w`, renderer `lutrgb` `±25.5w` (= `0.1 × 255`). Luma is BT.601 `(0.299, 0.587, 0.114)`, which is what `eq` uses. |
| Filter presets | 4×4 matrices in `web/src/schema/filters.ts` | `preset_chain()` in `filtergraph.rs` | Same coefficients: sepia/grayscale matrices ↔ `colorchannelmixer`/`hue=s=0`, invert ↔ `negate`. Matrix offset columns are 0..1 and map to `lutrgb` offsets ×255 (vintage `.06/.05/.08` → `+15/+13/+20`; cool `+.02/+.03` → `+5/+8`; warm `+.03/+.02` → `+8/+5`). |
| Chroma key | `LAYER_FRAG_SRC`: `length(rgb - key) / sqrt(3)`, alpha ramps over `[similarity, similarity+blend]` | `colorkey=color=…:similarity=…:blend=…` | Both key **decoded RGB** with euclidean distance. See the history below. The blurred-backdrop path repeats the same math on a Canvas2D `ImageData` in `PlaybackController.backdropLayer`. |
| Keyframes | `sampleTrack` / `easeProgress` in `web/src/lib/keyframes.ts` | `kf_expr()` in `filtergraph.rs` | Clamp outside the range; between keyframes interpolate with the **left** keyframe's easing. `linear → p`, `ease-in → p²`, `ease-out → p(2-p)`, `ease-in-out → p²(3-2p)`; the ffmpeg expression stores `p` in `st(0)` so the easing warp reuses it. Keyframe `t` is clip-local on both sides. |
| Crop | `uvRect` uniform, `cropX = max(0, min(x, 1-w))` in `PlaybackController.layerFor` | `crop=…` with `x.min(1-w).max(0)` | Applied **before** the contain-fit on both sides, so fit math sees cropped dimensions. Both clamp identically so hand-edited JSON with `x + w > 1` renders the same. |
| Transitions | `transitionWindow` + `pushTransitionLayers` | per-clip `ext_in`/`ext_out = d/2`, alpha ramps, `geq` wipe masks, overlay-`x` slides | Window is centred on the cut; each side needs `d/2` of source headroom; the incoming clip is blended **on top** of the outgoing one. |
| Text and fonts | `TextRenderer` (Canvas2D) with the bundled webfonts | `ass.rs` → libass with `fontsdir` pointing at the same TTFs | `PlayResX/Y` = canvas size; `WrapStyle: 2`; explicit `\n` → `\N`. Left/right alignment moves the anchor `measuredWidth / 2 - 0.25 × fontSize` off the block centre (times `transform.scale`); the `0.25` is exactly the `PADDING` constant `TextRenderer` adds around the glyphs. `measuredWidth: 0` falls back to centred. |
| Subtitles | drawn bottom-centre at `height/2 - h/2 - 0.05×height` | ASS `\an2` with `MarginV = 5%` of height | One shared style for all cues on both sides. |
| Background blur | Canvas2D `blur(5px)` on a 192-px-wide cover-cropped copy | `gblur=sigma=30` on a full-resolution cover crop | Geometry and content match; the **kernel does not**. This is a knowingly approximate contract. |

### One known ordering gap

The colour contract holds operation by operation but not in sequence. `LAYER_FRAG_SRC`
applies the filter-preset matrix first, then temperature, then brightness, contrast and
saturation. `filtergraph.rs` emits `eq` (brightness/contrast/saturation) first, then `lutrgb`
for temperature, then `preset_chain()`. Each step matches its counterpart, but the steps do
not commute, so a clip that carries a preset *and* non-zero adjustments — or temperature
together with contrast or saturation — will not match exactly between preview and export.
Clips that use only one of the two groups are unaffected. This is a real gap, not a
documented approximation; fixing it means picking one order and moving the other side to it.

### Why the contracts exist: chromakey vs colorkey

Green-screen keying was first implemented with ffmpeg's `chromakey` filter, which compares
chroma planes in YUV. It was rejected. `chromakey` compares *limited-range* video planes
against a *full-range* key colour, which introduces a threshold offset that depends on the
video's colour space (roughly 0.046 on BT.601). A browser shader working on decoded RGB
cannot reproduce that offset, so the same `similarity` value keyed noticeably more
aggressively in the preview than in the export — the user tunes the slider until the preview
looks right, exports, and gets a different matte.

The fix was to key on decoded RGB on both sides: `colorkey` in ffmpeg, `length(rgb - key) /
sqrt(3)` in the shader, with alpha ramping over `[similarity, similarity + blend]`. Both
`shaders.ts` and `filtergraph.rs` carry a `CHROMA KEY CONTRACT` comment explaining this,
because the naive change ("just use the filter named chromakey") is exactly the kind of edit
that silently breaks parity.

> When a comment and an implementation disagree, the implementation wins. A few doc comments
> still describe earlier designs — the schema's `ChromaKey` type is documented in terms of
> YUV `chromakey`, and the `shaders.ts` header credits `colorbalance` for temperature where
> `filtergraph.rs` emits `lutrgb`. The `CHROMA KEY CONTRACT` and `COLOR MATH CONTRACT`
> comments inside `shaders.ts` and `filtergraph.rs` are the ones to trust.

### Changing a visual feature

1. Change the preview (`shaders.ts` / `Compositor` / `PlaybackController`).
2. Change the renderer (`filtergraph.rs`, or `ass.rs` for text).
3. If the schema changed, update `vikado-types`, re-export the bindings, update the zod mirror.
4. `cargo test` — the insta snapshots under
   `crates/vikado-renderer/tests/snapshots/` will fail. **A snapshot diff is the review
   surface**: read the new graph line by line before accepting it with `INSTA_UPDATE=always
   cargo test`, or with `cargo insta accept` if you have installed `cargo-insta`
   (`cargo install cargo-insta` — the workspace only depends on the `insta` library).
5. Verify against real ffmpeg: `cargo test -p vikado-renderer --test golden_render -- --ignored`.
6. Compare a preview frame with an exported frame for the feature you touched.

---

## 8. The render service

`crates/vikado-server`. The router lives in `lib.rs` (`build_app`) so integration tests can
drive it in-process with `tower::ServiceExt::oneshot`; `main.rs` only reads env config, starts
the sweeper, and serves.

### Job lifecycle

```
POST /api/v1/jobs                     -> 201 {"job_id": "<uuid v7>"}   phase: created
POST /api/v1/jobs/{id}/assets         -> multipart, one field per file, FIELD NAME = sha-256 hex
POST /api/v1/jobs/{id}/render         -> 202, body {project, options}  phase: queued -> rendering
GET  /api/v1/jobs/{id}/events         -> SSE stream of JobStatus
GET  /api/v1/jobs/{id}                -> JobStatus (polling fallback)
GET  /api/v1/jobs/{id}/download       -> video/mp4 (409 NOT_DONE if unfinished)
DELETE /api/v1/jobs/{id}              -> 204, cancels the render and deletes the workspace
GET  /api/v1/healthz, /api/v1/version
```

`JobStatus` is `{job_id, status, progress, error?}` where `status` is one of `created`,
`queued`, `rendering`, `done`, `failed`, `canceled` and `progress` is `0..1`. Errors carry a
stable `code` (`JOB_NOT_FOUND`, `BAD_ASSET_KEY`, `UNSUPPORTED_SCHEMA`, `ASSET_MISSING`,
`FFMPEG_FAILED`, `IO_ERROR`, `NOT_DONE`, …) plus a message.

The client half is `web/src/export/exportClient.ts`: it collects the hashes actually
referenced by clips (so unused imports are never uploaded), uploads each one as a multipart
field named by its hash, posts `{project, options}`, subscribes to SSE, and falls back to 1 s
polling if the event stream drops.

The upload field name being the content hash is what makes dedupe trivial: the server
validates the name is 64 hex characters (which also makes it a safe path component) and writes
the bytes to `<job>/assets/<hash>` — exactly the filename `inputs::collect_inputs` expects.

### Workspaces, concurrency, and cleanup

Each job gets a directory under `VIKADO_DATA_DIR/jobs/<uuid>/` containing `assets/`, `work/`
(holding `graph.txt` and `overlays.ass` for post-mortem debugging), and `out.mp4`. IDs are
UUID v7, so the directory listing sorts by creation time.

`POST /render` validates `schemaVersion` against `vikado_types::SCHEMA_VERSION`, marks the job
`queued`, and spawns a task that first awaits a permit from a `Semaphore` sized by
`VIKADO_MAX_CONCURRENT_RENDERS` (default 1). ffmpeg saturates a machine easily; the semaphore
is the whole admission-control story. Progress callbacks write into a `tokio::sync::watch`
channel, and `/events` is just a `WatchStream` over that channel serialized as SSE with
keep-alives — which means an SSE subscriber immediately receives the current status on
connect, and late subscribers never miss the terminal state.

A background task sweeps every 600 s and removes jobs older than `VIKADO_JOB_TTL_HOURS`
(default 24), deleting their directories. On startup, `remove_orphan_dirs()` deletes every
directory under `jobs/` that the (empty) in-memory registry does not know about.

**Jobs are in-memory and are lost on restart.** This is deliberate. The browser holds the
authoritative project and its media, so the recovery path for a dropped job is simply to
export again; persisting job state would buy little and would turn a stateless service into
one with a database and a migration story. The startup orphan sweep is the other half of that
decision — restarting is what garbage-collects abandoned workspaces.

### Configuration

| Variable | Default | Effect |
| --- | --- | --- |
| `VIKADO_PORT` | `3000` | listen port (binds `0.0.0.0`) |
| `VIKADO_DATA_DIR` | `./data` | root for per-job workspaces |
| `VIKADO_STATIC_DIR` | unset | when set, serves the built frontend with an SPA fallback |
| `VIKADO_FONTS_DIR` | unset | fonts handed to libass; ignored if the path does not exist |
| `VIKADO_MAX_UPLOAD_BYTES` | `2147483648` | request body limit |
| `VIKADO_MAX_CONCURRENT_RENDERS` | `1` | render semaphore permits |
| `VIKADO_JOB_TTL_HOURS` | `24` | sweeper age threshold |

**There is no authentication, and CORS is permissive.** Any client that can reach the service
can create jobs, upload files, and consume CPU. Run it on localhost or behind a reverse proxy
that provides authentication and rate limiting.

The renderer can also be driven without the server, which is the fastest way to iterate on
`filtergraph.rs`:

```sh
cargo run -p vikado-renderer -- project.json assets-dir out.mp4 --fonts web/public/fonts
```

Files in `assets-dir` must be named by their content hash, exactly as the server stores them.

---

## 9. Test surface

```sh
cargo test
```

Unit tests plus the insta filtergraph snapshots in
`crates/vikado-renderer/tests/graph_snapshots.rs`. The snapshots cover a single clip,
adjustments and effects, transitions, speed/flip/background, multi-track gaps with image and
audio clips, chroma key + crop + background blur, keyframe expressions, ASS-aligned text, and
the export downscale. They are the review surface for any renderer change.

```sh
cargo test -p vikado-renderer --test golden_render -- --ignored
```

Runs real ffmpeg over `fixtures/media` and asserts the output's shape with ffprobe.

```sh
cargo test -p vikado-server --test api -- --ignored
```

Drives the full render lifecycle through the router in-process. The non-`--ignored` tests in
the same file (job creation, upload validation, error paths) run in plain `cargo test`.

```sh
cd web && pnpm vitest run
```

Frontend unit tests: timeline operations, keyframe sampling, SRT parsing, clipboard, caption
seam de-duplication.

```sh
cd web && pnpm build
```

`tsc -b` plus the generated-types drift check, then the Vite production build.

CI (`.github/workflows/ci.yml`) runs all of the above across four jobs: `web` (`pnpm lint`
with oxlint, `pnpm build`, `pnpm vitest run`), `rust` (`cargo fmt --all --check`, `cargo
clippy --workspace -- -D warnings`, `cargo test --workspace`, then both `--ignored` suites
against a real ffmpeg), `docker` (builds `docker/Dockerfile` without pushing, so the
single-container artifact cannot silently break), and `ts-bindings-fresh` as described in
[section 4](#4-schema-as-contract).

---

## 10. Known limitations and deferred work

Current limitations, all verifiable in the code:

- **No authentication on the render service**, and permissive CORS. Deploy behind a proxy.
- **Export requires the backend.** There is no client-side export path; without a reachable
  service you can edit but not produce an MP4.
- **Text clips cannot be keyframe-animated.** `ass.rs` emits static `\pos`, `\frz`, `\fscx/y`
  and `\alpha` from the clip's transform, so the inspector hides the keyframe diamonds for
  text (`allowKf = clip.type !== 'text'` in
  `web/src/editor/inspector/InspectorPanel.tsx`). Hiding the control keeps preview and export
  identical rather than letting the editor promise something the exporter cannot deliver.
- **Blur-kernel parity is approximate.** The preview blurs a 192-px-wide canvas with Canvas2D
  `blur(5px)`; the renderer uses `gblur=sigma=30` at full resolution. Geometry and content
  match, the exact kernel does not.
- **Colour operations run in different orders.** The preview shader applies the filter preset
  before the brightness/contrast/saturation/temperature math; the renderer applies `eq` and
  `lutrgb` before `preset_chain()`. Every individual operation matches, but they do not
  commute, so combining a preset with non-zero adjustments produces a small mismatch between
  preview and export (see [section 7](#7-parity-contracts)).
- **Preview video-layer budget.** `MediaPool` keeps at most `MAX_LIVE_VIDEOS = 6` live video
  elements and evicts by LRU, so timelines with more simultaneous video layers than that will
  thrash decoders. Scrubbing backwards is choppy: the preview relies on
  `HTMLVideoElement.currentTime` seeks, whose cost is set by the source's keyframe interval.
- **Transitions in the preview are an approximation.** They are composed from ordinary layers
  (opacity, scissor, translation) rather than a two-texture blend pass;
  `TRANSITION_FRAG_SRC` in `shaders.ts` is written but not linked. For full-stage clips — the
  common case — the result matches the renderer; for scaled or offset clips it can differ at
  the edges.
- **Hiding a video track does not mute it in the preview.** `inputs::collect_inputs` skips
  hidden non-audio tracks, so a hidden track's audio is dropped from the export, while
  `audibleClipsAt` only consults `track.muted`, so the preview still plays it. Mute the track
  as well as hiding it to keep the two in agreement.
- **No schema migrations.** `schemaVersion` is `1`; documents are re-parsed through zod on
  open so new fields pick up defaults, and the server rejects any other version with
  `UNSUPPORTED_SCHEMA`. There is no ladder for breaking changes yet.
- **Auto-captions download a model on first use.** `onnx-community/whisper-base` at fp32, run
  in a worker on WebGPU when `navigator.gpu` exists and on wasm otherwise
  (`web/src/captions/`). The weights are fetched from the Hugging Face hub and cached by the
  browser Cache API — transcription itself is local, but that first fetch is a network
  request the rest of the editor never makes. Quantised variants were rejected: they fail to
  load on wasm and degrade badly on software WebGPU.

Deliberately deferred, in rough order of interest:

- **A WebCodecs decode path** for the preview, replacing `HTMLVideoElement` seeking. It would
  fix reverse scrubbing and lift the simultaneous-layer ceiling, at the cost of owning frame
  buffering and presentation timing.
- **Keyframed text**, which needs either an ASS emitter that writes per-frame animation or a
  different text compositing path in the renderer.
- **A client-side export path** (WebCodecs encode), for an editor that works with no backend
  at all. It would introduce a *third* implementation of every visual feature, so the parity
  contracts would have to be extended to cover it before it is worth doing.
- **Authentication and quotas** on the render service, for anyone who wants to host it for
  more than one person.
