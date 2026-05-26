/**
 * Environment variable and path utilities.
 *
 * Shared helpers for interpolating environment variables into strings
 * and resolving path expressions (e.g. ~, ${HOME}).
 */

import { homedir } from "node:os";
import { join } from "node:path";

export function interpolateEnvVars(value: string): string {
  return value
    .replace(
      /\$\{(\w+)(?::-([^}]*))?\}/g,
      (_match, name: string, defaultValue: string | undefined) => {
        const val = process.env[name];
        if (val !== undefined) return val;
        return defaultValue ?? "";
      },
    )
    .replace(/\$env:(\w+)/g, (_, name) => process.env[name] ?? "");
}

export function interpolateEnvRecord(
  values: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!values) return undefined;

  const resolved: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    resolved[key] = interpolateEnvVars(value);
  }
  return resolved;
}

export function resolveConfigPath(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;

  const resolved = interpolateEnvVars(value);
  if (resolved === "~") return homedir();
  if (resolved.startsWith("~/") || resolved.startsWith("~\\")) {
    return join(homedir(), resolved.slice(2));
  }
  return resolved;
}
