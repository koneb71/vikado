# Self-hosting Vikado

> The render service is optional. Browsers with WebCodecs can export an MP4
> locally with no server involved; host this when you want ffmpeg-quality output,
> support for sources browsers cannot decode, or encoding done off the editing
> machine. See the export section of the README for the trade-offs.

Vikado splits into two halves. The editor is a single-page app that runs entirely in the
browser: it stores projects in IndexedDB, media in OPFS, and does all editing and preview
locally. The Rust render service (`vikado-server`) exists only to turn a finished project
into an MP4 with ffmpeg. It keeps no user accounts and no long-lived state — every export
is a self-contained job that is deleted again after a TTL.

Self-hosting therefore means running one process: the render service, which also serves the
built editor. This document covers running it with Docker, running it from source,
configuring it, sizing it, and putting it behind a reverse proxy.

> The render service has **no authentication**. Anyone who can reach it can create render
> jobs, upload files, consume CPU and disk, and download the output of any job whose id
> they know. Run it on localhost or on a trusted network, or put an authenticating reverse
> proxy in front of it. See [SECURITY.md](../SECURITY.md) for the full threat model.

## What the container actually is

`docker/Dockerfile` is a three-stage build that produces one runtime image containing the
whole application:

1. **Frontend stage** (`node:22-slim`) runs `pnpm install --frozen-lockfile` and
   `pnpm build` in `web/`, producing the static SPA in `web/dist` (which includes the
   bundled TTFs under `dist/fonts`).
2. **Server stage** (`rust:1-slim-bookworm`) runs `cargo build --release -p vikado-server`.
3. **Runtime stage** (`debian:bookworm-slim`) installs `ffmpeg` and `ca-certificates`, then
   copies in just the compiled binary and the built SPA. Neither Node nor the Rust
   toolchain survives into the runtime image.

The runtime image sets `VIKADO_PORT=3000`, `VIKADO_DATA_DIR=/data`,
`VIKADO_STATIC_DIR=/srv/vikado/web` and `VIKADO_FONTS_DIR=/srv/vikado/web/fonts`, declares
`EXPOSE 3000` and `VOLUME ["/data"]`, and runs `vikado-server`.

Because `VIKADO_STATIC_DIR` is set, the server mounts the built editor as a fallback service
with SPA routing (any unmatched path falls back to `index.html`) alongside the API under
`/api/v1`. One container is the entire app; the browser talks to the same origin it was
loaded from, so no CORS configuration or separate frontend host is required.

The image defines no `USER`, so `vikado-server` runs as root inside the container. You can
drop that with `--user` (or `user:` in compose), but `VIKADO_DATA_DIR` then has to be writable
by the uid you pick: with a fresh root-owned volume, job creation fails with
`JOB_CREATE_FAILED` and `Permission denied`.

The fonts matter: the same TTFs are served to the browser as webfonts and passed to libass
as `fontsdir` when rendering text and subtitles. That is what keeps preview and export
looking the same, which is why they are baked into the image rather than left to the host's
fontconfig.

## Requirements

- Docker with Compose v2, or a Rust toolchain plus Node 22 and pnpm if you build from source.
- `ffmpeg` on `PATH` for the server process (already in the image). The server spawns
  `ffmpeg` and nothing else at runtime; `ffprobe` is only needed if you run the renderer's
  golden-render tests.
- CPU. Rendering is the only expensive thing the service does, and it is CPU-bound.
- Disk for `VIKADO_DATA_DIR`, sized for the source media of concurrent and recent jobs.

## Running with Docker Compose

The bundled `docker-compose.yml` builds the image, publishes host port 3005 to container
port 3000, mounts a named volume at `/data`, and sets the upload limit, render concurrency
and job TTL explicitly.

```sh
docker compose up --build -d
```

Then open http://localhost:3005.

Check that the service is alive:

```sh
curl -s http://localhost:3005/api/v1/healthz
```

That prints `ok`. The build version is available too:

```sh
curl -s http://localhost:3005/api/v1/version
```

Follow the logs:

```sh
docker compose logs -f
```

