/**
 * mcp-client.ts — MCP client manager for connecting to configured
 * MCP servers, listing their tools, and forwarding tool calls.
 *
 * Uses @modelcontextprotocol/sdk for Streamable HTTP transport.
 * Server config is loaded from custom-settings.yaml via the shared Config module.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { TSchema } from "typebox";
import { Type } from "typebox";
import { spawn } from "node:child_process";
import { AuthStore } from "./auth-store.js";
import { CallbackServer } from "./callback-server.js";
import { McpOAuthProvider } from "./oauth-provider.js";
import { defaultConfig, type McpYamlServer } from "../shared/config.js";
import { Logger } from "../shared/logger.js";

// ─── Types ───────────────────────────────────────────────────────────────

export interface McpServerStatus {
  name: string;
  url: string;
  status: "connecting" | "connected" | "error";
  toolCount: number;
  error?: string;
}

export interface McpToolSchema {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  serverName: string;
  originalName: string;
}

interface McpClientHandle {
  client: Client;
  transport: StreamableHTTPClientTransport | StdioClientTransport;
}

// ─── Exported: JSON Schema → TypeBox converter ───────────────────────────

/** Build a TypeBox Object schema from a JSON Schema inputSchema. */
export function buildToolParameters(inputSchema: Record<string, unknown>): TSchema {
  if (inputSchema.type === "object" && inputSchema.properties) {
    return jsonSchemaToTypeBox(inputSchema) as any;
  }
  return Type.Any();
}

// ─── Exported: MCP Client Manager ────────────────────────────────────────

export class McpClientManager {
  private clients = new Map<string, McpClientHandle>();
  private statuses: McpServerStatus[] = [];
  private onStatusChange?: (statuses: McpServerStatus[]) => void;
  private authStore: AuthStore;
  private logger: Logger;

  constructor(authStore: AuthStore, logger: Logger) {
    this.authStore = authStore;
    this.logger = logger;
  }

  setStatusCallback(cb: (statuses: McpServerStatus[]) => void): void {
    this.onStatusChange = cb;
  }

  getStatuses(): McpServerStatus[] {
    return [...this.statuses];
  }

  async connectAll(): Promise<McpToolSchema[]> {
    const cfg = defaultConfig.loadCustomSettings();
    const servers = cfg.mcp?.servers ?? [];

    if (servers.length === 0) {
      this.emitStatus();
      return [];
    }

    const allTools: McpToolSchema[] = [];

    for (const server of servers) {
      const status: McpServerStatus = {
        name: server.name,
        url: server.url ?? server.command ?? "unknown",
        status: "connecting",
        toolCount: 0,
      };
      this.updateStatus(server.name, status);

      try {
        if (server.transport === "http" || !server.transport) {
          const tools = await this.connectHttp(server);
          status.status = "connected";
          status.toolCount = tools.length;

          for (const tool of tools) {
            allTools.push({
              name: `mcp_${server.name}_${tool.name}`,
              description: tool.description ?? "",
              inputSchema: (tool.inputSchema as Record<string, unknown>) ?? {
                type: "object",
                properties: {},
              },
              serverName: server.name,
              originalName: tool.name,
            });
          }
        } else if (server.transport === "stdio") {
          const tools = await this.connectStdio(server);
          status.status = "connected";
          status.toolCount = tools.length;

          for (const tool of tools) {
            allTools.push({
              name: `mcp_${server.name}_${tool.name}`,
              description: tool.description ?? "",
              inputSchema: (tool.inputSchema as Record<string, unknown>) ?? {
                type: "object",
                properties: {},
              },
              serverName: server.name,
              originalName: tool.name,
            });
          }
        }
      } catch (err) {
        status.status = "error";
        status.error = err instanceof Error ? err.message : String(err);
      }

      this.updateStatus(server.name, status);
    }

    return allTools;
  }

