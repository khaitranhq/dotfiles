/**
 * Permission Request Extension
 *
 * Gates tool execution based on a permission config at
 * ~/.pi/agent/permissions.json.
 *
 * The DEFAULT for every tool and every bash command is "ask" —
 * i.e. show the approval prompt.  The config file only needs to list
 * deviations from that default:
 *
 *   "allow" – always approve, no prompt
 *   "deny"  – block silently; the tool is removed from the active set
 *
 * Example ~/.pi/agent/permissions.json:
 *
 *   {
 *     "tools":        { "read": "allow", "bash": "deny" },
 *     "bashCommands": { "rm": "deny", "ls": "allow" }
 *   }
 *
 * The "bash" tool supports per-command fine-tuning via `bashCommands`.
 * For compound commands (&&, ;, |, ||) the first segment is matched.
 * A per-command rule overrides the tool-level rule for "bash".
 *
 * When level is "ask", the user is shown a prompt with these options:
 *
 *   [1] Allow                     – execute this one call
 *   [2] Deny (with reason)        – block, optionally providing a reason
 *   [3] Always approve            – allow and persist to the config file
 *   [4] Approve in this session   – allow for the rest of this session
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import type { ExtensionAPI, ToolCallEvent } from "@earendil-works/pi-coding-agent";

// ── Types ──────────────────────────────────────────────────────────────

type PermissionLevel = "allow" | "ask" | "deny";

interface PermissionsConfig {
  tools?: Record<string, PermissionLevel>;
  bashCommands?: Record<string, PermissionLevel>;
}

// ── Default rule (expressed in code, not a const) ────────────────────

/** The default permission level for any tool or command not in the config. */
const DEFAULT_LEVEL: PermissionLevel = "ask";

// ── Config helpers ────────────────────────────────────────────────────

function configPath(): string {
  const agentDir =
    process.env.PI_CODING_AGENT_DIR ?? path.join(os.homedir(), ".pi", "agent");
  return path.join(agentDir, "permissions.json");
}

function loadConfig(): PermissionsConfig {
  const p = configPath();
  try {
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, "utf-8");
      return JSON.parse(raw) as PermissionsConfig;
    }
  } catch (err) {
    console.error(`[permission-request] Failed to load config: ${err}`);
  }
  return {};
}

function saveConfig(cfg: PermissionsConfig): void {
  const p = configPath();
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(cfg, null, 2), "utf-8");
  } catch (err) {
    console.error(`[permission-request] Failed to save config: ${err}`);
  }
}

// ── Command extraction ────────────────────────────────────────────────

/**
 * Extract the first "word" of a bash command for matching.
 * Handles compound commands (&&, ;, |) by taking the first segment.
 */
function extractBaseCommand(fullCommand: string): string {
  let cmd = fullCommand.trim();

  // Split on common compound separators; keep only the first segment
  for (const sep of ["&&", ";", "|", "||", "&"]) {
    const idx = cmd.indexOf(sep);
    if (idx !== -1) {
      cmd = cmd.slice(0, idx);
    }
  }

  const words = cmd.trim().split(/\s+/);
  if (words.length === 0) return "";

  // Skip leading env assignments (KEY=val …)
  let first = words[0];
  let i = 0;
  while (first.includes("=") && i < words.length - 1) {
    first = words[++i];
  }

  return path.basename(first);
}

/**
 * Match a bash command against `bashCommands` rules.
 * Returns the permission level, or null if no specific rule matches.
 */
function matchBashCommand(
  command: string,
  bashCommands: Record<string, PermissionLevel>,
): PermissionLevel | null {
  const base = extractBaseCommand(command);
  if (base && base in bashCommands) {
    return bashCommands[base];
  }
  return null;
}

// ── Session key ───────────────────────────────────────────────────────

/** Build a session approval key. For bash, include the base command. */
function sessionKey(toolName: string, event: ToolCallEvent): string {
  if (toolName === "bash") {
    const command = (event.input as { command: string }).command;
    const base = extractBaseCommand(command);
    return `bash:${base}`;
  }
  return toolName;
}

// ── Extension ─────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  // Per-session overrides: tools/commands granted session-only approval
  const sessionApprovals = new Set<string>();

  let config = loadConfig();

  // ── Remove denied tools from the active set on startup ──────────────
  pi.on("session_start", async (_event) => {
    sessionApprovals.clear();
    config = loadConfig();

    // Only remove tools explicitly set to "deny" in user config.
    // Tools not in the config fall back to DEFAULT_LEVEL ("ask"),
    // so they remain active and will prompt on use.
    const deniedToolNames = new Set<string>();
    if (config.tools) {
      for (const [toolName, level] of Object.entries(config.tools)) {
        if (level === "deny") deniedToolNames.add(toolName);
      }
    }

    if (deniedToolNames.size > 0) {
      const activeNames = pi
        .getAllTools()
        .map((t) => t.name)
        .filter((name) => !deniedToolNames.has(name));
      pi.setActiveTools(activeNames);
    }
  });

  // ── Gate every tool call ───────────────────────────────────────────
  pi.on("tool_call", async (event: ToolCallEvent, ctx) => {
    const toolName = event.toolName;

    // Determine the effective permission level for this call.
    // Everything defaults to DEFAULT_LEVEL unless the user config
    // specifies an explicit override for the tool or bash command.
    let level: PermissionLevel = config.tools?.[toolName] ?? DEFAULT_LEVEL;

    // For bash, a per-command rule overrides the tool-level rule
    if (toolName === "bash") {
      const command = (event.input as { command: string }).command;
      const cmdLevel = matchBashCommand(command, config.bashCommands ?? {});
      if (cmdLevel !== null) level = cmdLevel;
    }

    // Check session-only approvals (granted earlier this session)
    const key = sessionKey(toolName, event);
    if (sessionApprovals.has(key)) return undefined;

    // ── allow ────────────────────────────────────────────────────────
    if (level === "allow") return undefined;

    // ── deny ─────────────────────────────────────────────────────────
    if (level === "deny") {
      return {
        block: true,
        reason: `Tool "${toolName}" is denied by permission config.`,
      };
    }

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

    const selected = await ctx.ui.select(
      `🔐 Permission required — ${desc}`,
      [
        "Allow",
        "Deny (with reason)",
        "Always approve",
        "Approve in this session only",
      ],
      // ctx.ui.select options — no timeout, user must decide
    );

    if (selected === null || selected === undefined) {
      return { block: true, reason: "Cancelled by user." };
    }

    switch (selected) {
      case "Allow":
        return undefined; // execute this one call

      case "Deny (with reason)": {
        const reason = await ctx.ui.input(
          "Reason for denial:",
          "e.g., not needed, dangerous, ...",
        );
        return { block: true, reason: reason || "Blocked by user." };
      }

      case "Always approve": {
        // Persist to config so future calls skip the prompt
        if (toolName === "bash") {
          const command = (event.input as { command: string }).command;
          const base = extractBaseCommand(command);
          if (base) {
            config.bashCommands ??= {};
            config.bashCommands[base] = "allow";
          } else {
            config.tools ??= {};
            config.tools[toolName] = "allow";
          }
        } else {
          config.tools ??= {};
          config.tools[toolName] = "allow";
        }
        saveConfig(config);
        return undefined;
      }

      case "Approve in this session only": {
        sessionApprovals.add(key);
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