To serve on a different host port, edit the `ports:` mapping in `docker-compose.yml` (for
example `"8080:3000"`). Leave the container side at 3000 unless you also change
`VIKADO_PORT`.

Stop it again:

```sh
docker compose down
```

`docker compose down` leaves the `vikado-data` volume in place. Add `-v` to delete it; since
job workspaces are wiped on startup anyway, that only matters if you have put something else
in the volume.

### Development compose file

`docker-compose.dev.yml` is a different thing and is not meant for deployment: it runs the
Vite dev server on :5173 with `web/` bind-mounted, and `cargo watch` rebuilding the server on
:3000 with the repository root bind-mounted at `/app`.

```sh
docker compose -f docker-compose.dev.yml up --build
```

Note that the dev compose file does not set `VIKADO_FONTS_DIR`, so text and subtitles in
renders from that container will not use the bundled fonts. Set
`VIKADO_FONTS_DIR=/app/web/public/fonts` on the `server` service if you are checking text
output.

## Running with plain `docker run`

Build the image and tag it:

```sh
docker build -t vikado -f docker/Dockerfile .
```

Run it with a named volume for job data:

```sh
docker run -d --name vikado -p 3005:3000 -v vikado-data:/data vikado
```

Override any of the settings with `-e`:

```sh
docker run -d --name vikado -p 3005:3000 -v vikado-data:/data -e VIKADO_JOB_TTL_HOURS=2 -e VIKADO_MAX_UPLOAD_BYTES=536870912 vikado
```

To bind only to the loopback interface on the host (the server itself always listens on
`0.0.0.0` inside the container), publish the port explicitly on 127.0.0.1:

```sh
docker run -d --name vikado -p 127.0.0.1:3005:3000 -v vikado-data:/data vikado
```

## Running from source, without Docker

Build the editor:

```sh
cd web && pnpm install && pnpm build
```

Build the server:

```sh
cargo build --release -p vikado-server
```

Run it, pointing it at the built SPA and the bundled fonts:

```sh
VIKADO_STATIC_DIR=web/dist VIKADO_FONTS_DIR=web/public/fonts ./target/release/vikado-server
```

`ffmpeg` must be on `PATH` — the server spawns it by name. If you omit
`VIKADO_STATIC_DIR` the process serves the API only and returns 404 for `/`, which is what
you want when the editor is hosted elsewhere or when you are running the Vite dev server in
front of it.

## Configuration

Every setting is an environment variable. An empty value is treated as unset, so
`VIKADO_FONTS_DIR=` behaves the same as not setting it at all.

The first four are baked into the image by `docker/Dockerfile`; the last three are set to their
default values by `docker-compose.yml` so they are easy to find and change.

| Variable | Default | In the provided container | What it does |
| --- | --- | --- | --- |
| `VIKADO_PORT` | `3000` | `3000` (image) | TCP port. The server always binds `0.0.0.0`. |
| `VIKADO_DATA_DIR` | `./data` | `/data` (image, and again in compose) | Root for per-job workspaces. Created at startup if missing. |
| `VIKADO_STATIC_DIR` | unset (API only) | `/srv/vikado/web` (image) | Directory of built frontend files to serve, with `index.html` as the SPA fallback. |
| `VIKADO_FONTS_DIR` | unset | `/srv/vikado/web/fonts` (image) | Font directory handed to libass as `fontsdir` for text and subtitle rendering. **Silently ignored if the path does not exist.** |
| `VIKADO_MAX_UPLOAD_BYTES` | `2147483648` (2 GiB) | same value, set by compose | Maximum request body size for every `/api/v1` route. |
| `VIKADO_MAX_CONCURRENT_RENDERS` | `1` | `1`, set by compose | Number of ffmpeg renders allowed to run at once; further jobs wait in `queued`. |
| `VIKADO_JOB_TTL_HOURS` | `24` | `24`, set by compose | Age at which a job and its workspace are deleted. |

Values that do not parse fall back to the default rather than failing startup, so a typo in
`VIKADO_MAX_CONCURRENT_RENDERS` gives you 1, not an error.

