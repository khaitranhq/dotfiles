/**
 * Pi Desktop Notification Extension
 *
 * Sends desktop toast notifications for:
 * 1. Agent completion — when the agent finishes processing a prompt and
 *    is idle, with a snippet of the last assistant response.
 *
 * Also exports `notifyPermissionRequired()` for the permission-request
 * extension to call when it shows the "🔐 Permission required" prompt.
 *
 * Uses PowerShell toast notifications on Windows.  Non-Windows systems
 * are skipped.
 */

import { execFile } from "node:child_process";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// ── Constants ─────────────────────────────────────────────────────────

const TITLE = "Pi";

/** Default notification command (Windows PowerShell). */
const DEFAULT_COMMAND = "powershell.exe";
const DEFAULT_ARGS: string[] = ["-NoProfile", "-Command"];

// ── Helpers ───────────────────────────────────────────────────────────

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

/**
 * Send a desktop toast notification for a permission-required prompt.
 * Called by the permission-request extension when it shows the
 * "🔐 Permission required" select dialog.
 */
export function notifyPermissionRequired(description: string): void {
  notify(TITLE, description);
}

export default function(pi: ExtensionAPI) {
  // Skip on non-Windows — powershell toast notifications are Windows-only.
  if (process.platform !== "win32") return;

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
