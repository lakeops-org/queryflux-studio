import type { AccessControlConfigDto, AccessControlProvider } from "@/lib/api-types";

export type AccessControlOverride = "inherit" | "enabled" | "disabled";

export interface AccessControlGroupStatus {
  /** Access control is configured and active for this group at query time. */
  effectiveEnabled: boolean;
  /** Access control is connected (at least one connection is configured). */
  connected: boolean;
  override: AccessControlOverride;
  globalEnabled: boolean;
  /** Named connection this group resolves to, if any (its own override, else `defaultConnection`). */
  connectionName: string | null;
  /** Provider for the resolved connection (`opa` / `cerbos`), when known. */
  provider: AccessControlProvider | null;
  shortLabel: string;
  description: string;
}

function providerLabel(provider: AccessControlProvider | null): string {
  if (provider === "cerbos") return "Cerbos";
  if (provider === "opa") return "OPA";
  return "the policy provider";
}

/** Whether any connection is configured — the Studio-level "Provider: None" state. */
export function isAccessControlConnected(
  config: AccessControlConfigDto | null | undefined,
): boolean {
  return Boolean(config && Object.keys(config.connections ?? {}).length > 0);
}

/**
 * The named connection `groupName` resolves to: its own override, else
 * `config.defaultConnection`. `null` means no connection resolves for this group at all.
 */
export function connectionNameForGroup(
  groupName: string,
  config: AccessControlConfigDto | null | undefined,
): string | null {
  return config?.groups[groupName]?.connection || config?.defaultConnection || null;
}

function providerForConnection(
  connectionName: string | null,
  config: AccessControlConfigDto | null | undefined,
): AccessControlProvider | null {
  if (!connectionName || !config) return null;
  return config.connections[connectionName]?.provider ?? null;
}

/** Resolve whether access control runs for queries routed to `groupName`. Mirrors QueryFlux `enabled_for_group` + `connection_name_for_group`. */
export function accessControlStatusForGroup(
  groupName: string,
  config: AccessControlConfigDto | null | undefined,
): AccessControlGroupStatus {
  const connectionName = connectionNameForGroup(groupName, config);
  const provider = providerForConnection(connectionName, config);

  if (!isAccessControlConnected(config)) {
    return {
      effectiveEnabled: false,
      connected: false,
      override: "inherit",
      globalEnabled: false,
      connectionName,
      provider,
      shortLabel: "Off",
      description:
        "Access control is not connected. Enable OPA or Cerbos on the Access Control page.",
    };
  }

  const globalEnabled = config?.enabled ?? true;
  const ov = config?.groups[groupName]?.enabled;
  const override: AccessControlOverride =
    ov === true ? "enabled" : ov === false ? "disabled" : "inherit";
  const administrativelyEnabled =
    override === "enabled" ? true : override === "disabled" ? false : globalEnabled;
  const effectiveEnabled = administrativelyEnabled && connectionName !== null;

  if (!effectiveEnabled) {
    const detail = !administrativelyEnabled
      ? override === "disabled"
        ? "Explicitly disabled for this group — the policy provider is not called."
        : globalEnabled
          ? "Disabled for this group."
          : "Global default is off and this group does not opt in."
      : "No connection resolves for this group (no override and no default connection configured) — access control does not apply.";
    return {
      effectiveEnabled: false,
      connected: true,
      override,
      globalEnabled,
      connectionName,
      provider,
      shortLabel: "Skipped",
      description: detail,
    };
  }

  const engine = providerLabel(provider);
  const connectionSuffix = ` (connection: ${connectionName})`;
  const detail =
    (override === "enabled"
      ? globalEnabled
        ? `Explicitly enabled — queries call ${engine}.`
        : `Opt-in enabled — global default is off but this group uses ${engine}.`
      : `Inherits global default (enabled) — queries call ${engine}.`) + connectionSuffix;

  const shortLabel =
    provider === "cerbos" ? "Cerbos on" : provider === "opa" ? "OPA on" : "On";

  return {
    effectiveEnabled: true,
    connected: true,
    override,
    globalEnabled,
    connectionName,
    provider,
    shortLabel,
    description: detail,
  };
}
