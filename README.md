# QueryFlux Studio

Next.js admin UI for QueryFlux: clusters, groups, routing, scripts, and query history. It talks to the **Admin REST API** (default `http://localhost:9000` via `ADMIN_API_URL`), not to backend engines directly.

## Run locally

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

QueryFlux Studio connects to the QueryFlux Admin REST API. By default, it expects the API at `http://localhost:9000`.

Postgres-backed features such as query history and persisted cluster configuration require the QueryFlux server to be configured with Postgres persistence.

For QueryFlux server setup and configuration, see the [QueryFlux repository](https://github.com/lakeops-org/queryflux).

## Deploy

Every push to `main` publishes:

`ghcr.io/lakeops-org/queryflux-studio:latest`

[Release Please](https://github.com/googleapis/release-please) opens a version PR from conventional commits. Merging that PR tags `vX.Y.Z` and also publishes:

- `ghcr.io/lakeops-org/queryflux-studio:vX.Y.Z`
- `ghcr.io/lakeops-org/queryflux-studio:X.Y.Z`
- `ghcr.io/lakeops-org/queryflux-studio:X.Y`

QueryFlux's unified image currently copies `:latest`. Pin a `vX.Y.Z` tag there when you want a QueryFlux release to embed a known Studio.

It serves the UI on port `3000` and connects to the QueryFlux Admin API using `ADMIN_API_URL`.

For example, when QueryFlux is reachable from the container at `host.docker.internal:9000`:

```bash
docker run --rm \
  -p 3000:3000 \
  -e ADMIN_API_URL=http://host.docker.internal:9000 \
  ghcr.io/lakeops-org/queryflux-studio:latest
```

If the Admin API requires authentication, set `ADMIN_API_USERNAME` and `ADMIN_API_PASSWORD` as well.

The Studio image is also bundled into QueryFlux's unified image under `/app/studio`.

## Adding or changing a backend in the UI

See the [QueryFlux backend support guide](https://github.com/lakeops-org/queryflux/blob/main/website/docs/architecture/adding-support/backend.md) for the backend-side integration steps.

Studio-side checklist:

1. Add **`lib/studio-engines/engines/<engine>.ts`** exporting a **`StudioEngineModule`** (descriptor + catalog metadata + optional validation and custom form id).
2. Register it in **`lib/studio-engines/manifest.ts`**.
3. Add a **`{ k: "studio", engineKey: "…" }`** entry to **`ENGINE_CATALOG_SLOTS`** in **`components/engine-catalog.ts`** where the card should appear.
4. If the cluster form is not generic: set **`customFormId`** on the module and register the component in **`components/cluster-config/studio-engine-forms.tsx`**.
5. If persisted **`config`** JSON uses new top-level keys, extend **`lib/cluster-persist-form.ts`**.

**Derived pieces** (usually no manual edits): **`lib/engine-registry.ts`** builds **`ENGINE_REGISTRY`** from the manifest; **`ENGINE_AFFINITY_OPTIONS`** comes from **`buildEngineAffinityOptionsFromManifest()`**; **`validateEngineSpecific`** dispatches to each module’s **`validateFlat`**.

## Layout (high level)

| Path | Role |
|------|------|
| `lib/studio-engines/` | Per-engine modules, manifest, catalog bridge, flat validation |
| `lib/engine-registry.ts` | Registry helpers + `ENGINE_REGISTRY` from manifest |
| `lib/engine-registry-types.ts` | `EngineDescriptor` and field/auth unions |
| `components/engine-catalog.ts` | Engines grid + `findEngineByType` (studio slots + static dialects) |
| `components/cluster-config/` | Cluster form router, generic row renderer, custom engine panels, SaaS warehouse editor, health/reconcile fields |
| `lib/adbc-saas-variants.ts` | Warehouse variant rows ↔ `ClusterVariant` conversion and validation |
| `lib/cluster-persist-form.ts` | Flat form ↔ persisted `config` JSON (including `variants`, `healthCheckQuery`, `reconcileQuery`) |

For Next.js framework docs, see [nextjs.org/docs](https://nextjs.org/docs).
