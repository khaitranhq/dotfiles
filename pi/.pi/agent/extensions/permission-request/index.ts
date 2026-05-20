/**
 * Permission Request Extension
 *
 * Gates tool execution based on an always-approve list in
 * ~/.pi/agent/custom-settings.json.
 *
 * Every tool and bash command defaults to "ask" — the approval prompt
 * is shown.  Add tools or commands to the `always_approve` section to
 * skip the prompt permanently:
 *
 *   always_approve.tools        – always allow these tools, no prompt
 *   always_approve.bashCommands – always allow these commands, no prompt
 *
 * Example ~/.pi/agent/custom-settings.json:
 *
 *   {
 *     "always_approve": {
 *       "tools":        ["read", "edit", "write"],
 *       "bashCommands": ["find", "grep", "ls", "cd", "rg", "cat"]
 *     }
 *   }
 *
 * For compound bash commands (&&, ;, |, ||, &) ALL segments must be approved.
 *
 * When a call is not always-approved, the user sees:
 *
 *   [1] Allow                     – execute this one call
 *   [2] Deny (with reason)        – block, optionally providing a reason
 *   [3] Always approve            – allow and persist to always_approve
 *   [4] Approve in this session   – allow for the rest of this session
 */

import type { ExtensionAPI, ToolCallEvent } from "@earendil-works/pi-coding-agent";
import {
  loadAlwaysApprove,
  updateCustomSettings,
  type AlwaysApproveConfig,
  type CustomSettings,
} from "../shared/config";
import { extractAllBaseCommands } from "../shared/command-utils";

// ── Set helpers ───────────────────────────────────────────────────────

function addToAlwaysApprove(
  settings: CustomSettings,
  category: "tools" | "bashCommands",
  name: string,
): CustomSettings {
  const aa: AlwaysApproveConfig = settings.always_approve ?? {};
  const list = aa[category] ?? [];
  if (!list.includes(name)) {
    aa[category] = [...list, name];
  }
  return { ...settings, always_approve: aa };
}

// ── Command extraction ────────────────────────────────────────────────

/**
 * Extract the first "word" of a bash command for matching.
 * For compound commands, returns the first segment's base command.
 */
function extractFirstBaseCommand(fullCommand: string): string {
  return extractAllBaseCommands(fullCommand)[0] || "";
}

// ── Session key ───────────────────────────────────────────────────────

/** Build a session approval key. For bash, include the first base command. */
function sessionKey(toolName: string, event: ToolCallEvent): string {
  if (toolName === "bash") {
    const command = (event.input as { command: string }).command;
    const base = extractFirstBaseCommand(command);
    return `bash:${base}`;
  }
  return toolName;
}

// ── Extension ─────────────────────────────────────────────────────────

export default function(pi: ExtensionAPI) {
  // Per-session overrides: tools/commands granted session-only approval
  const sessionApprovals = new Set<string>();

  // Live always-approve sets loaded from disk
  let alwaysApproveTools = new Set<string>();
  let alwaysApproveCommands = new Set<string>();

  function reloadAlwaysApprove(): void {
    const aa = loadAlwaysApprove();
    alwaysApproveTools = new Set(aa.tools ?? []);
    alwaysApproveCommands = new Set(aa.bashCommands ?? []);
  }

  reloadAlwaysApprove();

  // ── Reload config on session start ─────────────────────────────────
  pi.on("session_start", async (_event) => {
    sessionApprovals.clear();
    reloadAlwaysApprove();
  });

  // ── Gate every tool call ───────────────────────────────────────────
  pi.on("tool_call", async (event: ToolCallEvent, ctx) => {
    const toolName = event.toolName;

    // Determine whether this call is always-approved.
    // For compound bash commands, ALL segments must be approved.
    let alwaysApproved = false;

    if (toolName === "bash") {
      const command = (event.input as { command: string }).command;
      const bases = extractAllBaseCommands(command);
      if (bases.length > 0 && bases.every((b) => alwaysApproveCommands.has(b))) {
        alwaysApproved = true;
      }
    } else {
      if (alwaysApproveTools.has(toolName)) {
        alwaysApproved = true;
      }
    }

    // Check session-only approvals — all base commands must be approved
    if (toolName === "bash") {
      const command = (event.input as { command: string }).command;
      const bases = extractAllBaseCommands(command);
      if (bases.length > 0 && bases.every((b) => sessionApprovals.has(`bash:${b}`))) {
        return undefined;
      }
    } else {
      const key = sessionKey(toolName, event);
      if (sessionApprovals.has(key)) return undefined;
    }

    // ── always-approve ──────────────────────────────────────────────
    if (alwaysApproved) return undefined;

    // ── ask ──────────────────────────────────────────────────────────
    if (!ctx.hasUI) {
      // Non-interactive mode: deny by default
      return {
        block: true,
        reason: `Tool "${toolName}" requires approval (no UI available).`,
      };
    }

    // Build a human-readable description of what's being requested
    const desc = describeCall(event);

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
        return undefined; // execute this one call

      case "❌ Deny (with reason)": {
        const reason = await ctx.ui.input("Reason for denial:", "e.g., not needed, dangerous, ...");
        return { block: true, reason: reason || "Blocked by user." };
      }

      case "🔓 Always approve": {
        // Persist to custom-settings.json under always_approve.
        // For compound commands, add EVERY base command in the chain.
        if (toolName === "bash") {
          const command = (event.input as { command: string }).command;
          const bases = extractAllBaseCommands(command);
          if (bases.length > 0) {
            for (const base of bases) {
              updateCustomSettings((s) => addToAlwaysApprove(s, "bashCommands", base));
              alwaysApproveCommands.add(base);
            }
          } else {
            updateCustomSettings((s) => addToAlwaysApprove(s, "tools", toolName));
            alwaysApproveTools.add(toolName);
          }
        } else {
          updateCustomSettings((s) => addToAlwaysApprove(s, "tools", toolName));
          alwaysApproveTools.add(toolName);
        }
        return undefined;
      }

      case "🕐 Approve in this session only": {
        // For compound commands, approve all base commands for the session.
        if (toolName === "bash") {
          const command = (event.input as { command: string }).command;
          const bases = extractAllBaseCommands(command);
          if (bases.length > 0) {
            for (const base of bases) {
              sessionApprovals.add(`bash:${base}`);
            }
          } else {
            sessionApprovals.add(key);
          }
        } else {
          sessionApprovals.add(key);
        }
        return undefined;
      }

      default:
        return { block: true, reason: "Unknown choice." };
    }
  });
}

// ── Helpers ───────────────────────────────────────────────────────────

/** Build a human-readable description of the tool call. */
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
