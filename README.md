# <p align="center"><big>QueryFlux Studio</big></p>

<p align="center">
  <a href="https://queryflux.dev/docs/studio" title="QueryFlux Studio docs">
    <img
      src="https://raw.githubusercontent.com/lakeops-org/queryflux/main/website/static/img/queryflux-hero-banner.svg"
      alt="QueryFlux — One query, any engine"
      width="800"
    />
  </a>
</p>
<p align="center"><strong>Operate QueryFlux from the browser.</strong></p>

<p align="center">
  <a href="https://github.com/lakeops-org/queryflux-studio/actions/workflows/ci.yml?query=branch%3Amain"><img src="https://img.shields.io/github/actions/workflow/status/lakeops-org/queryflux-studio/ci.yml?branch=main&amp;label=build&amp;style=for-the-badge&amp;logo=github&amp;logoColor=white" alt="CI status on main" /></a>
  <a href="https://github.com/lakeops-org/queryflux-studio/pkgs/container/queryflux-studio"><img src="https://img.shields.io/badge/GHCR-queryflux--studio-blue?style=for-the-badge&amp;logo=github&amp;logoColor=white" alt="GHCR image" /></a>
  <a href="https://github.com/lakeops-org/queryflux-studio/releases/latest"><img src="https://img.shields.io/github/v/release/lakeops-org/queryflux-studio?sort=semver&amp;style=for-the-badge&amp;logo=github&amp;logoColor=white&amp;label=release" alt="Latest release" /></a>
  <a href="https://github.com/lakeops-org/queryflux-studio/commits/main/"><img src="https://img.shields.io/github/last-commit/lakeops-org/queryflux-studio?style=for-the-badge&amp;logo=git&amp;logoColor=white&amp;label=last%20commit" alt="Last commit" /></a>
</p>
<p align="center">
  <a href="https://github.com/lakeops-org/queryflux-studio/blob/main/LICENSE"><img src="https://img.shields.io/github/license/lakeops-org/queryflux-studio?style=for-the-badge&amp;logo=apache&amp;logoColor=white" alt="License" /></a>
  <a href="https://github.com/lakeops-org/queryflux"><img src="https://img.shields.io/badge/backend-queryflux-4F46E5?style=for-the-badge&amp;logo=github&amp;logoColor=white" alt="QueryFlux backend" /></a>
</p>
<p align="center">
  <a href="https://join.slack.com/t/queryfluxworkspace/shared_invite/zt-3v7qedxj9-o8ElCLGK0UXT8xBU0_bD8w">Slack community</a>
  &nbsp;·&nbsp;
  <a href="https://queryflux.dev/docs/studio">Documentation</a>
  &nbsp;·&nbsp;
  <a href="https://github.com/lakeops-org/queryflux">QueryFlux</a>
</p>

