# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Eight more fonts**, taking the bundled set to thirteen across sans, serif, display,
  script, handwriting and mono: Montserrat, Poppins, Merriweather, Bebas Neue, Anton,
  Bangers, Lobster and Caveat. The font picker now groups by category.
- **Six more filters** — noir, vivid, faded, cyberpunk, sunset and mint — each authored as
  a colour matrix for the shader and mirrored as an ffmpeg chain.
- **Five more transitions**: wipe up, wipe down, slide up, slide down, and fade through
  white (as opposed to fade-black, which drops to the canvas colour).
- **Text styling**: letter spacing, drop shadow, and an uppercase/lowercase transform.
- **Text animations**: slide in or out from any of four directions, plus zoom in and zoom
  out, independently on entry and exit.

- **Export on this device.** The timeline can now be rendered and encoded entirely in
  the browser, using the GPU compositor for frames and the platform's hardware H.264
  encoder through WebCodecs, so an export no longer requires the render service. The
  export dialog offers "This device" (the default where WebCodecs is available) or
  "Render service", and both honour the existing quality tier and output scale.

### Changed

- The layer stack that describes a frame moved out of `PlaybackController` into
  `web/src/engine/frameGraph.ts`. The live preview and the in-browser exporter now
  call the same builder, so a local export cannot drift from the preview.
- Downscaled local exports now ask the browser for its highest-quality resampling
  filter instead of the default, which aliased visibly at 0.5x.

### Fixed

- **Roboto was not a font.** The bundled `Roboto.ttf` shipped in 0.1.0 as a saved HTML
  page, so every project using it silently fell back to a different face — and to a
  *different* fallback in the browser than in libass. Replaced with the real file, and
  `fonts.test.ts` now checks that each bundled font is a real font whose internal family
  name matches the one the ASS style line asks for.
- **Every layer was composited upside down.** The vertex shader flips v so the
  quad's top edge samples the texture's top row, but `layerMatrix` then negated
  the y basis as well as the translation, so that edge landed at the bottom of
  the frame. Video, images, text and subtitles were all mirrored vertically in
  the preview and in the local export, against an ffmpeg renderer that was
  upright the whole time. Only the translation is negated now, and the
  placement maths moved to `web/src/engine/compositor/geometry.ts` with tests
  pinned to corner colours read off real renderer output — orientation is the
  one thing a preview-vs-local-export comparison can never catch, since both
  share that code and a shared flip cancels out.
- **Rotated sources exported sideways.** A clip carrying a display matrix (any phone
  portrait recording) was handed to the compositor as its raw decoded landscape frame
  while the layer was sized from the post-rotation dimensions, so it exported on its
  side and stretched. Frames are now drawn through the sample's own rotation, matching
  the preview exactly.
- **Overlapping fades jumped to full volume.** The two fades multiply in the preview
  and in ffmpeg, but the local export scheduled them as independent Web Audio ramp
  events, so any clip shorter than the sum of its fades produced a click at roughly
  full volume with its fade-in lost. The gain is now sampled from the same envelope
  the preview uses.
- **Undecodable or missing media exported silently black.** Every source is opened up
  front and the export stops with the asset's name, distinguishing media missing from
  browser storage (re-import it) from media this browser cannot decode (use the render
  service). Unencodable audio no longer disappears from the output either.
- Two clips of the same asset on screen together (split, then crossfaded) could show
  one recycled frame for both.
- Still images re-uploaded their full-resolution texture to the GPU on every preview
  frame, a regression from the `frameGraph` extraction.
- The exporter leaked its demuxers, hardware decoders and WebGL context on cancel or
  failure, and the finished download URL leaked if the dialog closed mid-export.

### Known issues

- Exporting on this device resamples sped-up audio, which raises its pitch; the
  preview and the ffmpeg renderer both preserve pitch. The export dialog warns when a
  project is affected. Use the render service for pitch-correct output.

## [0.1.0] - 2026-08-13

Initial public release. Vikado is a local-first, web-based video editor: the browser
does all editing and real-time preview, and a stateless Rust service renders the final
MP4 with ffmpeg.

### Added

#### Timeline

- Multi-track timeline with video, audio and text tracks (track 0 is the bottom layer;
  video tracks accept both video and image clips).
- Trim, split, move (including across tracks), duplicate, and copy/paste of clips.
- Edge snapping to clip boundaries, the playhead and the timeline start, with on-screen
  guides; toggleable.
- Drag and drop from the media panel onto a track.
- Per-clip filmstrip thumbnails and audio waveforms, cached in IndexedDB by content
  hash.
- Right-click clip context menu, drag-resizable timeline dock, and keyboard shortcuts
  with an in-app reference dialog.
- Undo/redo across all project edits, up to 200 steps (zundo).

#### Media

- Import of video, audio and image files.
- Content-addressed storage: media files live in OPFS under the SHA-256 of their bytes,
  and the project document is autosaved to IndexedDB. Nothing is uploaded until an
  export is requested.
