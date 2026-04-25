import type { Plugin } from "@opencode-ai/plugin";
import { basename } from "path";

const createToastScript = (title: string, message: string): string => `
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] > $null

$xml = New-Object Windows.Data.Xml.Dom.XmlDocument
$toastXml = @'
<toast>
  <visual>
    <binding template="ToastText02">
      <text id="1"></text>
      <text id="2"></text>
    </binding>
  </visual>
</toast>
'@
$xml.LoadXml($toastXml)
$xml.SelectSingleNode('//text[@id="1"]').InnerText = '${title}'
$xml.SelectSingleNode('//text[@id="2"]').InnerText = '${message}'

$toast = New-Object Windows.UI.Notifications.ToastNotification $xml
$notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('${title}')
$notifier.Show($toast)
`;

export const MyPlugin: Plugin = async ({
  project,
  client,
  $,
  directory,
  worktree,
}) => {
  const projectName = directory ? basename(directory) : "";
  const title = `OpenCode - ${projectName}`;

  return {
    event: async ({ event }) => {
      // Send notification on session completion
      if (event.type === "session.idle") {
        const script = createToastScript(title, "Session completed!");
        await $`powershell.exe -NoProfile -Command ${script}`;
      }
      // Send notification when permission is asked
      if (event.type === "permission.asked") {
        const script = createToastScript(title, "Permission request");
        await $`powershell.exe -NoProfile -Command ${script}`;
      }
    },
    "permission.ask": async () => {
      const script = createToastScript(title, "Permission request");
      await $`powershell.exe -NoProfile -Command ${script}`;
    },
    "tool.execute.before": async (input) => {
      if (input.tool === "question") {
        const script = createToastScript(title, "Question asked");
        await $`powershell.exe -NoProfile -Command ${script}`;
      }
      if (input.tool === "plan_exit") {
        const script = createToastScript(title, "Plan exit");
        await $`powershell.exe -NoProfile -Command ${script}`;
      }
    },
  };
};
