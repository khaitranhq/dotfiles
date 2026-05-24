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
 * **Configuration:** ~/.pi/agent/custom-settings.yaml → "mcp" section
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { truncateHead, formatSize } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type, type TSchema } from "typebox";

import { McpClient, type McpTool, type ServerConfig, McpError } from "./mcp-client";
import { jsonSchemaToTypeBox, describeSchema } from "./schema";
import { discoverAgents, type AgentConfig } from "../subagent/agents";
import { loadCustomSettings, type CustomSettings } from "../shared/config";

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

// ── Constants ──────────────────────────────────────────────────────────

const DEFAULTS: Required<McpConfig> = {
  servers: [],
  toolPrefix: "mcp",
  maxResultBytes: 10240, // 10 KB — aggressive for token efficiency
  maxResultLines: 500,
  reconnectEnabled: true,
  reconnectMaxRetries: 3,
};

// ── Helpers ────────────────────────────────────────────────────────────

/** Build default token store path for a server name. */
function defaultTokenStorePath(serverName: string): string {
  return path.join(
    os.homedir(),
    ".pi",
    "agent",
    "mcp-tokens",
    `${serverName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 64)}.json`,
  );
}

/** Sanitize a name for use in tool identifiers: keep only [a-zA-Z0-9_]. */
function sanitizeName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase();
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
    const settings: CustomSettings = loadCustomSettings();
    const mcp = settings.mcp as McpConfig | undefined;

    if (!mcp) {
      return { ...DEFAULTS };
    }

    return {
      toolPrefix: mcp.toolPrefix ?? DEFAULTS.toolPrefix,
      maxResultBytes: mcp.maxResultBytes ?? DEFAULTS.maxResultBytes,
      maxResultLines: mcp.maxResultLines ?? DEFAULTS.maxResultLines,
      reconnectEnabled: mcp.reconnectEnabled ?? DEFAULTS.reconnectEnabled,
      reconnectMaxRetries: mcp.reconnectMaxRetries ?? DEFAULTS.reconnectMaxRetries,
      servers: mcp.servers ?? [],
    };
  } catch (err) {
    console.error(`[mcp] Failed to load config from custom-settings.yaml: ${err}`);
    return { ...DEFAULTS };
  }
}

