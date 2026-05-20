/**
 * Shared Config Module
 *
 * Centralised loader for ~/.pi/agent/custom-settings.yaml.
 *
 * Uses YAML format with native comment support.
 * Automatically migrates legacy custom-settings.json on first load.
 *
 * Extensions import this module instead of duplicating path resolution
 * and YAML loading/saving logic.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

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
  return path.join(getAgentDir(), "custom-settings.yaml");
}

/** Legacy JSON config path (migrated to YAML on first load). */
function legacyConfigPath(): string {
  return path.join(getAgentDir(), "custom-settings.json");
}

// ── JSON → YAML migration ────────────────────────────────────────────

/**
 * If custom-settings.json exists but custom-settings.yaml does not,
 * migrate the legacy JSON file to YAML automatically.
 */
function migrateJsonToYaml(): void {
  const yamlPath = configPath();
  const jsonPath = legacyConfigPath();

  if (fs.existsSync(yamlPath) || !fs.existsSync(jsonPath)) return;

  try {
    const raw = fs.readFileSync(jsonPath, "utf-8");
    // Strip JSONC comments (// and /* */)
    let cleaned = raw;
    cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, "");
    cleaned = cleaned.replace(/(?<!:)\/\/.*$/gm, "");
    const settings = JSON.parse(cleaned);

    // Write as YAML
    fs.mkdirSync(path.dirname(yamlPath), { recursive: true });
    fs.writeFileSync(yamlPath, stringifyYaml(settings), "utf-8");
    console.error(
      `[config] Migrated custom-settings.json → custom-settings.yaml`,
    );
  } catch (err) {
    console.error(
      `[config] Failed to migrate custom-settings.json: ${err}`,
    );
  }
}

// ── Load / Save ───────────────────────────────────────────────────────

export function loadCustomSettings(): CustomSettings {
  const p = configPath();

  // One-time migration from legacy JSON
  migrateJsonToYaml();

  try {
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, "utf-8");
      return (parseYaml(raw) as CustomSettings) ?? {};
    }
  } catch (err) {
    console.error(`[config] Failed to load custom-settings.yaml: ${err}`);
  }
  return {};
}

export function saveCustomSettings(settings: CustomSettings): void {
  const p = configPath();
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, stringifyYaml(settings), "utf-8");
  } catch (err) {
    console.error(`[config] Failed to save custom-settings.yaml: ${err}`);
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

