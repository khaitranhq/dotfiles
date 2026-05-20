/**
 * Shared Command Utilities
 *
 * Reusable helpers for parsing, splitting, and analysing shell commands.
 * Used by defender (rm detection) and other extensions that introspect
 * bash tool inputs.
 */

import * as path from "node:path";

// ── Command splitting ─────────────────────────────────────────────────

/** Shell command separators that introduce a new command in a chain. */
export const COMMAND_SEPARATORS = new Set(["&&", "||", ";", "|", "&"]);

/**
 * Extract the first "word" of a bash command for matching / display.
 *
 * Handles compound commands (&&, ;, |) by taking the first segment
 * and strips leading env assignments (KEY=val …).
 */
export function extractBaseCommand(fullCommand: string): string {
  return extractAllBaseCommands(fullCommand)[0] || "";
}

/**
 * Extract base commands from *all* segments of a (possibly compound) command.
 *
 * Splits on &&, ||, ;, |, & and extracts the first word from each segment,
 * stripping env assignments.  Returns an array of base command names.
 *
 * Example:
 *   "cd /tmp && pnpm install"  →  ["cd", "pnpm"]
 *   "FOO=1 ls -la | grep foo"  →  ["ls", "grep"]
 */
export function extractAllBaseCommands(fullCommand: string): string[] {
  if (!fullCommand || !fullCommand.trim()) return [];

  // Split on compound separators — longer alternatives first to avoid
  // partial matches (|| before |, && before &).
  const segments = fullCommand.split(/\s*(?:\|\||&&|;|\||&)\s*/);

  return segments
    .map((seg) => extractSingleBaseCommand(seg))
    .filter((cmd) => cmd.length > 0);
}

// ── Internal helpers ──────────────────────────────────────────────────

/**
 * Extract the first word of a SINGLE command segment (no separators).
 * Strips leading env assignments and returns basename.
 */
function extractSingleBaseCommand(segment: string): string {
  const words = segment.trim().split(/\s+/);
  if (words.length === 0) return "";

  // Skip leading env assignments (KEY=val …)
  let first = words[0];
  let i = 0;
  while (first.includes("=") && i < words.length - 1) {
    first = words[++i];
  }

  return path.basename(first);
}

// ── rm detection ──────────────────────────────────────────────────────

/**
 * Allowed command prefixes that can appear before rm in a command chain
 * (e.g., `sudo rm -rf /foo`, `env VAR=1 rm file`).
 */
const RM_PREFIXES = new Set([
  "env", "nice", "ionice", "nohup", "sudo", "pkexec", "doas",
]);

/**
 * Find the index of the "rm" token in a tokenised command.
 *
 * Skips shell command separators (&&, ||, ;, |, &) and allowed prefixes
 * (sudo, env, nice, etc.).  Returns -1 when rm is not the primary command
 * in any segment of the chain.
 */
export function findRmIndex(tokens: string[]): number {
  let sawPrefix = false;
  for (let i = 0; i < tokens.length; i++) {
    if (COMMAND_SEPARATORS.has(tokens[i])) {
      sawPrefix = false;
      continue;
    }

    const token = tokens[i].replace(/^\w+=\S+/, ""); // strip env assignments
    if (token === "rm") return i;

    if (RM_PREFIXES.has(token)) {
      sawPrefix = true;
      continue;
    }

    if (sawPrefix) {
      // After a prefix (sudo, env, etc.), skip past env vars / arguments
      // until we find rm — e.g., "env VAR=1 rm file"
      continue;
    }

    // Not a prefix, not rm, and no prefix seen — this token starts a
    // different command (e.g., "echo rm file").  Skip to next separator.
    while (i + 1 < tokens.length && !COMMAND_SEPARATORS.has(tokens[i + 1])) {
      i++;
    }
  }
  return -1;
}

/**
 * Extract target file paths from tokens after the rm invocation.
 *
 * Skips flag arguments (e.g., -rf, --recursive) and stops at the next
 * shell command separator.
 */
export function extractRmPaths(command: string): string[] {
  const tokens = command.match(/\S+/g) || [];
  const rmIdx = findRmIndex(tokens);
  if (rmIdx === -1) return [];

  const paths: string[] = [];
  let pastDoubleDash = false;
  for (let i = rmIdx + 1; i < tokens.length; i++) {
    let token = tokens[i];
    if (COMMAND_SEPARATORS.has(token)) break;
    token = token.replace(/^["']|["']$/g, ""); // strip surrounding quotes
    if (token === "--") {
      pastDoubleDash = true;
      continue;
    }
    if (!pastDoubleDash && token.startsWith("-")) continue;
    paths.push(token);
  }
  return paths;
}
