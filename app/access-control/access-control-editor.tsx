"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Info, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { putAccessControlConfig } from "@/lib/api";
import type {
  AccessControlConfigDto,
  AccessControlConnectionDto,
  AccessControlGroupOverrideDto,
  AccessControlProvider,
  CerbosProviderConfigDto,
  OpaProviderConfigDto,
} from "@/lib/api-types";
import { AccessControlProviderIcon } from "@/components/access-control-provider-icon";
import { Field, SectionHeader, TextInput, SaveBar } from "@/components/studio-settings";

type GroupScope = "inherit" | "enabled" | "disabled";
/** Studio-level: whether any connections are configured. Per-connection provider is OPA or Cerbos. */
type TopLevel = "none" | "connected";
type Secret = { bearerToken: string; clientSecret: string };

/** A not-yet-saved connection being filled in. Kept out of `config.connections` (whose keys
 * are the source of truth for save/name-uniqueness) until it has a name, so the name field
 * can be typed freely — including transiently blank or colliding — without corrupting state. */
interface DraftConnection {
  id: string;
  name: string;
  connection: AccessControlConnectionDto;
}

const DOCS_OVERVIEW = "https://queryflux.dev/docs/access-control/overview";
const DOCS_OPA = "https://queryflux.dev/docs/access-control/opa";
const DOCS_CERBOS = "https://queryflux.dev/docs/access-control/cerbos";

const DEFAULT_OPA: OpaProviderConfigDto = {
  url: "http://localhost:8181",
  decisionPath: "/v1/data/queryflux/access",
  timeoutMs: 1000,
};

const DEFAULT_CERBOS: CerbosProviderConfigDto = {
  url: "http://localhost:3592",
  checkResourcesPath: "/api/check/resources",
  timeoutMs: 1000,
};

const SHARED_DEFAULTS = {
  operations: ["table.select"] as string[],
  onMissingSchema: "evaluate" as const,
  failOpen: false,
  cacheTtlMs: 5000,
  cacheCapacity: 10000,
  sessionParamKeys: [] as string[],
};

function defaultConnectionFor(provider: AccessControlProvider): AccessControlConnectionDto {
  if (provider === "cerbos") {
    return {
      provider: "cerbos",
      cerbos: { ...DEFAULT_CERBOS },
      opa: null,
      ...SHARED_DEFAULTS,
    };
  }
  return {
    provider: "opa",
    opa: { ...DEFAULT_OPA },
    cerbos: null,
    ...SHARED_DEFAULTS,
  };
}

const EMPTY_CONFIG: AccessControlConfigDto = {
  enabled: true,
  defaultConnection: null,
  connections: {},
  groups: {},
};

function normalizeConnection(raw: AccessControlConnectionDto | undefined): AccessControlConnectionDto {
  const provider: AccessControlProvider = raw?.provider === "cerbos" ? "cerbos" : "opa";
  const base = defaultConnectionFor(provider);
  return {
    ...base,
    ...raw,
    provider,
    opa:
      provider === "opa"
        ? { ...DEFAULT_OPA, ...(raw?.opa ?? {}) }
        : raw?.opa ?? null,
    cerbos:
      provider === "cerbos"
        ? { ...DEFAULT_CERBOS, ...(raw?.cerbos ?? {}) }
        : raw?.cerbos ?? null,
    operations: raw?.operations?.length ? raw.operations : SHARED_DEFAULTS.operations,
    sessionParamKeys: raw?.sessionParamKeys ?? [],
  };
}

function normalize(raw: AccessControlConfigDto | null): AccessControlConfigDto {
  if (!raw) return { ...EMPTY_CONFIG };
  const connections: Record<string, AccessControlConnectionDto> = {};
  for (const [name, conn] of Object.entries(raw.connections ?? {})) {
    connections[name] = normalizeConnection(conn);
  }
  return {
    enabled: raw.enabled ?? true,
    defaultConnection: raw.defaultConnection ?? null,
    connections,
    groups: raw.groups ?? {},
  };
}

function groupScope(ov: AccessControlGroupOverrideDto | undefined): GroupScope {
  if (ov?.enabled === true) return "enabled";
  if (ov?.enabled === false) return "disabled";
  return "inherit";
}

function setGroupScope(
  groups: Record<string, AccessControlGroupOverrideDto>,
  name: string,
  scope: GroupScope,
): Record<string, AccessControlGroupOverrideDto> {
  const prev = groups[name] ?? {};
  if (scope === "inherit") {
    return { ...groups, [name]: { ...prev, enabled: undefined } };
  }
  return { ...groups, [name]: { ...prev, enabled: scope === "enabled" } };
}

