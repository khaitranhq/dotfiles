/**
 * Defender Bash Guard
 *
 * Checks shell commands against dangerous patterns and validates
 * rm target paths against allowed filesystem prefixes.
 */

import { isPathAllowed } from "../shared/path-guard";
import { extractRmPaths } from "../shared/command-utils";
import { DANGEROUS_PATTERNS } from "./patterns";

// ── Types ─────────────────────────────────────────────────────────────

export interface BashCheckResult {
  blocked: boolean;
  reason?: string;
}

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Check whether a bash command is dangerous.
 *
 * Returns a block result if the command matches any dangerous pattern
 * or attempts to rm files outside the allowed prefixes.
 */
export function checkBashCommand(
  command: string,
  cwd?: string,
  allowedPrefixes?: string[],
): BashCheckResult {
  // --- Path-aware rm check ---
  const rmPaths = extractRmPaths(command);
  if (rmPaths.length > 0) {
    const outsidePaths = rmPaths.filter((p) => !isPathAllowed(p, cwd, allowedPrefixes));
    if (outsidePaths.length > 0) {
      return {
        blocked: true,
        reason: `rm blocked: targets outside safe paths: ${outsidePaths.join(", ")}`,
      };
    }
  }

  // --- Pattern-based check ---
  const matched = findDangerousPattern(command);
  if (matched) {
    return {
      blocked: true,
      reason: `Dangerous command blocked. Do not try workarounds — tell the user this operation is not allowed. (matched: ${matched})`,
    };
  }

  return { blocked: false };
}

/**
 * Test against dangerous patterns. Returns the first matching pattern
 * as a string, or null if none match.
 */
export function findDangerousPattern(command: string): RegExp | null {
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) return pattern;
  }
  return null;
}
