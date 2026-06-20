/**
 * Ponytail — shared configuration resolver.
 *
 * Resolution order for default mode:
 *   1. PONYTAIL_DEFAULT_MODE environment variable
 *   2. Config file defaultMode field:
 *      - $XDG_CONFIG_HOME/ponytail/config.json (any platform, if set)
 *      - ~/.config/ponytail/config.json (macOS / Linux fallback)
 *      - %APPDATA%\ponytail\config.json (Windows fallback)
 *   3. 'full'
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export const DEFAULT_MODE = "full";
export const VALID_MODES = ["off", "lite", "full", "ultra", "review"] as const;
export const RUNTIME_MODES = ["off", "lite", "full", "ultra"] as const;

export type RuntimeMode = (typeof RUNTIME_MODES)[number];
export type ValidMode = (typeof VALID_MODES)[number];

function normalizeMode(mode: unknown): RuntimeMode | null {
  if (typeof mode !== "string") return null;
  const normalized = mode.trim().toLowerCase();
  return (RUNTIME_MODES as readonly string[]).includes(normalized)
    ? (normalized as RuntimeMode)
    : null;
}

function normalizeConfigMode(mode: unknown): ValidMode | null {
  if (typeof mode !== "string") return null;
  const normalized = mode.trim().toLowerCase();
  return (VALID_MODES as readonly string[]).includes(normalized) ? (normalized as ValidMode) : null;
}

/**
 * Runtime or config-only mode accepted by the persisted-mode getter.
 *
 * Runtime modes (`off`/`lite`/`full`/`ultra`) are the modes that can drive
 * injection. Config-only modes (e.g. `review`) are valid as a persisted
 * default but defer to a separate skill — see `getPonytailInstructions`.
 */
export type PersistedMode = RuntimeMode | ValidMode;

export function normalizePersistedMode(mode: unknown): PersistedMode | null {
  return normalizeMode(mode) ?? normalizeConfigMode(mode as string);
}

export { normalizeMode, normalizeConfigMode };

/**
 * "stop ponytail" / "normal mode" turns ponytail off, but only as a standalone
 * command. Matching the phrase anywhere in the message turned it off mid-task
 * for ordinary requests like "add a normal mode toggle" — so require the whole
 * message to be the command, ignoring case and trailing punctuation.
 */
export function isDeactivationCommand(text: unknown): boolean {
  const t = String(text ?? "")
    .trim()
    .toLowerCase()
    .replace(/[.!?\s]+$/, "");
  return t === "stop ponytail" || t === "normal mode";
}

function getConfigDir(): string {
  if (process.env.XDG_CONFIG_HOME) {
    return path.join(process.env.XDG_CONFIG_HOME, "ponytail");
  }
  if (process.platform === "win32") {
    return path.join(
      process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"),
      "ponytail",
    );
  }
  return path.join(os.homedir(), ".config", "ponytail");
}

export function getConfigPath(): string {
  return path.join(getConfigDir(), "config.json");
}

export function getDefaultMode(): RuntimeMode {
  // 1. Environment variable (highest priority)
  const envMode = process.env.PONYTAIL_DEFAULT_MODE;
  if (envMode && (VALID_MODES as readonly string[]).includes(envMode.toLowerCase())) {
    return envMode.toLowerCase() as RuntimeMode;
  }

  // 2. Config file
  try {
    const configPath = getConfigPath();
    const config = JSON.parse(fs.readFileSync(configPath, "utf8")) as {
      defaultMode?: string;
    };
    if (
      config.defaultMode &&
      (VALID_MODES as readonly string[]).includes(config.defaultMode.toLowerCase())
    ) {
      return config.defaultMode.toLowerCase() as RuntimeMode;
    }
  } catch {
    // Config file doesn't exist or is invalid — fall through
  }

  // 3. Default
  return DEFAULT_MODE;
}

export function writeDefaultMode(mode: unknown): ValidMode | null {
  const normalized = normalizeConfigMode(mode);
  if (!normalized) return null;

  const configPath = getConfigPath();
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify({ defaultMode: normalized }, null, 2), "utf8");
  return normalized;
}
