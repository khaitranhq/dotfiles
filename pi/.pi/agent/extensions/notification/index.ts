/**
 * Pi Windows Notification Extension
 *
 * Sends Windows toast notifications for agent lifecycle events.
 * Windows only — uses PowerShell to invoke the Windows.UI.Notifications API.
 *
 * Ref: opencode-plugins/plugins/notification.ts
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const TITLE = "Pi";

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

  // Notify when the agent asks a question (e.g., clarification, confirmations)
  pi.on("tool_call", async (event) => {
    if (event.toolName === "question") {
      notify(TITLE, "Question asked");
    }
  });
}
