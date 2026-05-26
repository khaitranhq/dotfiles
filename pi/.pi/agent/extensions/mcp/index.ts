// index.ts - MCP extension entry point
import type { ExtensionAPI, ToolInfo } from "@earendil-works/pi-coding-agent";
import type { McpExtensionState } from "./state.ts";
import { Type } from "typebox";
import { showStatus, showTools, reconnectServers } from "./init/commands.ts";
import { loadMcpConfig } from "./config/loader.ts";
import {
  buildProxyDescription,
  createDirectToolExecutor,
  getMissingConfiguredDirectToolServers,
  resolveDirectTools,
} from "./proxy/direct.ts";
import { flushMetadataCache, initializeMcp } from "./init/bootstrap.ts";
import { loadMetadataCache } from "./config/cache.ts";
import {
  executeCall,
  executeConnect,
  executeDescribe,
  executeList,
  executeSearch,
  executeStatus,
} from "./proxy/modes.ts";
import { getConfigPathFromArgv, truncateAtWord } from "./utils.ts";
import {
  createMcpDirectToolCallRenderer,
  renderMcpProxyToolCall,
  renderMcpToolResult,
} from "./tools/renderer.ts";
import { shutdownOAuth, authenticate, removeAuth } from "./client/oauth-flow.ts";