Logging uses `tracing` and honours `RUST_LOG`; the default filter is
`vikado_server=info,tower_http=info`. Output is sparse by design: a line at startup with the
listen address, and a line per swept job. There is no per-request access log, so if you need
one, take it from your reverse proxy.

### The upload limit applies to the whole request

`VIKADO_MAX_UPLOAD_BYTES` is a body-size limit on all API routes, not just uploads. The
editor uploads one file per request, so in practice it is a per-file cap — but it also caps
the project JSON of a render request. Projects with a large number of subtitle cues are
still tiny compared to media, so 2 GiB is generous for both; the number to think about is
the largest single source file your users will export with.

The two routes report the limit differently. An oversized render request gets a plain
`413 Payload Too Large`; an oversized asset upload gets `400` with code `UPLOAD_MALFORMED`,
because the truncated body reaches the multipart parser before the handler sees it.

### Serving over HTTPS

Several editor features require a
[secure context](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts): OPFS
media storage, and screen and webcam recording via `getDisplayMedia`/`getUserMedia`. Browsers
treat `http://localhost` as secure, but a plain-HTTP LAN address is not. If you serve Vikado
to anyone other than yourself, terminate TLS at a reverse proxy — otherwise recording
silently disappears from the UI (it is feature-detected) and media storage may fail.

## The data directory

Everything the service writes lives under `VIKADO_DATA_DIR/jobs/<job-uuid>/`:

```
data/jobs/019ff9fe-9c9c-7692-a4f9-9ba23d5f82b0/
├── assets/
│   └── 9481f3fd1efab428b122b3dd55dcf64f8b956d628ff8470b69a3c122c92a59ca
├── work/
│   ├── graph.txt        # the generated ffmpeg filter_complex script
│   └── overlays.ass     # the ASS subtitle/text overlay file (only if the project has text)
└── out.mp4              # the finished render
```

Uploaded assets are named by their sha-256 hex digest; the client's filename is never used
anywhere on disk. Assets are per job, with no sharing between jobs, so a job's workspace
holds a full copy of every source file its project references. Peak disk usage for a job is
roughly the sum of its source files plus the output.

Job metadata (status, progress, cancellation) is held in memory only. Two consequences worth
knowing before you plan backups or restarts:

- **Restarting the service wipes every job workspace.** On startup the server removes every
  directory under `<VIKADO_DATA_DIR>/jobs/` that it does not have in memory — which, on a
  fresh process, is all of them. In-flight and completed-but-not-downloaded exports are lost,
  and clients get a 404 for their job id. There is nothing here worth backing up.
- **Jobs expire.** A sweeper runs every 10 minutes and removes any job older than
  `VIKADO_JOB_TTL_HOURS` (measured from job creation, not from completion). Sweeping cancels
  the render if it is still running, so the TTL doubles as the only wall-clock limit on how
  long a single render may occupy the queue.

Clients also clean up after themselves: the editor sends `DELETE /api/v1/jobs/<id>` whenever
the export dialog closes — after a cancel and after a finished download alike — which cancels
the ffmpeg process if it is still running and deletes the workspace immediately. A user who
closes the tab instead leaves the workspace for the sweeper.

If you want a tighter disk profile, lower `VIKADO_JOB_TTL_HOURS`. One or two hours is plenty
for interactive use: the editor offers the download the moment the render finishes, and
deletes the job as soon as the export dialog is closed.

## Sizing

Rendering is CPU-bound and single-job-parallel: ffmpeg is invoked without a `-threads`
argument, so libx264 uses every core it can see. That is exactly why the default
`VIKADO_MAX_CONCURRENT_RENDERS` is 1 — a second concurrent render does not make the machine
faster, it just makes both exports slower and doubles peak memory and disk. Raise it only if
you have deliberately spare cores, or if your users mostly export short draft-quality clips
where process startup dominates.

Other things that affect load:

- **Quality tier.** `draft` uses x264 `veryfast`/CRF 28, `standard` and `high` use `medium`
  with CRF 23 and 18. Draft is dramatically cheaper.
