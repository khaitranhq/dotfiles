/**
 * Pi Desktop Notification Extension
 *
 * Sends desktop toast notifications for:
 * 1. Tool calls that need user approval (permission "ask") when the
 *    tool/command is NOT in the auto-approve list.
 * 2. Agent completion — when the agent finishes processing a prompt and
 *    is idle, with a snippet of the last assistant response.
 *
 * The notification command is configured in ~/.pi/agent/custom-settings.json
 * under `notification`.  Defaults to PowerShell on Windows.
 *
 *   // custom-settings.json
 *   {
 *     "notification": {
 *       "command": "powershell.exe",
 *       "args": ["-NoProfile", "-Command"]
 *     }
 *   }
 *
 * On non-Windows systems the extension is skipped unless a custom
 * `notification.command` is configured.
 */

import { execFile } from "node:child_process";
import * as path from "node:path";
import type { ExtensionAPI, ToolCallEvent } from "@earendil-works/pi-coding-agent";
import {
  loadAlwaysApprove,
  loadNotificationConfig,
  type AlwaysApproveConfig,
  type NotificationConfig,
} from "../shared/config";

// ── Constants ─────────────────────────────────────────────────────────

const TITLE = "Pi";

/** Default notification command (Windows PowerShell). */
const DEFAULT_COMMAND = "powershell.exe";
const DEFAULT_ARGS: string[] = ["-NoProfile", "-Command"];

// ── Config helpers ────────────────────────────────────────────────────

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
 * Determine whether the given tool call requires user approval ("ask").
 * Returns true when the tool/command is NOT in the auto-approve list —
 * meaning the agent will prompt the user before executing.
 */
function isPermissionAsk(event: ToolCallEvent, alwaysApprove: AlwaysApproveConfig): boolean {
  const toolName = event.toolName;

  if (toolName === "bash") {
    const command = (event.input as { command: string }).command;
    const base = extractBaseCommand(command);
    // If the base command is in always-approve, it's allowed → no notification
    if (base && (alwaysApprove.bashCommands ?? []).includes(base)) {
      return false;
    }
    // Not in always-approve → will "ask" the user → notify
    return true;
  }

  // Non-bash tools: always-approved if listed in tools → no notification
  if ((alwaysApprove.tools ?? []).includes(toolName)) {
    return false;
  }

  // Not in always-approve → will "ask" the user → notify
  return true;
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

function notify(
  title: string,
  message: string,
  config: NotificationConfig,
): void {
  const command = config.command ?? DEFAULT_COMMAND;
  const args = [...(config.args ?? DEFAULT_ARGS)];
  const script = createToastScript(title, message);

  // If the command is powershell, embed the script as a -Command arg.
  // For other commands, pass the script via stdin or let args handle it.
  execFile(command, [...args, script], (err) => {
    if (err) {
      // Silently ignore — notification is best-effort
    }
  });
}

export default function(pi: ExtensionAPI) {
  const notifyCfg = loadNotificationConfig();

  // Skip if no notification command is configured AND we're not on Windows.
  // On Windows the default powershell command works out of the box.
  if (process.platform !== "win32" && !notifyCfg.command) return;

  // Reload config on session start so changes take effect without restart.
  let alwaysApprove = loadAlwaysApprove();
  pi.on("session_start", async () => {
    alwaysApprove = loadAlwaysApprove();
  });

  // Notify on tool calls only when the user needs to approve them
  // (permission level is "ask" — not in the auto-approve list).
  // Auto-approved tools/commands silently skip notifications.
  pi.on("tool_call", async (event) => {
    if (!isPermissionAsk(event, alwaysApprove)) return;
    notify(TITLE, describeToolCall(event), notifyCfg);
  });

  // Notify when the agent finishes processing a prompt.
  // Lets users know pi is idle and ready for the next input.
  pi.on("agent_end", async (event) => {
    const msgCount = event.messages?.length ?? 0;
    if (msgCount === 0) return; // nothing happened
    const lastMsg = event.messages[msgCount - 1];
    // Extract a short snippet from the last assistant message
    let preview = "";
    if (lastMsg && lastMsg.role === "assistant" && Array.isArray(lastMsg.content)) {
      for (const block of lastMsg.content) {
        if (block.type === "text" && typeof block.text === "string") {
          preview = block.text.slice(0, 80).replace(/\n/g, " ");
          break;
        }
      }
    }
    const body = preview ? `Done: ${preview}…` : "Done — ready for you.";
    notify(TITLE, body, notifyCfg);
  });
}
