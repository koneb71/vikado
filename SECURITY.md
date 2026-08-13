# Security policy

## Supported versions

| Version | Supported |
| --- | --- |
| 0.1.x | Yes |
| Anything earlier | Not applicable — 0.1.0 is the first release |

Fixes are made on the current 0.1.x line. There are no long-term support branches.

## Threat model

Vikado is two pieces with very different security properties, and it is worth being blunt
about both.

### The editor is local-first

The editor is a static single-page app. There is no account system, no login, and no
server-side project storage. Projects live in IndexedDB and imported media lives in OPFS,
both scoped to the browser origin on the user's own machine. Nothing is uploaded while
editing, and closing the tab does not send anything anywhere.

Implications:

- Browser storage is not encrypted. Anyone with access to the OS user profile can read the
  projects and media Vikado has stored. Use full-disk encryption if that matters to you.
- Clearing site data for the origin destroys projects and media irreversibly. There is no
  server-side copy to restore from.
- Auto-captions run Whisper in the browser. The audio never leaves the machine, but the model
  weights are downloaded from the Hugging Face hub on first use and cached by the browser.
  That download is the only third-party network request the editor makes, and it happens only
  if a user asks for auto-captions.

### The render service has no authentication

`vikado-server` implements no authentication, no authorization, and no rate limiting. Every
endpoint under `/api/v1` is open to anyone who can open a TCP connection to it, and the
server binds `0.0.0.0`. Concretely, any client that can reach the service can:

- create render jobs and upload files, up to `VIKADO_MAX_UPLOAD_BYTES` per request;
- occupy the render queue and consume all available CPU;
- fill the disk backing `VIKADO_DATA_DIR`, subject only to the job TTL;
- read the status of, download the output of, and delete any job whose id it knows.

Job ids are the only thing standing between one client and another client's export. They are
UUIDv7 values — random enough not to be enumerated in bulk, but they are bearer tokens by
accident rather than an authorization check, and their leading bits encode the creation
timestamp. Anyone holding a job id has full control of that job.

CORS is deliberately permissive (`Access-Control-Allow-Origin: *`), so a page on any website,
loaded in a browser that can reach the service, can drive the API — including a service bound
to `localhost`. That is a design consequence of letting the editor be hosted separately from
the renderer, and another reason the service does not belong on a shared network unprotected.

**Vikado's render service is designed to run on localhost, or on a trusted network behind an
authenticating reverse proxy. Exposing it directly to the public internet is not a supported
configuration, and no part of the code is written on the assumption that untrusted clients
can reach it.** See [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md) for a reverse proxy
configuration with HTTP basic auth.

### What crosses the network on export

Exporting is the only time user content leaves the browser. The editor uploads the source
files referenced by the project — not the whole media library — plus the project JSON, which
includes text and subtitle content. The server renders, the client downloads the MP4, and the
workspace is deleted when the export dialog closes — or, if the tab goes away first, by the
TTL sweeper. If the render service is not yours, those files are on someone else's machine
for the length of the TTL.

## Mitigations that exist

These are properties of the current code, not aspirations:

