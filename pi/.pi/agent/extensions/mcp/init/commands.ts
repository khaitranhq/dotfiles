// init/commands.ts - MCP slash commands (simplified, no UI panels)
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { McpExtensionState } from "../core/state";
import type { ServerEntry } from "../core/types";
import { updateMetadataCache, getFailureAgeSeconds } from "./bootstrap";
import { buildToolMetadata } from "../tools/metadata";
import { OAuthFlow } from "../client/oauth-flow";
import { getOrInitMcpState } from "../core/utils";

// ── Exported ──────────────────────────────────────────────────────────

export function createMcpCommand(
  getState: () => McpExtensionState | null,
  getInitPromise: () => Promise<McpExtensionState> | null,
) {
  return async (args?: string) => {
    const { state, error } = await getOrInitMcpState(getState, getInitPromise);
    if (error || !state) {
      console.error(error ?? "MCP not initialized");
      return;
    }

    const parts = args?.trim()?.split(/\s+/) ?? [];
    const subcommand = parts[0] ?? "";
    const targetServer = parts[1];

    switch (subcommand) {
      case "reconnect":
        await reconnectServers(state, targetServer);
        break;
      case "tools":
        await showTools(state, { hasUI: false } as never);
        break;
      case "auth": {
        if (!targetServer) {
          console.error("Usage: mcp auth <server-name>");
          return;
        }
        const defn = state.config.mcpServers[targetServer];
        if (!defn?.url) {
          console.error(`Server "${targetServer}" not found or not an HTTP server`);
          return;
        }
        try {
          const status = await new OAuthFlow(targetServer).authenticate(defn.url, defn);
          console.log(`MCP Auth: ${targetServer} → ${status}`);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`MCP Auth failed for ${targetServer}: ${message}`);
        }
        break;
      }
      case "logout": {
        if (!targetServer) {
          console.error("Usage: mcp logout <server-name>");
          return;
        }
        try {
          await new OAuthFlow(targetServer).removeAuth();
          console.log(`MCP Auth: Removed credentials for ${targetServer}`);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`MCP logout failed for ${targetServer}: ${message}`);
        }
        break;
      }
      case "status":
      case "":
      default:
        await showStatus(state, { hasUI: false } as never);
        break;
    }
  };
}

// ── Internal ──────────────────────────────────────────────────────────

async function reconnectServers(state: McpExtensionState, targetServer?: string): Promise<void> {
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

async function showStatus(state: McpExtensionState, _ctx: ExtensionContext): Promise<void> {
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

  console.log(lines.join("\n"));
}

async function showTools(state: McpExtensionState, _ctx: ExtensionContext): Promise<void> {
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

function updateStatusBar(_state: McpExtensionState): void {
  // Status bar updates are now no-op (no UI context available).
  // Previously this used state.ui which was removed.
}
