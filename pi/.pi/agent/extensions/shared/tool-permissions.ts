/**
 * Tool permission resolution utilities.
 *
 * Shared between permission-request (runtime gating) and subagent
 * (subagent tool filtering) extensions.
 */

import {
  type BashPermissions,
  type CustomSettings,
  type ToolPermission,
  type ToolPermissions,
} from "./config";
import { isCommandApproved, matchesToolPattern } from "./command-utils";

// ── Type guard ────────────────────────────────────────────────────────

/** Check whether a value is a ToolPermissions map (object with string/bool keys). */
export function isToolPermissions(obj: unknown): obj is ToolPermissions {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
  const keys = Object.keys(obj);
  if (keys.length === 0) return false;
  // Exclude settings-level keys that aren't tool maps
  if (keys.includes("global") || keys.includes("agents")) return false;
  return true;
}

// ── Permission lookup ─────────────────────────────────────────────────

/**
 * Look up a tool name in a permission map.
 * Returns the permission value or null if not found.
 * Supports wildcards (e.g. `mcp_atlassian_*`).
 */
export function lookupPermission(
  toolName: string,
  perms: ToolPermissions | null,
): ToolPermission | null {
  if (!perms) return null;

  for (const [key, value] of Object.entries(perms)) {
    if (key === "bash") continue;
    if (matchesToolPattern(toolName, new Set([key]))) {
      if (typeof value === "string") return value as ToolPermission;
    }
  }
  return null;
}

/**
 * Resolve bash command permission from a permission map.
 * Checks the `bash` sub-map for command prefix matches.
 * Returns the permission value or null if not found.
 */
export function resolveBashPermission(
  command: string,
  perms: ToolPermissions | null,
): ToolPermission | null {
  if (!perms) return null;

  const bashPerms = perms["bash"];
  if (!bashPerms || typeof bashPerms === "string") return null;

  const bashMap = bashPerms as BashPermissions;

  for (const entryType of ["allow", "deny", "ask"] as const) {
    const entries = new Set(
      Object.entries(bashMap)
        .filter(([, v]) => v === entryType)
        .map(([k]) => k),
    );
    if (entries.size > 0 && isCommandApproved(command, entries)) return entryType;
  }

  return null;
}

// ── Settings mutation helpers ─────────────────────────────────────────

export function addToolPermission(
  settings: CustomSettings,
  toolName: string,
  permission: ToolPermission,
): CustomSettings {
  const perms: ToolPermissions = isToolPermissions(settings.tools)
    ? { ...(settings.tools as ToolPermissions) }
    : {};
  perms[toolName] = permission;
  return { ...settings, tools: perms };
}

export function addBashPermission(
  settings: CustomSettings,
  command: string,
  permission: ToolPermission,
): CustomSettings {
  const perms: ToolPermissions = isToolPermissions(settings.tools)
    ? { ...(settings.tools as ToolPermissions) }
    : {};
  const bashPerms: BashPermissions =
    typeof perms["bash"] === "object" && perms["bash"] !== null
      ? { ...(perms["bash"] as BashPermissions) }
      : {};
  bashPerms[command] = permission;
  perms["bash"] = bashPerms;
  return { ...settings, tools: perms };
}
