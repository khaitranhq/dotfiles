/**
 * Permission Request Extension
 *
 * Gates tool execution based on tool permissions defined in:
 *   1. Agent metadata `tools` section (passed via PI_AGENT_TOOL_PERMISSIONS env var)
 *   2. `permissions` section in ~/.pi/agent/custom-settings.yaml
 *   3. Defaults to "ask" (prompt the user)
 *
 * Permission values: "allow" | "deny" | "ask"
 *
 * New `permissions` format in custom-settings.yaml:
 *
 *   permissions:
 *     read: allow
 *     write: allow
 *     edit: allow
 *     mcp_atlassian_*: deny          # wildcard support
 *     bash:
 *       ls: allow
 *       rg: allow
 *       rm: deny
 *
 * Agent metadata `tools` section (in .md frontmatter):
 *
 *   tools:
 *     bash: allow
 *     mcp_atlassian_*: allow
 *
 * When a call is not auto-allowed but is "ask", the user sees:
 *
 *   [1] Allow                     – execute this one call
 *   [2] Deny (with reason)        – block, optionally providing a reason
 *   [3] Always approve            – allow and persist to custom settings
 *   [4] Approve in this session   – allow for the rest of this session
 */

import type { ExtensionAPI, ToolCallEvent } from "@earendil-works/pi-coding-agent";
import { loadToolPermissions, updateCustomSettings, type ToolPermissions } from "../shared/config";
import {
  lookupPermission,
  resolveBashPermission,
  addToolPermission,
  addBashPermission,
} from "../shared/tool-permissions";
import { extractAllCommandSegments, extractCommandBasis } from "../shared/command-utils";
import { notifyPermissionRequired } from "../notification/index";

// ── Agent tool permissions (from env var) ──────────────────────────────

function loadAgentToolPermissions(): ToolPermissions | null {
  try {
    const raw = process.env.PI_AGENT_TOOL_PERMISSIONS;
    if (!raw) return null;
    return JSON.parse(raw) as ToolPermissions;
  } catch {
    return null;
  }
}

