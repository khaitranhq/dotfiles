/**
 * Defender Extension
 *
 * Blocks dangerous bash commands and prevents reading/writing outside $HOME.
 * Relative paths are resolved against the current working directory.
 * When a command is blocked, also sends a steering instruction telling the agent
 * NOT to try workarounds — just inform the user that the operation is not allowed.
 *
 * Protected operations:
 *  - rm targeting files outside $HOME (except /tmp — always allowed)
 *  - sudo, chmod, chown, dd, mkfs, fdisk, shutdown, reboot, etc.
 *  - Workaround commands: find ... -delete, find ... -exec rm, xargs rm, etc.
 *  - Read tool: any file outside $HOME (except /tmp)
 *  - Write/Edit tools: any file outside $HOME (except /tmp)
 *  - Reading/writing any .env or .*.env file
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { DEFAULT_ALLOWED_PREFIXES } from "../shared/path-guard";
import { BLOCK_INSTRUCTION } from "./patterns";
import { checkBashCommand } from "./bash-guard";
import { checkReadPath, checkWritePath } from "./file-guard";

// ── Extension ─────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  let blockedThisTurn = false;

  pi.on("turn_end", async () => {
    blockedThisTurn = false;
  });

  pi.on("tool_call", async (event, ctx) => {
    const cwd = ctx.cwd;

    // ── Bash ─────────────────────────────────────────────────────────
    if (event.toolName === "bash") {
      const command = event.input.command as string;
      const result = checkBashCommand(command, cwd, DEFAULT_ALLOWED_PREFIXES);

      if (result.blocked) {
        if (ctx.hasUI) {
          ctx.ui.notify(`Blocked dangerous command: ${command.slice(0, 80)}`, "warning");
        }
        if (!blockedThisTurn) {
          blockedThisTurn = true;
          pi.sendUserMessage(BLOCK_INSTRUCTION, { deliverAs: "steer" });
        }
        return { block: true, reason: result.reason };
      }

      return undefined;
    }

    // ── Read ─────────────────────────────────────────────────────────
    if (event.toolName === "read") {
      const filePath = event.input.path as string;
      const result = checkReadPath(filePath, cwd, DEFAULT_ALLOWED_PREFIXES);

      if (result.blocked) {
        if (ctx.hasUI) {
          ctx.ui.notify(`Blocked read outside safe paths: ${filePath}`, "warning");
        }
        return { block: true, reason: result.reason };
      }

      return undefined;
    }

    // ── Write / Edit ─────────────────────────────────────────────────
    if (event.toolName === "write" || event.toolName === "edit") {
      const filePath = event.input.path as string;
      const result = checkWritePath(filePath, cwd, DEFAULT_ALLOWED_PREFIXES);

      if (result.blocked) {
        if (ctx.hasUI) {
          ctx.ui.notify(`Blocked write outside safe paths: ${filePath}`, "warning");
        }
        return { block: true, reason: result.reason };
      }

      return undefined;
    }

    return undefined;
  });
}
