/**
 * Desktop notifications for pi agent events.
 *
 * Sends desktop toast notifications for:
 * 1. Permission requests — "🔐 Permission required" prompts.
 * 2. Question prompts — when the LLM uses the `question` tool.
 * 3. Agent completion — when the primary agent finishes processing.
 *
 * Windows: PowerShell toast notifications.  Other platforms are skipped.
 */

import { execFile } from "node:child_process";
import * as os from "node:os";
import * as path from "node:path";

import { Logger } from "../shared/logger";

// ── Constants ─────────────────────────────────────────────────────────

const TITLE = "Pi";
const LOG_PATH = path.join(os.homedir(), ".pi", "agent", "subagent", "notification.log");
const powershellPath = path.join(
  "/mnt",
  "c",
  "Windows",
  "System32",
  "WindowsPowerShell",
  "v1.0",
  "powershell.exe",
);

const logger = new Logger(LOG_PATH);

// ── XML escaping ──────────────────────────────────────────────────────

/** Escape text for safe inclusion in XML element content. */
function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ── Windows: PowerShell toast ─────────────────────────────────────────

function createToastScript(title: string, message: string): string {
  const escTitle = xmlEscape(title);
  const escMessage = xmlEscape(message);
  return [
    `[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null`,
    `[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] > $null`,
    ``,
    `$xml = New-Object Windows.Data.Xml.Dom.XmlDocument`,
    `$toastXml = @'`,
    `<toast>`,
    `  <visual>`,
    `    <binding template="ToastText02">`,
    `      <text id="1">${escTitle}</text>`,
    `      <text id="2">${escMessage}</text>`,
    `    </binding>`,
    `  </visual>`,
    `</toast>`,
    `'@`,
    `$xml.LoadXml($toastXml)`,
    ``,
    `$toast = New-Object Windows.UI.Notifications.ToastNotification $xml`,
    `$notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('${escTitle}')`,
    `$notifier.Show($toast)`,
  ].join("\n");
}

function notify(title: string, message: string): void {
  const script = createToastScript(title, message);
  logger.log(`Running notification script:\n${script}`);
  execFile(powershellPath, ["-NoProfile", "-Command", script], (err) => {
    if (err) {
      logger.log(`Failed to send notification: ${err.message}`);
    }
  });
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Notify that a permission-required prompt is showing.
 * Called by the permission gate when it shows the "🔐 Permission required" dialog.
 */
export function notifyPermissionRequired(description: string): void {
  notify(TITLE, description);
}

/**
 * Notify that the LLM is asking a question via the question tool.
 * Called when the subagent extension observes a `question` tool_call.
 */
export function notifyQuestion(questionText: string): void {
  const preview = questionText.length > 100 ? `${questionText.slice(0, 97)}…` : questionText;
  notify(TITLE, `Question: ${preview}`);
}

/**
 * Notify that the primary agent has finished processing a prompt.
 * Called on the `agent_end` event.
 */
export function notifyAgentDone(responsePreview: string): void {
  const body = responsePreview ? `Done: ${responsePreview}…` : "Done — ready for you.";
  notify(TITLE, body);
}