// ── Extension ─────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  // Per-session overrides: tool/command names granted session-only approval
  const sessionApprovals = new Set<string>();

  // Live permission maps loaded from disk
  let settingsPerms: ToolPermissions = {};

  function reloadPermissions(): void {
    settingsPerms = loadToolPermissions();
  }

  reloadPermissions();

  // ── Reload config on session start ─────────────────────────────────
  pi.on("session_start", async (_event) => {
    sessionApprovals.clear();
    reloadPermissions();
  });

  // ── Gate every tool call ───────────────────────────────────────────
  pi.on("tool_call", async (event: ToolCallEvent, ctx) => {
    const toolName = event.toolName;

    // Load agent-level permissions (from env var, set by subagent spawn)
    const agentPerms = loadAgentToolPermissions();

    // ── Bash: resolve command-level permission ──────────────────────
    if (toolName === "bash") {
      const command = (event.input as { command: string }).command;
      const segments = extractAllCommandSegments(command);

      // For compound commands, ALL segments must be allowed
      // and NONE may be denied (deny wins over allow).
      let denied = false;

      for (const seg of segments) {
        // Check session approvals first
        if (sessionApprovals.has(seg)) continue;
        if (segments.every((s) => sessionApprovals.has(s))) return undefined;

        // Check agent permissions
        const agentBashPerm = resolveBashPermission(seg, agentPerms);
        if (agentBashPerm === "deny") {
          denied = true;
          break;
        }
        if (agentBashPerm === "allow") continue;
        if (agentBashPerm === "ask") {
          // agent says ask, defer to settings
        }

        // Check settings permissions (only if agent didn't decide)
        if (agentBashPerm === null) {
          const settingsBashPerm = resolveBashPermission(seg, settingsPerms);
          if (settingsBashPerm === "deny") {
            denied = true;
            break;
          }
          if (settingsBashPerm === "allow") continue;
        }
      }

      if (denied) {
        return { block: true, reason: `Bash command denied by tool permissions.` };
      }

      // If all segments have been handled (all allow/session-approved)
      if (
        segments.length > 0 &&
        segments.every(
          (s) =>
            sessionApprovals.has(s) ||
            resolveBashPermission(s, agentPerms) === "allow" ||
            resolveBashPermission(s, settingsPerms) === "allow",
        )
      ) {
        return undefined;
      }
    } else {
      // ── Non-bash tool: resolve tool-level permission ──────────────

      // Check session approvals
      if (sessionApprovals.has(toolName)) return undefined;

      // Check agent permissions
      const agentResult = lookupPermission(toolName, agentPerms);
      if (agentResult === "deny") {
        return { block: true, reason: `Tool "${toolName}" denied by agent permissions.` };
      }
      if (agentResult === "allow") return undefined;

      // Check settings permissions (only if agent didn't decide)
      if (agentResult === null) {
        const settingsResult = lookupPermission(toolName, settingsPerms);
        if (settingsResult === "deny") {
          return { block: true, reason: `Tool "${toolName}" denied by tool permissions.` };
        }
        if (settingsResult === "allow") return undefined;
      }
    }

    // ── Ask ──────────────────────────────────────────────────────────
    if (!ctx.hasUI) {
      return {
        block: true,
        reason: `Tool "${toolName}" requires approval (no UI available).`,
      };
    }

    const desc = describeCall(event);
    notifyPermissionRequired(desc);

    const selected = await ctx.ui.select(`🔐 Permission required — ${desc}`, [
      "✅ Allow",
      "❌ Deny (with reason)",
      "🔓 Always approve",
      "🕐 Approve in this session only",
    ]);

    if (selected === null || selected === undefined) {
      return { block: true, reason: "Cancelled by user." };
    }

    switch (selected) {
      case "✅ Allow":
        return undefined;

      case "❌ Deny (with reason)": {
        const reason = await ctx.ui.input("Reason for denial:", "e.g., not needed, dangerous, ...");
        return { block: true, reason: reason || "Blocked by user." };
      }

      case "🔓 Always approve": {
        // Persist to custom-settings.yaml under `permissions`.
        if (toolName === "bash") {
          const command = (event.input as { command: string }).command;
          const segments = extractAllCommandSegments(command);
          if (segments.length > 0) {
            for (const seg of segments) {
              const basis = extractCommandBasis(seg);
              if (basis) {
                updateCustomSettings((s) => addBashPermission(s, basis, "allow"));
              }
            }
          }
        } else {
          updateCustomSettings((s) => addToolPermission(s, toolName, "allow"));
        }
        reloadPermissions();
        return undefined;
      }

      case "🕐 Approve in this session only": {
        if (toolName === "bash") {
          const command = (event.input as { command: string }).command;
          const segments = extractAllCommandSegments(command);
          if (segments.length > 0) {
            for (const seg of segments) {
              const basis = extractCommandBasis(seg);
              if (basis) sessionApprovals.add(basis);
            }
          } else {
            sessionApprovals.add(toolName);
          }
        } else {
          sessionApprovals.add(toolName);
        }
        return undefined;
      }

      default:
        return { block: true, reason: "Unknown choice." };
    }
  });
}

// ── Helpers ───────────────────────────────────────────────────────────

function describeCall(event: ToolCallEvent): string {
  const toolName = event.toolName;
  const input = event.input as Record<string, unknown>;

  switch (toolName) {
    case "bash":
      return `bash: ${input.command ?? "(no command)"}`;
    case "read":
      return `read: ${input.path ?? "?"}`;
    case "write":
      return `write: ${input.path ?? "?"}`;
    case "edit":
      return `edit: ${input.path ?? "?"}`;
    case "ls":
      return `ls: ${input.path ?? "."}`;
    case "grep":
      return `grep: ${input.pattern ?? "?"} in ${input.path ?? "?"}`;
    case "find":
      return `find: ${input.path ?? "."}`;
    default:
      return `${toolName}: ${JSON.stringify(input).slice(0, 120)}`;
  }
}
