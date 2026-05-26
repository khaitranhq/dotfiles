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

/** @deprecated Replaced by {@link ToolPermissions}. Kept for migration. */
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

/**
 * Per-agent tool override: allow (whitelist) or deny (blacklist).
 * Configured in custom-settings.yaml under `tools.agents.<agentName>`.
 *
 * @deprecated Replaced by {@link ToolPermissions}. Kept for migration.
 */
export interface AgentToolOverride {
  allow?: string[];
  deny?: string[];
}

/**
 * Tool toggle configuration.
 *
 * @deprecated Replaced by {@link ToolPermissions}. Kept for migration.
 */
export interface ToolsConfig {
  global?: AgentToolOverride;
  agents?: Record<string, AgentToolOverride>;
}

// ── New tools permission format ───────────────────────────────────────

/** Permission level for a tool or bash command: allow, deny, or ask (prompt). */
export type ToolPermission = "allow" | "deny" | "ask";

/**
 * Bash command permissions keyed by command prefix.
 * Example: `{ jq: "allow", rm: "deny" }`.
 */
export type BashPermissions = Record<string, ToolPermission>;

/**
 * Tool permission map — tool name (or wildcard) to permission level,
 * or a BashPermissions sub-map for the `bash` tool.
 *
 * Example:
 * ```yaml
 * tools:
 *   read: allow
 *   write: allow
 *   mcp_atlassian_*: deny
 *   bash:
 *     jq: allow
 *     rm: deny
 * ```
 */
export type ToolPermissions = Record<string, ToolPermission | BashPermissions>;

// ── MCP server config from custom-settings.yaml ──────────────────────

/**
 * Single MCP server entry as defined in custom-settings.yaml `mcp.servers[]`.
 * Uses an array format with `name` and `transport` fields, unlike the
 * keyed-object format used in `mcp.json`.
 */
export interface McpYamlServer {
  name: string;
  transport?: "http" | "stdio";
  url?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  headers?: Record<string, string>;
  /** Authentication type: 'oauth', 'bearer', or false to disable */
  auth?: "oauth" | "bearer" | false;
  bearerToken?: string;
  bearerTokenEnv?: string;
  /** OAuth configuration (optional). Set to false to disable OAuth. */
  oauth?:
    | {
        grantType?: "authorization_code" | "client_credentials";
        clientId?: string;
        clientSecret?: string;
        scope?: string;
        redirectUri?: string;
        clientName?: string;
        clientUri?: string;
      }
    | false;
  lifecycle?: "keep-alive" | "lazy" | "eager";
  idleTimeout?: number;
  exposeResources?: boolean;
  directTools?: boolean | string[];
  excludeTools?: string[];
  debug?: boolean;
  timeout?: number;
  reconnection?: {
    maxRetries?: number;
    maxReconnectionDelay?: number;
  };
}

/** MCP section under custom-settings.yaml root `mcp` key. */
export interface McpYamlConfig {
  servers?: McpYamlServer[];
}

export interface CustomSettings {
  always_approve?: AlwaysApproveConfig;
  subagent?: SubagentConfig;
  mcp?: McpYamlConfig;
  /**
   * Tool permissions map (new format) or legacy ToolsConfig (old format).
   *
   * New format (replaces `always_approve` and `tools.global`):
   * ```yaml
   * tools:
   *   read: allow
   *   mcp_atlassian_*: deny
   *   bash:
   *     jq: allow
   *     rm: deny
   * ```
   *
   * Old format (@deprecated):
   * ```yaml
   * tools:
   *   global:
   *     allow: [read, write]
   * ```
   */
  tools?: ToolsConfig | ToolPermissions;
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
    console.error(`[config] Migrated custom-settings.json → custom-settings.yaml`);
  } catch (err) {
    console.error(`[config] Failed to migrate custom-settings.json: ${err}`);
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
export function updateCustomSettings(updater: (settings: CustomSettings) => CustomSettings): void {
  saveCustomSettings(updater(loadCustomSettings()));
}

// ── Convenience getters ───────────────────────────────────────────────

export function loadAlwaysApprove(): AlwaysApproveConfig {
  return loadCustomSettings().always_approve ?? {};
}

export function loadSubagentConfig(): SubagentConfig {
  return loadCustomSettings().subagent ?? {};
}

export function loadToolsConfig(): ToolsConfig {
  const settings = loadCustomSettings();
  const tools = settings.tools;
  // If tools is the new ToolPermissions format, return empty (no legacy config)
  if (!tools || isToolPermissions(tools)) return {};
  return tools as ToolsConfig;
}

/**
 * Check whether a tools config object is the new {@link ToolPermissions}
 * format (map of tool → permission) rather than the old
 * {@link ToolsConfig} format ({global, agents}).
 */
function isToolPermissions(obj: unknown): obj is ToolPermissions {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
  const keys = Object.keys(obj);
  if (keys.length === 0) return false;
  // Old format has "global" or "agents" keys
  if (keys.includes("global") || keys.includes("agents")) return false;
  // New format: all values are strings ("allow"/"deny"/"ask") or objects (bash sub-map)
  return true;
}

/**
 * Load the new tool permissions map from custom-settings.yaml.
 *
 * Checks the `tools` key first:
 * - If it's the new format ({@link ToolPermissions} map), return it.
 * - If it's the old format ({@link ToolsConfig}), fall through.
 *
 * Then migrates from `always_approve` if present.
 */
export function loadToolPermissions(): ToolPermissions {
  const settings = loadCustomSettings();

  // New format: `tools` as a ToolPermissions map
  if (settings.tools && isToolPermissions(settings.tools)) {
    return settings.tools as ToolPermissions;
  }

  // Migrate from always_approve
  const aa = settings.always_approve;
  if (aa) {
    const perms: ToolPermissions = {};

    if (aa.tools) {
      for (const tool of aa.tools) {
        perms[tool] = "allow";
      }
    }

    if (aa.bashCommands && aa.bashCommands.length > 0) {
      const bashPerms: BashPermissions = {};
      for (const cmd of aa.bashCommands) {
        bashPerms[cmd] = "allow";
      }
      perms["bash"] = bashPerms;
    }

    return perms;
  }

  return {};
}
