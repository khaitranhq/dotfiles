/**
 * MCP connection lifecycle — connect, disconnect, tool registration.
 *
 * Manages MCP client instances, registers tools with pi, and handles
 * reconnection logic.
 */
import { Type, type TSchema } from "typebox";
import { Text } from "@earendil-works/pi-tui";
import { truncateHead, formatSize } from "@earendil-works/pi-coding-agent";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { McpClient, type ServerConfig } from "./client";
import { mcpLogInfo, mcpLogError } from "./logger";
import { jsonSchemaToTypeBox } from "./schema";
import type { McpConfig } from "./config";
import { DEFAULTS } from "./config";
import { makeToolName, buildToolDescription, buildPromptSnippet } from "./helpers";

// ── Types ──────────────────────────────────────────────────────────────

/** Shared mutable state for MCP connections. */
export interface ConnectionState {
  clients: Map<string, McpClient>;
  toolMap: Map<string, { client: McpClient; originalName: string }>;
  config: McpConfig;
}

/** Minimal context interface for pi session/input callbacks. */
export interface McpContext {
  hasUI?: boolean;
  cwd?: string;
  ui?: {
    notify?: (msg: string, level?: "info" | "warning" | "error") => void;
    setStatus?: (key: string, status: string) => void;
  };
}

// ── Connection ─────────────────────────────────────────────────────────

export async function connectServer(
  serverConfig: ServerConfig,
  ctx?: McpContext,
): Promise<McpClient | null> {
  const client = new McpClient(serverConfig, serverConfig.timeout ?? 30000);

  client.setLogger((msg) => {
    if (
      msg.includes("error") ||
      msg.includes("fail") ||
      msg.includes("OAuth") ||
      msg.includes("browser") ||
      msg.includes("http://") ||
      msg.includes("https://")
    ) {
      ctx?.ui?.notify?.(msg, "info");
    }
  });

  try {
    await client.connect();
    mcpLogInfo(serverConfig.name, "Connection successful");
    return client;
  } catch (err) {
    const detail = `${(err as any)?.constructor?.name ?? "Error"}: ${(err instanceof Error ? err.message : String(err)) || "(empty)"}${err instanceof Error && err.stack ? "\n" + err.stack : ""}`;
    mcpLogError(serverConfig.name, `Connection failed: ${detail}`);
    ctx?.ui?.notify?.(`MCP server "${serverConfig.name}" connection failed: ${detail}`, "warning");
    client.disconnect();
    return null;
  }
}

// ── Tool registration ──────────────────────────────────────────────────

/**
 * Register all tools from a connected MCP client for the given server.
 * Returns the count of tools registered.
 */
