#!/usr/bin/env bash
# Notify — desktop toast via notify-send.
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

notify-send "$TITLE" "$MESSAGE"
