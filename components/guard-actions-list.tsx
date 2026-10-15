import type { GuardAction } from "@/lib/api-types";
import { ShieldCheck, ShieldAlert, ShieldX, PenLine } from "lucide-react";

const META_LABELS: Record<string, string> = {
  tables: "Tables",
  row_filtered: "Row filtered",
  masked_columns: "Masked columns",
};

export function GuardBadge({ action }: { action: "allow" | "warn" | "deny" | "rewrite" | string }) {
  if (action === "deny") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 ring-1 ring-red-200">
        <ShieldX size={10} className="flex-shrink-0" />
        blocked
      </span>
    );
  }
  if (action === "warn") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 ring-1 ring-amber-200">
        <ShieldAlert size={10} className="flex-shrink-0" />
        warned
      </span>
    );
  }
  if (action === "rewrite") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-violet-50 text-violet-700 ring-1 ring-violet-200">
        <PenLine size={10} className="flex-shrink-0" />
        rewritten
      </span>
    );
  }
  return null;
}

function metadataEntries(metadata: Record<string, string> | null | undefined) {
  if (!metadata) return [];
  return Object.entries(metadata).filter(([, v]) => v != null && String(v).trim() !== "");
}

export function GuardActionsList({ actions }: { actions: GuardAction[] }) {
  if (actions.length === 0) return null;

  return (
    <div className="space-y-2">
      {actions.map((a, i) => {
        const meta = metadataEntries(a.metadata);
        const tone =
          a.action === "deny"
            ? "bg-red-50 border-red-100"
            : a.action === "warn"
              ? "bg-amber-50 border-amber-100"
              : a.action === "rewrite"
                ? "bg-violet-50 border-violet-100"
                : "bg-slate-50 border-slate-100";
        return (
          <div key={i} className={`flex items-start gap-3 rounded-xl p-3 text-xs border ${tone}`}>
            <span className="mt-0.5 flex-shrink-0">
              {a.action === "deny" ? (
                <ShieldX size={14} className="text-red-500" />
              ) : a.action === "warn" ? (
                <ShieldAlert size={14} className="text-amber-500" />
              ) : a.action === "rewrite" ? (
                <PenLine size={14} className="text-violet-500" />
              ) : (
                <ShieldCheck size={14} className="text-emerald-500" />
              )}
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold font-mono text-slate-700">{a.guard}</span>
                <GuardBadge action={a.action} />
                {a.code && (
                  <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                    {a.code}
                  </span>
                )}
              </div>
              {a.reason && (
                <p
                  className={`text-[11px] ${
                    a.action === "deny"
                      ? "text-red-700"
                      : a.action === "warn"
                        ? "text-amber-700"
                        : "text-slate-500"
                  }`}
                >
                  {a.reason}
                </p>
              )}
              {meta.length > 0 && (
                <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-0.5 text-[11px] text-slate-600">
                  {meta.map(([key, value]) => (
                    <div key={key} className="contents">
                      <dt className="text-slate-400 whitespace-nowrap">{META_LABELS[key] ?? key}</dt>
                      <dd className="font-mono text-slate-700 truncate" title={value}>
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function GuardSummaryBadge({ actions, wasBlocked }: { actions: GuardAction[] | null; wasBlocked: boolean }) {
  if (!actions || actions.length === 0) return null;
  if (wasBlocked) {
    return <GuardBadge action="deny" />;
  }
  if (actions.some((a) => a.action === "warn")) return <GuardBadge action="warn" />;
  if (actions.some((a) => a.action === "rewrite")) return <GuardBadge action="rewrite" />;
  return null;
}
