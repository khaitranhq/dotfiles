/**
 * Defender Extension
 *
 * Blocks dangerous bash commands and prevents reading/writing outside $HOME.
 * Uses {@link Defender} for path extraction, pattern matching, and file checks.
 *
 * Protected operations:
 *  - rm targeting files outside $HOME (except /tmp — always allowed)
 *  - sudo, chmod, chown, dd, mkfs, fdisk, shutdown, reboot, etc.
 *  - Workaround commands: find ... -delete, find ... -exec rm, xargs rm, etc.
 *  - Read tool: any file outside $HOME (except /tmp)
 *  - Write/Edit tools: any file outside $HOME (except /tmp)
 *  - Reading/writing any .env or .*.env file
 */

import type { TextContent, ImageContent } from "@earendil-works/pi-ai";
import type {
  ExtensionAPI,
  ExtensionContext,
  ToolCallEventResult,
} from "@earendil-works/pi-coding-agent";
import { DEFAULT_ALLOWED_PREFIXES, isPathAllowed } from "../shared/path-guard";
import { Defender } from "./defender";
import { SecretMask } from "./secret-mask";

// ── Types ─────────────────────────────────────────────────────────────

interface DefenderState {
  blockedThisTurn: boolean;
}

// ── Extension ─────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  const defender = new Defender();
  const state: DefenderState = { blockedThisTurn: false };

  pi.on("turn_end", () => {
    state.blockedThisTurn = false;
  });

  pi.on("tool_call", (event, ctx) => {
    switch (event.toolName) {
      case "bash":
        return handleBash(defender, event.input.command as string, ctx, pi, state);
      case "read":
        return handleRead(defender, event.input.path as string, ctx);
      case "write":
      case "edit":
        return handleWrite(defender, event.input.path as string, ctx);
    }
    return undefined;
  });

  pi.on("tool_result", async (event) => {
    return maskToolResult(event.content);
  });
}

// ── Helpers ───────────────────────────────────────────────────────────

function steerOnce(pi: ExtensionAPI, defender: Defender, state: DefenderState): void {
  if (!state.blockedThisTurn) {
    state.blockedThisTurn = true;
    pi.sendUserMessage(defender.blockInstruction, { deliverAs: "steer" });
  }
}

function blockNotify(ctx: ExtensionContext, reason: string, msg: string): ToolCallEventResult {
  if (ctx.hasUI) ctx.ui.notify(msg, "warning");
  return { block: true, reason };
}

// ── Tool handlers ─────────────────────────────────────────────────────

function handleBash(
  defender: Defender,
  command: string,
  ctx: ExtensionContext,
  pi: ExtensionAPI,
  state: DefenderState,
): ToolCallEventResult | undefined {
  // Dangerous patterns
  const matched = defender.findDangerousPattern(command);
  if (matched) {
    steerOnce(pi, defender, state);
    return blockNotify(
      ctx,
      `Dangerous command blocked: ${matched}`,
      `Blocked dangerous command: ${command.slice(0, 80)}`,
    );
  }

  // File paths targeted by the command
  const outsidePaths = defender
    .getBashTargetPaths(command)
    .filter((p) => !isPathAllowed(p, ctx.cwd, DEFAULT_ALLOWED_PREFIXES));

  if (outsidePaths.length > 0) {
    steerOnce(pi, defender, state);
    return blockNotify(
      ctx,
      `Command blocked: targets outside safe paths: ${outsidePaths.join(", ")}`,
      `Blocked command targeting unsafe paths: ${command.slice(0, 80)}`,
    );
  }
}

function handleRead(
  defender: Defender,
  filePath: string,
  ctx: ExtensionContext,
): ToolCallEventResult | undefined {
  const result = defender.checkRead(filePath, ctx.cwd, DEFAULT_ALLOWED_PREFIXES);
  if (result.blocked) {
    return blockNotify(ctx, result.reason!, `Blocked read: ${filePath}`);
  }
}

async function maskToolResult(
  content: (TextContent | ImageContent)[] | undefined,
): Promise<{ content?: (TextContent | ImageContent)[] } | undefined> {
  if (!content || content.length === 0) return undefined;

  let changed = false;
  const masked: typeof content = [];

  for (const block of content) {
    if (block.type === "text" && block.text) {
      const result = await SecretMask.mask(block.text);
      if (result.count > 0) {
        changed = true;
        masked.push({ ...block, text: result.masked });
        continue;
      }
    }
    masked.push(block);
  }

  return changed ? { content: masked } : undefined;
}

function handleWrite(
  defender: Defender,
  filePath: string,
  ctx: ExtensionContext,
): ToolCallEventResult | undefined {
  const result = defender.checkWrite(filePath, ctx.cwd, DEFAULT_ALLOWED_PREFIXES);
  if (result.blocked) {
    return blockNotify(ctx, result.reason!, `Blocked write: ${filePath}`);
  }
}
