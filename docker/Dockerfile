# ---- Frontend build ----
FROM node:22-slim AS web
RUN corepack enable
WORKDIR /app/web
# pnpm-workspace.yaml carries allowBuilds for transformers.js' optional deps —
# without it pnpm install fails with ERR_PNPM_IGNORED_BUILDS
COPY web/package.json web/pnpm-lock.yaml web/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY web/ .
RUN pnpm build

# ---- Server build ----
FROM rust:1-slim-bookworm AS server
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY crates/ crates/
RUN cargo build --release -p vikado-server

# ---- Runtime ----
FROM debian:bookworm-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY --from=server /app/target/release/vikado-server /usr/local/bin/vikado-server
COPY --from=web /app/web/dist /srv/vikado/web

ENV VIKADO_PORT=3000 \
    VIKADO_DATA_DIR=/data \
    VIKADO_STATIC_DIR=/srv/vikado/web \
    VIKADO_FONTS_DIR=/srv/vikado/web/fonts

EXPOSE 3000
VOLUME ["/data"]
CMD ["vikado-server"]
