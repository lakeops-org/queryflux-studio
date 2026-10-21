"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Cpu,
  GitCommitHorizontal,
  History,
  Network,
  Radio,
  RadioTower,
  Search,
  Server,
  Tag,
  X,
} from "lucide-react";
import type { WorkerFleetDto, WorkerView } from "@/lib/api-types";
import { formatDateTime } from "@/components/ui-helpers";
import {
  HEALTH_STYLE,
  formatAgo,
  isSiteAgent,
  shortRevision,
  siteOf,
  summarizeFleet,
  workerHealth,
} from "@/lib/worker-fleet";

const REFRESH_MS = 10_000;

export function WorkersView({ fleet, error }: { fleet: WorkerFleetDto | null; error: string | null }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => router.refresh(), REFRESH_MS);
    return () => clearInterval(id);
  }, [router]);

  const workers = useMemo(() => fleet?.workers ?? [], [fleet]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return workers;
    return workers.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        Object.entries(w.labels).some(([k, v]) => `${k}=${v}`.toLowerCase().includes(q)),
    );
  }, [workers, query]);
  const selectedWorker = workers.find((w) => w.name === selected) ?? null;

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto">
      <Header fleet={fleet} />

      {error ? (
        <Notice
          title="Worker status is not available"
          body={
            <>
              This QueryFlux does not expose <code className="font-mono">/admin/workers</code>. Upgrade it to a
              release with worker mode. <span className="text-slate-400">({error})</span>
            </>
          }
        />
      ) : !fleet?.enabled ? (
        <Notice
          title="This QueryFlux does not serve workers"
          body={
            <>
              <p>
                Workers pull their config from a control plane, share its capacity limits and send it their query
                history. Enable the worker API on this process to accept them:
              </p>
              <pre className="mt-3 rounded-lg bg-slate-900 text-slate-100 text-xs p-3 overflow-x-auto">{`queryflux:
  role: controlPlane
  workerApi:
    enabled: true
    sharedSecret: <long-random-secret>`}</pre>
            </>
          }
        />
      ) : (
        <>
          <SummaryCards fleet={fleet} />
          <Warnings fleet={fleet} />
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[220px] max-w-md">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name, site or label (team=checkout)…"
                  className="w-full h-9 pl-8 pr-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
                />
              </div>
              <span className="text-xs text-slate-400 tabular-nums">
                {filtered.length} / {workers.length} workers · refreshes every {REFRESH_MS / 1000}s
              </span>
            </div>
            {workers.length === 0 ? (
              <EmptyFleet />
            ) : (
              <WorkerTable workers={filtered} onSelect={setSelected} selected={selected} />
            )}
          </div>
        </>
      )}

      {selectedWorker && fleet && (
        <WorkerDetail worker={selectedWorker} fleet={fleet} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function Header({ fleet }: { fleet: WorkerFleetDto | null }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-white to-indigo-50/60 px-6 py-5 shadow-xs">
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 text-xs font-medium">
              <Network size={12} />
              Fleet
            </span>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Workers</h1>
          </div>
          <p className="text-sm text-slate-500 mt-2 max-w-2xl">
            Workers run queries next to your applications. They take their config from this control plane, share
            its capacity limits and send it their query history, directly or through their site&apos;s agent.
          </p>
        </div>
        {fleet?.enabled && (
          <div className="flex items-center gap-2 text-xs text-slate-500 bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-xs">
            <GitCommitHorizontal size={13} className="text-slate-400" />
            Serving revision
            <code className="font-mono text-slate-800" title={fleet.controlPlaneRevision ?? ""}>
              {shortRevision(fleet.controlPlaneRevision)}
            </code>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCards({ fleet }: { fleet: WorkerFleetDto }) {
  const s = summarizeFleet(fleet);
  const cards = [
    {
      label: "Workers",
      value: s.total,
      sub: s.siteAgents > 0 ? `incl. ${s.siteAgents} site agent${s.siteAgents === 1 ? "" : "s"} · last 7 days` : "seen in the last 7 days", icon: <Boxes size={18} />, tone: "bg-indigo-100 text-indigo-600" },
    { label: "Online", value: s.online, sub: `${s.total - s.online} offline`, icon: <Radio size={18} />, tone: "bg-emerald-100 text-emerald-600" },
    { label: "Healthy", value: s.healthy, sub: "in sync, no errors", icon: <CheckCircle2 size={18} />, tone: "bg-sky-100 text-sky-600" },
    {
      label: "Needs attention",
      value: s.needsAttention,
      sub: "online: behind, stale or failing",
      icon: <AlertTriangle size={18} />,
      tone: s.needsAttention > 0 ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-400",
    },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="bg-white rounded-xl border border-slate-200 p-5 flex gap-4 items-start shadow-xs">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${c.tone}`}>{c.icon}</div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{c.label}</p>
            <p className="text-2xl font-bold mt-0.5 text-slate-900 tabular-nums">{c.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{c.sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function Warnings({ fleet }: { fleet: WorkerFleetDto }) {
  const { warnings } = summarizeFleet(fleet);
  if (warnings.length === 0) return null;
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-1.5">
      {warnings.map((w) => (
        <p key={w} className="flex items-start gap-2 text-sm text-amber-800">
          <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
          {w}
        </p>
      ))}
    </div>
  );
}

function HealthBadge({ worker }: { worker: WorkerView }) {
  const style = HEALTH_STYLE[workerHealth(worker)];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 ${style.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  );
}

/** "site agent · dc1" for an agent, "behind dc1's agent" for a worker relayed by one. */
function KindTag({ worker: w }: { worker: WorkerView }) {
  const site = siteOf(w);
  if (!site) return null;
  return isSiteAgent(w) ? (
    <span className="inline-flex items-center mt-1 text-[10px] font-medium text-violet-700 bg-violet-50 ring-1 ring-violet-200 px-1.5 py-0.5 rounded-md">
      site agent · {site}
    </span>
  ) : (
    <span className="inline-flex items-center mt-1 text-[10px] text-violet-600">behind {site}&apos;s agent</span>
  );
}

function Labels({ labels }: { labels: Record<string, string> }) {
  const entries = Object.entries(labels);
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {entries.map(([k, v]) => (
        <span key={k} className="inline-flex items-center gap-0.5 text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md font-mono">
          <Tag size={9} />
          {k}={v}
        </span>
      ))}
    </div>
  );
}

function WorkerTable({
  workers,
  onSelect,
  selected,
}: {
  workers: WorkerView[];
  onSelect: (name: string) => void;
  selected: string | null;
}) {
  if (workers.length === 0) {
    return (
      <div className="px-6 py-12 text-center">
        <p className="text-sm font-medium text-slate-600">No matches</p>
        <p className="text-xs text-slate-400 mt-1">Try another name or label.</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
            {["Worker", "Health", "Config", "Coordination", "History", "Frontends", "Last seen"].map((h) => (
              <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {workers.map((w, i) => (
            <tr
              key={w.name}
              onClick={() => onSelect(w.name)}
              className={`cursor-pointer align-top transition-colors ${
                selected === w.name ? "bg-indigo-50/70" : "hover:bg-indigo-50/60"
              } ${i !== workers.length - 1 ? "border-b border-slate-50" : ""} ${w.state === "offline" ? "opacity-60" : ""}`}
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-1.5 font-mono text-xs text-slate-800 font-medium">
                  {isSiteAgent(w) ? (
                    <RadioTower size={12} className="text-violet-500 flex-shrink-0" />
                  ) : (
                    <Server size={12} className="text-indigo-400 flex-shrink-0" />
                  )}
                  {w.name}
                </div>
                <KindTag worker={w} />
                <Labels labels={w.labels} />
              </td>
              <td className="px-4 py-3">
                <HealthBadge worker={w} />
                {w.lastError && (
                  <p className="text-[11px] text-red-500 mt-1 max-w-[220px] truncate" title={w.lastError}>
                    {w.lastError}
                  </p>
                )}
              </td>
              <td className="px-4 py-3 text-xs">
                <code className="font-mono text-slate-700" title={w.activeRevision ?? ""}>
                  {shortRevision(w.activeRevision)}
                </code>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {w.status.configSource === "peer"
                    ? "copied from a peer"
                    : w.status.configSource === "cache"
                      ? "cached on disk"
                      : w.inSync === false
                        ? "older than control plane"
                        : w.parent
                          ? "via site agent"
                          : "from control plane"}
                </div>
              </td>
              <td className="px-4 py-3 text-xs text-slate-600">
                {isSiteAgent(w) ? (
                  <span>forwards upstream</span>
                ) : w.coordinationMode === "local" ? (
                  <span className="text-amber-700">local limits</span>
                ) : (
                  <span>shared</span>
                )}
                {w.coordinationMode !== "local" && !isSiteAgent(w) && (
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {w.status.onUnavailable === "localLimits" ? "falls back to local" : "fail closed"}
                  </div>
                )}
              </td>
              <td className="px-4 py-3 text-xs text-slate-600 tabular-nums whitespace-nowrap">
                {w.status.history ? (
                  <>
                    {w.status.history.sent.toLocaleString()} sent
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {w.status.history.queued > 0 && `${w.status.history.queued} queued · `}
                      {w.status.history.dropped > 0 ? (
                        <span className="text-red-500">{w.status.history.dropped} dropped</span>
                      ) : (
                        w.status.history.redaction ?? "full"
                      )}
                    </div>
                  </>
                ) : (
                  <span className="text-slate-300">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-[11px] text-slate-500 font-mono">
                {w.status.frontends.length > 0 ? w.status.frontends.join(" · ") : <span className="text-slate-300">—</span>}
              </td>
              <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                <span className="inline-flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${w.state === "online" ? "bg-emerald-400" : "bg-slate-300"}`} />
                  {formatAgo(w.secondsSinceSeen)}
                </span>
                <div className="text-[11px] text-slate-400 mt-0.5">v{w.version}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyFleet() {
  return (
    <div className="px-6 py-14 text-center">
      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
        <Boxes size={18} className="text-slate-400" />
      </div>
      <p className="text-sm font-medium text-slate-600">No workers have registered yet</p>
      <p className="text-xs text-slate-400 mt-1 mb-4">Start a QueryFlux with a worker config pointing at this control plane:</p>
      <pre className="inline-block text-left rounded-lg bg-slate-900 text-slate-100 text-xs p-3">{`queryflux:
  role: worker
  controlPlane:
    url: https://<this-control-plane>:9000
    auth: { mode: sharedSecret, sharedSecret: <secret> }`}</pre>
      <p className="text-xs text-slate-400 mt-3">
        Workers in a network that can only connect outward register through a site agent (
        <code className="font-mono">role: siteAgent</code>) and show up here as <code className="font-mono">&lt;site&gt;/&lt;worker&gt;</code>.
      </p>
    </div>
  );
}

function Notice({ title, body }: { title: string; body: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-6 py-6 shadow-xs">
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <div className="text-sm text-slate-500 mt-2 max-w-3xl">{body}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-xs">
      <span className="text-slate-400 flex-shrink-0">{label}</span>
      <span className="text-slate-700 text-right min-w-0 break-words">{children}</span>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 px-4 py-3">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
        {icon}
        {title}
      </h3>
      <div className="divide-y divide-slate-50">{children}</div>
    </section>
  );
}

function when(iso: string | null | undefined): string {
  return iso ? formatDateTime(new Date(iso)) : "—";
}

function WorkerDetail({ worker: w, fleet, onClose }: { worker: WorkerView; fleet: WorkerFleetDto; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/20" />
      <aside
        className="relative h-full w-full max-w-lg bg-white shadow-2xl overflow-y-auto p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-mono text-base font-semibold text-slate-900 break-all">{w.name}</h2>
            <div className="mt-1.5 flex items-center gap-2">
              <HealthBadge worker={w} />
              <span className="text-xs text-slate-400">
                {w.state} · seen {formatAgo(w.secondsSinceSeen)}
              </span>
            </div>
            <KindTag worker={w} />
            <Labels labels={w.labels} />
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100" title="Close">
            <X size={16} />
          </button>
        </div>

        {w.lastError && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 break-words">{w.lastError}</div>
        )}

        <Section icon={<GitCommitHorizontal size={12} />} title="Config">
          <Row label="Control plane serves">
            <code className="font-mono">{fleet.controlPlaneRevision ?? "—"}</code>
          </Row>
          <Row label="Active revision">
            <code className="font-mono">{w.activeRevision ?? "—"}</code>
            {w.inSync === true && <span className="ml-1.5 text-emerald-600">in sync</span>}
            {w.inSync === false && <span className="ml-1.5 text-amber-600">behind</span>}
          </Row>
          {w.downloadedRevision && w.downloadedRevision !== w.activeRevision && (
            <Row label="Downloaded, not active">
              <code className="font-mono text-red-600">{w.downloadedRevision}</code>
            </Row>
          )}
          <Row label="Source">
            {w.status.configSource === "peer"
              ? "copied from a peer worker"
              : w.status.configSource === "cache"
                ? "the agent's disk cache"
                : w.parent
                  ? `control plane, through ${w.parent}'s agent`
                  : w.status.configSource === "controlPlane"
                    ? "control plane"
                    : "—"}
          </Row>
          {w.status.stale && <Row label="Stale">not yet confirmed by the control plane</Row>}
          <Row label="Confirmed by control plane">{when(w.status.confirmedAt)}</Row>
          <Row label="Activated">{when(w.status.activatedAt)}</Row>
          <Row label="Last successful sync">{when(w.status.lastSuccessfulSync)}</Row>
          <Row label="Failed syncs in a row">{w.status.consecutiveFailures}</Row>
        </Section>

        <Section icon={<Cpu size={12} />} title="Capacity">
          <Row label="Limits">
            {isSiteAgent(w)
              ? "forwards its workers' capacity calls to this control plane"
              : w.coordinationMode === "local"
                ? "this worker alone (local)"
                : "shared with the fleet"}
          </Row>
          {w.coordinationMode !== "local" && !isSiteAgent(w) && (
            <Row label="Control plane unreachable">
              {w.status.onUnavailable === "localLimits" ? "admit on this worker's own limit" : "new queries wait (fail closed)"}
            </Row>
          )}
          <Row label="Heartbeat">{w.status.heartbeatIntervalSecs ? `every ${w.status.heartbeatIntervalSecs}s` : "—"}</Row>
        </Section>

        <Section icon={<History size={12} />} title="Query history">
          <Row label="Redaction">{w.status.history?.redaction ?? "full"}</Row>
          <Row label="Endpoint">
            <span className="font-mono">
              {w.status.history?.endpoint ?? (w.parent ? `${w.parent}'s agent` : "control plane")}
            </span>
          </Row>
          <Row label="Sent">{w.status.history?.sent.toLocaleString() ?? "—"}</Row>
          <Row label="Queued">{w.status.history?.queued.toLocaleString() ?? "—"}</Row>
          <Row label="Dropped">
            <span className={(w.status.history?.dropped ?? 0) > 0 ? "text-red-600" : ""}>
              {w.status.history?.dropped.toLocaleString() ?? "—"}
            </span>
          </Row>
          {w.status.history?.lastError && <Row label="Last error">{w.status.history.lastError}</Row>}
          {isSiteAgent(w) ? (
            <Row label="Spool">history waits on the agent&apos;s disk until this control plane accepts it</Row>
          ) : (
            <div className="pt-2">
              <Link href={`/queries?worker=${encodeURIComponent(w.name)}`} className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
                View this worker&apos;s queries →
              </Link>
            </div>
          )}
        </Section>

        <Section icon={<Radio size={12} />} title="Process">
          <Row label="Version">{w.version || "—"}</Row>
          <Row label="Frontends">
            <span className="font-mono">{w.status.frontends.length > 0 ? w.status.frontends.join(", ") : "—"}</span>
          </Row>
          <Row label="Registered">{when(w.registeredAt)}</Row>
          <Row label="Last report">{when(w.lastSeen)}</Row>
        </Section>
      </aside>
    </div>
  );
}
