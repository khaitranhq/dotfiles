/**
 * Pi Desktop Notification Extension
 *
 * Sends desktop toast notifications for:
 * 1. Tool calls that need user approval (permission "ask") when the
 *    tool/command is NOT in the auto-approve list.
 * 2. Agent completion — when the agent finishes processing a prompt and
 *    is idle, with a snippet of the last assistant response.
 *
 * Uses PowerShell toast notifications on Windows.  Non-Windows systems
 * are skipped.
 */

import { execFile } from "node:child_process";
import type { ExtensionAPI, ToolCallEvent } from "@earendil-works/pi-coding-agent";
import {
  loadAlwaysApprove,
  type AlwaysApproveConfig,
} from "../shared/config";
import { extractBaseCommand } from "../shared/command-utils";

// ── Constants ─────────────────────────────────────────────────────────

const TITLE = "Pi";

/** Default notification command (Windows PowerShell). */
const DEFAULT_COMMAND = "powershell.exe";
const DEFAULT_ARGS: string[] = ["-NoProfile", "-Command"];

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

function notify(title: string, message: string): void {
  const script = createToastScript(title, message);
  execFile(DEFAULT_COMMAND, [...DEFAULT_ARGS, script], (err) => {
    if (err) {
      // Silently ignore — notification is best-effort
    }
  });
}

export default function(pi: ExtensionAPI) {
  // Skip on non-Windows — powershell toast notifications are Windows-only.
  if (process.platform !== "win32") return;

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
    notify(TITLE, describeToolCall(event));
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
    notify(TITLE, body);
  });
}
