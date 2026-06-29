/**
 * Shared Config Module
 *
 * Centralised loader for ~/.pi/agent/custom-settings.yaml.
 *
 * Uses YAML format with native comment support.
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
 *   atlassian_*: deny
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

// ── Config class ──────────────────────────────────────────────────────

/**
 * Centralised configuration loader for ~/.pi/agent/custom-settings.yaml.
 *
 * Singleton — use {@link Config.getInstance} or the pre-built
 * {@link defaultConfig} export. The single instance holds an in-memory
 * cache and resolves paths relative to the default agent directory.
 */
export class Config {
  private static instance: Config | null = null;

  private cachedSettings: CustomSettings | null = null;
  private cachedSettingsDir: string | null = null;
  private readonly agentDir: string;

  private constructor() {
    this.agentDir = path.join(os.homedir(), ".pi", "agent");
  }

  /** Return the singleton Config instance, creating it on first call. */
  static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }

  // ── Path helpers ──────────────────────────────────────────────────

  /** Return the agent directory this instance is bound to. */
  getAgentDir(): string {
    return this.agentDir;
  }

  /** Full path to `custom-settings.yaml` in the agent directory. */
  configPath(): string {
    return path.join(this.agentDir, "custom-settings.yaml");
  }

  // ── Cache management ──────────────────────────────────────────────

  /** Invalidate the cached config so the next read reloads from disk. */
  invalidateConfigCache(): void {
    this.cachedSettings = null;
    this.cachedSettingsDir = null;
  }

  // ── Load / Save ───────────────────────────────────────────────────

  /**
   * Parse and return the current settings from custom-settings.yaml.
   * Returns a shallow clone to prevent callers from mutating the cache.
   */
  loadCustomSettings(): CustomSettings {
    if (this.cachedSettings !== null && this.cachedSettingsDir === this.agentDir) {
      return { ...this.cachedSettings };
    }

    const p = this.configPath();

    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, "utf-8");
        this.cachedSettings = (parseYaml(raw) as CustomSettings) ?? {};
        this.cachedSettingsDir = this.agentDir;
        return { ...this.cachedSettings };
      }
    } catch (err) {
      console.error(`[config] Failed to load custom-settings.yaml: ${err}`);
    }
    this.cachedSettings = {};
    this.cachedSettingsDir = this.agentDir;
    return { ...this.cachedSettings };
  }

  /**
   * Atomic read-modify-write helper.
   *
   * Usage:
   *   cfg.updateCustomSettings(s => ({ ...s, always_approve: { ...s.always_approve, tools: ["ls"] } }))
   */
  updateCustomSettings(updater: (settings: CustomSettings) => CustomSettings): void {
    this.saveCustomSettings(updater(this.loadCustomSettings()));
  }

  // ── Convenience getters ───────────────────────────────────────────

  /** Load the `subagent` config section with defaults. */
  loadSubagentConfig(): SubagentConfig {
    return this.loadCustomSettings().subagent ?? {};
  }

  /**
   * Load agent definitions from the `agents` key.
   * Resolves `${file:...}` references in agent prompts.
   */
  loadAgentsConfig(): AgentsConfig {
    const settings = this.loadCustomSettings();
    const raw = settings.agents;
    if (!raw) return {};

    const baseDir = path.dirname(this.configPath());
    const resolved: AgentsConfig = {};
    for (const [name, def] of Object.entries(raw)) {
      resolved[name] = {
        ...def,
        prompt: Config.resolveFileRefs(def.prompt, baseDir),
      };
    }
    return resolved;
  }

  /** Load the tool permissions map from the `tools` key. */
  loadToolPermissions(): ToolPermissions {
    const settings = this.loadCustomSettings();
    return (settings.tools as ToolPermissions) ?? {};
  }

  // ── Static utilities ──────────────────────────────────────────────

  /**
   * Resolve `${file:/path/to/file}` references in YAML content.
   * Reads the referenced file and inlines its content.
   */
  static resolveFileRefs(yaml: string, baseDir: string): string {
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

  /**
   * Serialize settings to custom-settings.yaml and update the cache.
   */
  private saveCustomSettings(settings: CustomSettings): void {
    const p = this.configPath();
    try {
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, stringifyYaml(settings), "utf-8");
      this.cachedSettings = settings;
      this.cachedSettingsDir = this.agentDir;
    } catch (err) {
      console.error(`[config] Failed to save custom-settings.yaml: ${err}`);
    }
  }
}

// ── Default singleton ─────────────────────────────────────────────────

/** Pre-built Config singleton using the default agent directory. */
export const defaultConfig = Config.getInstance();
