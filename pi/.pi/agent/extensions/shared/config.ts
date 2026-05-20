/**
 * Shared Config Module
 *
 * Centralised loader for ~/.pi/agent/custom-settings.json.
 *
 * Supports JSON with comments (JSONC):
 *   // line comment
 *   /* block comment *​/
 *
 * Extensions import this module instead of duplicating path resolution
 * and JSON loading/saving logic.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// ── Supported settings (extend as needed) ─────────────────────────────

export interface AlwaysApproveConfig {
  tools?: string[];
  bashCommands?: string[];
}

export interface SubagentConfig {
  /** Default agent scope when none is specified. */
  defaultScope?: "user" | "project" | "both";
  /** Default value for confirmProjectAgents. */
  confirmProjectAgents?: boolean;
}

export interface CustomSettings {
  always_approve?: AlwaysApproveConfig;
  subagent?: SubagentConfig;
  [key: string]: unknown;
}

// ── Path resolution ───────────────────────────────────────────────────

function getAgentDir(): string {
  return process.env.PI_CODING_AGENT_DIR ?? path.join(os.homedir(), ".pi", "agent");
}

export function configPath(): string {
  return path.join(getAgentDir(), "custom-settings.json");
}

// ── JSONC helpers ─────────────────────────────────────────────────────

/** Strip // line comments (but not https://) and /* block comments *​/ */
function stripJsonComments(raw: string): string {
  let json = raw;
  // Remove block comments first
  json = json.replace(/\/\*[\s\S]*?\*\//g, "");
  // Remove line comments, preserving URLs like https://
  json = json.replace(/(?<!:)\/\/.*$/gm, "");
  return json;
}

// ── Load / Save ───────────────────────────────────────────────────────

export function loadCustomSettings(): CustomSettings {
  const p = configPath();
  try {
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, "utf-8");
      const cleaned = stripJsonComments(raw);
      return JSON.parse(cleaned) as CustomSettings;
    }
  } catch (err) {
    console.error(`[config] Failed to load custom-settings.json: ${err}`);
  }
  return {};
}

export function saveCustomSettings(settings: CustomSettings): void {
  const p = configPath();
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(settings, null, 2) + "\n", "utf-8");
  } catch (err) {
    console.error(`[config] Failed to save custom-settings.json: ${err}`);
  }
}

/**
 * Atomic read-modify-write helper.
 *
 * Usage:
 *   updateCustomSettings(s => ({ ...s, always_approve: { ...s.always_approve, tools: ["ls"] } }))
 */
export function updateCustomSettings(
  updater: (settings: CustomSettings) => CustomSettings,
): void {
  saveCustomSettings(updater(loadCustomSettings()));
}

// ── Convenience getters ───────────────────────────────────────────────

export function loadAlwaysApprove(): AlwaysApproveConfig {
  return loadCustomSettings().always_approve ?? {};
}

export function loadSubagentConfig(): SubagentConfig {
  return loadCustomSettings().subagent ?? {};
}