// ── Main Extension ─────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  // ── State ──────────────────────────────────────────────────────────

  /** Map: prefixed tool name → { client, originalToolName } */
  const toolMap = new Map<string, { client: McpClient; originalName: string }>();

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
      // Always show OAuth messages, errors, and browser-fallback URLs
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
      return client;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (ctx?.hasUI) {
        ctx.ui.notify(`MCP server "${serverConfig.name}" connection failed: ${msg}`, "warning");
      }
      console.error(`[mcp] Failed to connect to "${serverConfig.name}": ${msg}`);
      client.disconnect();
      return null;
    }
  }

  /**
   * Register all tools from a connected MCP client for the given server.
   * Returns the count of tools registered.
   */
  async function registerServerTools(
    client: McpClient,
    serverConfig: ServerConfig,
    ctx?: Parameters<Parameters<typeof pi.on>[1]>[1],
  ): Promise<number> {
    if (!client.hasTools) {
      if (ctx?.hasUI) {
        ctx.ui.notify(`MCP server "${serverConfig.name}" connected (no tools)`, "info");
      }
      return 0;
    }

    const tools = await client.listTools();
    if (tools.length === 0) return 0;

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

        async execute(_toolCallId, params, signal, onUpdate, _ctx) {
          // Look up the client — it may have disconnected
          const entry = toolMap.get(toolName);
          if (!entry) {
            throw new Error(`MCP tool "${toolName}" is no longer available (server disconnected)`);
          }

          // Check for cancellation
          if (signal?.aborted) {
            return {
              content: [{ type: "text" as const, text: "Cancelled" }],
              details: { server: serverConfig.name, tool: mcpTool.name, isMcp: true },
            };
          }

          onUpdate?.({
            content: [
              { type: "text" as const, text: `Calling ${serverConfig.name}/${mcpTool.name}...` },
            ],
            details: { server: serverConfig.name, tool: mcpTool.name, isMcp: true },
          } as any);

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
                textParts.push(`[Resource: ${item.mimeType ?? "unknown"} — not displayed]`);
              } else if (item.type === "image") {
                textParts.push(`[Image: ${item.mimeType ?? "unknown"} — not displayed]`);
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
                output += `\n\n[Output truncated: ${truncation.outputLines} of ${truncation.totalLines} lines`;
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

      // Map tool name → client for execution
      toolMap.set(toolName, {
        client,
        originalName: mcpTool.name,
      });
    }

    if (ctx?.hasUI && tools.length > 0) {
      ctx.ui.notify(`MCP: "${serverConfig.name}" — ${tools.length} tool(s) registered`, "info");
    }

    return tools.length;
  }

  async function connectAllServers(
    ctx?: Parameters<Parameters<typeof pi.on>[1]>[1],
  ): Promise<void> {
    if (connecting) return;
    connecting = true;

    // Disconnect existing clients
    for (const [, client] of clients) {
      client.disconnect();
    }
    clients.clear();
    toolMap.clear();

    const servers = config.servers ?? [];

    if (servers.length === 0) {
      connecting = false;
      return;
    }

    // Connect to all servers in parallel
    const results = await Promise.all(servers.map((sc) => connectServer(sc, ctx)));

    // Register tools from successfully connected servers
    let totalTools = 0;

    for (let i = 0; i < servers.length; i++) {
      const client = results[i];
      if (!client) continue;

      const serverConfig = servers[i];
      clients.set(serverConfig.name, client);

      try {
        const toolCount = await registerServerTools(client, serverConfig, ctx);
        totalTools += toolCount;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (ctx?.hasUI) {
          ctx.ui.notify(`MCP server "${serverConfig.name}" tool listing failed: ${msg}`, "warning");
        }
        console.error(`[mcp] Failed to list tools from "${serverConfig.name}": ${msg}`);
      }
    }

    connecting = false;

    if (ctx?.hasUI && totalTools > 0) {
      ctx.ui.notify(`MCP: ${clients.size} server(s), ${totalTools} tool(s) ready`, "info");
    }
  }

  // ── Lifecycle ──────────────────────────────────────────────────────

  pi.on("session_start", async (_event, ctx) => {
    config = loadMcpConfig();

    const serverCount = (config.servers ?? []).length;

    if (serverCount === 0) {
      if (ctx.hasUI) {
        ctx.ui.setStatus("mcp", "MCP: no servers configured");
      }
      return;
    }

    if (ctx.hasUI) {
      ctx.ui.setStatus("mcp", `MCP: connecting to ${serverCount} server(s)...`);
    }

    await connectAllServers(ctx);

    if (ctx.hasUI) {
      const connectedCount = clients.size;
      const toolCount = toolMap.size;
      ctx.ui.setStatus(
        "mcp",
        `MCP: ${connectedCount}/${serverCount} server(s), ${toolCount} tool(s)`,
      );
    }
  });

  pi.on("session_shutdown", async () => {
    for (const [, client] of clients) {
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

        const header = info ? `${name} (${info.name} v${info.version})` : name;

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
        ctx.ui.notify(`MCP: ${clients.size} server(s), ${toolMap.size} tool(s) ready`, "info");
      }
    },
  });

  // ── Command: /mcp-auth ───────────────────────────────────────────

  pi.registerCommand("mcp-auth", {
    description:
      "Manage OAuth authentication for MCP servers. " +
      "Usage: /mcp-auth [status|login <name>|logout <name>]",
    handler: async (args, ctx) => {
      const trimmedArgs = (args ?? "").trim();
      const parts = trimmedArgs.split(/\s+/);
      const subCommand = parts[0]?.toLowerCase() ?? "status";
      const targetName = parts.slice(1).join(" ");

      // All servers use OAuth
      const oauthServers = config.servers ?? [];

      // ── status (default) ────────────────────────────────────────
      if (subCommand === "status" || !subCommand) {
        if (oauthServers.length === 0) {
          ctx.ui.notify(
            "MCP OAuth: No servers configured.\n" +
              "Add a server to the 'mcp' section in ~/.pi/agent/custom-settings.yaml.\n" +
              "OAuth is auto-detected from the server's /.well-known/oauth-authorization-server.",
            "info",
          );
          return;
        }

        const lines: string[] = ["MCP OAuth Status:", ""];

        for (const serverConfig of oauthServers) {
          const client = clients.get(serverConfig.name);
          const oauthConfig = serverConfig.oauth;
          const status = client?.getOAuthStatus();

          let authLine: string;
          if (!status) {
            // Client not connected — check config
            // Compute token store path to check manually
            const storePath =
              oauthConfig?.tokenStorePath ?? defaultTokenStorePath(serverConfig.name);
            let hasTokens = false;
            let expiresAt: number | undefined;
            try {
              if (fs.existsSync(storePath)) {
                const raw = fs.readFileSync(storePath, "utf-8");
                const tokens = JSON.parse(raw);
                if (tokens.access_token) {
                  hasTokens = true;
                  expiresAt = tokens.expires_at;
                }
              }
            } catch {
              // Ignore
            }

            if (hasTokens) {
              if (expiresAt && Date.now() > expiresAt) {
                authLine = "⚠ expired (not connected)";
              } else if (expiresAt) {
                const remaining = Math.round((expiresAt - Date.now()) / 1000);
                authLine = `⚠ cached (${remaining}s remaining, not connected)`;
              } else {
                authLine = "⚠ cached (not connected)";
              }
            } else {
              authLine = "✗ not authenticated";
            }
          } else if (status.authenticated) {
            if (status.tokenExpiry && Date.now() > status.tokenExpiry) {
              authLine = "⚠ expired";
            } else if (status.tokenExpiry) {
              const remaining = Math.round((status.tokenExpiry - Date.now()) / 1000);
              const mins = Math.floor(remaining / 60);
              const secs = remaining % 60;
              authLine = `✓ authenticated (${mins}m ${secs}s remaining)`;
            } else {
              authLine = "✓ authenticated";
            }
          } else if (status.hasTokens) {
            authLine = "⚠ tokens present but not valid";
          } else {
            authLine = "✗ not authenticated";
          }

          lines.push(`  ${serverConfig.name}: ${authLine}`);

          // Show scopes if available
          const scopes = status?.scopes ?? oauthConfig?.scopes;
          if (scopes && scopes.length > 0) {
            lines.push(`    Scopes: ${scopes.join(", ")}`);
          }

          // Show token store path
          const storePath =
            status?.tokenStorePath ??
            oauthConfig?.tokenStorePath ??
            defaultTokenStorePath(serverConfig.name);
          lines.push(`    Tokens: ${storePath}`);
          lines.push("");
        }

        ctx.ui.notify(lines.join("\n"), "info");
        return;
      }

      // ── login <name> ────────────────────────────────────────────
      if (subCommand === "login") {
        if (!targetName) {
          // If only one OAuth server, default to it
          if (oauthServers.length === 1) {
            // Fall through with implicit target
          } else {
            const names = oauthServers.map((s) => s.name).join(", ");
            ctx.ui.notify(
              `Usage: /mcp-auth login <server-name>\nAvailable OAuth servers: ${names || "none"}`,
              "warning",
            );
            return;
          }
        }

        const serverName = targetName || oauthServers[0]?.name;
        if (!serverName) {
          ctx.ui.notify("No OAuth-enabled servers configured.", "warning");
          return;
        }

        const serverConfig = (config.servers ?? []).find((s) => s.name === serverName);
        if (!serverConfig) {
          ctx.ui.notify(`Server "${serverName}" not found in MCP config.`, "error");
          return;
        }

        // Disconnect existing client if connected
        const existingClient = clients.get(serverName);
        if (existingClient) {
          ctx.ui.notify(`MCP OAuth: Clearing cached tokens for "${serverName}"...`, "info");
          existingClient.clearOAuthTokens();
          existingClient.disconnect();
          clients.delete(serverName);

          // Remove tools registered by this client
          for (const [toolName, entry] of toolMap) {
            if (entry.client === existingClient) {
              toolMap.delete(toolName);
            }
          }
        } else {
          // Client not connected — just clear tokens on disk
          const oauthConfig = serverConfig.oauth;
          const storePath = oauthConfig?.tokenStorePath ?? defaultTokenStorePath(serverName);
          try {
            if (fs.existsSync(storePath)) {
              fs.unlinkSync(storePath);
            }
          } catch {
            // Ignore
          }
        }

        ctx.ui.notify(
          `MCP OAuth: Starting authentication for "${serverName}"...\n` +
            `A browser window should open. Follow the prompts to authorize.`,
          "info",
        );

        try {
          const client = await connectServer(serverConfig, ctx);
          if (!client) {
            ctx.ui.notify(`MCP OAuth: Failed to connect to "${serverName}".`, "error");
            return;
          }

          clients.set(serverName, client);

          // Register tools from the newly connected server
          const toolCount = await registerServerTools(client, serverConfig, ctx);

          const status = client.getOAuthStatus();
          const authMsg = status?.authenticated
            ? "authenticated"
            : "connected (check OAuth status)";

          ctx.ui.notify(
            `MCP OAuth: "${serverName}" ${authMsg} and ${toolCount} tool(s) registered.`,
            "info",
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          ctx.ui.notify(`MCP OAuth: Authentication failed for "${serverName}": ${msg}`, "error");
        }
        return;
      }

      // ── logout <name> ───────────────────────────────────────────
      if (subCommand === "logout") {
        if (!targetName) {
          if (oauthServers.length === 1) {
            // Fall through with implicit target
          } else {
            const names = oauthServers.map((s) => s.name).join(", ");
            ctx.ui.notify(
              `Usage: /mcp-auth logout <server-name>\nAvailable OAuth servers: ${names || "none"}`,
              "warning",
            );
            return;
          }
        }

        const serverName = targetName || oauthServers[0]?.name;
        if (!serverName) {
          ctx.ui.notify("No OAuth-enabled servers configured.", "warning");
          return;
        }

        let cleared = false;

        // Clear from connected client
        const existingClient = clients.get(serverName);
        if (existingClient) {
          existingClient.clearOAuthTokens();
          existingClient.disconnect();
          clients.delete(serverName);

          // Remove tools registered by this client
          for (const [toolName, entry] of toolMap) {
            if (entry.client === existingClient) {
              toolMap.delete(toolName);
            }
          }
          cleared = true;
        }

        // Also clear token file directly in case it persists
        const serverConfig = (config.servers ?? []).find((s) => s.name === serverName);
        if (serverConfig) {
          const oauthConfig = serverConfig.oauth;
          const storePath = oauthConfig?.tokenStorePath ?? defaultTokenStorePath(serverName);
          try {
            if (fs.existsSync(storePath)) {
              fs.unlinkSync(storePath);
              cleared = true;
            }
          } catch {
            // Ignore
          }
        }

        if (cleared) {
          ctx.ui.notify(`MCP OAuth: Cleared tokens for "${serverName}".`, "info");
        } else {
          ctx.ui.notify(`MCP OAuth: No tokens found for "${serverName}".`, "info");
        }
        return;
      }

      // ── unknown sub-command ──────────────────────────────────────
      ctx.ui.notify(
        `Unknown sub-command: "${subCommand}".\n` +
          `Usage: /mcp-auth [status|login <name>|logout <name>]`,
        "warning",
      );
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
    const available = discovery.subagents.map((a: AgentConfig) => a.name).join(", ") || "none";
    ctx.ui.notify(`Unknown agent: "@${agentName}". Available subagents: ${available}`, "error");
    return { action: "handled" };
  });
}
