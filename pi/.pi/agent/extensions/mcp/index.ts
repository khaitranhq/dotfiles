/**
 * MCP Extension — Model Context Protocol integration for pi.
 *
 * Connects to MCP servers (stdio & SSE transports) and registers their
 * tools as pi tools that the LLM can call.
 *
 * **Token efficiency strategies:**
 *   - `promptSnippet`: concise one-line per tool in tool list
 *   - Truncated results: max 10 KB / 500 lines per tool response
 *   - Lazy schema conversion: unknown schemas → Type.Any() (minimal tokens)
 *   - Connection reuse: clients persist across turns
 *   - No full server metadata in LLM context — only tool name + snippet
 *
 * **Configuration:** ~/.pi/agent/custom-settings.yaml → "mcp" section
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { McpClient } from "./client";
import { mcpLogInfo } from "./logger";
import { loadMcpConfig, DEFAULTS } from "./config";
import { connectAllServers, type ConnectionState } from "./connection";
import {
  registerMcpStatusCommand,
  registerMcpReloadCommand,
  registerMcpAuthCommand,
} from "./commands";
import { registerInputHandler } from "./input-handler";

export default function (pi: ExtensionAPI) {
  // ── Shared mutable state ──────────────────────────────────────────

  const state: ConnectionState = {
    clients: new Map<string, McpClient>(),
    toolMap: new Map<string, { client: McpClient; originalName: string }>(),
    config: { ...DEFAULTS },
  };

  const loadingRef = { current: false };

  // ── Commands ───────────────────────────────────────────────────────

  registerMcpStatusCommand(pi, state);
  registerMcpReloadCommand(pi, state, loadingRef);
  registerMcpAuthCommand(pi, state);

  // ── Lifecycle ──────────────────────────────────────────────────────

  pi.on("session_start", async (_event, ctx) => {
    state.config = loadMcpConfig();

    mcpLogInfo("mcp", "Session started");

    const serverCount = (state.config.servers ?? []).length;

    if (serverCount === 0) {
      mcpLogInfo("mcp", "No servers configured");
      if (ctx.hasUI) {
        ctx.ui.setStatus("mcp", "MCP: no servers configured");
      }
      return;
    }

    mcpLogInfo("mcp", `Connecting to ${serverCount} server(s)...`);
    if (ctx.hasUI) {
      ctx.ui.setStatus("mcp", `MCP: connecting to ${serverCount} server(s)...`);
    }

    await connectAllServers(pi, state, loadingRef, ctx);

    const connectedCount = state.clients.size;
    const toolCount = state.toolMap.size;
    mcpLogInfo("mcp", `${connectedCount}/${serverCount} server(s) connected, ${toolCount} tool(s)`);
    if (ctx.hasUI) {
      ctx.ui.setStatus(
        "mcp",
        `MCP: ${connectedCount}/${serverCount} server(s), ${toolCount} tool(s)`,
      );
    }
  });

  pi.on("session_shutdown", async () => {
    mcpLogInfo("mcp", "Session shutdown — disconnecting all clients");
    for (const [, client] of state.clients) {
      client.disconnect();
    }
    state.clients.clear();
    state.toolMap.clear();
    state.config = { ...DEFAULTS };
  });

  // ── Input handler ──────────────────────────────────────────────────

  registerInputHandler(pi);
}
