// proxy/direct.ts - Tool registration and execution
import type {
  AgentToolResult,
  AgentToolUpdateCallback,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type { McpExtensionState } from "../core/state.ts";
import type { RegisteredTool, McpConfig, McpContent } from "../core/types.ts";
import type { MetadataCache } from "../config/cache.ts";
import { lazyConnect, getFailureAgeSeconds } from "../init/bootstrap.ts";
import { isServerCacheValid } from "../config/cache.ts";
import { formatSchema } from "../tools/metadata.ts";
import { transformMcpContent } from "../tools/registrar.ts";
import { resourceNameToToolName } from "../tools/resources.ts";
import { formatToolName, isToolExcluded } from "../core/types.ts";
import { getOrInitMcpState } from "../core/utils.ts";

const BUILTIN_NAMES = new Set(["read", "bash", "edit", "write", "grep", "find", "ls", "mcp"]);

export function resolveTools(
  config: McpConfig,
  cache: MetadataCache | null,
  prefix: "server" | "none" | "short",
  envOverride?: string[],
): RegisteredTool[] {
  const specs: RegisteredTool[] = [];
  if (!cache) return specs;

  const seenNames = new Set<string>();

  const envServers = new Set<string>();
  const envTools = new Map<string, Set<string>>();
  if (envOverride) {
    for (let item of envOverride) {
      item = item.replace(/\/+$/, "");
      if (item.includes("/")) {
        const [server, tool] = item.split("/", 2);
        if (server && tool) {
          if (!envTools.has(server)) envTools.set(server, new Set());
          envTools.get(server)!.add(tool);
        } else if (server) {
          envServers.add(server);
        }
      } else if (item) {
        envServers.add(item);
      }
    }
  }

  const globalFilter = config.settings?.directTools;

  for (const [serverName, definition] of Object.entries(config.mcpServers)) {
    const serverCache = cache.servers[serverName];
    if (!serverCache || !isServerCacheValid(serverCache, definition)) continue;

    let toolFilter: true | string[] | false = false;

    if (envOverride) {
      if (envServers.has(serverName)) {
        toolFilter = true;
      } else if (envTools.has(serverName)) {
        toolFilter = [...envTools.get(serverName)!];
      }
    } else {
      if (definition.directTools !== undefined) {
        toolFilter = definition.directTools;
      } else if (globalFilter) {
        toolFilter = globalFilter;
      }
    }

    if (!toolFilter) continue;

    for (const tool of serverCache.tools ?? []) {
      if (toolFilter !== true && !toolFilter.includes(tool.name)) continue;
      if (isToolExcluded(tool.name, serverName, prefix, definition.excludeTools)) continue;
      const prefixedName = formatToolName(tool.name, serverName, prefix);
      if (BUILTIN_NAMES.has(prefixedName)) {
        console.warn(`MCP: skipping tool "${prefixedName}" (collides with builtin)`);
        continue;
      }
      if (seenNames.has(prefixedName)) {
        console.warn(`MCP: skipping duplicate tool "${prefixedName}" from "${serverName}"`);
        continue;
      }
      seenNames.add(prefixedName);
      specs.push({
        serverName,
        originalName: tool.name,
        prefixedName,
        description: tool.description ?? "",
        inputSchema: tool.inputSchema,
      });
    }

    if (definition.exposeResources !== false) {
      for (const resource of serverCache.resources ?? []) {
        const baseName = `get_${resourceNameToToolName(resource.name)}`;
        if (toolFilter !== true && !toolFilter.includes(baseName)) continue;
        if (isToolExcluded(baseName, serverName, prefix, definition.excludeTools)) continue;
        const prefixedName = formatToolName(baseName, serverName, prefix);
        if (BUILTIN_NAMES.has(prefixedName)) {
          console.warn(`MCP: skipping resource tool "${prefixedName}" (collides with builtin)`);
          continue;
        }
        if (seenNames.has(prefixedName)) {
          console.warn(
            `MCP: skipping duplicate resource tool "${prefixedName}" from "${serverName}"`,
          );
          continue;
        }
        seenNames.add(prefixedName);
        specs.push({
          serverName,
          originalName: baseName,
          prefixedName,
          description: resource.description ?? `Read resource: ${resource.uri}`,
          resourceUri: resource.uri,
        });
      }
    }
  }

  return specs;
}

export function getMissingConfiguredToolServers(
  config: McpConfig,
  cache: MetadataCache | null,
): string[] {
  const missing: string[] = [];
  const globalFilter = config.settings?.directTools;

  for (const [serverName, definition] of Object.entries(config.mcpServers)) {
    const hasConfiguredTools =
      definition.directTools !== undefined ? !!definition.directTools : !!globalFilter;

    if (!hasConfiguredTools) continue;

    const serverCache = cache?.servers?.[serverName];
    if (!serverCache || !isServerCacheValid(serverCache, definition)) {
      missing.push(serverName);
    }
  }

  return missing;
}

type ToolExecutor = (
  toolCallId: string,
  params: Record<string, unknown>,
  signal: AbortSignal | undefined,
  onUpdate: AgentToolUpdateCallback<Record<string, unknown>> | undefined,
  ctx: ExtensionContext,
) => Promise<AgentToolResult<Record<string, unknown>>>;

export function createToolExecutor(
  getState: () => McpExtensionState | null,
  getInitPromise: () => Promise<McpExtensionState> | null,
  spec: RegisteredTool,
): ToolExecutor {
  return async function execute(_toolCallId, params) {
    const { state, error } = await getOrInitMcpState(getState, getInitPromise);
    if (error || !state) {
      return {
        content: [{ type: "text" as const, text: error ?? "MCP not initialized" }],
        details: { error: "init_failed" },
      };
    }

    const connected = await lazyConnect(state, spec.serverName);

    if (!connected) {
      const failedAgo = getFailureAgeSeconds(state, spec.serverName);
      return {
        content: [
          {
            type: "text" as const,
            text: `MCP server "${spec.serverName}" not available${failedAgo !== null ? ` (failed ${failedAgo}s ago)` : ""}`,
          },
        ],
        details: { error: "server_unavailable", server: spec.serverName },
      };
    }

    const connection = state.manager.getConnection(spec.serverName);
    if (!connection || connection.status !== "connected") {
      return {
        content: [{ type: "text" as const, text: `MCP server "${spec.serverName}" not connected` }],
        details: { error: "not_connected", server: spec.serverName },
      };
    }

    try {
      state.manager.touch(spec.serverName);
      state.manager.incrementInFlight(spec.serverName);

      if (spec.resourceUri) {
        const result = await connection.client.readResource({ uri: spec.resourceUri });
        const content = (result.contents ?? []).map((c) => ({
          type: "text" as const,
          text:
            "text" in c
              ? c.text
              : "blob" in c
                ? `[Binary data: ${(c as { mimeType?: string }).mimeType ?? "unknown"}]`
                : JSON.stringify(c),
        }));
        return {
          content:
            content.length > 0 ? content : [{ type: "text" as const, text: "(empty resource)" }],
          details: { server: spec.serverName, resourceUri: spec.resourceUri },
        };
      }

      const result = await connection.client.callTool({
        name: spec.originalName,
        arguments: params ?? {},
      });

      const mcpContent = (result.content ?? []) as McpContent[];
      const content = transformMcpContent(mcpContent);

      if (result.isError) {
        let errorText =
          content
            .filter((c: { type: string; text?: string }) => c.type === "text")
            .map((c: { type: string; text?: string }) => (c as { text: string }).text)
            .join("\n") || "Tool execution failed";
        if (spec.inputSchema) {
          errorText += `\n\nExpected parameters:\n${formatSchema(spec.inputSchema)}`;
        }
        return {
          content: [{ type: "text" as const, text: `Error: ${errorText}` }],
          details: { error: "tool_error", server: spec.serverName },
        };
      }

      return {
        content: content.length > 0 ? content : [{ type: "text" as const, text: "(empty result)" }],
        details: { server: spec.serverName, tool: spec.originalName },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      let errorText = `Failed to call tool: ${message}`;
      if (spec.inputSchema) {
        errorText += `\n\nExpected parameters:\n${formatSchema(spec.inputSchema)}`;
      }
      return {
        content: [{ type: "text" as const, text: errorText }],
        details: { error: "call_failed", server: spec.serverName },
      };
    } finally {
      state.manager.decrementInFlight(spec.serverName);
      state.manager.touch(spec.serverName);
    }
  };
}
