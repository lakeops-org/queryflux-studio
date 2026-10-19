import type { WorkerFleetDto, WorkerView } from "./api-types";

/**
 * One word for a worker's condition, most severe first:
 * - offline: no report within three heartbeat intervals;
 * - unconfigured: reporting, but no config activated yet;
 * - failing: config sync with the control plane keeps failing;
 * - stale: running a config copied from a peer, not yet confirmed by the control plane;
 * - behind: running an older revision than the control plane serves;
 * - healthy.
 */
export type WorkerHealth = "offline" | "unconfigured" | "failing" | "stale" | "behind" | "healthy";

export function workerHealth(w: WorkerView): WorkerHealth {
  if (w.state === "offline") return "offline";
  if (!w.activeRevision) return "unconfigured";
  if (w.status.consecutiveFailures > 0) return "failing";
  if (w.status.stale) return "stale";
  if (w.inSync === false) return "behind";
  return "healthy";
}

export const HEALTH_STYLE: Record<WorkerHealth, { label: string; dot: string; badge: string }> = {
  healthy: {
    label: "Healthy",
    dot: "bg-emerald-400",
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
  behind: {
    label: "Behind",
    dot: "bg-amber-400",
    badge: "bg-amber-50 text-amber-700 ring-amber-200",
  },
  stale: {
    label: "Stale config",
    dot: "bg-amber-400",
    badge: "bg-amber-50 text-amber-700 ring-amber-200",
  },
  failing: {
    label: "Sync failing",
    dot: "bg-red-400",
    badge: "bg-red-50 text-red-700 ring-red-200",
  },
  unconfigured: {
    label: "No config yet",
    dot: "bg-slate-300",
    badge: "bg-slate-50 text-slate-600 ring-slate-200",
  },
  offline: {
    label: "Offline",
    dot: "bg-slate-300",
    badge: "bg-slate-100 text-slate-500 ring-slate-200",
  },
};

export interface FleetSummary {
  total: number;
  online: number;
  healthy: number;
  needsAttention: number;
  warnings: string[];
}

export function summarizeFleet(fleet: WorkerFleetDto): FleetSummary {
  const workers = fleet.workers;
  const online = workers.filter((w) => w.state === "online");
  const healthy = workers.filter((w) => workerHealth(w) === "healthy").length;
  const warnings: string[] = [];

  // Mirrors the control plane's own warning: limits only hold across workers that
  // coordinate through it.
  const local = online.filter((w) => w.coordinationMode === "local");
  if (online.length >= 2 && local.length > 0) {
    warnings.push(
      `${local.map((w) => w.name).join(", ")} ${local.length === 1 ? "uses" : "use"} coordination.mode: local ` +
        `while ${online.length} workers are online, so maxRunningQueries is enforced per worker, not across the fleet.`,
    );
  }
  const dropped = workers.filter((w) => (w.status.history?.dropped ?? 0) > 0);
  if (dropped.length > 0) {
    warnings.push(
      `${dropped.map((w) => w.name).join(", ")} dropped query history while the history endpoint was unreachable.`,
    );
  }
  if (fleet.revisionError) {
    warnings.push(`The control plane cannot build its worker config: ${fleet.revisionError}`);
  }

  return {
    total: workers.length,
    online: online.length,
    healthy,
    needsAttention: online.length - online.filter((w) => workerHealth(w) === "healthy").length,
    warnings,
  };
}

/** "12s ago", "4m ago", "3h ago", "2d ago". */
export function formatAgo(seconds: number): string {
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function shortRevision(rev: string | null | undefined): string {
  return rev ? rev.slice(0, 8) : "—";
}
