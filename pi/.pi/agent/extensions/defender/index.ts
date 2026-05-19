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
 *  - Reading any .env or .*.env file (e.g., .env, .env.local, .env.production)
 *  - Writing/editing any .env or .*.env file
 */

import * as path from "node:path";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/** Patterns for dangerous bash commands and common workarounds. */
const DANGEROUS_PATTERNS: RegExp[] = [
  /\bsudo\b/i,
  /\b(chmod|chown)\b.*\b777\b/i,
  /\bdd\s+if=/i,
  /\bmkfs\.?\w*\b/i,
  /\bfdisk\b/i,
  /\b(shutdown|reboot|halt|poweroff|init\s+[06])\b/i,
  /\b:(){ :\|:& };:/,  // fork bomb
  /\b>\/dev\/sda\b/i,  // write to raw disk
  /\bchmod\s+[_-]?[rR]\b/i,  // recursive chmod
  /\bfind\b.*\b-delete\b/i,  // find ... -delete
  /\bfind\b.*-exec\s+rm\b/i,  // find ... -exec rm ...
  /\bfind\b.*-execdir\s+rm\b/i,  // find ... -execdir rm ...
  /\bxargs\b.*\brm\b/i,  // xargs rm
  /\bperl\b.*\bunlink\b/i,  // perl unlink
  /\bpython\b.*\bos\.remove\b/i,  // python os.remove
  /\bpython\b.*\bshutil\.rmtree\b/i,  // python shutil.rmtree
  /\bruby\b.*\bFileUtils\.rm/i,  // ruby FileUtils.rm
];

/** Regex matching .env file paths (bare filename or path component). */
const ENV_FILE_RE = /(?:^|[\\/])\.env(?:\..*)?$|(?:^|[\\/])\..*\.env(?:\..*)?$/;

/** Message sent to the agent when a dangerous command is blocked. */
const BLOCK_INSTRUCTION =
  "SECURITY BLOCK: Your last action was blocked because it is destructive or dangerous. " +
  "DO NOT attempt any workarounds (find, xargs, perl, python, ruby, or any other tool). " +
  "Just tell the user: 'This operation is not allowed because it could harm the system.'";

// ── Path Helpers ─────────────────────────────────────────────────────

const HOME_DIR = process.env.HOME || '/home/' + (process.env.USER || 'user');
const ALLOWED_PREFIXES = [HOME_DIR, '/tmp'].map((prefix) => path.resolve(prefix));

/** Expand ~ and $HOME in a path string. */
function expandPath(rawPath: string): string {
  if (!rawPath) return rawPath;

  if (rawPath === '~') {
    return HOME_DIR;
  }

  if (rawPath.startsWith('~/')) {
    return path.join(HOME_DIR, rawPath.slice(2));
  }

  return rawPath.replace(/\$HOME\b|\$\{HOME\}/g, HOME_DIR);
}

/** Normalize a path, resolving relative paths against cwd. */
function normalizePath(rawPath: string, cwd?: string): string {
  if (!rawPath) return rawPath;

  const expandedPath = expandPath(rawPath);
  const baseDir = path.isAbsolute(expandedPath)
    ? path.parse(expandedPath).root
    : (cwd || process.cwd());

  return path.resolve(baseDir, expandedPath);
}

/** Check whether a path is within an allowed prefix ($HOME or /tmp). */
function isPathAllowed(rawPath: string, cwd?: string): boolean {
  if (!rawPath) return true;

  const resolved = normalizePath(rawPath, cwd);
  return ALLOWED_PREFIXES.some((prefix) =>
    resolved === prefix || resolved.startsWith(prefix + path.sep),
  );
}

/**
 * Check if a command is an rm invocation (rm as the primary command,
 * optionally prefixed by sudo / env / nice / ionice / nohup / etc.).
 * Returns the index of the "rm" token, or -1 if not found.
 */
function findRmIndex(tokens: string[]): number {
  // Allow common prefixes like env, nice, nohup, sudo before rm.
  // sudo is handled separately by DANGEROUS_PATTERNS, but we still
  // want to do path-aware checks for rm even with these prefixes.
  const prefixes = new Set([
    'env', 'nice', 'ionice', 'nohup', 'sudo', 'pkexec', 'doas',
  ]);
  for (let i = 0; i < tokens.length; i++) {
    // Strip leading variable assignments like FOO=bar
    const token = tokens[i].replace(/^\w+=\S+/, '');
    if (token === 'rm') return i;
    if (!prefixes.has(token)) return -1;
  }
  return -1;
}

