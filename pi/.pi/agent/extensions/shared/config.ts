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

export interface SubagentConfig {
  /** Default agent scope when none is specified. */
  defaultScope?: "user" | "project" | "both";
  /** Default value for confirmProjectAgents. */
  confirmProjectAgents?: boolean;
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

// ── Agent config types ────────────────────────────────────────────────

/**
 * Single agent definition in custom-settings.yaml `agents` map.
 *
 * ```yaml
 * agents:
 *   coder:
 *     mode: subagent
 *     description: General-purpose coding subagent
 *     model: claude-sonnet-4-5
 *     tools:
 *       - read
 *       - bash
 *     prompt: |
 *       You are a coder subagent...
 * ```
 */
export interface AgentYamlDefinition {
  mode: "subagent" | "primary";
  description: string;
  model?: string;
  /** Tool list (array) or permission map (object with allow/deny/ask). */
  tools?: string[] | Record<string, unknown>;
  /** System prompt text. Supports ${file:/path/to/prompt.md} references. */
  prompt: string;
}

/** Agent definitions map keyed by agent name. */
export type AgentsConfig = Record<string, AgentYamlDefinition>;

export interface CustomSettings {
  subagent?: SubagentConfig;
  mcp?: McpYamlConfig;
  agents?: AgentsConfig;
  tools?: ToolPermissions;
  [key: string]: unknown;
}

// ── Path resolution ───────────────────────────────────────────────────

export function getAgentDir(): string {
  return process.env.PI_CODING_AGENT_DIR ?? path.join(os.homedir(), ".pi", "agent");
}

export function getAgentPath(...segments: string[]): string {
  return path.join(getAgentDir(), ...segments);
}

export function configPath(): string {
  return getAgentPath("custom-settings.yaml");
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

export function loadSubagentConfig(): SubagentConfig {
  return loadCustomSettings().subagent ?? {};
}

// ── File reference resolution ─────────────────────────────────────────

/**
 * Resolve `${file:/path/to/file}` references in YAML content.
 * Reads the referenced file and inlines its content.
 */
export function resolveFileRefs(yaml: string, baseDir: string): string {
  return yaml.replace(/\$\{file:([^}]+)\}/g, (_match: string, filePath: string) => {
    const resolved = filePath.startsWith("/") ? filePath : path.join(baseDir, filePath);
    try {
      return fs.readFileSync(resolved, "utf-8");
    } catch {
      console.error(`[config] Failed to resolve file ref: ${resolved}`);
      return `[File not found: ${resolved}]`;
    }
  });
}

// ── Agent config loader ───────────────────────────────────────────────

/**
 * Load agent definitions from custom-settings.yaml `agents` key.
 * Resolves `${file:...}` references in agent prompts.
 */
export function loadAgentsConfig(): AgentsConfig {
  const settings = loadCustomSettings();
  const raw = settings.agents;
  if (!raw) return {};

  // Resolve file references in each agent's prompt
  const baseDir = path.dirname(configPath());
  const resolved: AgentsConfig = {};
  for (const [name, def] of Object.entries(raw)) {
    resolved[name] = {
      ...def,
      prompt: resolveFileRefs(def.prompt, baseDir),
    };
  }
  return resolved;
}

/** Load the tool permissions map from custom-settings.yaml `tools` key. */
export function loadToolPermissions(): ToolPermissions {
  const settings = loadCustomSettings();
  return (settings.tools as ToolPermissions) ?? {};
}
