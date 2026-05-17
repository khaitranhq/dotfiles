/**
 * Defender Extension
 *
 * Blocks dangerous bash commands and prevents reading/writing outside $HOME.
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
const ALLOWED_PREFIXES = [HOME_DIR, '/tmp'];

/** Normalize a path: expand ~ and $HOME, resolve . and .. */
function normalizePath(path: string): string {
  if (!path) return path;
  // Expand ~ and ~user
  if (path === '~' || path.startsWith('~/')) {
    path = HOME_DIR + path.slice(1);
  }
  // Expand $HOME / ${HOME}
  path = path.replace(/\$HOME\b|\$\{HOME\}/g, HOME_DIR);
  // Resolve . and ..
  const parts = path.split('/');
  const result: string[] = [];
  for (const part of parts) {
    if (part === '..') {
      result.pop();
    } else if (part !== '.' && part !== '') {
      result.push(part);
    }
  }
  return '/' + result.join('/');
}

/** Check whether a path is within an allowed prefix ($HOME or /tmp). */
function isPathAllowed(rawPath: string): boolean {
  if (!rawPath) return true;
  const resolved = normalizePath(rawPath);
  // Relative paths (no leading /) — we cannot determine location, so allow.
  if (!resolved.startsWith('/')) return true;
  return ALLOWED_PREFIXES.some(prefix => {
    const p = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
    return resolved === p || resolved.startsWith(p + '/');
  });
}

/** Extract target file paths from an rm command, skipping flags/options. */
function extractRmPaths(command: string): string[] {
  const tokens = command.match(/\S+/g) || [];
  let i = 1; // skip 'rm'
  const paths: string[] = [];
  let pastDoubleDash = false;
  for (; i < tokens.length; i++) {
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
      if (/\brm\b/i.test(command)) {
        const paths = extractRmPaths(command);
        const outsidePaths = paths.filter(p => !isPathAllowed(p));
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

      // Block reading files outside $HOME (except /tmp)
      if (!isPathAllowed(path)) {
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

      // Block writing files outside $HOME (except /tmp)
      if (!isPathAllowed(path)) {
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
