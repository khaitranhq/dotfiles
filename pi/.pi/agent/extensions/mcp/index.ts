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
 * **Configuration:** ~/.pi/agent/custom-settings.json → "mcp" section
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  truncateHead,
  formatSize,
} from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type, type TSchema } from "typebox";

import {
  McpClient,
  type McpTool,
  type ServerConfig,
  McpError,
} from "./mcp-client";
import { jsonSchemaToTypeBox, describeSchema } from "./schema";
import { discoverAgents, type AgentConfig } from "../subagent/agents";

// ── Types ──────────────────────────────────────────────────────────────

interface McpConfig {
  servers?: ServerConfig[];
  /** Prefix for registered tool names. Default: "mcp" */
  toolPrefix?: string;
  /** Max result bytes before truncation. Default: 10240 (10 KB). */
  maxResultBytes?: number;
  /** Max result lines before truncation. Default: 500. */
  maxResultLines?: number;
  /** Whether to attempt reconnection on failure. Default: true. */
  reconnectEnabled?: boolean;
  /** Max reconnection attempts. Default: 3. */
  reconnectMaxRetries?: number;
}

interface McpSettingsFile {
  mcp?: McpConfig;
}

// ── Constants ──────────────────────────────────────────────────────────

const CONFIG_PATH = path.join(os.homedir(), ".pi", "agent", "custom-settings.json");

const DEFAULTS: Required<McpConfig> = {
  servers: [],
  toolPrefix: "mcp",
  maxResultBytes: 10240, // 10 KB — aggressive for token efficiency
  maxResultLines: 500,
  reconnectEnabled: true,
  reconnectMaxRetries: 3,
};

// ── Helpers ────────────────────────────────────────────────────────────

/** Sanitize a name for use in tool identifiers: keep only [a-zA-Z0-9_]. */
function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "").toLowerCase();
}

/** Build a prefixed tool name: "<prefix>_<server>_<tool>" */
function makeToolName(prefix: string, serverName: string, toolName: string): string {
  return `${prefix}_${sanitizeName(serverName)}_${sanitizeName(toolName)}`;
}

/**
 * Build a concise tool description that includes the MCP tool's description
 * and parameter schema in a compact format for the LLM.
 *
 * Token-efficient: only includes what the LLM needs to make correct calls.
 */
function buildToolDescription(mcpTool: McpTool): string {
  let desc = mcpTool.description ?? mcpTool.name;

  // Append compact param schema if available (not for empty schemas)
  const hasParams =
    mcpTool.inputSchema &&
    typeof mcpTool.inputSchema === "object" &&
    Object.keys(mcpTool.inputSchema as Record<string, unknown>).length > 0;

  if (hasParams) {
    const compactSchema = describeSchema(mcpTool.inputSchema);
    // Only append if the schema description is not too long
    if (compactSchema.length <= 300) {
      desc += `\nParams: ${compactSchema}`;
    }
  }

  return desc;
}

/**
 * Build a concise prompt snippet (one line) for the system-prompt tool list.
 * Keeps the tool list compact even with dozens of MCP tools.
 */
function buildPromptSnippet(config: McpConfig, mcpTool: McpTool, serverName: string): string {
  const shortDesc = (mcpTool.description ?? mcpTool.name).split("\n")[0].slice(0, 80);
  const prefix = config.toolPrefix ?? DEFAULTS.toolPrefix;
  const fullName = makeToolName(prefix, serverName, mcpTool.name);
  return `${fullName}: ${shortDesc}`;
}

// ── Config loading ─────────────────────────────────────────────────────