export default function mcpAdapter(pi: ExtensionAPI) {
  let state: McpExtensionState | null = null;
  let initPromise: Promise<McpExtensionState> | null = null;
  let lifecycleGeneration = 0;

  async function shutdownState(currentState: McpExtensionState | null): Promise<void> {
    if (!currentState) return;

    try {
      flushMetadataCache(currentState);
    } catch (error) {
      console.error("MCP: metadata flush failed during shutdown", error);
    }

    try {
      await currentState.lifecycle.gracefulShutdown();
    } catch (error) {
      console.error("MCP: graceful shutdown failed", error);
    }

    try {
      await shutdownOAuth();
    } catch (error) {
      console.error("MCP: OAuth shutdown failed", error);
    }
  }

  const earlyConfigPath = getConfigPathFromArgv();
  const earlyConfig = loadMcpConfig(earlyConfigPath);
  const earlyCache = loadMetadataCache();
  const prefix = earlyConfig.settings?.toolPrefix ?? "server";

  const envRaw = process.env.MCP_DIRECT_TOOLS;
  const directSpecs =
    envRaw === "__none__"
      ? []
      : resolveDirectTools(
          earlyConfig,
          earlyCache,
          prefix,
          envRaw
            ?.split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        );
  const missingConfiguredDirectToolServers = getMissingConfiguredDirectToolServers(
    earlyConfig,
    earlyCache,
  );
  const shouldRegisterProxyTool =
    earlyConfig.settings?.disableProxyTool !== true ||
    directSpecs.length === 0 ||
    missingConfiguredDirectToolServers.length > 0;

  for (const spec of directSpecs) {
    (pi.registerTool as (tool: unknown) => unknown)({
      name: spec.prefixedName,
      label: `MCP: ${spec.originalName}`,
      description: spec.description || "(no description)",
      promptSnippet: truncateAtWord(spec.description, 100) || `MCP tool from ${spec.serverName}`,
      parameters: Type.Unsafe((spec.inputSchema || { type: "object", properties: {} }) as never),
      execute: createDirectToolExecutor(
        () => state,
        () => initPromise,
        spec,
      ),
      renderCall: createMcpDirectToolCallRenderer(spec.prefixedName),
      renderResult: renderMcpToolResult,
    });
  }

  const getPiTools = (): ToolInfo[] => pi.getAllTools();

  pi.registerFlag("mcp-config", {
    description: "Path to MCP config file",
    type: "string",
  });

  pi.on("session_start", async (_event, ctx) => {
    const generation = ++lifecycleGeneration;
    const previousState = state;
    state = null;
    initPromise = null;

    try {
      await shutdownState(previousState);
    } catch (error) {
      console.error("MCP: failed to shut down previous session state", error);
    }

    if (generation !== lifecycleGeneration) {
      return;
    }

    const promise = initializeMcp(pi, ctx);
    initPromise = promise;

    promise
      .then(async (nextState) => {
        if (generation !== lifecycleGeneration || initPromise !== promise) {
          try {
            await shutdownState(nextState);
          } catch (error) {
            console.error("MCP: failed to clean stale session state", error);
          }
          return;
        }

        state = nextState;
        initPromise = null;
      })
      .catch((err) => {
        if (generation !== lifecycleGeneration) {
          return;
        }
        if (initPromise !== promise && initPromise !== null) {
          return;
        }
        console.error("MCP initialization failed:", err);
        initPromise = null;
      });
  });

  pi.on("session_shutdown", async () => {
    ++lifecycleGeneration;
    const currentState = state;
    state = null;
    initPromise = null;

    try {
      await shutdownState(currentState);
    } catch (error) {
      console.error("MCP: session shutdown cleanup failed", error);
    }
  });

  pi.registerCommand("mcp", {
    description: "Show MCP server status",
    handler: async (args) => {
      if (!state && initPromise) {
        try {
          state = await initPromise;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`MCP initialization failed: ${message}`);
          return;
        }
      }
      if (!state) {
        console.error("MCP not initialized");
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
            const status = await authenticate(targetServer, defn.url, defn);
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
            await removeAuth(targetServer);
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
    },
  });

  if (shouldRegisterProxyTool) {
    (pi.registerTool as (tool: unknown) => unknown)({
      name: "mcp",
      label: "MCP",
      description: buildProxyDescription(earlyConfig, earlyCache, directSpecs),
      promptSnippet: "MCP gateway - connect to MCP servers and call their tools",
      renderCall: renderMcpProxyToolCall,
      parameters: Type.Object({
        tool: Type.Optional(
          Type.String({ description: "Tool name to call (e.g., 'xcodebuild_list_sims')" }),
        ),
        args: Type.Optional(
          Type.String({ description: 'Arguments as JSON string (e.g., \'{"key": "value"}\')' }),
        ),
        connect: Type.Optional(
          Type.String({ description: "Server name to connect (lazy connect + metadata refresh)" }),
        ),
        describe: Type.Optional(
          Type.String({ description: "Tool name to describe (shows parameters)" }),
        ),
        search: Type.Optional(Type.String({ description: "Search tools by name/description" })),
        regex: Type.Optional(
          Type.Boolean({ description: "Treat search as regex (default: substring match)" }),
        ),
        includeSchemas: Type.Optional(
          Type.Boolean({
            description: "Include parameter schemas in search results (default: true)",
          }),
        ),
        server: Type.Optional(
          Type.String({ description: "Filter to specific server (also disambiguates tool calls)" }),
        ),
      }),
      renderResult: renderMcpToolResult,
      async execute(
        _toolCallId: string,
        params: {
          tool?: string;
          args?: string;
          connect?: string;
          describe?: string;
          search?: string;
          regex?: boolean;
          includeSchemas?: boolean;
          server?: string;
        },
      ) {
        let parsedArgs: Record<string, unknown> | undefined;
        if (params.args) {
          try {
            parsedArgs = JSON.parse(params.args);
            if (
              typeof parsedArgs !== "object" ||
              parsedArgs === null ||
              Array.isArray(parsedArgs)
            ) {
              const gotType = Array.isArray(parsedArgs)
                ? "array"
                : parsedArgs === null
                  ? "null"
                  : typeof parsedArgs;
              throw new Error(`Invalid args: expected a JSON object, got ${gotType}`);
            }
          } catch (error) {
            if (error instanceof SyntaxError) {
              throw new Error(`Invalid args JSON: ${error.message}`, { cause: error });
            }
            throw error;
          }
        }

        if (!state && initPromise) {
          try {
            state = await initPromise;
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return {
              content: [{ type: "text" as const, text: `MCP initialization failed: ${message}` }],
              details: { error: "init_failed", message },
            };
          }
        }
        if (!state) {
          return {
            content: [{ type: "text" as const, text: "MCP not initialized" }],
            details: { error: "not_initialized" },
          };
        }

        if (params.tool) {
          return executeCall(state, params.tool, parsedArgs, params.server, getPiTools);
        }
        if (params.connect) {
          return executeConnect(state, params.connect);
        }
        if (params.describe) {
          return executeDescribe(state, params.describe);
        }
        if (params.search) {
          return executeSearch(
            state,
            params.search,
            params.regex,
            params.server,
            params.includeSchemas,
          );
        }
        if (params.server) {
          return executeList(state, params.server);
        }
        return executeStatus(state);
      },
    });
  }
}
