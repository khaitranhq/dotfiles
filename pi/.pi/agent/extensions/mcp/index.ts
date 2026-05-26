// index.ts - MCP extension entry point
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { McpExtensionState } from "./core/types";
import { loadMcpConfig } from "./core/config";
import { McpToolRegistry } from "./app/tools";
import { registerMcpSessionHandlers, type McpSessionContext } from "./app/session";
import { mcpAuthCommand } from "./app/commands";

export default function (pi: ExtensionAPI) {
  const sessionCtx: McpSessionContext = {
    state: null,
    initPromise: null,
    generation: 0,
  };

  const getState = (): McpExtensionState | null => sessionCtx.state;
  const getInitPromise = (): Promise<McpExtensionState> | null => sessionCtx.initPromise;

  const config = loadMcpConfig();

  new McpToolRegistry(pi, config, getState, getInitPromise).register();

  registerMcpSessionHandlers(pi, sessionCtx);

  pi.registerCommand("mcp-auth", {
    description: "Authenticate an MCP OAuth server",
    handler: mcpAuthCommand,
  });
}
