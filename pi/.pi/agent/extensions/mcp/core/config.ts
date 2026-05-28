// config.ts - Config loading from custom-settings.yaml
import { defaultConfig } from "../../shared/config";
import type { McpYamlServer } from "../../shared/config";
import type { McpConfig, ServerEntry } from "./types";

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

/**
 * Load MCP config from {@link ~/.pi/agent/custom-settings.yaml} (sole source).
 */
export function loadMcpConfig(): McpConfig {
  const customSettings = defaultConfig.loadCustomSettings();
  if (customSettings.mcp?.servers) {
    return convertYamlMcpToConfig(customSettings.mcp.servers);
  }
  return { mcpServers: {} };
}
