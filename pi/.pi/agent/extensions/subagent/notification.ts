/**
 * Desktop notifications for pi agent events.
 *
 * Sends desktop toast notifications via notify-send for:
 * 1. Permission requests — "🔐 Permission required" prompts.
 * 2. Question prompts — when the LLM uses the `question` tool.
 * 3. Agent completion — when the primary agent finishes processing.
 */

import { execFile } from "node:child_process";
import * as os from "node:os";
import * as path from "node:path";

import { Logger } from "../shared/logger";

// ── Constants ─────────────────────────────────────────────────────────

const TITLE = "Pi";
const LOG_PATH = path.join(os.homedir(), ".pi", "agent", "subagent", "notification.log");

const logger = new Logger(LOG_PATH);

// ── notify-send ───────────────────────────────────────────────────────

function notify(title: string, message: string): void {
  logger.log(`Sending notification: ${title} — ${message}`);
  execFile("notify-send --hint=string:sound-name:complete", [title, message], (err) => {
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
