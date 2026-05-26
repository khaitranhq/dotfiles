// index.ts - MCP extension entry point
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { McpExtensionState } from "./core/state";
import { loadMcpConfig } from "./config/loader";
import { McpToolRegistry } from "./tools/register";
import { registerMcpSessionHandlers, type McpSessionContext } from "./init/session";
import { createMcpCommand } from "./init/commands";

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

  pi.registerCommand("mcp", {
    description: "Show MCP server status",
    handler: createMcpCommand(getState, getInitPromise),
  });
}
