/**
 * MCP command registration — /mcp-status, /mcp-reload, /mcp-auth.
 *
 * Each function registers its command handler on the pi ExtensionAPI.
 * They share mutable state (clients, toolMap, config) and the connection
 * lifecycle functions.
 */
import * as fs from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { loadMcpConfig, defaultTokenStorePath } from "./config";
import { mcpLogInfo, mcpLogError } from "./logger";
import {
  connectServer,
  registerServerTools,
  connectAllServers,
  type ConnectionState,
} from "./connection";

// ── /mcp-status ────────────────────────────────────────────────────────

export function registerMcpStatusCommand(pi: ExtensionAPI, state: ConnectionState): void {
  pi.registerCommand("mcp-status", {
    description: "Show MCP server connection status and registered tools",
    handler: async (_args, ctx) => {
      if (state.clients.size === 0) {
        ctx.ui.notify("MCP: No servers connected.", "info");
        return;
      }

      const lines: string[] = [];
      lines.push("MCP Servers:");

      for (const [name, client] of state.clients) {
        const info = client.info;
        const serverTools = Array.from(state.toolMap.entries())
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
}

// ── /mcp-reload ────────────────────────────────────────────────────────

export function registerMcpReloadCommand(
  pi: ExtensionAPI,
  state: ConnectionState,
  loadingRef: { current: boolean },
): void {
  pi.registerCommand("mcp-reload", {
    description: "Reload MCP configuration and reconnect to servers",
    handler: async (_args, ctx) => {
      mcpLogInfo("mcp", "Reloading configuration...");
      if (ctx.hasUI) {
        ctx.ui.notify("MCP: Reloading configuration...", "info");
      }

      // Disconnect all
      for (const [, client] of state.clients) {
        client.disconnect();
      }
      state.clients.clear();
      state.toolMap.clear();

      // Reload config and reconnect
      state.config = loadMcpConfig();
      await connectAllServers(pi, state, loadingRef, ctx);

      mcpLogInfo("mcp", `Reloaded: ${state.clients.size} server(s), ${state.toolMap.size} tool(s)`);
      if (ctx.hasUI) {
        ctx.ui.notify(
          `MCP: ${state.clients.size} server(s), ${state.toolMap.size} tool(s) ready`,
          "info",
        );
      }
    },
  });
}

// ── /mcp-auth ──────────────────────────────────────────────────────────

export function registerMcpAuthCommand(pi: ExtensionAPI, state: ConnectionState): void {
  pi.registerCommand("mcp-auth", {
    description:
      "Manage OAuth authentication for MCP servers. " +
      "Usage: /mcp-auth [status|login <name>|logout <name>]",
    handler: async (args, ctx) => {
      const trimmedArgs = (args ?? "").trim();
      const parts = trimmedArgs.split(/\s+/);
      const subCommand = parts[0]?.toLowerCase() ?? "status";
      const targetName = parts.slice(1).join(" ");

      const oauthServers = state.config.servers ?? [];

      // ── status ─────────────────────────────────────────────────
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
          const client = state.clients.get(serverConfig.name);
          const status = client?.getOAuthStatus();

          let authLine: string;
          if (!status) {
            const storePath =
              serverConfig.oauth?.tokenStorePath ?? defaultTokenStorePath(serverConfig.name);
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

          const scopes = status?.scopes ?? serverConfig.oauth?.scopes;
          if (scopes && scopes.length > 0) {
            lines.push(`    Scopes: ${scopes.join(", ")}`);
          }

          const storePath =
            status?.tokenStorePath ??
            serverConfig.oauth?.tokenStorePath ??
            defaultTokenStorePath(serverConfig.name);
          lines.push(`    Tokens: ${storePath}`);
          lines.push("");
        }

        ctx.ui.notify(lines.join("\n"), "info");
        return;
      }

      // ── login <name> ───────────────────────────────────────────
      if (subCommand === "login") {
        if (!targetName) {
          if (oauthServers.length !== 1) {
            const names = oauthServers.map((s) => s.name).join(", ");
            ctx.ui.notify(
              `Usage: /mcp-auth login <server-name>\n` +
                `Available OAuth servers: ${names || "none"}`,
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

        const serverConfig = (state.config.servers ?? []).find((s) => s.name === serverName);
        if (!serverConfig) {
          ctx.ui.notify(`Server "${serverName}" not found in MCP config.`, "error");
          return;
        }

        // Disconnect existing client if connected
        const existingClient = state.clients.get(serverName);
        if (existingClient) {
          ctx.ui.notify(`MCP OAuth: Clearing cached tokens for "${serverName}"...`, "info");
          existingClient.clearOAuthTokens();
          existingClient.disconnect();
          state.clients.delete(serverName);

          for (const [toolName, entry] of state.toolMap) {
            if (entry.client === existingClient) {
              state.toolMap.delete(toolName);
            }
          }
        } else {
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

        mcpLogInfo(serverName, "Starting OAuth login...");
        ctx.ui.notify(
          `MCP OAuth: Starting authentication for "${serverName}"...\n` +
            `A browser window should open. Follow the prompts to authorize.`,
          "info",
        );

        try {
          const client = await connectServer(serverConfig, ctx);
          if (!client) {
            return;
          }

          state.clients.set(serverName, client);

          const toolCount = await registerServerTools(pi, client, serverConfig, state, ctx);
          mcpLogInfo(serverName, `OAuth login complete — ${toolCount} tool(s)`);

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
          mcpLogError(serverName, `OAuth login failed: ${msg}`);
          ctx.ui.notify(`MCP OAuth: Authentication failed for "${serverName}": ${msg}`, "error");
        }
        return;
      }

      // ── logout <name> ──────────────────────────────────────────
      if (subCommand === "logout") {
        if (!targetName) {
          if (oauthServers.length !== 1) {
            const names = oauthServers.map((s) => s.name).join(", ");
            ctx.ui.notify(
              `Usage: /mcp-auth logout <server-name>\n` +
                `Available OAuth servers: ${names || "none"}`,
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

        const existingClient = state.clients.get(serverName);
        if (existingClient) {
          existingClient.clearOAuthTokens();
          existingClient.disconnect();
          state.clients.delete(serverName);

          for (const [toolName, entry] of state.toolMap) {
            if (entry.client === existingClient) {
              state.toolMap.delete(toolName);
            }
          }
          cleared = true;
        }

        const serverConfig = (state.config.servers ?? []).find((s) => s.name === serverName);
        if (serverConfig) {
          const storePath = serverConfig.oauth?.tokenStorePath ?? defaultTokenStorePath(serverName);
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

      // ── unknown ────────────────────────────────────────────────
      ctx.ui.notify(
        `Unknown sub-command: "${subCommand}".\n` +
          `Usage: /mcp-auth [status|login <name>|logout <name>]`,
        "warning",
      );
    },
  });
}