- **Uploads cannot escape their job workspace.** The multipart field name must be exactly 64
  hexadecimal characters (the file's sha-256), or the request is rejected with
  `BAD_ASSET_KEY`. Client-supplied filenames are never used as paths; the original name is
  carried in the project only as a display label. Job ids are parsed as UUIDs before use, so
  paths like `/api/v1/jobs/../../etc/passwd` are 404s. Both behaviours are covered by tests in
  `crates/vikado-server/tests/api.rs`.
- **Request bodies are bounded.** A body limit (`VIKADO_MAX_UPLOAD_BYTES`, default 2 GiB)
  applies to every `/api/v1` route, uploads and render submissions alike.
- **Render concurrency is capped.** A semaphore (`VIKADO_MAX_CONCURRENT_RENDERS`, default 1)
  limits how many ffmpeg processes run at once; further jobs queue.
- **Jobs expire.** A sweeper runs every 10 minutes and deletes any job older than
  `VIKADO_JOB_TTL_HOURS` (default 24), cancelling the render if it is still running. Job state
  is in memory only, and every leftover workspace is removed at startup, so a restart is a
  full reset.
- **Clients cannot inject ffmpeg command-line arguments.** The request body is deserialized
  into the typed project schema, and the project's `schemaVersion` must match the server's or
  the request is rejected with `UNSUPPORTED_SCHEMA`. Encoder settings come from a closed enum
  (`draft`/`standard`/`high`) rather than free-form strings, ffmpeg is spawned as an argv
  vector with no shell involved, and the filter graph is written to a file rather than
  interpolated into a command line. Text and subtitle content reaches ffmpeg through a
  generated ASS file, with backslashes escaped and braces neutralised so it cannot open an
  override block. What goes *inside* the graph is a separate question — see the gaps below.
- **Transcription is local.** Auto-captions never upload audio.

## Known gaps

- **No authentication, authorization, rate limiting or quotas**, as described above. Add them
  at the proxy layer.
- **No per-client isolation.** Any client that learns a job id gets that job's output.
- **Project asset references are not validated as content hashes.** The upload endpoint
  validates the storage key, but the render endpoint resolves each input by joining
  `assets[].hash` from the submitted project onto the job's asset directory without checking
  its shape. A crafted project can therefore name a path outside the job workspace, and the
  referenced file — if ffmpeg can decode it — ends up in an MP4 the submitter can download.
  Treat the ability to reach the API as equivalent to read access to any media file the server
  process can read. Running in the provided container limits that to the image plus
  `/data`; running the binary directly as your own user does not.
- **Style strings are copied into the generated files unchecked.** A `#`-prefixed
  `canvasBackground` and a chroma-key colour are pasted into the `filter_complex` script after
  only the `#` is stripped; a text clip's font name is pasted into the ASS style line as-is.
  Neither can reach the command line — the graph is passed as a script file — but a crafted
  project can add syntax of its own to what ffmpeg and libass parse.
- **A malformed colour panics the render task.** A colour shorter than six hex digits panics
  the ASS emitter, which kills the task and leaves the job reporting `rendering` with no
  progress until the TTL sweeper collects it. The process survives and the render slot is
  released, but the client waits forever.
- **Error messages are verbose.** A failed render reports the last 60 lines of ffmpeg's
  stderr and absolute server-side paths to the client. That is deliberate — it is what makes
  export failures debuggable — but it discloses details of the server's filesystem.
- **No wall-clock render timeout.** A job runs until it finishes, is deleted, or is swept at
  the TTL. The TTL is the only upper bound.
- **No access logging.** The server logs a startup line and swept jobs. If you need an audit
  trail, take it from the reverse proxy.
- **ffmpeg is the real attack surface.** The service exists to feed untrusted media files to
  ffmpeg's demuxers and decoders, which is historically where media-handling vulnerabilities
  live. Rebuild the image regularly to pick up Debian's ffmpeg updates, and do not run the
  service alongside data you would not hand to its clients.
- **The provided image runs as root.** `docker/Dockerfile` sets no `USER`, so the server and
  the ffmpeg processes it spawns run as uid 0 inside the container. Passing `--user` drops
  that, but `VIKADO_DATA_DIR` must then be writable by the uid you choose — otherwise job
  creation fails with `JOB_CREATE_FAILED`.
- **No supply-chain attestation.** Releases are not signed and there are no published image
  digests to verify against yet.

## Deploying safely

1. Bind the service to localhost, or publish it only on a trusted network.
2. Put an authenticating reverse proxy in front of it if more than one person uses it, and
   terminate TLS there — several editor features (OPFS storage, screen and webcam recording)
   require a secure context anyway.
3. Prefer the container. It carries little more than ffmpeg, the binary and the built SPA, so
   its filesystem is a much smaller blast radius than a workstation — though the process
   inside it still runs as root, as noted above.
4. Give `VIKADO_DATA_DIR` its own volume, and lower `VIKADO_JOB_TTL_HOURS` to the smallest
   value your users tolerate — one or two hours is usually enough.
5. Keep the image current; the ffmpeg it ships is where security updates matter most.

## Reporting a vulnerability

Report security issues privately through GitHub's security advisory flow:

**https://github.com/koneb71/vikado/security/advisories/new**

Please do **not** open a public issue, pull request or discussion for a suspected
vulnerability. Public reports expose users of self-hosted instances before a fix exists.

A useful report includes:

- the affected component (editor, `vikado-server`, `vikado-renderer`) and the version or
  commit you tested;
- how the instance was deployed — in particular whether it sat behind a proxy;
- reproduction steps, ideally a minimal project JSON or HTTP request;
- what an attacker gains, and the access they need to start.

We aim to acknowledge reports within a week, and will keep you updated as the fix progresses.
If you would like credit in the release notes, say so in the report; if you would rather stay
anonymous, that is fine too.

Findings that amount to "the render service has no authentication" are already documented
above and are not vulnerabilities in themselves. Reports that show how that design causes
harm in a configuration this policy describes as supported — localhost, or behind an
authenticating proxy — very much are.