- **Resolution scale.** The editor offers 100%, 75% and 50%; halving the scale quarters the
  pixel count and roughly quarters encode cost.
- **Clip count.** The renderer emits one ffmpeg input per media-backed clip, so a busy
  timeline means many simultaneous decoders in one process. Memory scales with clip count,
  not just resolution.

For a small team, two to four cores and a few gigabytes of RAM are a reasonable starting
point, with disk sized for `TTL × exports-per-hour × average project media size`. Watch the
first few real exports before committing to numbers; project media size varies far more than
anything else here.

## Behind a reverse proxy

The proxy has three jobs: terminate TLS, allow large uploads, and leave the progress stream
alone. Everything is same-origin — the SPA and the API come from one upstream — so a single
`proxy_pass` covers the app, with one extra location for Server-Sent Events.

```nginx
server {
    listen 443 ssl;
    server_name vikado.example.com;

    ssl_certificate     /etc/letsencrypt/live/vikado.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/vikado.example.com/privkey.pem;

    # Must be at least as large as the biggest source file anyone will export,
    # or nginx rejects the asset upload with 413 and the export stops there.
    client_max_body_size 2g;

    # Progress stream: no buffering, no timeout mid-render.
    location ~ ^/api/v1/jobs/[^/]+/events$ {
        proxy_pass http://127.0.0.1:3005;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header Connection "";
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding off;
        proxy_read_timeout 3600s;
    }

    location / {
        proxy_pass http://127.0.0.1:3005;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
```

Notes on why each of those settings is there:

- Regex locations win over the prefix `location /` in nginx, so the SSE block applies to
  `/api/v1/jobs/<id>/events` and the general block handles everything else.
- With `proxy_buffering` on, nginx accumulates the event stream and the progress bar sits at
  zero until the render finishes. The editor falls back to polling the status endpoint once
  per second if the stream errors out, so a misconfigured proxy degrades rather than breaks —
  but the fallback only triggers on an error, not on buffering.
- The stream emits a keep-alive comment every 15 seconds, so an idle timeout above that is
  enough to hold the connection; the long `proxy_read_timeout` is for the total render, which
  can far exceed the default 60 seconds.
- Uploads and the MP4 download are ordinary request/response traffic and need only the body
  limit and generous timeouts.

If you deploy without HTTPS on a LAN, keep the same proxy settings and drop the `ssl` lines —
but see the secure-context note above for what stops working.

### Adding authentication

Vikado has no login, no API keys and no authorization checks. The supported way to restrict
access is to make the proxy require credentials before it forwards anything. HTTP basic auth
is the simplest option that works with every part of the app:

```sh
sudo htpasswd -c /etc/nginx/vikado.htpasswd yourname
```

Add these two lines at the `server` level of the block above, so they apply to the SPA, the
API and the event stream alike:

```nginx
auth_basic           "Vikado";
auth_basic_user_file /etc/nginx/vikado.htpasswd;
```

Whatever scheme you choose, it has to be one the browser applies automatically to all
requests — basic auth, a session cookie, or an authenticating proxy like oauth2-proxy. The
progress stream uses `EventSource`, which cannot send custom headers, so a scheme that
requires an `Authorization: Bearer` header on each request will break progress reporting
(exports will still complete, and the client will fall back to polling, which fails the same
way). Cookie-based and basic auth do not have this problem.

Restricting network reachability is a fine substitute for a proxy when only you use the
service: publish the container port on `127.0.0.1` and reach it over SSH port forwarding or a
VPN.

## Upgrading

```sh
git pull
```

```sh
docker compose up --build -d
```

The rebuild replaces the container; the `vikado-data` volume survives, though its job
directories are cleared on startup regardless. Upgrade when no render is in progress, since
restarting cancels in-flight jobs.

Because one container serves both halves, the editor and the render service always come from
the same commit, which matters: the server rejects a project whose `schemaVersion` it does
not recognise with HTTP 422 and code `UNSUPPORTED_SCHEMA`. If you host the built SPA
separately from the render service — on a CDN, say — you must deploy both from the same
commit.