function setGroupConnection(
  groups: Record<string, AccessControlGroupOverrideDto>,
  name: string,
  connection: string,
): Record<string, AccessControlGroupOverrideDto> {
  const prev = groups[name] ?? {};
  if (connection === "") {
    return { ...groups, [name]: { ...prev, connection: undefined } };
  }
  return { ...groups, [name]: { ...prev, connection } };
}

/** Any group override pointing at `connectionName` reverts to inheriting the default. */
function clearGroupsUsingConnection(
  groups: Record<string, AccessControlGroupOverrideDto>,
  connectionName: string,
): Record<string, AccessControlGroupOverrideDto> {
  const next: Record<string, AccessControlGroupOverrideDto> = {};
  for (const [name, ov] of Object.entries(groups)) {
    next[name] = ov.connection === connectionName ? { ...ov, connection: undefined } : ov;
  }
  return next;
}

function Callout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3 text-xs text-slate-600 space-y-2">
      <div className="flex items-center gap-2 font-semibold text-slate-700">
        <Info size={14} className="text-indigo-500 shrink-0" />
        {title}
      </div>
      <div className="leading-relaxed space-y-1.5 pl-6">{children}</div>
    </div>
  );
}

function OpaConnectionFields({
  opa,
  secret,
  wantsClientCreds,
  onOpaChange,
  onSecretChange,
  onClientCredsToggle,
}: {
  opa: OpaProviderConfigDto;
  secret: Secret;
  wantsClientCreds: boolean;
  onOpaChange: (patch: Partial<OpaProviderConfigDto>) => void;
  onSecretChange: (patch: Partial<Secret>) => void;
  onClientCredsToggle: (checked: boolean) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <TextInput
          label="OPA URL"
          value={opa.url}
          onChange={(v) => onOpaChange({ url: v })}
          placeholder="http://localhost:8181"
        />
        <TextInput
          label="Decision path"
          value={opa.decisionPath}
          onChange={(v) => onOpaChange({ decisionPath: v })}
          placeholder="/v1/data/queryflux/access"
        />
      </div>
      <div className="grid grid-cols-2 gap-4 max-w-lg">
        <TextInput
          label="Timeout (ms)"
          type="number"
          value={String(opa.timeoutMs)}
          onChange={(v) => onOpaChange({ timeoutMs: Number(v) || 0 })}
        />
        <TextInput
          label={opa.bearerTokenSet ? "Bearer token (leave blank to keep)" : "Bearer token"}
          type="password"
          value={secret.bearerToken}
          onChange={(v) => onSecretChange({ bearerToken: v })}
          placeholder={opa.bearerTokenSet ? "••••••••" : "optional"}
        />
      </div>

      <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
        <input
          type="checkbox"
          checked={wantsClientCreds}
          onChange={(e) => onClientCredsToggle(e.target.checked)}
        />
        OAuth2 client credentials (instead of a static bearer token)
      </label>
      {wantsClientCreds && (
        <div className="grid grid-cols-2 gap-4">
          <TextInput
            label="Client ID"
            value={opa.clientCredentials?.clientId ?? ""}
            onChange={(v) =>
              onOpaChange({
                clientCredentials: {
                  clientId: v,
                  tokenEndpoint: opa.clientCredentials?.tokenEndpoint ?? "",
                },
              })
            }
          />
          <TextInput
            label="Token endpoint"
            value={opa.clientCredentials?.tokenEndpoint ?? ""}
            onChange={(v) =>
              onOpaChange({
                clientCredentials: {
                  clientId: opa.clientCredentials?.clientId ?? "",
                  tokenEndpoint: v,
                },
              })
            }
          />
          <TextInput
            label={
              opa.clientCredentials?.clientSecretSet
                ? "Client secret (leave blank to keep)"
                : "Client secret"
            }
            type="password"
            value={secret.clientSecret}
            onChange={(v) => onSecretChange({ clientSecret: v })}
            placeholder={opa.clientCredentials?.clientSecretSet ? "••••••••" : ""}
          />
        </div>
      )}
    </>
  );
}