/** Extract target file paths from tokens after the rm command, skipping flags/options. */
function extractRmPaths(command: string): string[] {
  const tokens = command.match(/\S+/g) || [];
  const rmIdx = findRmIndex(tokens);
  if (rmIdx === -1) return [];

  const paths: string[] = [];
  let pastDoubleDash = false;
  for (let i = rmIdx + 1; i < tokens.length; i++) {
    let token = tokens[i];
    token = token.replace(/^["']|["']$/g, ''); // strip quotes
    if (token === '--') {
      pastDoubleDash = true;
      continue;
    }
    if (!pastDoubleDash && token.startsWith('-')) {
      continue;
    }
    paths.push(token);
  }
  return paths;
}

export default function (pi: ExtensionAPI) {
  let blockedThisTurn = false;

  pi.on("turn_end", async () => {
    blockedThisTurn = false;
  });

  pi.on("tool_call", async (event, ctx) => {
    // ── Bash ─────────────────────────────────────────────────────────
    if (event.toolName === "bash") {
      const command = event.input.command as string;

      // --- Path-aware rm check ---
      // Allow rm if all target paths are within $HOME or /tmp.
      // Only triggers when rm is the primary command (not in a pipe or string).
      const rmPaths = extractRmPaths(command);
      if (rmPaths.length > 0) {
        const outsidePaths = rmPaths.filter((p) => !isPathAllowed(p, ctx.cwd));
        if (outsidePaths.length > 0) {
          if (ctx.hasUI) {
            ctx.ui.notify(
              `Blocked rm outside safe paths: ${command.slice(0, 80)}`,
              "warning",
            );
          }
          if (!blockedThisTurn) {
            blockedThisTurn = true;
            pi.sendUserMessage(BLOCK_INSTRUCTION, { deliverAs: "steer" });
          }
          return {
            block: true,
            reason: `rm blocked: targets outside $HOME (and not /tmp): ${outsidePaths.join(', ')}`,
          };
        }
        // All rm targets are safe — fall through to check other patterns.
      }

      for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(command)) {
          if (ctx.hasUI) {
            ctx.ui.notify(
              `Blocked dangerous command: ${command.slice(0, 80)}`,
              "warning",
            );
          }

          // Send steering instruction (only once per turn) to tell the
          // agent to stop trying workarounds.
          if (!blockedThisTurn) {
            blockedThisTurn = true;
            pi.sendUserMessage(BLOCK_INSTRUCTION, { deliverAs: "steer" });
          }

          return {
            block: true,
            reason: `Dangerous command blocked. Do not try workarounds — tell the user this operation is not allowed. (matched: ${pattern})`,
          };
        }
      }
      return undefined;
    }

    // ── Read ─────────────────────────────────────────────────────────
    if (event.toolName === "read") {
      const path = event.input.path as string;

      // Block reading .env files (the agent shouldn't see secrets)
      if (ENV_FILE_RE.test(path)) {
        if (ctx.hasUI) {
          ctx.ui.notify(
            `Blocked read of sensitive file: ${path}`,
            "warning",
          );
        }
        return { block: true, reason: `Reading "${path}" is blocked — it looks like an env file` };
      }

      // Block reading files outside $HOME (except /tmp).
      // Resolve relative paths against the current working directory.
      if (!isPathAllowed(path, ctx.cwd)) {
        if (ctx.hasUI) {
          ctx.ui.notify(
            `Blocked read outside safe paths: ${path}`,
            "warning",
          );
        }
        return { block: true, reason: `Reading "${path}" is blocked — only files under $HOME and /tmp are allowed` };
      }

      return undefined;
    }

    // ── Write / Edit ─────────────────────────────────────────────────
    if (event.toolName === "write" || event.toolName === "edit") {
      const path = event.input.path as string;

      // Block writing/editing .env files
      if (ENV_FILE_RE.test(path)) {
        if (ctx.hasUI) {
          ctx.ui.notify(
            `Blocked write to sensitive file: ${path}`,
            "warning",
          );
        }
        return {
          block: true,
          reason: `Writing to "${path}" is blocked — it looks like an env file`,
        };
      }

      // Block writing files outside $HOME (except /tmp).
      // Resolve relative paths against the current working directory.
      if (!isPathAllowed(path, ctx.cwd)) {
        if (ctx.hasUI) {
          ctx.ui.notify(
            `Blocked write outside safe paths: ${path}`,
            "warning",
          );
        }
        return { block: true, reason: `Writing to "${path}" is blocked — only files under $HOME and /tmp are allowed` };
      }

      return undefined;
    }

    return undefined;
  });
}
