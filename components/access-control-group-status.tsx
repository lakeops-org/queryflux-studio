"use client";

import Link from "next/link";
import { Fingerprint } from "lucide-react";
import type { AccessControlConfigDto } from "@/lib/api-types";
import { accessControlStatusForGroup } from "@/lib/access-control-scope";
import { AccessControlProviderIcon } from "@/components/access-control-provider-icon";

type Variant = "compact" | "banner";

export function AccessControlGroupStatus({
  groupName,
  config,
  variant = "compact",
}: {
  groupName: string;
  config: AccessControlConfigDto | null | undefined;
  variant?: Variant;
}) {
  const name = groupName.trim();
  if (!name) return null;

  const status = accessControlStatusForGroup(name, config);

  const badgeCls =
    !status.connected
      ? "text-slate-600 bg-slate-100 border-slate-200"
      : status.effectiveEnabled
        ? "text-emerald-800 bg-emerald-50 border-emerald-200"
        : "text-amber-800 bg-amber-50 border-amber-200";

  const mark =
    status.effectiveEnabled && status.provider ? (
      <AccessControlProviderIcon provider={status.provider} size={14} />
    ) : (
      <Fingerprint size={11} className="opacity-70" />
    );

  if (variant === "compact") {
    return (
      <span
        className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md border ${badgeCls}`}
        title={status.description}
      >
        {mark}
        {status.shortLabel}
      </span>
    );
  }

  return (
    <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 px-3 py-2.5 flex gap-3">
      {status.effectiveEnabled && status.provider ? (
        <AccessControlProviderIcon provider={status.provider} size={20} className="mt-0.5" />
      ) : (
        <Fingerprint size={16} className="text-indigo-500 shrink-0 mt-0.5" />
      )}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-800">Access control</span>
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${badgeCls}`}>
            {status.shortLabel}
          </span>
        </div>
        <p className="text-[11px] text-slate-600 leading-relaxed">{status.description}</p>
        <Link
          href="/access-control"
          className="text-[11px] font-medium text-indigo-600 hover:underline"
        >
          Edit scope on Access Control →
        </Link>
      </div>
    </div>
  );
}
