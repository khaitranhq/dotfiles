/**
 * Shared Path Guard Module
 *
 * Reusable path-safety utilities for defender and other extensions that
 * need to gate filesystem access to $HOME and /tmp.
 *
 * All path helpers resolve relative paths against the caller-supplied cwd
 * (typically the session working directory).  They also expand ~ and
 * $HOME / ${HOME} tokens.
 */

import * as path from "node:path";

// ── Constants ─────────────────────────────────────────────────────────

const HOME_DIR = process.env.HOME || "/home/" + (process.env.USER || "user");

/** Default safe prefixes — $HOME and /tmp (both resolved to absolute). */
const DEFAULT_ALLOWED_PREFIXES = [HOME_DIR, "/tmp"].map((prefix) => path.resolve(prefix));

/** Regex matching .env file paths (bare filename or path component). */
const ENV_FILE_RE = /(?:^|[\\/])\.env(?:\..*)?$|(?:^|[\\/])\..*\.env(?:\..*)?$/;

// ── Path helpers ──────────────────────────────────────────────────────

/** Expand ~ and $HOME / ${HOME} in a path string. */
export function expandPath(rawPath: string): string {
  if (!rawPath) return rawPath;

  if (rawPath === "~") return HOME_DIR;
  if (rawPath.startsWith("~/")) return path.join(HOME_DIR, rawPath.slice(2));

  return rawPath.replace(/\$HOME\b|\$\{HOME\}/g, HOME_DIR);
}

/** Normalize a path, resolving relative paths against cwd. */
export function normalizePath(rawPath: string, cwd?: string): string {
  if (!rawPath) return rawPath;

  const expandedPath = expandPath(rawPath);
  const baseDir = path.isAbsolute(expandedPath)
    ? path.parse(expandedPath).root
    : cwd || process.cwd();

  return path.resolve(baseDir, expandedPath);
}

/** Check whether a resolved path is within one of the allowed prefixes. */
export function isPathAllowed(
  rawPath: string,
  cwd?: string,
  allowedPrefixes: string[] = DEFAULT_ALLOWED_PREFIXES,
): boolean {
  if (!rawPath) return true;

  const resolved = normalizePath(rawPath, cwd);
  return allowedPrefixes.some(
    (prefix) => resolved === prefix || resolved.startsWith(prefix + path.sep),
  );
}

/** Check whether a path string matches the .env file pattern. */
export function isEnvFile(rawPath: string): boolean {
  return ENV_FILE_RE.test(rawPath);
}

// ── Re-exports ────────────────────────────────────────────────────────

export { DEFAULT_ALLOWED_PREFIXES, ENV_FILE_RE, HOME_DIR };
