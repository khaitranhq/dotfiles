/**
 * Pi Windows Notification Extension
 *
 * Sends Windows toast notifications for agent lifecycle events.
 * Windows only — uses PowerShell to invoke the Windows.UI.Notifications API.
 *
 * Notifications are only sent for tool calls whose permission level is "ask" —
 * i.e. the user needs to approve them. Tools/commands set to "allow" or "deny"
 * silently skip notifications.
 *
 * Ref: opencode-plugins/plugins/notification.ts
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import type { ExtensionAPI, ToolCallEvent } from "@earendil-works/pi-coding-agent";

// ── Permission types ──────────────────────────────────────────────────

type PermissionLevel = "allow" | "ask" | "deny";

interface PermissionsConfig {
  tools?: Record<string, PermissionLevel>;
  bashCommands?: Record<string, PermissionLevel>;
}

const TITLE = "Pi";

// ── Permission helpers ────────────────────────────────────────────────

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
  } catch {
    // Silently fall back to empty config
  }
  return {};
}

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

/** Determine whether the given tool call is at "ask" permission level. */
function isPermissionAsk(event: ToolCallEvent): boolean {
  const config = loadConfig();
  const toolName = event.toolName;

  // Determine the effective permission level for this call.
  // Everything defaults to "ask" unless the user config specifies an
  // explicit override for the tool or bash command.
  let level: PermissionLevel = config.tools?.[toolName] ?? "ask";

  // For bash, a per-command rule overrides the tool-level rule
  if (toolName === "bash") {
    const command = (event.input as { command: string }).command;
    const cmdLevel = matchBashCommand(command, config.bashCommands ?? {});
    if (cmdLevel !== null) level = cmdLevel;
  }

  return level === "ask";
}

// ── Helpers ───────────────────────────────────────────────────────────

/** Build a short description of the tool call for the toast notification. */
function describeToolCall(event: ToolCallEvent): string {
  const input = event.input as Record<string, unknown>;

  switch (event.toolName) {
    case "bash":
      return `bash: ${String(input.command ?? "(no command)").slice(0, 100)}`;
    case "question":
      return `Question: ${String(input.text ?? "?").slice(0, 100)}`;
    case "read":
      return `read: ${input.path ?? "?"}`;
    case "write":
      return `write: ${input.path ?? "?"}`;
    case "edit":
      return `edit: ${input.path ?? "?"}`;
    case "ls":
      return `ls: ${input.path ?? "."}`;
    case "grep":
      return `grep: ${input.pattern ?? "?"}`;
    case "find":
      return `find: ${input.path ?? "."}`;
    default:
      return `${event.toolName}`;
  }
}

function createToastScript(title: string, message: string): string {
  return [
    `[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null`,
    `[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] > $null`,
    ``,
    `$xml = New-Object Windows.Data.Xml.Dom.XmlDocument`,
    `$toastXml = @'`,
    `<toast>`,
    `  <visual>`,
    `    <binding template="ToastText02">`,
    `      <text id="1">${title}</text>`,
    `      <text id="2">${message}</text>`,
    `    </binding>`,
    `  </visual>`,
    `</toast>`,
    `'@`,
    `$xml.LoadXml($toastXml)`,
    ``,
    `$toast = New-Object Windows.UI.Notifications.ToastNotification $xml`,
    `$notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('${title}')`,
    `$notifier.Show($toast)`,
  ].join("\n");
}

function notify(title: string, message: string): void {
  const { execFile } = require("child_process");
  const script = createToastScript(title, message);
  execFile(
    "powershell.exe",
    ["-NoProfile", "-Command", script],
    (err: Error | null) => {
      if (err) {
        // Silently ignore — notification is best-effort
      }
    },
  );
}

export default function (pi: ExtensionAPI) {
  // Notify when agent finishes a turn and is waiting for user input
  pi.on("agent_end", async () => {
    notify(TITLE, "Session completed!");
  });

  // Notify on tool calls only when the user needs to approve them
  // (permission level is "ask"). Tools/commands set to "allow" or "deny"
  // are silently skipped.
  pi.on("tool_call", async (event) => {
    if (!isPermissionAsk(event)) return;
    notify(TITLE, describeToolCall(event));
  });
}
