# QueryFlux Studio images.
# Next.js standalone build (see `output: "standalone"` in next.config.ts).
#
# Targets:
#   runner   — Studio only (default final stage), published as ghcr.io/lakeops-org/queryflux-studio
#   bundled  — QueryFlux server + Studio in one container, built on top of the
#              server-only QueryFlux image and published as ghcr.io/lakeops-org/queryflux:<version>
#
# Examples:
#   docker build -t queryflux-studio:local .
#   docker build --target bundled -t queryflux:local .
#   docker build --target bundled \
#     --build-arg QUERYFLUX_IMAGE=ghcr.io/lakeops-org/queryflux:v0.5.0-slim -t queryflux:v0.5.0 .

ARG QUERYFLUX_IMAGE=ghcr.io/lakeops-org/queryflux:latest-slim

FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# QueryFlux server (slim) + Studio. The slim image provides /app/queryflux,
# /app/adbc-drivers.sh, the Python venv, libduckdb and the dbc CLI; this stage
# adds Node, tini and the Studio build.
FROM ${QUERYFLUX_IMAGE} AS bundled

ARG NODE_VERSION=20.18.1

USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    xz-utils \
    tini \
    && DPKG_ARCH=$(dpkg --print-architecture) \
    && case "$DPKG_ARCH" in \
         amd64) NODE_ARCH=x64 ;; \
         arm64) NODE_ARCH=arm64 ;; \
         *) echo "unsupported arch=$DPKG_ARCH"; exit 1 ;; \
       esac \
    && curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${NODE_ARCH}.tar.xz" \
         | tar -xJf - -C /usr/local --strip-components=1 \
    && rm -rf /usr/local/include /usr/local/share/doc /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /app/studio

COPY --from=builder /app/public /app/studio/public
COPY --from=builder /app/.next/standalone /app/studio/
COPY --from=builder /app/.next/static /app/studio/.next/static
COPY docker/bundled/entrypoint.sh /app/entrypoint-unified.sh
RUN chmod +x /app/entrypoint-unified.sh \
    && chown -R queryflux:queryflux /app/studio

USER queryflux
WORKDIR /app

EXPOSE 3000 8080 9000

ENTRYPOINT ["/usr/bin/tini", "--", "/app/entrypoint-unified.sh"]
CMD ["--config", "/etc/queryflux/config.yaml"]

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

# Configure ADMIN_API_URL when QueryFlux's Admin API is not reachable at
# http://localhost:9000 from this container. Optional ADMIN_API_USERNAME
# and ADMIN_API_PASSWORD can be used when authentication is required.

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