Studio is the admin UI for [QueryFlux](https://github.com/lakeops-org/queryflux): live cluster health, query history, routing, guardrails, security, and engine forms. It talks only to the **Admin REST API** (default `:9000`). It never connects to Trino, DuckDB, or any other engine itself.

```
SQL clients  →  QueryFlux (protocols :8080 / :5432 / :3306 / …)
                      │
                      ├── Admin API :9000
                      │         ▲
Browser :3000  →  Studio ───────┘  same-origin /api/admin-proxy
```

The QueryFlux **unified image** already bundles Studio at `/app/studio` on port `3000`. This repo is for running Studio standalone, hacking on the UI, or publishing `ghcr.io/lakeops-org/queryflux-studio`.

## What you can do

| Page | What it is for |
| --- | --- |
| **Dashboard** | Queries, error rate, duration, and translation rate for the last hour |
| **Clusters** | Runtime health, capacity, add/edit persisted cluster configs |
| **Groups** | Cluster groups, affinity, and admission limits |
| **Routing** | Protocol, header, regex, tag, Python, and compound routers |
| **Query History** | Past and running queries (needs Postgres persistence) |
| **Scripts** | User-defined routing / translation scripts |
| **Guardrails** | Policy actions before a query hits an engine |
| **Security** | Admin password, auth providers, users |
| **Catalog** | Iceberg / HMS-style catalog providers |
| **Protocols** | Which frontends are listening |
| **Agents** | Agent conversations and steps |
| **API Reference** | In-app OpenAPI explorer against the live Admin API |

Default login is `admin` / `admin`. Change it on **Security** immediately. After the first UI password change, bootstrap YAML/env credentials are ignored (Postgres keeps the bcrypt hash).

## Quick start

You need a QueryFlux process with the Admin API on `:9000`. See the [QueryFlux README](https://github.com/lakeops-org/queryflux) if you do not have one yet.

```bash
git clone https://github.com/lakeops-org/queryflux-studio.git
cd queryflux-studio
npm ci          # Node 20+
npm run dev     # http://localhost:3000
```

Studio proxies Admin API calls through `/api/admin-proxy`, so the browser never talks to `:9000` directly and you do not need CORS.

Query history and persisted cluster/group edits need QueryFlux `persistence.type: postgres`. In-memory mode still serves the dashboard, but config writes and history do not survive restart.

Regenerate TypeScript types from a running proxy:

```bash
npm run generate-api   # reads http://localhost:9000/openapi.json → lib/api-types.ts
```

## Docker

```bash
docker run --rm -p 3000:3000 \
  -e ADMIN_API_URL=http://host.docker.internal:9000 \
  ghcr.io/lakeops-org/queryflux-studio:latest
```

On Linux, `host.docker.internal` may need `--add-host=host.docker.internal:host-gateway`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `ADMIN_API_URL` | `http://localhost:9000` | QueryFlux Admin API base URL from the Studio container |
| `ADMIN_API_USERNAME` | — | Bootstrap Basic auth when no browser session exists |
| `ADMIN_API_PASSWORD` | — | Pair with `ADMIN_API_USERNAME` |
| `PORT` | `3000` | Listen port |
| `HOSTNAME` | `0.0.0.0` | Bind address |

Images:

| Tag | When |
| --- | --- |
| `:latest` | Every push to `main` |
| `:vX.Y.Z`, `:X.Y.Z`, `:X.Y` | [Release Please](https://github.com/googleapis/release-please) cut (conventional commits) |

Pin a versioned tag from QueryFlux when you want a release to embed a known Studio. `:latest` is the snapshot.

## Engines in the UI

Studio ships forms for the engines QueryFlux actually runs: **Trino**, **DuckDB** (embedded + HTTP), **StarRocks**, **Athena**, **ClickHouse**, and **ADBC** (Snowflake, Databricks, BigQuery, Postgres, and other `dbc` drivers, including warehouse variants and health/reconcile queries).

Adding a backend is a two-repo change: Rust adapter in [queryflux](https://github.com/lakeops-org/queryflux/blob/main/website/docs/architecture/adding-support/backend.md), then a Studio module here.

1. Add `lib/studio-engines/engines/<engine>.ts` exporting a `StudioEngineModule` (descriptor, catalog, optional `validateFlat` / `customFormId`).
2. Append it to `STUDIO_ENGINE_MODULES` in `lib/studio-engines/manifest.ts`.
3. Add `{ k: "studio", engineKey: "…" }` to `ENGINE_CATALOG_SLOTS` in `components/engine-catalog.ts`.
4. Custom form: set `customFormId` and register it in `components/cluster-config/studio-engine-forms.tsx`.
5. New persisted `config` JSON keys: extend `lib/cluster-persist-form.ts`.

`lib/engine-registry.ts` and affinity options are derived from the manifest — do not edit those by hand.

## Layout

| Path | Role |
| --- | --- |
| `app/` | Next.js routes (dashboard, clusters, routing, …) |
| `app/api/admin-proxy/` | Same-origin proxy to the Admin API |
| `app/api/session/` | Login cookie (HttpOnly Basic session) |
| `lib/studio-engines/` | Per-engine modules, manifest, validation |
| `lib/api.ts` / `lib/api-types.ts` | Admin client + generated OpenAPI types |
| `components/cluster-config/` | Generic + custom cluster forms |
| `lib/cluster-persist-form.ts` | Flat form ↔ persisted cluster `config` JSON |

## License

Apache License 2.0. See [LICENSE](LICENSE).