function loadMcpConfig(): McpConfig {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      return { ...DEFAULTS };
    }

    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    const settings = JSON.parse(raw) as McpSettingsFile;

    if (!settings.mcp) {
      return { ...DEFAULTS };
    }

    return {
      toolPrefix: settings.mcp.toolPrefix ?? DEFAULTS.toolPrefix,
      maxResultBytes: settings.mcp.maxResultBytes ?? DEFAULTS.maxResultBytes,
      maxResultLines: settings.mcp.maxResultLines ?? DEFAULTS.maxResultLines,
      reconnectEnabled:
        settings.mcp.reconnectEnabled ?? DEFAULTS.reconnectEnabled,
      reconnectMaxRetries:
        settings.mcp.reconnectMaxRetries ?? DEFAULTS.reconnectMaxRetries,
      servers: settings.mcp.servers ?? [],
    };
  } catch (err) {
    console.error(
      `[mcp] Failed to load config from ${CONFIG_PATH}: ${err}`,
    );
    return { ...DEFAULTS };
  }
}

// ── Main Extension ─────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  // ── State ──────────────────────────────────────────────────────────

  /** Map: prefixed tool name → { client, originalToolName } */
  const toolMap = new Map<
    string,
    { client: McpClient; originalName: string }
  >();

  /** All active MCP clients, keyed by server name. */
  const clients = new Map<string, McpClient>();

  /** Loaded config. */
  let config: McpConfig = { ...DEFAULTS };

  /** Whether we're currently (re)connecting. */
  let connecting = false;

  // ── Connection management ──────────────────────────────────────────

  async function connectServer(
    serverConfig: ServerConfig,
    ctx?: Parameters<Parameters<typeof pi.on>[1]>[1],
  ): Promise<McpClient | null> {
    const client = new McpClient(serverConfig, serverConfig.timeout ?? 30000);

    client.setLogger((msg) => {
      // Log to pi's notification system if available
      // Show errors/warnings, and OAuth progress messages
      if (
        msg.includes("error") ||
        msg.includes("fail") ||
        msg.includes("OAuth")
      ) {
        ctx?.ui?.notify?.(msg, "info");
      }
    });

    try {
      await client.connect();
      return client;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (ctx?.hasUI) {
        ctx.ui.notify(
          `MCP server "${serverConfig.name}" connection failed: ${msg}`,
          "warning",
        );
      }
      console.error(`[mcp] Failed to connect to "${serverConfig.name}": ${msg}`);
      client.disconnect();
      return null;
    }
  }

  async function connectAllServers(
    ctx?: Parameters<Parameters<typeof pi.on>[1]>[1],
  ): Promise<void> {
    if (connecting) return;
    connecting = true;

    // Disconnect existing clients
    for (const [name, client] of clients) {
      client.disconnect();
    }
    clients.clear();
    toolMap.clear();

    const enabledServers = config.servers.filter(
      (s) => (s as any).enabled !== false,
    );

    if (enabledServers.length === 0) {
      connecting = false;
      return;
    }

    // Connect to all servers in parallel
    const results = await Promise.all(
      enabledServers.map((sc) => connectServer(sc, ctx)),
    );

    // Register tools from successfully connected servers
    let totalTools = 0;

    for (let i = 0; i < enabledServers.length; i++) {
      const client = results[i];
      if (!client) continue;

      const serverConfig = enabledServers[i];
      clients.set(serverConfig.name, client);

      // Only register tools if the server supports them
      if (!client.hasTools) {
        if (ctx?.hasUI) {
          ctx.ui.notify(
            `MCP server "${serverConfig.name}" connected (no tools)`,
            "info",
          );
        }
        continue;
      }

      try {
        const tools = await client.listTools();
        if (tools.length === 0) continue;

        const prefix = config.toolPrefix ?? DEFAULTS.toolPrefix;

        for (const mcpTool of tools) {
          const toolName = makeToolName(prefix, serverConfig.name, mcpTool.name);

          // Convert JSON Schema to TypeBox (falls back to Type.Any for unknowns)
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
            promptSnippet: buildPromptSnippet(config, mcpTool, serverConfig.name),
            parameters: paramSchema as any,

            async execute(toolCallId, params, signal, onUpdate, _ctx) {
              // Look up the client — it may have disconnected
              const entry = toolMap.get(toolName);
              if (!entry) {
                throw new Error(
                  `MCP tool "${toolName}" is no longer available (server disconnected)`,
                );
              }

              // Check for cancellation
              if (signal?.aborted) {
                return { content: [{ type: "text" as const, text: "Cancelled" }] };
              }

              onUpdate?.({
                content: [
                  { type: "text" as const, text: `Calling ${serverConfig.name}/${mcpTool.name}...` },
                ],
              });

              try {
                const result = await entry.client.callTool(
                  entry.originalName,
                  params as Record<string, unknown>,
                  signal ?? undefined,
                );

                // Extract text content
                const textParts: string[] = [];
                for (const item of result.content) {
                  if (item.type === "text" && item.text) {
                    textParts.push(item.text);
                  } else if (item.type === "resource") {
                    textParts.push(
                      `[Resource: ${item.mimeType ?? "unknown"} — not displayed]`,
                    );
                  } else if (item.type === "image") {
                    textParts.push(
                      `[Image: ${item.mimeType ?? "unknown"} — not displayed]`,
                    );
                  }
                }

                let output = textParts.join("\n");

                // ── Truncation for token efficiency ──────────────────
                const maxBytes = config.maxResultBytes ?? DEFAULTS.maxResultBytes;
                const maxLines = config.maxResultLines ?? DEFAULTS.maxResultLines;

                if (output) {
                  const truncation = truncateHead(output, { maxLines, maxBytes });
                  output = truncation.content;

                  if (truncation.truncated) {
                    output +=
                      `\n\n[Output truncated: ${truncation.outputLines} of ${truncation.totalLines} lines`;
                    output += ` (${formatSize(truncation.outputBytes)} of ${formatSize(truncation.totalBytes)})]`;
                  }
                }

                // Signal errors from the MCP server
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

                // Attempt reconnection if enabled
                if (
                  config.reconnectEnabled &&
                  err instanceof McpError &&
                  err.message.includes("timed out")
                ) {
                  // Don't reconnect from within a tool call — just report
                }

                throw new Error(`MCP tool "${entry.originalName}" failed: ${msg}`);
              }
            },

            // ── Custom rendering ─────────────────────────────────────
            renderCall(args: Record<string, unknown>, theme: any, _context: any) {
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
              const suffix =
                !expanded && text.length > 100
                  ? theme.fg("dim", "...")
                  : "";

              if (result?.isError) {
                return new Text(
                  theme.fg("error", `✗ ${shortText}${suffix}`),
                  0,
                  0,
                );
              }

              return new Text(
                theme.fg("success", `✓ ${shortText}${suffix}`),
                0,
                0,
              );
            },
          });

          // Map tool name → client for execution
          toolMap.set(toolName, {
            client,
            originalName: mcpTool.name,
          });

          totalTools++;
        }

        if (ctx?.hasUI && totalTools > 0) {
          ctx.ui.notify(
            `MCP: "${serverConfig.name}" — ${tools.length} tool(s) registered`,
            "info",
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (ctx?.hasUI) {
          ctx.ui.notify(
            `MCP server "${serverConfig.name}" tool listing failed: ${msg}`,
            "warning",
          );
        }
        console.error(
          `[mcp] Failed to list tools from "${serverConfig.name}": ${msg}`,
        );
      }
    }

    connecting = false;

    if (ctx?.hasUI && totalTools > 0) {
      ctx.ui.notify(
        `MCP: ${clients.size} server(s), ${totalTools} tool(s) ready`,
        "info",
      );
    }
  }

  // ── Lifecycle ──────────────────────────────────────────────────────

  pi.on("session_start", async (_event, ctx) => {
    config = loadMcpConfig();

    const enabledCount = config.servers.filter(
      (s) => (s as any).enabled !== false,
    ).length;

    if (enabledCount === 0) {
      if (ctx.hasUI) {
        ctx.ui.setStatus("mcp", "MCP: no servers configured");
      }
      return;
    }

    if (ctx.hasUI) {
      ctx.ui.setStatus("mcp", `MCP: connecting to ${enabledCount} server(s)...`);
    }

    await connectAllServers(ctx);

    if (ctx.hasUI) {
      const connectedCount = clients.size;
      const toolCount = toolMap.size;
      ctx.ui.setStatus(
        "mcp",
        `MCP: ${connectedCount}/${enabledCount} server(s), ${toolCount} tool(s)`,
      );
    }
  });

  pi.on("session_shutdown", async () => {
    for (const [name, client] of clients) {
      client.disconnect();
    }
    clients.clear();
    toolMap.clear();
    config = { ...DEFAULTS };
  });

  // ── Command: /mcp-status ───────────────────────────────────────────

  pi.registerCommand("mcp-status", {
    description: "Show MCP server connection status and registered tools",
    handler: async (_args, ctx) => {
      if (clients.size === 0) {
        ctx.ui.notify("MCP: No servers connected.", "info");
        return;
      }

      const lines: string[] = [];
      lines.push("MCP Servers:");

      for (const [name, client] of clients) {
        const info = client.info;
        const serverTools = Array.from(toolMap.entries())
          .filter(([, v]) => v.client === client)
          .map(([toolName, v]) => `  ${toolName} → ${v.originalName}`);

        const header = info
          ? `${name} (${info.name} v${info.version})`
          : name;

        lines.push(`  ${header}`);
        if (serverTools.length === 0) {
          lines.push(`    (no tools)`);
        } else {
          for (const t of serverTools) {
            lines.push(t);
          }
        }
      }

      ctx.ui.notify(lines.join("\n"), "info");
    },
  });

  // ── Command: /mcp-reload ───────────────────────────────────────────

  pi.registerCommand("mcp-reload", {
    description: "Reload MCP configuration and reconnect to servers",
    handler: async (_args, ctx) => {
      if (ctx.hasUI) {
        ctx.ui.notify("MCP: Reloading configuration...", "info");
      }

      // Disconnect all
      for (const [, client] of clients) {
        client.disconnect();
      }
      clients.clear();
      toolMap.clear();

      // Reload config and reconnect
      config = loadMcpConfig();
      await connectAllServers(ctx);

      if (ctx.hasUI) {
        ctx.ui.notify(
          `MCP: ${clients.size} server(s), ${toolMap.size} tool(s) ready`,
          "info",
        );
      }
    },
  });

  // ── Input: @agentName delegation ───────────────────────────────────

  pi.on("input", async (event, ctx) => {
    // Only transform interactive user input (not RPC or extension-injected messages)
    if (event.source !== "interactive") return;

    // Match @agentName prefix at the start of input
    const match = event.text.match(/^@([\w.-]+)\s+(.*)/);
    if (!match) return;

    const [, agentName, task] = match;
    const trimmedTask = task.trim();
    if (!trimmedTask) return;

    // Discover available agents (both user and project scopes)
    const discovery = discoverAgents(ctx.cwd, "both");

    // Check if it's a subagent
    const subagent = discovery.subagents.find((a: AgentConfig) => a.name === agentName);
    if (subagent) {
      return {
        action: "transform",
        text: `Use the subagent tool to delegate the following task to the "${agentName}" agent: ${trimmedTask}`,
      };
    }

    // Check if it's a primary agent (misuse)
    const primaryAgent = discovery.primaryAgents.find((a: AgentConfig) => a.name === agentName);
    if (primaryAgent) {
      ctx.ui.notify(
        `"${agentName}" is a primary agent. Use /agent ${agentName} to switch.`,
        "warning",
      );
      return { action: "handled" };
    }

    // Agent not found — show available subagents
    const available =
      discovery.subagents.map((a: AgentConfig) => a.name).join(", ") || "none";
    ctx.ui.notify(
      `Unknown agent: "@${agentName}". Available subagents: ${available}`,
      "error",
    );
    return { action: "handled" };
  });
}
