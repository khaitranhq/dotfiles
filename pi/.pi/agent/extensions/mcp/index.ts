/**
 * MCP Extension — Full MCP client with automatic OAuth 2.1 support.
 *
 * Connects to MCP servers configured in custom-settings.yaml, discovers
 * their tools, and registers them with pi. Handles OAuth 2.1
 * authorization automatically (DCR, PKCE, token refresh) — no
 * manual OAuth tools required.
 *
 * All MCP tools are registered with "mcp_" prefix.
 * Server connection status is shown in a TUI widget.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Container, Text } from "@earendil-works/pi-tui";
import { AuthStore } from "./auth-store.js";
import { McpClientManager, buildToolParameters, type McpServerStatus } from "./mcp-client.js";

// ─── Extension Entry Point ──────────────────────────────────────────────

export default async function (pi: ExtensionAPI) {
  const authStore = new AuthStore();
  const mcpManager = new McpClientManager(authStore);

  pi.on("session_start", async (_event, ctx) => {
    if (ctx.hasUI) {
      mcpManager.setStatusCallback((statuses) => {
        ctx.ui.setWidget("mcp-status", () => createStatusWidget(statuses));
      });
      ctx.ui.setWidget("mcp-status", () => createStatusWidget([]));
    }

    const tools = await mcpManager.connectAll();

    for (const tool of tools) {
      const params = buildToolParameters(tool.inputSchema);

      pi.registerTool({
        name: tool.name,
        label: `MCP: ${tool.serverName}/${tool.originalName}`,
        description: tool.description || `MCP tool: ${tool.originalName} from ${tool.serverName}`,
        promptSnippet: `${tool.name}: ${tool.description?.slice(0, 80) ?? `MCP tool from ${tool.serverName}`}`,
        promptGuidelines: [
          `Use ${tool.name} for operations on the ${tool.serverName} MCP server. ` +
            (tool.description ? tool.description.slice(0, 200) : ""),
        ],
        parameters: params as any,
        async execute(_toolCallId, args, _signal, _onUpdate, _ctx) {
          const result = await mcpManager.callTool(
            tool.serverName,
            tool.originalName,
            args as Record<string, unknown>,
          );
          return {
            content: result.content,
            details: { serverName: tool.serverName, toolName: tool.originalName },
            isError: result.isError,
          };
        },
      });
    }

    if (tools.length > 0 && ctx.hasUI) {
      ctx.ui.notify(
        `MCP: connected to ${mcpManager.getStatuses().filter((s) => s.status === "connected").length} server(s), ${tools.length} tools registered`,
        "info",
      );
    }
  });

  pi.on("session_shutdown", async () => {
    await mcpManager.disconnectAll();
  });
}

// ─── Status Widget ───────────────────────────────────────────────────────

function createStatusWidget(statuses: McpServerStatus[]): Container {
  const container = new Container();

  if (statuses.length === 0) {
    container.addChild(new Text("  MCP: no servers configured", 0, 0));
    return container;
  }

  for (const s of statuses) {
    const icon = s.status === "connected" ? "●" : s.status === "connecting" ? "◌" : "✕";
    const label =
      `${icon} ${s.name}: ${s.status}` +
      (s.status === "connected" ? ` (${s.toolCount} tools)` : "") +
      (s.error ? ` — ${s.error}` : "");
    container.addChild(new Text(`  ${label}`, 1, 0));
  }

  return container;
}
