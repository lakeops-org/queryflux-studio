import type { TranslationOutcome } from "@/lib/api-types";

const reasonLabels: Record<NonNullable<TranslationOutcome["reason"]>, string> = {
  sqlglot_unavailable: "SQLGlot was unavailable.",
  transpile_error: "Translation failed.",
  not_needed: "Translation was not needed.",
  no_schema: "No schema was available; dialect-only translation succeeded.",
  optimize_error: "Schema optimization failed; dialect-only translation succeeded.",
};

export function TranslationBadge({
  outcome,
  showReason = false,
}: {
  outcome?: TranslationOutcome | null;
  showReason?: boolean;
}) {
  const status = outcome?.status ?? "unknown";
  const reason = outcome?.reason;
  const description = reason
    ? reasonLabels[reason] ?? reason
    : outcome ? "Translation completed." : "No translation outcome was recorded.";
  const color = status === "fallback"
    ? "bg-amber-50 text-amber-700 ring-amber-200"
    : status === "yes"
      ? "bg-violet-50 text-violet-700 ring-violet-200"
      : reason === "sqlglot_unavailable" || reason === "transpile_error"
        ? "bg-red-50 text-red-700 ring-red-200"
        : "bg-slate-50 text-slate-600 ring-slate-200";

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span
        title={description}
        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ring-1 ${color}`}
      >
        Translated: {status}
      </span>
      {showReason && <span className="text-xs text-slate-500">{description}</span>}
    </span>
  );
}
