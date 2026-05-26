// init/commands.ts - MCP slash commands (simplified, no UI panels)
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { McpExtensionState } from "../state.ts";
import type { ServerEntry } from "../types.ts";
import { updateMetadataCache, updateStatusBar, getFailureAgeSeconds } from "./bootstrap.ts";
import { buildToolMetadata } from "../tools/metadata.ts";

export async function showStatus(state: McpExtensionState, _ctx: ExtensionContext): Promise<void> {
  const lines: string[] = ["MCP Server Status:", ""];

  for (const name of Object.keys(state.config.mcpServers)) {
    const connection = state.manager.getConnection(name);
    const metadata = state.toolMetadata.get(name);
    const toolCount = metadata?.length ?? 0;
    const failedAgo = getFailureAgeSeconds(state, name);
    let status = "not connected";
    let statusIcon = "○";

    if (connection?.status === "connected") {
      status = "connected";
      statusIcon = "✓";
    } else if (failedAgo !== null) {
      status = `failed ${failedAgo}s ago`;
      statusIcon = "✗";
    } else if (metadata !== undefined) {
      status = "cached";
    }

    lines.push(
      `${statusIcon} ${name}: ${status} (${toolCount} tools${status === "cached" ? ", cached" : ""})`,
    );
  }

  if (Object.keys(state.config.mcpServers).length === 0) {
    lines.push("No MCP servers configured");
  }

  // Output to console since we don't have ctx.ui
  console.log(lines.join("\n"));
}

export async function showTools(state: McpExtensionState, _ctx: ExtensionContext): Promise<void> {
  const allTools = [...state.toolMetadata.values()].flat().map((m) => m.name);

  if (allTools.length === 0) {
    console.log("No MCP tools available");
    return;
  }

  const lines = [
    "MCP Tools:",
    "",
    ...allTools.map((t) => `  ${t}`),
    "",
    `Total: ${allTools.length} tools`,
  ];

  console.log(lines.join("\n"));
}

export async function reconnectServers(
  state: McpExtensionState,
  targetServer?: string,
): Promise<void> {
  if (targetServer && !state.config.mcpServers[targetServer]) {
    console.error(`Server "${targetServer}" not found in config`);
    return;
  }

  const entries = targetServer
    ? [[targetServer, state.config.mcpServers[targetServer]] as [string, ServerEntry]]
    : Object.entries(state.config.mcpServers);

  for (const [name, definition] of entries) {
    try {
      await state.manager.close(name);
      const connection = await state.manager.connect(name, definition);
      const prefix = state.config.settings?.toolPrefix ?? "server";
      const { metadata } = buildToolMetadata(
        connection.tools,
        connection.resources,
        definition,
        name,
        prefix,
      );
      state.toolMetadata.set(name, metadata);
      updateMetadataCache(state, name);
      state.failureTracker.delete(name);
      console.log(
        `MCP: Reconnected to ${name} (${connection.tools.length} tools, ${connection.resources.length} resources)`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      state.failureTracker.set(name, Date.now());
      console.error(`MCP: Failed to reconnect to ${name}: ${message}`);
    }
  }

  updateStatusBar(state);
}
