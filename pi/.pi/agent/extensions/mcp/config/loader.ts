// config/loader.ts - Config loading without import support
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { getAgentPath } from "../../shared/config";
import { loadCustomSettings } from "../../shared/config";
import type { McpYamlServer } from "../../shared/config";
import type { McpConfig, ServerEntry, McpSettings } from "../core/types";

const GENERIC_GLOBAL_CONFIG_PATH = join(homedir(), ".config", "mcp", "mcp.json");
const PROJECT_CONFIG_NAME = ".mcp.json";
const PROJECT_PI_CONFIG_NAME = ".pi/mcp.json";

// -- Config sources (layered: standard → Pi overrides) --

interface ConfigSourceSpec {
  id: string;
  label: string;
  readPath: string;
  shared: boolean;
}

// -- Exported functions --

/**
 * Converts MCP servers from the custom-settings.yaml array format
 * to the {@link McpConfig} keyed-object format.
 *
 * Strips `name` (becomes the key) and `transport` (inferred from
 * presence of `url` vs `command`).
 */
export function convertYamlMcpToConfig(servers: McpYamlServer[] | undefined): McpConfig {
  if (!servers || servers.length === 0) {
    return { mcpServers: {} };
  }

  const mcpServers: Record<string, ServerEntry> = {};

  for (const server of servers) {
    if (!server.name) continue;

    const { name, transport: _transport, ...entry } = server;
    mcpServers[name] = entry as ServerEntry;
  }

  return { mcpServers };
}

export function loadMcpConfig(overridePath?: string, cwd = process.cwd()): McpConfig {
  let config: McpConfig = { mcpServers: {} };

  for (const source of getConfigSources(overridePath, cwd)) {
    const loaded = readValidatedConfig(source.readPath);
    if (!loaded) continue;
    config = mergeConfigs(config, loaded);
  }

  // Merge MCP servers from custom-settings.yaml (overrides JSON configs)
  const customSettings = loadCustomSettings();
  if (customSettings.mcp?.servers) {
    config = mergeConfigs(config, convertYamlMcpToConfig(customSettings.mcp.servers));
  }

  return config;
}

// -- Internal helpers --

function getConfigSources(overridePath?: string, cwd = process.cwd()): ConfigSourceSpec[] {
  const userPath = getPiGlobalConfigPath(overridePath);
  const projectPath = getProjectConfigPath(cwd);
  const projectPiPath = getProjectPiConfigPath(cwd);
  const sources: ConfigSourceSpec[] = [];

  if (GENERIC_GLOBAL_CONFIG_PATH !== userPath) {
    sources.push({
      id: "shared-global",
      label: "user-global standard MCP",
      readPath: GENERIC_GLOBAL_CONFIG_PATH,
      shared: true,
    });
  }

  sources.push({
    id: "pi-global",
    label: "Pi global override",
    readPath: userPath,
    shared: false,
  });

  if (projectPath !== userPath) {
    sources.push({
      id: "shared-project",
      label: "project standard MCP",
      readPath: projectPath,
      shared: true,
    });
  }

  if (projectPiPath !== userPath && projectPiPath !== projectPath) {
    sources.push({
      id: "pi-project",
      label: "project Pi override",
      readPath: projectPiPath,
      shared: false,
    });
  }

  return sources;
}

function getPiGlobalConfigPath(overridePath?: string): string {
  return overridePath ? resolve(overridePath) : getAgentPath("mcp.json");
}

function getProjectConfigPath(cwd = process.cwd()): string {
  return resolve(cwd, PROJECT_CONFIG_NAME);
}

function getProjectPiConfigPath(cwd = process.cwd()): string {
  return resolve(cwd, PROJECT_PI_CONFIG_NAME);
}

function mergeConfigs(base: McpConfig, next: McpConfig): McpConfig {
  return {
    mcpServers: { ...base.mcpServers, ...next.mcpServers },
    settings: next.settings ? { ...base.settings, ...next.settings } : base.settings,
  };
}

function readValidatedConfig(path: string): McpConfig | null {
  if (!existsSync(path)) return null;

  try {
    return validateConfig(JSON.parse(readFileSync(path, "utf-8")));
  } catch (error) {
    console.warn(`Failed to load MCP config from ${path}:`, error);
    return null;
  }
}

function validateConfig(raw: unknown): McpConfig {
  if (!raw || typeof raw !== "object") {
    return { mcpServers: {} };
  }

  const obj = raw as Record<string, unknown>;
  const servers = obj.mcpServers ?? obj["mcp-servers"] ?? {};

  if (typeof servers !== "object" || servers === null || Array.isArray(servers)) {
    return { mcpServers: {} };
  }

  return {
    mcpServers: servers as Record<string, ServerEntry>,
    settings: obj.settings as McpSettings | undefined,
  };
}