Projects themselves live in the user's browser, so an upgrade never migrates server-side
data. There is none.

## Troubleshooting

### The container will not start: address already in use

The host port is taken. Find the process holding it:

```sh
lsof -nP -iTCP:3005 -sTCP:LISTEN
```

Either stop that process or change the host side of the `ports:` mapping in
`docker-compose.yml`. Change `VIKADO_PORT` only if you want to move the port inside the
container as well.

### The export dialog says `Upload failed (413)` or `Upload failed (400)`

An asset upload was rejected, and the editor abandons the export there rather than submitting
a render it knows will fail. A `413` comes from a reverse proxy whose `client_max_body_size`
is smaller than the file. A `400` is the server's own `VIKADO_MAX_UPLOAD_BYTES` truncating the
multipart body. Raise whichever limit is below the size of the source file.

### Export fails with `ASSET_MISSING`

The project referenced an asset that is not in the job's `assets/` directory. Through the
editor this is rare, because it uploads every referenced file before submitting the render;
it usually means the job was driven through the API directly, or the renderer CLI was pointed
at an incomplete assets directory. The error message carries the exact path the renderer
looked for:

```sh
curl -s http://localhost:3005/api/v1/jobs/<job-id>
```

### Export fails with `FFMPEG_FAILED`

That code covers both "ffmpeg could not be started" and "ffmpeg exited non-zero". The error
message carries the detail: for a startup failure it reads `could not start ffmpeg: ...`
(install ffmpeg or use the provided image), and for a render failure it contains the last 60
lines of ffmpeg's stderr. The editor's export dialog shows the same text, and you can fetch
it from the status endpoint with the `curl` command above.

To reproduce a failing render outside the service, run the renderer CLI directly against a
saved project and an assets directory whose files are named by their content hash:

```sh
cargo run -p vikado-renderer -- project.json assets-dir out.mp4 --fonts web/public/fonts
```

The CLI takes no quality or scale flags; it always renders at the defaults (`high`, full
resolution), so a failure that only shows up at one quality tier will not reproduce there.

### Exported text or subtitles use the wrong font

`VIKADO_FONTS_DIR` is unset, or points at a path that does not exist — in which case it is
ignored without a warning and libass falls back to whatever fontconfig finds, which in a slim
container is usually nothing useful. Confirm the directory is visible inside the container:

```sh
docker compose exec vikado ls /srv/vikado/web/fonts
```

You should see `Inter.ttf`, `JetBrainsMono.ttf`, `Oswald.ttf`, `PlayfairDisplay.ttf` and
`Roboto.ttf`, alongside a `LICENSE-*.txt` for each one.

### A job reports `rendering` forever

If ffmpeg is running, the render is simply slow — check with `docker compose top`. If it is
not, the render task died before ffmpeg started, which the server currently cannot report:
the status stays at `rendering` until the TTL sweeper collects the job. The container log has
the panic. Restarting clears the stuck job along with every other one.

### The progress bar sits at 0% but the export completes

The event stream is being buffered somewhere between the browser and the server. Apply the
SSE location settings above (`proxy_buffering off`, `Connection ""`, long
`proxy_read_timeout`). Cloudflare-style proxies and some load balancers buffer by default too.

### Disk is filling up

Check what the job directory is holding:

```sh
docker compose exec vikado du -sh /data/jobs
```

Lower `VIKADO_JOB_TTL_HOURS` so the sweeper reclaims space sooner. Restarting the service
clears the directory entirely, since jobs do not survive a restart.

### Screen or webcam recording is missing from the editor

The whole Record tab is feature-detected: the sidebar drops it when the browser exposes
neither `getDisplayMedia` nor `getUserMedia`, which is what happens outside a secure context.
Serve the app over HTTPS, or reach it as `http://localhost`.

### The editor loads but exports say the render service is unreachable

The SPA is being served by something other than `vikado-server`, and `/api/v1` is not
reaching the render service. The editor always calls the API on its own origin, so the same
host must serve both. Verify from the same origin the browser uses:

```sh
curl -s https://vikado.example.com/api/v1/healthz
```