  async callTool(
    serverName: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
    const handle = this.clients.get(serverName);
    if (!handle) {
      return {
        content: [{ type: "text", text: `MCP server "${serverName}" is not connected.` }],
        isError: true,
      };
    }

    try {
      const result = await handle.client.callTool({
        name: toolName,
        arguments: args,
      });

      const textParts: string[] = [];
      const isError: boolean = (result as any).isError ?? false;

      const contentItems = result.content as Array<{
        type: string;
        text?: string;
        resource?: { uri?: string; text?: string };
      }>;
      for (const item of contentItems) {
        if (item.type === "text") {
          textParts.push(item.text ?? "");
        } else if (item.type === "resource") {
          textParts.push(
            `[Resource: ${(item as any).resource?.uri ?? "unknown"} — ${(item as any).resource?.text ?? ""}]`,
          );
        } else {
          textParts.push(`[${item.type} content]`);
        }
      }

      return {
        content: [{ type: "text", text: textParts.join("\n") || "(empty result)" }],
        isError,
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `MCP tool call failed: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  }

  async disconnectAll(): Promise<void> {
    for (const [name, handle] of this.clients) {
      try {
        await handle.transport.close();
      } catch {
        // Best-effort cleanup
      }
      const status = this.statuses.find((s) => s.name === name);
      if (status) status.status = "error";
    }
    this.clients.clear();
    this.emitStatus();
  }

  // ─── Private ─────────────────────────────────────────────────────────

  private updateStatus(name: string, status: McpServerStatus): void {
    const idx = this.statuses.findIndex((s) => s.name === name);
    if (idx >= 0) {
      this.statuses[idx] = status;
    } else {
      this.statuses.push(status);
    }
    this.emitStatus();
  }

  private emitStatus(): void {
    this.onStatusChange?.([...this.statuses]);
  }

  // ─── OAuth helpers ─────────────────────────────────────────────────

  /**
   * Ensure we have a valid OAuth access token for the given server.
   * Returns null if no OAuth is needed.
   */
  private async ensureOAuthToken(server: McpYamlServer, url: string): Promise<string | null> {
    // Explicitly disabled
    if (server.auth === false) return null;

    // Bearer token from config
    if (server.auth === "bearer" || server.bearerToken || server.bearerTokenEnv) {
      if (server.bearerToken) return server.bearerToken;
      if (server.bearerTokenEnv) return process.env[server.bearerTokenEnv] ?? null;
    }

    const serverName = server.name;

    // Try stored valid token first
    const stored = this.authStore.get(serverName, url);
    if (stored?.accessToken && !this.authStore.isExpired(stored)) {
      return stored.accessToken;
    }

    // Try silent refresh
    if (stored && this.authStore.canRefresh(stored)) {
      try {
        const provider = new McpOAuthProvider(serverName, url, "", this.authStore);
        provider.loadFromStore();
        const token = await provider.getAccessToken();
        if (token) return token;
      } catch {
        // fall through to probe + interactive flow
      }
    }

    // If OAuth is explicitly configured, always probe
    // Otherwise, probe to auto-detect
    if (server.auth !== "oauth" && !stored) {
      return null; // No explicit OAuth config and no stored tokens — skip probing
    }

    // Probe server for OAuth requirements
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "initialize",
          params: {
            protocolVersion: "2025-06-18",
            capabilities: {},
            clientInfo: { name: "pi", version: "1.0.0" },
          },
          id: 1,
        }),
      });

      const wwwAuth =
        response.headers.get("WWW-Authenticate") || response.headers.get("www-authenticate");

      this.logger.log(`wwwAuth for ${server.name}: ${wwwAuth ?? "(none)"}`);

      if (response.ok) return null; // No OAuth needed

      if (response.status === 401 && wwwAuth) {
        return await this.runOAuthFlow(server, url, wwwAuth);
      }

      // Unexpected response — let normal connect handle it
      return null;
    } catch {
      // If probe fails (network error), let normal connect handle it
      return null;
    }
  }

  /** Run the interactive OAuth authorization flow and return an access token. */
  private async runOAuthFlow(
    server: McpYamlServer,
    url: string,
    wwwAuthHeader: string,
  ): Promise<string> {
    const serverName = server.name;
    const oauthConfig = server.oauth;

    // Start callback server
    const callbackServer = new CallbackServer();
    await callbackServer.start();
    const redirectUri = callbackServer.getRedirectUri();

    const provider = new McpOAuthProvider(serverName, url, redirectUri, this.authStore);

    try {
      // Discover OAuth metadata
      this.updateOAuthStatus(serverName, "Discovering OAuth metadata...");
      const metadata = await provider.discoverFrom401(wwwAuthHeader);

      // Register client or reuse stored
      const stored = this.authStore.get(serverName, url);
      if (stored?.clientId) {
        provider.setClientInfo({
          clientId: stored.clientId,
          clientSecret: stored.clientSecret,
        });
        provider.setMetadata(metadata);
      } else if (metadata.registrationUrl) {
        this.updateOAuthStatus(serverName, "Registering client...");
        await provider.register();
      } else if (oauthConfig && typeof oauthConfig === "object" && oauthConfig.clientId) {
        provider.setClientInfo({
          clientId: oauthConfig.clientId,
          clientSecret: oauthConfig.clientSecret,
        });
        provider.setMetadata(metadata);
      } else {
        throw new Error(
          "Authorization server does not support dynamic client registration. " +
            "Set oauth.clientId in custom-settings.yaml for this server.",
        );
      }

      // Build authorization URL and open browser
      const scopes =
        oauthConfig && typeof oauthConfig === "object" && oauthConfig.scope
          ? oauthConfig.scope.split(" ")
          : undefined;
      const authUrl = provider.buildAuthorizationUrl(scopes);

      this.updateOAuthStatus(serverName, "Waiting for browser authorization...");
      openUrl(authUrl);

      // Wait for callback
      const callbackResult = await callbackServer.waitForCallback(300_000);

      // Validate CSRF state
      if (!provider.validateState(callbackResult.state)) {
        throw new Error("CSRF state validation failed. Authorization may have been tampered with.");
      }

      // Exchange code for tokens
      this.updateOAuthStatus(serverName, "Exchanging authorization code...");
      const tokenSet = await provider.exchangeCode(callbackResult.code);

      return tokenSet.accessToken;
    } finally {
      callbackServer.stop();
    }
  }

  /** Emit an intermediate OAuth status update. */
  private updateOAuthStatus(serverName: string, message: string): void {
    const existing = this.statuses.find((s) => s.name === serverName);
    const status: McpServerStatus = {
      name: serverName,
      url: existing?.url ?? "",
      status: "connecting",
      toolCount: 0,
      error: message,
    };
    this.updateStatus(serverName, status);
  }

  // ─── stdio transport ───────────────────────────────────────────────

  private async connectStdio(server: McpYamlServer): Promise<
    Array<{
      name: string;
      description?: string;
      inputSchema: Record<string, unknown>;
    }>
  > {
    const command = server.command;
    if (!command) throw new Error(`No command configured for stdio server "${server.name}"`);

    const transportEnv: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) transportEnv[key] = value;
    }
    Object.assign(transportEnv, server.env);

    const transport = new StdioClientTransport({
      command,
      args: server.args ?? [],
      env: transportEnv,
      cwd: server.cwd ?? process.cwd(),
      stderr: "pipe",
    });

    const client = new Client({ name: "pi-mcp-extension", version: "1.0.0" }, { capabilities: {} });

    await client.connect(transport);
    this.clients.set(server.name, { client, transport });

    const result = await client.listTools();
    return result.tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: (t.inputSchema as Record<string, unknown>) ?? {
        type: "object",
        properties: {},
      },
    }));
  }

  // ─── HTTP transport ─────────────────────────────────────────────────

  private async connectHttp(server: McpYamlServer): Promise<
    Array<{
      name: string;
      description?: string;
      inputSchema: Record<string, unknown>;
    }>
  > {
    const url = server.url;
    if (!url) throw new Error(`No URL configured for server "${server.name}"`);

    const headers: Record<string, string> = {};
    if (server.headers) {
      for (const [key, value] of Object.entries(server.headers)) {
        headers[key] = value.replace(/\$\{(\w+)\}/g, (_, name) => process.env[name] ?? "");
      }
    }

    // Handle OAuth authentication automatically
    const accessToken = await this.ensureOAuthToken(server, url);
    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }

    const transport = new StreamableHTTPClientTransport(new URL(url), {
      requestInit: { headers },
    });

    const client = new Client({ name: "pi-mcp-extension", version: "1.0.0" }, { capabilities: {} });

    await client.connect(transport);
    this.clients.set(server.name, { client, transport });

    const result = await client.listTools();
    return result.tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: (t.inputSchema as Record<string, unknown>) ?? {
        type: "object",
        properties: {},
      },
    }));
  }
}

// ─── Internal ────────────────────────────────────────────────────────────

/** Open a URL in the system default browser. */
function openUrl(url: string): void {
  const platform = process.platform;
  let command: string;
  let args: string[];

  if (platform === "darwin") {
    command = "open";
    args = [url];
  } else if (platform === "win32") {
    command = "cmd";
    args = ["/c", "start", '""', url];
  } else {
    command = process.env.BROWSER || "xdg-open";
    args = [url];
  }

  const proc = spawn(command, args, {
    stdio: "ignore",
    detached: true,
  });
  proc.unref();
}

/** Convert a JSON Schema property definition to a TypeBox schema (recursive). */
function jsonSchemaToTypeBox(schema: Record<string, unknown>): TSchema {
  if (Array.isArray(schema.enum)) {
    const literals = schema.enum.map((v: unknown) => {
      if (typeof v === "string") return Type.Literal(v);
      if (typeof v === "number") return Type.Literal(v);
      if (typeof v === "boolean") return Type.Literal(v);
      return Type.Literal(String(v));
    });
    return Type.Union(literals as any);
  }

  const schemaType = schema.type as string | undefined;

  switch (schemaType) {
    case "object": {
      const properties = (schema.properties as Record<string, Record<string, unknown>>) ?? {};
      const required = (schema.required as string[]) ?? [];
      const shape: Record<string, TSchema> = {};
      for (const [key, propSchema] of Object.entries(properties)) {
        const prop = jsonSchemaToTypeBox(propSchema);
        shape[key] = required.includes(key) ? prop : Type.Optional(prop);
      }
      return Type.Object(shape, {
        additionalProperties: (schema.additionalProperties as boolean | undefined) ?? false,
      });
    }
    case "array": {
      const items = schema.items
        ? jsonSchemaToTypeBox(schema.items as Record<string, unknown>)
        : Type.String();
      return Type.Array(items);
    }
    case "string":
      return Type.String();
    case "number":
    case "integer":
      return Type.Number();
    case "boolean":
      return Type.Boolean();
    default:
      return Type.Any();
  }
}
