/**
 * app/tools.ts — MCP tool registration, execution, and metadata.
 *
 * Merges: proxy/direct.ts + tools/register.ts + tools/metadata.ts + tools/resources.ts
 */

import type {
  AgentToolResult,
  AgentToolUpdateCallback,
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { McpExtensionState } from "../core/types";
import type {
  RegisteredTool,
  McpConfig,
  McpTool,
  McpResource,
  McpContent,
  ContentBlock,
  ServerEntry,
  ToolMetadata,
} from "../core/types";
import { formatToolName, isToolExcluded } from "../core/types";
import { OAuthFlow, supportsOAuth } from "../client/oauth";
import type { MetadataCache } from "../core/cache";
import { MetadataCacheManager } from "../core/cache";
import { isServerCacheValid } from "../core/cache";
import { lazyConnect, getFailureAgeSeconds } from "./bootstrap";
import { getOrInitMcpState } from "../core/utils";
import { truncateAtWord } from "../../shared/text-utils";

// ═══════════════════════════════════════════════════════════════════════
// Resource name utilities (was tools/resources.ts)
// ═══════════════════════════════════════════════════════════════════════

export function resourceNameToToolName(name: string): string {
  let result = name
    .replace(/[^a-zA-Z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+/, "")
    .replace(/_+$/, "")
    .toLowerCase();

  if (!result || /^\d/.test(result)) {
    result = "resource" + (result ? "_" + result : "");
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════
// Tool metadata builder (was tools/metadata.ts)
// ═══════════════════════════════════════════════════════════════════════

export function buildToolMetadata(
  tools: McpTool[],
  resources: McpResource[],
  definition: ServerEntry,
  serverName: string,
  prefix: "server" | "none" | "short",
): { metadata: ToolMetadata[]; failedTools: string[] } {
  const metadata: ToolMetadata[] = [];
  const failedTools: string[] = [];

  for (const tool of tools) {
    if (!tool?.name) {
      failedTools.push("(unnamed)");
      continue;
    }
    if (isToolExcluded(tool.name, serverName, prefix, definition.excludeTools)) {
      continue;
    }

    metadata.push({
      name: formatToolName(tool.name, serverName, prefix),
      originalName: tool.name,
      description: tool.description ?? "",
      inputSchema: tool.inputSchema,
    });
  }

  if (definition.exposeResources !== false) {
    for (const resource of resources) {
      const baseName = `get_${resourceNameToToolName(resource.name)}`;
      if (isToolExcluded(baseName, serverName, prefix, definition.excludeTools)) {
        continue;
      }

      metadata.push({
        name: formatToolName(baseName, serverName, prefix),
        originalName: baseName,
        description: resource.description ?? `Read resource: ${resource.uri}`,
        resourceUri: resource.uri,
      });
    }
  }

  return { metadata, failedTools };
}

// ═══════════════════════════════════════════════════════════════════════
// Tool resolution (was proxy/direct.ts — resolveTools)
// ═══════════════════════════════════════════════════════════════════════

const BUILTIN_NAMES = new Set(["read", "bash", "edit", "write", "grep", "find", "ls", "mcp"]);

type _ToolExecutor = (
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
): _ToolExecutor {
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

    // Proactive OAuth token check — attempt refresh before the 401 round trip.
    const definition = state.config.mcpServers[spec.serverName];
    if (definition?.url && supportsOAuth(definition)) {
      const flow = new OAuthFlow(spec.serverName, definition.url, definition);
      if (flow.authStatus === "expired") {
        const refreshed = await flow.validToken();
        if (refreshed === null) {
          return {
            content: [
              {
                type: "text" as const,
                text:
                  `OAuth token expired for MCP server "${spec.serverName}". ` +
                  `Run /mcp-auth ${spec.serverName} to re-authenticate.`,
              },
            ],
            details: { error: "oauth_expired", server: spec.serverName },
          };
        }
      }
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
      } else if (globalFilter !== undefined) {
        toolFilter = globalFilter;
      } else {
        toolFilter = true;
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

// ── Schema formatting ────────────────────────────────────────────────

function formatProperty(name: string, schema: unknown, required: boolean, indent: string): string {
  if (!schema || typeof schema !== "object") {
    return `${indent}${name}${required ? " *required*" : ""}`;
  }

  const s = schema as Record<string, unknown>;
  const parts: string[] = [];

  let typeStr = "";
  if (s.type) {
    if (Array.isArray(s.type)) {
      typeStr = s.type.join(" | ");
    } else {
      typeStr = String(s.type);
    }
  } else if (s.enum) {
    typeStr = "enum";
  } else if (s.anyOf || s.oneOf) {
    typeStr = "union";
  }

  if (Array.isArray(s.enum)) {
    const enumVals = s.enum.map((v) => JSON.stringify(v)).join(", ");
    typeStr = `enum: ${enumVals}`;
  }

  parts.push(`${indent}${name}`);
  if (typeStr) parts.push(`(${typeStr})`);
  if (required) parts.push("*required*");

  if (s.description && typeof s.description === "string") {
    parts.push(`- ${s.description}`);
  }

  if (s.default !== undefined) {
    parts.push(`[default: ${JSON.stringify(s.default)}]`);
  }

  return parts.join(" ");
}

function formatSchema(schema: unknown, indent = "  "): string {
  if (!schema || typeof schema !== "object") {
    return `${indent}(no schema)`;
  }

  const s = schema as Record<string, unknown>;

  if (s.type === "object" && s.properties && typeof s.properties === "object") {
    const props = s.properties as Record<string, unknown>;
    const required = Array.isArray(s.required) ? (s.required as string[]) : [];

    if (Object.keys(props).length === 0) {
      return `${indent}(no parameters)`;
    }

    const lines: string[] = [];
    for (const [name, propSchema] of Object.entries(props)) {
      const isRequired = required.includes(name);
      const propLine = formatProperty(name, propSchema, isRequired, indent);
      lines.push(propLine);
    }
    return lines.join("\n");
  }

  if (s.type) {
    return `${indent}(${s.type})`;
  }

  return `${indent}(complex schema)`;
}

// ── MCP content transformation ──────────────────────────────────────

function transformMcpContent(content: McpContent[]): ContentBlock[] {
  return content.map((c) => {
    if (c.type === "text") {
      return { type: "text" as const, text: c.text ?? "" };
    }
    if (c.type === "image") {
      return {
        type: "image" as const,
        data: c.data ?? "",
        mimeType: c.mimeType ?? "image/png",
      };
    }
    if (c.type === "resource") {
      const resourceUri = c.resource?.uri ?? "(no URI)";
      const resourceContent =
        c.resource?.text ?? (c.resource ? JSON.stringify(c.resource) : "(no content)");
      return {
        type: "text" as const,
        text: `[Resource: ${resourceUri}]\n${resourceContent}`,
      };
    }
    if (c.type === "resource_link") {
      const linkName = c.name ?? c.uri ?? "unknown";
      const linkUri = c.uri ?? "(no URI)";
      return {
        type: "text" as const,
        text: `[Resource Link: ${linkName}]\nURI: ${linkUri}`,
      };
    }
    if (c.type === "audio") {
      return {
        type: "text" as const,
        text: `[Audio content: ${c.mimeType ?? "audio/*"}]`,
      };
    }
    return { type: "text" as const, text: JSON.stringify(c) };
  });
}

// ═══════════════════════════════════════════════════════════════════════
// Tool registry (was tools/register.ts)
// ═══════════════════════════════════════════════════════════════════════

export class McpToolRegistry {
  private cache = new MetadataCacheManager();
  private prefix: "server" | "none" | "short";

  constructor(
    private pi: ExtensionAPI,
    private config: McpConfig,
    private getState: () => McpExtensionState | null,
    private getInitPromise: () => Promise<McpExtensionState> | null,
  ) {
    this.prefix = config.settings?.toolPrefix ?? "server";
  }

  register(): void {
    const cache = this.cache.load();
    const envRaw = process.env.MCP_DIRECT_TOOLS;
    const specs =
      envRaw === "__none__"
        ? []
        : resolveTools(
            this.config,
            cache,
            this.prefix,
            envRaw
              ?.split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          );

    for (const spec of specs) {
      this.pi.registerTool({
        name: spec.prefixedName,
        label: `MCP: ${spec.originalName}`,
        description: spec.description || "(no description)",
        promptSnippet: truncateAtWord(spec.description, 100) || `MCP tool from ${spec.serverName}`,
        parameters: Type.Unsafe((spec.inputSchema || { type: "object", properties: {} }) as never),
        execute: createToolExecutor(this.getState, this.getInitPromise, spec),
      });
    }
  }
}
