/**
 * MCP Extension — Full MCP client with automatic OAuth 2.1 support.
 *
 * Connects to MCP servers configured in custom-settings.yaml, discovers
 * their tools, and registers them with pi. Handles OAuth 2.1
 * authorization automatically (DCR, PKCE, token refresh) — no
 * manual OAuth tools required.
 *
 * All MCP tools are registered with "mcp_" prefix.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { AuthStore } from "./auth-store.js";
import { McpClientManager, buildToolParameters } from "./mcp-client.js";
import { Logger } from "../shared/logger.js";
import * as os from "node:os";
import * as path from "node:path";

// ─── Extension Entry Point ──────────────────────────────────────────────

export default async function (pi: ExtensionAPI) {
  const authStore = new AuthStore();
  const logPath = path.join(os.homedir(), ".pi", "agent", "mcp", "mcp.log");
  const logger = new Logger(logPath);
  const mcpManager = new McpClientManager(authStore, logger);

  pi.on("session_start", async (_event, _) => {
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

    // MCP connected silently — sidebar shows status via tool_execution events.
  });

  pi.on("session_shutdown", async () => {
    await mcpManager.disconnectAll();
  });
}
