#!/usr/bin/env bash
# Notify — desktop toast via PowerShell from WSL.
# Reads JSON from stdin (Claude Code hook input), extracts event info, and sends a toast.
#
# Hook events handled:
#   PermissionRequest    → "🔐 Tool: <tool_name>"
#   PostToolUse          → matches AskUserQuestion tool
#   Stop                 → "Done" with preview of last message

set -euo pipefail

read -r INPUT

extract() { jq -r "$1" <<< "$INPUT" 2>/dev/null || true; }

HOOK_EVENT="$(extract '.hook_event_name')"

case "$HOOK_EVENT" in
  PermissionRequest)
    TOOL="$(extract '.tool_name')"
    TITLE="Claude Code — Permission"
    MESSAGE="🔐 ${TOOL}"
    if [ "${TOOL}" = "Bash" ] || [ "${TOOL}" = "PowerShell" ]; then
      CMD="$(extract '.tool_input.command')"
      MESSAGE="🔐 ${TOOL}: ${CMD}"
    fi
    ;;
  PostToolUse)
    TOOL="$(extract '.tool_name')"
    if [ "${TOOL}" != "AskUserQuestion" ]; then
      exit 0
    fi
    QUESTIONS="$(extract '.tool_input.questions[0].question')"
    TITLE="Claude Code — Question"
    MESSAGE="❓ ${QUESTIONS}"
    ;;
  Stop)
    TEXT="$(extract '.last_assistant_message // ""')"
    PREVIEW="${TEXT:0:120}"
    TITLE="Claude Code"
    MESSAGE="${PREVIEW:-Done — ready for you.}"
    ;;
  *)
    exit 0
    ;;
esac

# XML-escape
escape_xml() {
  sed -e 's/&/\&amp;/g' \
      -e 's/</\&lt;/g' \
      -e 's/>/\&gt;/g' \
      -e 's/"/\&quot;/g' \
      -e "s/'/\&apos;/g" \
      <<< "$1"
}

ETITLE="$(escape_xml "$TITLE")"
EMESSAGE="$(escape_xml "$MESSAGE")"

/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe -NoProfile -Command "
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > \$null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] > \$null
\$xml = New-Object Windows.Data.Xml.Dom.XmlDocument
\$xml.LoadXml(@'
<toast>
  <visual>
    <binding template=\"ToastText02\">
      <text id=\"1\">${ETITLE}</text>
      <text id=\"2\">${EMESSAGE}</text>
    </binding>
  </visual>
</toast>
'@)
\$toast = New-Object Windows.UI.Notifications.ToastNotification \$xml
\$notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('${ETITLE}')
\$notifier.Show(\$toast)
"