function CerbosConnectionFields({
  cerbos,
  secret,
  onCerbosChange,
  onSecretChange,
}: {
  cerbos: CerbosProviderConfigDto;
  secret: Secret;
  onCerbosChange: (patch: Partial<CerbosProviderConfigDto>) => void;
  onSecretChange: (patch: Partial<Secret>) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <TextInput
          label="Cerbos URL"
          value={cerbos.url}
          onChange={(v) => onCerbosChange({ url: v })}
          placeholder="http://localhost:3592"
        />
        <TextInput
          label="Check-resources path"
          value={cerbos.checkResourcesPath}
          onChange={(v) => onCerbosChange({ checkResourcesPath: v })}
          placeholder="/api/check/resources"
        />
      </div>
      <div className="grid grid-cols-2 gap-4 max-w-lg">
        <TextInput
          label="Timeout (ms)"
          type="number"
          value={String(cerbos.timeoutMs)}
          onChange={(v) => onCerbosChange({ timeoutMs: Number(v) || 0 })}
        />
        <TextInput
          label={cerbos.bearerTokenSet ? "Bearer token (leave blank to keep)" : "Bearer token"}
          type="password"
          value={secret.bearerToken}
          onChange={(v) => onSecretChange({ bearerToken: v })}
          placeholder={cerbos.bearerTokenSet ? "••••••••" : "optional (Hub/Cloud)"}
        />
      </div>
      <p className="text-[11px] text-slate-400">
        Self-hosted Cerbos usually needs no token (network policy). Cerbos has no OAuth2
        client-credentials option — bearer only.
      </p>
    </>
  );
}