- Metadata probing via mp4box with a media-element fallback.
- Screen and webcam recording through MediaRecorder, with optional microphone mixing.
  WebM blobs that report an infinite duration are repaired on save, and the prober has a
  seek-to-end backstop for any that slip through.

#### Clip properties

- Playback speed from 0.25x to 4x, with pitch-corrected audio (chained `atempo` on the
  render side).
- Horizontal and vertical flip.
- Position, scale, rotation and opacity.
- Per-clip volume and fade in/out; a video clip's fade covers opacity and audio
  together. Video clips and whole tracks can be muted.

#### Keyframe animation

- Keyframes on x, y, scale, rotation and opacity, with linear, ease-in, ease-out and
  ease-in-out easing between them.
- Diamond toggles in the inspector and keyframe markers on the timeline clip.
- Values interpolate between keyframes and clamp outside the keyframed range; keyframe
  times are clip-local, so they survive moving the clip.

#### Effects

- Color adjustments: brightness, contrast, saturation and temperature.
- Six filter presets: grayscale, sepia, vintage, cool, warm and invert.
- Six transitions between adjacent clips: crossfade, fade-black, wipe-left, wipe-right,
  slide-left and slide-right.
- Chroma key (green screen) with adjustable similarity and edge blend.
- Background blur fill, so vertical or off-aspect footage fills the canvas.
- Source crop.

#### Text and subtitles

- Text overlays using five bundled OFL fonts (Inter, Roboto, Oswald, Playfair Display,
  JetBrains Mono), with size, weight, italics, color, alignment, outline, background box
  and fades.
- Six one-tap text style presets.
- Subtitle track with a manual cue editor and SRT import/export.
- Auto-captions generated entirely in the browser with Whisper
  (`@huggingface/transformers`, `onnx-community/whisper-base`), using WebGPU when
  available and falling back to WebAssembly. The model is cached after the first
  download. Eleven selectable languages plus auto-detect, with de-duplication of text
  repeated across transcription window seams.

#### Utilities

- Detach audio: splits a video clip's sound onto its own audio track and mutes the
  video clip.
- Freeze frame: captures the frame the selected video clip shows at the playhead as a
  still image, then ripple-inserts it across every track and shifts the subtitle cues,
  so detached audio, overlays and captions stay in sync.

#### Export

- Server-side MP4 render (H.264 via libx264, AAC audio, yuv420p).
- Quality tier (draft, standard, high) and output resolution scale (100%, 75%, 50%).
- Live progress over server-sent events, then a direct download.

#### Project settings

- Canvas size presets (1920x1080, 1280x720, 1080x1920, 1080x1080), frame rate
  (24, 25, 30, 50, 60) and canvas background color.

#### Backend

- `vikado-types`: the serde + ts-rs schema crate, the single source of truth for the
  project format. TypeScript bindings are exported into `web/src/generated` and a
  compile-time drift check fails the frontend build if the two sides diverge.
- `vikado-renderer`: compiles a project into a single ffmpeg `filter_complex` graph
  using the same overlay-stack model as the preview, emits ASS for text and subtitles
  (rendered by libass from the same bundled TTFs the browser uses), and supervises the
  ffmpeg process while parsing progress. Ships a CLI for rendering a project without a
  server.
- `vikado-server`: an Axum job API under `/api/v1` — create a job, upload assets by
  content hash, submit a render, follow progress over SSE or by polling, download the
  result, and delete the job. Jobs live in per-job workspaces under a configurable data
  directory and are swept on a TTL. The server also serves the built frontend.

#### Preview and render parity

- Every visual feature is implemented twice, once in GLSL/Canvas for the preview and
  once as ffmpeg filters for the render, with contract comments on both sides that must
  be changed together: color math, filter presets, chroma key, keyframe sampling, text
  layout and fonts, crop clamping, and transition windows.
- Chroma keying uses ffmpeg's RGB `colorkey` rather than the YUV `chromakey` filter.
  `chromakey` compares limited-range video planes against a full-range key color, which
  introduces a colorspace-dependent threshold offset (about 0.046 on BT.601) that a
  browser cannot reproduce — the preview would key more aggressively than the export.

#### Packaging

- Single-container Docker image (multi-stage build: node, then rust, then a Debian
  runtime with ffmpeg) plus a hot-reload development compose file.
- MIT license.

### Known limitations

- The render service has no authentication and permissive CORS. Do not expose it to an
  untrusted network without putting your own access control in front of it.
- Exporting requires the backend; there is no client-side export path.
- Text clips cannot be keyframe-animated. libass cannot express it, so the editor hides
  the keyframe toggles for text rather than let the preview and the export disagree.
- Background blur parity is approximate: the preview's Canvas2D blur and ffmpeg's
  `gblur` match in geometry and content, but not in the exact kernel.
- Heavily layered projects strain the preview: the media pool keeps at most six decoded
  video elements alive and evicts the least recently used, so projects with more
  simultaneous video layers than that will thrash.
- The preview seeks real `<video>` elements, so scrubbing long-GOP sources feels
  sluggish, especially backwards.

[0.1.0]: https://github.com/koneb71/vikado/releases/tag/v0.1.0
