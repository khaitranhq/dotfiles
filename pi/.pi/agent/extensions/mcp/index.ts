// index.ts - MCP extension entry point
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { McpExtensionState } from "./core/state.ts";
import { loadMcpConfig } from "./config/loader.ts";
import { McpToolRegistry } from "./tools/register.ts";
import { registerMcpSessionHandlers, type McpSessionContext } from "./init/session.ts";
import { createMcpCommand } from "./init/commands.ts";

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
