/**
 * Defender File Guard
 *
 * Validates read/write/edit tool calls against safe-path rules
 * and env-file restrictions.
 */

import { isPathAllowed, isEnvFile } from "../shared/path-guard";

// ── Types ─────────────────────────────────────────────────────────────

export interface FileCheckResult {
  blocked: boolean;
  reason?: string;
}

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Check whether reading the given path is allowed.
 *
 * Blocks:
 *  - .env files (the agent shouldn't see secrets)
 *  - Files outside $HOME (except /tmp)
 */
export function checkReadPath(
  filePath: string,
  cwd?: string,
  allowedPrefixes?: string[],
): FileCheckResult {
  if (isEnvFile(filePath)) {
    return {
      blocked: true,
      reason: `Reading "${filePath}" is blocked — it looks like an env file`,
    };
  }

  if (!isPathAllowed(filePath, cwd, allowedPrefixes)) {
    return {
      blocked: true,
      reason: `Reading "${filePath}" is blocked — only files under $HOME and /tmp are allowed`,
    };
  }

  return { blocked: false };
}

/**
 * Check whether writing/editing the given path is allowed.
 *
 * Blocks:
 *  - .env files
 *  - Files outside $HOME (except /tmp)
 */
export function checkWritePath(
  filePath: string,
  cwd?: string,
  allowedPrefixes?: string[],
): FileCheckResult {
  if (isEnvFile(filePath)) {
    return {
      blocked: true,
      reason: `Writing to "${filePath}" is blocked — it looks like an env file`,
    };
  }

  if (!isPathAllowed(filePath, cwd, allowedPrefixes)) {
    return {
      blocked: true,
      reason: `Writing to "${filePath}" is blocked — only files under $HOME and /tmp are allowed`,
    };
  }

  return { blocked: false };
}
