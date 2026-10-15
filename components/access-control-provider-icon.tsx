import type { AccessControlProvider } from "@/lib/api-types";

const PROVIDER_LOGO: Record<AccessControlProvider, { src: string; label: string }> = {
  opa: { src: "/logos/opa.svg", label: "Open Policy Agent" },
  cerbos: { src: "/logos/cerbos.svg", label: "Cerbos" },
};

interface Props {
  provider: AccessControlProvider;
  /** Icon container size in px (default 28) */
  size?: number;
  className?: string;
}

/** Official OPA / Cerbos mark for access-control provider pickers and badges. */
export function AccessControlProviderIcon({ provider, size = 28, className }: Props) {
  const { src, label } = PROVIDER_LOGO[provider];
  const iconSvgSize = Math.round(size * 0.65);

  return (
    <div
      className={`rounded-lg flex items-center justify-center flex-shrink-0 bg-white border border-slate-200 ${className ?? ""}`}
      style={{ width: size, height: size }}
      title={label}
    >
      {/* Small static brand marks under /public/logos — same pattern as EngineIcon */}
      <img src={src} alt={`${label} logo`} width={iconSvgSize} height={iconSvgSize} />
    </div>
  );
}