export async function registerServerTools(
  pi: ExtensionAPI,
  client: McpClient,
  serverConfig: ServerConfig,
  state: ConnectionState,
  ctx?: McpContext,
): Promise<number> {
  if (!client.hasTools) {
    ctx?.ui?.notify?.(`MCP server "${serverConfig.name}" connected (no tools)`, "info");
    return 0;
  }

  const tools = await client.listTools();
  if (tools.length === 0) return 0;

  const prefix = state.config.toolPrefix ?? DEFAULTS.toolPrefix;

  for (const mcpTool of tools) {
    const toolName = makeToolName(prefix, serverConfig.name, mcpTool.name);

    const paramSchema: TSchema =
      mcpTool.inputSchema &&
      typeof mcpTool.inputSchema === "object" &&
      Object.keys(mcpTool.inputSchema as Record<string, unknown>).length > 0
        ? jsonSchemaToTypeBox(mcpTool.inputSchema)
        : Type.Object({});

    pi.registerTool({
      name: toolName,
      label: `MCP: ${serverConfig.name}/${mcpTool.name}`,
      description: buildToolDescription(mcpTool),
      promptSnippet: buildPromptSnippet(state.config, mcpTool, serverConfig.name),
      parameters: paramSchema as any,

      async execute(_toolCallId, params, signal, onUpdate, _ctx) {
        const entry = state.toolMap.get(toolName);
        if (!entry) {
          throw new Error(`MCP tool "${toolName}" is no longer available (server disconnected)`);
        }

        if (signal?.aborted) {
          return {
            content: [{ type: "text" as const, text: "Cancelled" }],
            details: { server: serverConfig.name, tool: mcpTool.name, isMcp: true },
          };
        }

        onUpdate?.({
          content: [
            {
              type: "text" as const,
              text: `Calling ${serverConfig.name}/${mcpTool.name}...`,
            },
          ],
          details: { server: serverConfig.name, tool: mcpTool.name, isMcp: true },
        } as any);

        try {
          const result = await entry.client.callTool(
            entry.originalName,
            params as Record<string, unknown>,
            signal ?? undefined,
          );

          const textParts: string[] = [];
          for (const item of result.content) {
            if (item.type === "text" && item.text) {
              textParts.push(item.text);
            } else if (item.type === "resource") {
              textParts.push(`[Resource: ${item.mimeType ?? "unknown"} — not displayed]`);
            } else if (item.type === "image") {
              textParts.push(`[Image: ${item.mimeType ?? "unknown"} — not displayed]`);
            }
          }

          let output = textParts.join("\n");

          const maxBytes = state.config.maxResultBytes ?? DEFAULTS.maxResultBytes;
          const maxLines = state.config.maxResultLines ?? DEFAULTS.maxResultLines;

          if (output) {
            const truncation = truncateHead(output, { maxLines, maxBytes });
            output = truncation.content;

            if (truncation.truncated) {
              output += `\n\n[Output truncated: ${truncation.outputLines} of ${truncation.totalLines} lines`;
              output += ` (${formatSize(truncation.outputBytes)} of ${formatSize(truncation.totalBytes)})]`;
            }
          }

          if (result.isError) {
            throw new Error(output || "MCP tool returned an error");
          }

          return {
            content: [
              {
                type: "text" as const,
                text: output || "(empty result)",
              },
            ],
            details: {
              server: serverConfig.name,
              tool: entry.originalName,
              isMcp: true,
            },
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          throw new Error(`MCP tool "${entry.originalName}" failed: ${msg}`);
        }
      },

      // ── Custom rendering ────────────────────────────────────────
      renderCall(args: unknown, theme: any, _context: any) {
        const shortArgs = JSON.stringify(args).slice(0, 60);
        return new Text(
          theme.fg("toolTitle", theme.bold(`${serverConfig.name}/${mcpTool.name}`)) +
            " " +
            theme.fg("dim", shortArgs.length > 60 ? shortArgs + "..." : shortArgs),
          0,
          0,
        );
      },

      renderResult(
        result: any,
        { expanded }: { expanded?: boolean; isPartial?: boolean },
        theme: any,
        _context: any,
      ) {
        const text = result?.content?.[0]?.text ?? "";
        const shortText = text.slice(0, expanded ? 500 : 100);
        const suffix = !expanded && text.length > 100 ? theme.fg("dim", "...") : "";

        if (result?.isError) {
          return new Text(theme.fg("error", `✗ ${shortText}${suffix}`), 0, 0);
        }

        return new Text(theme.fg("success", `✓ ${shortText}${suffix}`), 0, 0);
      },
    });

    state.toolMap.set(toolName, {
      client,
      originalName: mcpTool.name,
    });
  }

  if (tools.length > 0) {
    ctx?.ui?.notify?.(`MCP: "${serverConfig.name}" — ${tools.length} tool(s) registered`, "info");
  }

  return tools.length;
}

// ── Connect all ────────────────────────────────────────────────────────

export async function connectAllServers(
  pi: ExtensionAPI,
  state: ConnectionState,
  loadingRef: { current: boolean },
  ctx?: McpContext,
): Promise<void> {
  if (loadingRef.current) return;
  loadingRef.current = true;

  try {
    // Disconnect existing clients
    for (const [, client] of state.clients) {
      client.disconnect();
      mcpLogInfo("mcp", `Disconnected from server "${client.info?.name}"`);
    }
    state.clients.clear();
    state.toolMap.clear();

    const servers = state.config.servers ?? [];

    if (servers.length === 0) {
      return;
    }

    // Connect to all servers in parallel
    const results = await Promise.all(servers.map((sc) => connectServer(sc, ctx)));

    let totalTools = 0;

    for (let i = 0; i < servers.length; i++) {
      const client = results[i];
      if (!client) continue;

      const serverConfig = servers[i];
      state.clients.set(serverConfig.name, client);

      try {
        const toolCount = await registerServerTools(pi, client, serverConfig, state, ctx);
        totalTools += toolCount;
        mcpLogInfo(serverConfig.name, `${toolCount} tool(s) registered`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        mcpLogError(serverConfig.name, `Tool listing failed: ${msg}`);
        ctx?.ui?.notify?.(
          `MCP server "${serverConfig.name}" tool listing failed: ${msg}`,
          "warning",
        );
      }
    }

    if (totalTools > 0) {
      ctx?.ui?.notify?.(
        `MCP: ${state.clients.size} server(s), ${totalTools} tool(s) ready`,
        "info",
      );
    }
  } finally {
    loadingRef.current = false;
  }
}