function suggestConnectionName(
  provider: AccessControlProvider,
  taken: Iterable<string>,
): string {
  const takenSet = new Set([...taken].map((n) => n.trim().toLowerCase()));
  const base = provider === "cerbos" ? "cerbos" : "opa";
  if (!takenSet.has(base)) return base;
  for (let i = 2; i < 100; i++) {
    const candidate = `${base}-${i}`;
    if (!takenSet.has(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}

/** True when `name` still looks like an auto-suggested name for `provider` (or empty). */
function isSuggestedName(name: string, provider: AccessControlProvider): boolean {
  const trimmed = name.trim().toLowerCase();
  if (!trimmed) return true;
  const base = provider === "cerbos" ? "cerbos" : "opa";
  return trimmed === base || new RegExp(`^${base}-\\d+$`).test(trimmed);
}

function ProviderBadge({ provider }: { provider: AccessControlProvider }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${
        provider === "cerbos"
          ? "text-violet-700 bg-violet-50"
          : "text-sky-700 bg-sky-50"
      }`}
    >
      <AccessControlProviderIcon provider={provider} size={16} />
      {provider === "cerbos" ? "Cerbos" : "OPA"}
    </span>
  );
}

function ProviderPicker({
  value,
  onChange,
}: {
  value: AccessControlProvider;
  onChange: (p: AccessControlProvider) => void;
}) {
  const options: Array<{ id: AccessControlProvider; title: string; subtitle: string }> = [
    { id: "opa", title: "Open Policy Agent", subtitle: "Rego policies" },
    { id: "cerbos", title: "Cerbos", subtitle: "CEL policy files" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 max-w-md">
      {options.map((opt) => {
        const selected = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
              selected
                ? opt.id === "cerbos"
                  ? "border-violet-300 bg-violet-50 ring-2 ring-violet-200"
                  : "border-sky-300 bg-sky-50 ring-2 ring-sky-200"
                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <AccessControlProviderIcon provider={opt.id} size={32} />
            <span className="min-w-0">
              <span className="block text-xs font-semibold text-slate-800">{opt.title}</span>
              <span className="block text-[10px] text-slate-500">{opt.subtitle}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

interface Props {
  initialConfig: AccessControlConfigDto | null;
  clusterGroups: string[];
}

export function AccessControlEditor({ initialConfig, clusterGroups }: Props) {
  const [config, setConfig] = useState<AccessControlConfigDto>(() => normalize(initialConfig));
  const [topLevel, setTopLevel] = useState<TopLevel>(() =>
    Object.keys(normalize(initialConfig).connections).length > 0 ? "connected" : "none",
  );
  const [drafts, setDrafts] = useState<DraftConnection[]>([]);
  const [draftSeq, setDraftSeq] = useState(0);
  const [secrets, setSecrets] = useState<Record<string, Secret>>({});
  const [useClientCreds, setUseClientCreds] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const [name, conn] of Object.entries(normalize(initialConfig).connections)) {
      init[name] = Boolean(conn.opa?.clientCredentials);
    }
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const inputCls =
    "w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-300";

  const connectionNames = useMemo(
    () => Object.keys(config.connections).sort(),
    [config.connections],
  );

  const groupNames = useMemo(() => {
    const names = new Set(clusterGroups);
    for (const name of Object.keys(config.groups)) names.add(name);
    return [...names].sort();
  }, [clusterGroups, config.groups]);

  const secretsFor = (key: string) => secrets[key] ?? { bearerToken: "", clientSecret: "" };
  const setSecretsFor = (key: string, patch: Partial<Secret>) =>
    setSecrets({ ...secrets, [key]: { ...secretsFor(key), ...patch } });

  const setConnection = (name: string, patch: Partial<AccessControlConnectionDto>) => {
    setConfig({
      ...config,
      connections: {
        ...config.connections,
        [name]: { ...config.connections[name], ...patch },
      },
    });
  };
  const setConnectionOpa = (name: string, patch: Partial<OpaProviderConfigDto>) => {
    const conn = config.connections[name];
    setConnection(name, { opa: { ...(conn.opa ?? DEFAULT_OPA), ...patch } });
  };
  const setConnectionCerbos = (name: string, patch: Partial<CerbosProviderConfigDto>) => {
    const conn = config.connections[name];
    setConnection(name, { cerbos: { ...(conn.cerbos ?? DEFAULT_CERBOS), ...patch } });
  };

  const switchConnectionProvider = (name: string, provider: AccessControlProvider) => {
    const prev = config.connections[name];
    if (prev.provider === provider) return;
    // Keep YAML-only shared knobs; reset the inactive provider block to defaults.
    const next = defaultConnectionFor(provider);
    setConnection(name, {
      ...next,
      operations: prev.operations,
      onMissingSchema: prev.onMissingSchema,
      failOpen: prev.failOpen,
      cacheTtlMs: prev.cacheTtlMs,
      cacheCapacity: prev.cacheCapacity,
      sessionParamKeys: prev.sessionParamKeys,
    });
  };

  const setTopLevelChoice = (next: TopLevel) => {
    setTopLevel(next);
    if (next === "none") {
      setConfig({ ...config, connections: {}, defaultConnection: null });
      setDrafts([]);
      return;
    }
    // First pick: open a named draft immediately so the connection name is set with the provider.
    if (
      next === "connected" &&
      Object.keys(config.connections).length === 0 &&
      drafts.length === 0
    ) {
      const id = `draft-${draftSeq}`;
      setDraftSeq(draftSeq + 1);
      setDrafts([
        {
          id,
          name: suggestConnectionName("opa", []),
          connection: defaultConnectionFor("opa"),
        },
      ]);
    }
  };

  const takenNames = () => [
    ...Object.keys(config.connections),
    ...drafts.map((d) => d.name.trim()).filter(Boolean),
  ];

  const addDraft = (provider: AccessControlProvider = "opa") => {
    const id = `draft-${draftSeq}`;
    setDraftSeq(draftSeq + 1);
    // Never auto-assigned as the default connection — that's always a deliberate, separate
    // choice via the "Default connection" selector once a connection has a real name.
    setDrafts([
      ...drafts,
      {
        id,
        name: suggestConnectionName(provider, takenNames()),
        connection: defaultConnectionFor(provider),
      },
    ]);
  };

  const updateDraftName = (id: string, name: string) => {
    setDrafts(drafts.map((d) => (d.id === id ? { ...d, name } : d)));
    if (saveMsg && !saveMsg.ok) setSaveMsg(null);
  };
  const updateDraftConnection = (id: string, patch: Partial<AccessControlConnectionDto>) => {
    setDrafts(
      drafts.map((d) => (d.id === id ? { ...d, connection: { ...d.connection, ...patch } } : d)),
    );
  };
  const updateDraftOpa = (id: string, patch: Partial<OpaProviderConfigDto>) => {
    const draft = drafts.find((d) => d.id === id);
    if (!draft) return;
    updateDraftConnection(id, { opa: { ...(draft.connection.opa ?? DEFAULT_OPA), ...patch } });
  };
  const updateDraftCerbos = (id: string, patch: Partial<CerbosProviderConfigDto>) => {
    const draft = drafts.find((d) => d.id === id);
    if (!draft) return;
    updateDraftConnection(id, {
      cerbos: { ...(draft.connection.cerbos ?? DEFAULT_CERBOS), ...patch },
    });
  };
  const switchDraftProvider = (id: string, provider: AccessControlProvider) => {
    const draft = drafts.find((d) => d.id === id);
    if (!draft || draft.connection.provider === provider) return;
    const prevProvider = draft.connection.provider;
    const nextConnection = defaultConnectionFor(provider);
    const nextName = isSuggestedName(draft.name, prevProvider)
      ? suggestConnectionName(
          provider,
          takenNames().filter((n) => n.toLowerCase() !== draft.name.trim().toLowerCase()),
        )
      : draft.name;
    setDrafts(
      drafts.map((d) =>
        d.id === id ? { ...d, name: nextName, connection: nextConnection } : d,
      ),
    );
  };
  const removeDraft = (id: string) => {
    setDrafts(drafts.filter((d) => d.id !== id));
    const nextSecrets = { ...secrets };
    delete nextSecrets[id];
    setSecrets(nextSecrets);
    const nextCreds = { ...useClientCreds };
    delete nextCreds[id];
    setUseClientCreds(nextCreds);
  };

  const removeConnection = (name: string) => {
    if (
      !window.confirm(
        `Delete connection "${name}"? Any cluster group routed to it (explicitly, or via the default connection) will get no access control until reassigned.`,
      )
    ) {
      return;
    }
    const connections = { ...config.connections };
    delete connections[name];
    setConfig({
      ...config,
      connections,
      defaultConnection: config.defaultConnection === name ? null : config.defaultConnection,
      groups: clearGroupsUsingConnection(config.groups, name),
    });
    const nextSecrets = { ...secrets };
    delete nextSecrets[name];
    setSecrets(nextSecrets);
  };

  const save = async () => {
    setSaveMsg(null);

    const trimmedDrafts = drafts.map((d) => ({ ...d, name: d.name.trim() }));
    if (trimmedDrafts.some((d) => !d.name)) {
      setSaveMsg({ text: "Every connection needs a name.", ok: false });
      return;
    }
    const allNames = [...connectionNames, ...trimmedDrafts.map((d) => d.name)];
    const seen = new Set<string>();
    const duplicate = allNames.find((n) => {
      if (seen.has(n)) return true;
      seen.add(n);
      return false;
    });
    if (duplicate) {
      setSaveMsg({ text: `Connection name "${duplicate}" is used more than once.`, ok: false });
      return;
    }

    setSaving(true);
    try {
      const entries: Array<{ name: string; connection: AccessControlConnectionDto; secretKey: string }> = [
        ...Object.entries(config.connections).map(([name, connection]) => ({
          name,
          connection,
          secretKey: name,
        })),
        ...trimmedDrafts.map((d) => ({ name: d.name, connection: d.connection, secretKey: d.id })),
      ];

      if (entries.length === 0) {
        await putAccessControlConfig({
          enabled: false,
          defaultConnection: null,
          connections: {},
          groups: {},
        });
      } else {
        const connections: Record<string, AccessControlConnectionDto> = {};
        for (const { name, connection: conn, secretKey } of entries) {
          const sec = secretsFor(secretKey);
          if (conn.provider === "cerbos") {
            const cerbos = conn.cerbos ?? DEFAULT_CERBOS;
            connections[name] = {
              ...conn,
              provider: "cerbos",
              cerbos: {
                ...cerbos,
                bearerToken: sec.bearerToken.trim() || undefined,
              },
              // Drop the inactive provider block so a flipped connection doesn't leave stale
              // opa: fields that confuse readers / future edits.
              opa: null,
            };
          } else {
            const opa = conn.opa ?? DEFAULT_OPA;
            const wantsClientCreds = useClientCreds[secretKey] ?? Boolean(opa.clientCredentials);
            connections[name] = {
              ...conn,
              provider: "opa",
              opa: {
                ...opa,
                bearerToken: sec.bearerToken.trim() || undefined,
                clientCredentials: wantsClientCreds
                  ? {
                      clientId: opa.clientCredentials?.clientId ?? "",
                      tokenEndpoint: opa.clientCredentials?.tokenEndpoint ?? "",
                      clientSecret: sec.clientSecret.trim() || undefined,
                    }
                  : null,
              },
              cerbos: null,
            };
          }
        }
        await putAccessControlConfig({
          ...config,
          enabled: config.enabled ?? true,
          connections,
        });
        // Fold newly-named drafts into the persisted connection map now that they've saved.
        setConfig((prev) => ({ ...prev, connections }));
      }
      setDrafts([]);
      setSecrets({});
      setSaveMsg({
        text: "Saved and hot-reloaded. Run a test query on an enabled group and check Queries for opa_access.",
        ok: true,
      });
    } catch (e) {
      const msg = String(e);
      if (msg.includes("503") || msg.toLowerCase().includes("persistence")) {
        setSaveMsg({
          text: "Save failed: Postgres persistence is required (persistence.type: postgres).",
          ok: false,
        });
      } else {
        setSaveMsg({ text: msg, ok: false });
      }
    } finally {
      setSaving(false);
    }
  };

  const renderConnectionFields = (
    conn: AccessControlConnectionDto,
    secretKey: string,
    onProviderChange: (p: AccessControlProvider) => void,
    onOpaChange: (patch: Partial<OpaProviderConfigDto>) => void,
    onCerbosChange: (patch: Partial<CerbosProviderConfigDto>) => void,
  ) => {
    const wantsClientCreds =
      useClientCreds[secretKey] ?? Boolean(conn.opa?.clientCredentials);
    return (
      <>
        <Field label="Provider">
          <ProviderPicker value={conn.provider} onChange={onProviderChange} />
        </Field>
        {conn.provider === "cerbos" ? (
          <CerbosConnectionFields
            cerbos={conn.cerbos ?? DEFAULT_CERBOS}
            secret={secretsFor(secretKey)}
            onCerbosChange={onCerbosChange}
            onSecretChange={(patch) => setSecretsFor(secretKey, patch)}
          />
        ) : (
          <OpaConnectionFields
            opa={conn.opa ?? DEFAULT_OPA}
            secret={secretsFor(secretKey)}
            wantsClientCreds={wantsClientCreds}
            onOpaChange={onOpaChange}
            onSecretChange={(patch) => setSecretsFor(secretKey, patch)}
            onClientCredsToggle={(checked) => {
              setUseClientCreds({ ...useClientCreds, [secretKey]: checked });
              if (checked && !conn.opa?.clientCredentials) {
                onOpaChange({
                  clientCredentials: { clientId: "", tokenEndpoint: "" },
                });
              }
            }}
          />
        )}
      </>
    );
  };

  return (
    <div className="p-8 max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Access control</h1>
        <p className="text-sm text-slate-500 mt-1 max-w-3xl">
          Connect QueryFlux to one or more policy providers —{" "}
          <a href={DOCS_OPA} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
            OPA
          </a>{" "}
          or{" "}
          <a href={DOCS_CERBOS} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
            Cerbos
          </a>{" "}
          — and choose which cluster groups call which connection. Row filters, column masks, and
          table grants live in the provider&apos;s own policy store — not here. SQL-shape safety (
          <Link href="/guardrails" className="text-indigo-600 hover:underline">
            Guardrails
          </Link>
          ) is a separate layer.
        </p>
        <a
          href={DOCS_OVERVIEW}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 mt-2 text-xs text-indigo-600 hover:underline"
        >
          Access control docs <ExternalLink size={12} />
        </a>
      </div>

      <Callout title="What Studio configures">
        <ul className="list-disc pl-4 space-y-1">
          <li>
            <strong>One or more named connections</strong> — each picks OPA or Cerbos and its own
            URL/credentials. No name is special. Pick which one is the <strong>default</strong>{" "}
            separately, once it&apos;s saved; adding a connection never sets it as default on its
            own.
          </li>
          <li>
            <strong>Scope</strong> — global default, plus per cluster group: enabled/disabled and
            which connection it uses. Different groups can use different providers (e.g. OPA→Cerbos
            migration).
          </li>
          <li>
            <strong>No default connection set?</strong> Groups without an explicit override get{" "}
            <em>no</em> access control at all — there&apos;s nothing to route them to.
          </li>
          <li>
            <strong>Not here:</strong> Rego / Cerbos policy files, operations, cache, session param
            keys, fail-open, onMissingSchema — set those in YAML or the provider.
          </li>
          <li>
            <strong>Not on Clusters:</strong> routing groups are defined there; access-control
            scope is only on this page.
          </li>
          <li>
            Different rules for different teams on the <em>same</em> provider belong in policy
            (Rego: branch on <span className="font-mono">input.context.clusterGroup</span>; Cerbos:
            on roles / <span className="font-mono">R.attr</span>), not a second connection.
          </li>
        </ul>
      </Callout>

      <section className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <SectionHeader icon={<ShieldCheck size={15} />} title="Provider" />
        <div className="p-6 space-y-4">
          <Field label="Access control">
            <select
              className={inputCls + " max-w-xs"}
              value={topLevel}
              onChange={(e) => setTopLevelChoice(e.target.value as TopLevel)}
            >
              <option value="none">None — access control off</option>
              <option value="connected">Connected — OPA and/or Cerbos</option>
            </select>
          </Field>
          {topLevel === "none" && (
            <div className="space-y-3 max-w-md">
              <p className="text-xs text-slate-500">
                Or start with a named connection — pick a provider and edit the name:
              </p>
              <div className="grid grid-cols-2 gap-3">
                {(["opa", "cerbos"] as AccessControlProvider[]).map((provider) => (
                  <button
                    key={provider}
                    type="button"
                    onClick={() => {
                      setTopLevel("connected");
                      const id = `draft-${draftSeq}`;
                      setDraftSeq(draftSeq + 1);
                      setDrafts([
                        {
                          id,
                          name: suggestConnectionName(provider, Object.keys(config.connections)),
                          connection: defaultConnectionFor(provider),
                        },
                      ]);
                    }}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                      provider === "cerbos"
                        ? "border-violet-200 bg-white hover:border-violet-300 hover:bg-violet-50"
                        : "border-sky-200 bg-white hover:border-sky-300 hover:bg-sky-50"
                    }`}
                  >
                    <AccessControlProviderIcon provider={provider} size={32} />
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold text-slate-800">
                        {provider === "cerbos" ? "Cerbos" : "Open Policy Agent"}
                      </span>
                      <span className="block text-[10px] text-slate-500 font-mono">
                        name: {provider}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <p className="text-xs text-slate-400 max-w-2xl">
            Queries on disabled groups skip access control entirely. Each connection below chooses
            OPA or Cerbos independently.
          </p>
        </div>
      </section>

      {topLevel === "connected" && (
        <section className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <SectionHeader icon={<ShieldCheck size={15} />} title="Connections" />
          <div className="p-6 space-y-6">
            <p className="text-xs text-slate-400">
              QueryFlux POSTs identity, tables, and context to a connection&apos;s endpoint on each
              query (for groups routed to it). Policy content is loaded by the provider itself —
              Studio never edits Rego or Cerbos YAML.{" "}
              <a href={DOCS_OPA} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
                OPA wire format
              </a>
              {" · "}
              <a href={DOCS_CERBOS} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
                Cerbos wire format
              </a>
            </p>

            <Field label="Default connection">
              <select
                className={inputCls + " max-w-xs"}
                value={config.defaultConnection ?? ""}
                onChange={(e) =>
                  setConfig({ ...config, defaultConnection: e.target.value || null })
                }
              >
                <option value="">(none — every group must be assigned explicitly)</option>
                {connectionNames.map((c) => (
                  <option key={c} value={c}>
                    {c} ({config.connections[c]?.provider ?? "opa"})
                  </option>
                ))}
              </select>
            </Field>
            <p className="text-xs text-slate-400 max-w-2xl">
              Cluster groups without a <span className="font-mono">Connection</span> override
              under Scope use this one. Leave unset to require every group to opt in explicitly.
              A new connection is never chosen automatically — set it here once it&apos;s saved.
            </p>

            {connectionNames.length === 0 && drafts.length === 0 && (
              <p className="text-xs text-slate-400">No connections yet — add one below.</p>
            )}

            {connectionNames.map((name) => {
              const conn = config.connections[name];
              const isDefaultConnection = name === config.defaultConnection;
              return (
                <div key={name} className="rounded-lg border border-slate-200 p-4 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-slate-800 px-2 py-0.5 rounded bg-slate-100">
                        {name}
                      </span>
                      <ProviderBadge provider={conn.provider} />
                      {isDefaultConnection && (
                        <span className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wide px-1.5 py-0.5 rounded bg-indigo-50">
                          default
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeConnection(name)}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title={`Delete connection "${name}"`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {renderConnectionFields(
                    conn,
                    name,
                    (p) => switchConnectionProvider(name, p),
                    (patch) => setConnectionOpa(name, patch),
                    (patch) => setConnectionCerbos(name, patch),
                  )}
                </div>
              );
            })}

            {drafts.map((draft) => (
              <div
                key={draft.id}
                className="rounded-lg border border-indigo-200 bg-indigo-50/30 p-4 space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-4 min-w-0">
                    <div className="max-w-xs">
                      <TextInput
                        label="Connection name (required)"
                        value={draft.name}
                        onChange={(v) => updateDraftName(draft.id, v)}
                        placeholder="e.g. opa, cerbos, or prod"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">
                        Pre-filled from the provider you picked — rename anytime before save.
                      </p>
                    </div>
                    {renderConnectionFields(
                      draft.connection,
                      draft.id,
                      (p) => switchDraftProvider(draft.id, p),
                      (patch) => updateDraftOpa(draft.id, patch),
                      (patch) => updateDraftCerbos(draft.id, patch),
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeDraft(draft.id)}
                    className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                    title="Remove this connection"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => addDraft("opa")}
                className="flex items-center gap-1.5 text-xs font-medium text-sky-700 hover:text-sky-800 border border-sky-200 rounded-lg px-3 py-1.5 hover:bg-sky-50 transition-colors"
              >
                <AccessControlProviderIcon provider="opa" size={18} />
                <Plus size={12} /> New OPA connection
              </button>
              <button
                type="button"
                onClick={() => addDraft("cerbos")}
                className="flex items-center gap-1.5 text-xs font-medium text-violet-700 hover:text-violet-800 border border-violet-200 rounded-lg px-3 py-1.5 hover:bg-violet-50 transition-colors"
              >
                <AccessControlProviderIcon provider="cerbos" size={18} />
                <Plus size={12} /> New Cerbos connection
              </button>
            </div>
          </div>
        </section>
      )}

      {topLevel === "connected" && (
        <section className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <SectionHeader icon={<ShieldCheck size={15} />} title="Scope by cluster group" />
          <div className="p-6 space-y-5">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={config.enabled ?? true}
                onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
              />
              Enabled by default for all cluster groups
            </label>
            <p className="text-xs text-slate-400 max-w-2xl">
              When unchecked, only groups set to <span className="font-mono">Enabled</span> below
              call access control (opt-in). When checked, all groups use it unless set to{" "}
              <span className="font-mono">Disabled</span> — e.g. sandbox without row filters. Either
              way, a group still needs a resolvable connection (its own, or the default above).
            </p>

            {groupNames.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-400 border-b border-slate-100">
                      <th className="pb-2 pr-4 font-semibold">Cluster group</th>
                      <th className="pb-2 pr-4 font-semibold">Access control for this group</th>
                      <th className="pb-2 font-semibold">Connection</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupNames.map((name) => {
                      const ov = config.groups[name];
                      return (
                        <tr key={name} className="border-b border-slate-50">
                          <td className="py-2 pr-4 font-mono text-slate-700">{name}</td>
                          <td className="py-2 pr-4">
                            <select
                              className={inputCls + " max-w-[10rem]"}
                              value={groupScope(ov)}
                              onChange={(e) =>
                                setConfig({
                                  ...config,
                                  groups: setGroupScope(
                                    config.groups,
                                    name,
                                    e.target.value as GroupScope,
                                  ),
                                })
                              }
                            >
                              <option value="inherit">Inherit default</option>
                              <option value="enabled">Enabled</option>
                              <option value="disabled">Disabled</option>
                            </select>
                          </td>
                          <td className="py-2">
                            <select
                              className={inputCls + " max-w-[14rem]"}
                              value={ov?.connection ?? ""}
                              onChange={(e) =>
                                setConfig({
                                  ...config,
                                  groups: setGroupConnection(config.groups, name, e.target.value),
                                })
                              }
                            >
                              <option value="">
                                Inherit ({config.defaultConnection || "none — skipped"})
                              </option>
                              {connectionNames.map((c) => (
                                <option key={c} value={c}>
                                  {c} ({config.connections[c]?.provider ?? "opa"})
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                No cluster groups in Postgres yet. Add groups under{" "}
                <Link href="/clusters" className="text-indigo-600 hover:underline">
                  Clusters
                </Link>{" "}
                — scope for each group is configured here, not on the group form.
              </p>
            )}
          </div>
        </section>
      )}

      <section className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-3">
        <p className="text-[11px] text-slate-500">
          Saving requires <span className="font-mono">persistence.type: postgres</span>. Config is
          stored in <span className="font-mono">proxy_settings</span> and hot-reloads without restart.
          Until the first save, YAML <span className="font-mono">accessControl:</span> applies.
          Secrets are never shown after save — leave a token field blank to keep the stored value
          for that connection.
        </p>
        <SaveBar saving={saving} message={saveMsg} onSave={save} label="Save access control" />
        {topLevel === "connected" && (
          <p className="text-[11px] text-slate-400">
            After save, open{" "}
            <Link href="/queries" className="text-indigo-600 hover:underline">
              Queries
            </Link>{" "}
            on a routed group with access control enabled — look for{" "}
            <span className="font-mono">opa_access</span> under Guard Actions (name is historical —
            used for both OPA and Cerbos) and{" "}
            <strong>Rewritten SQL (access control)</strong> when filters or masks apply.
          </p>
        )}
      </section>
    </div>
  );
}
