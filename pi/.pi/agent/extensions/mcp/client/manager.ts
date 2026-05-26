// client/manager.ts - MCP server connection management
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import type { McpTool, McpResource, ServerDefinition, Transport } from "../core/types.ts";
import { interpolateEnvRecord, resolveBearerToken, resolveConfigPath } from "../core/utils.ts";
import { supportsOAuth, extractOAuthConfig } from "./oauth-flow.ts";
import { McpOAuthProvider } from "./oauth-provider.ts";

interface ServerConnection {
  client: Client;
  transport: Transport;
  definition: ServerDefinition;
  tools: McpTool[];
  resources: McpResource[];
  lastUsedAt: number;
  inFlight: number;
  status: "connected" | "closed";
}

export class McpServerManager {
  private connections = new Map<string, ServerConnection>();
  private connectPromises = new Map<string, Promise<ServerConnection>>();

  async connect(name: string, definition: ServerDefinition): Promise<ServerConnection> {
    if (this.connectPromises.has(name)) {
      return this.connectPromises.get(name)!;
    }

    const existing = this.connections.get(name);
    if (existing?.status === "connected") {
      existing.lastUsedAt = Date.now();
      return existing;
    }

    const promise = this.createConnection(name, definition);
    this.connectPromises.set(name, promise);

    try {
      const connection = await promise;
      this.connections.set(name, connection);
      return connection;
    } finally {
      this.connectPromises.delete(name);
    }
  }

  private async createConnection(
    name: string,
    definition: ServerDefinition,
  ): Promise<ServerConnection> {
    const client = new Client({ name: `pi-mcp-${name}`, version: "1.0.0" });

    let transport: Transport;

    if (definition.command) {
      transport = new StdioClientTransport({
        command: definition.command,
        args: definition.args ?? [],
        env: resolveEnv(definition.env),
        cwd: resolveConfigPath(definition.cwd),
        stderr: definition.debug ? "inherit" : "ignore",
      });
    } else if (definition.url) {
      transport = await this.createHttpTransport(name, definition);
    } else {
      throw new Error(`Server ${name} has no command or url`);
    }

    try {
      await client.connect(transport);

      const [tools, resources] = await Promise.all([
        this.fetchAllTools(client),
        this.fetchAllResources(client),
      ]);

      return {
        client,
        transport,
        definition,
        tools,
        resources,
        lastUsedAt: Date.now(),
        inFlight: 0,
        status: "connected",
      };
    } catch (error) {
      await client.close().catch(() => {});
      await transport.close().catch(() => {});
      throw error;
    }
  }

  private async createHttpTransport(
    name: string,
    definition: ServerDefinition,
  ): Promise<Transport> {
    const url = new URL(definition.url!);
    const headers = resolveHeaders(definition.headers) ?? {};
    let authProvider: McpOAuthProvider | undefined;

    // OAuth: create auth provider (SDK handles token attachment and refresh)
    if (supportsOAuth(definition)) {
      const oauthConfig = extractOAuthConfig(definition);
      authProvider = new McpOAuthProvider(name, definition.url!, oauthConfig, {
        // Normal connections don't redirect — auth must be pre-established.
        // The SDK will throw UnauthorizedError if auth is needed.
        onRedirect: async () => {
          throw new Error(
            "OAuth requires interactive authentication. Run /mcp auth <server> first.",
          );
        },
      });
    }

    // Bearer token auth (for non-OAuth or fallback)
    if (
      !authProvider &&
      (definition.bearerToken !== undefined || definition.bearerTokenEnv !== undefined)
    ) {
      const token = resolveBearerToken(definition);
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }

    const requestInit = Object.keys(headers).length > 0 ? { headers } : undefined;

    // Try StreamableHTTP first, fall back to SSE
    const streamableTransport = new StreamableHTTPClientTransport(url, {
      requestInit,
      authProvider,
    });

    try {
      const testClient = new Client({ name: "pi-mcp-probe", version: "2.1.2" });
      await testClient.connect(streamableTransport);
      await testClient.close().catch(() => {});
      await streamableTransport.close().catch(() => {});

      return new StreamableHTTPClientTransport(url, { requestInit, authProvider });
    } catch {
      await streamableTransport.close().catch(() => {});
      return new SSEClientTransport(url, { requestInit });
    }
  }

  private async fetchAllTools(client: Client): Promise<McpTool[]> {
    const allTools: McpTool[] = [];
    let cursor: string | undefined;

    do {
      const result = await client.listTools(cursor ? { cursor } : undefined);
      allTools.push(...(result.tools ?? []));
      cursor = result.nextCursor;
    } while (cursor);

    return allTools;
  }

  private async fetchAllResources(client: Client): Promise<McpResource[]> {
    try {
      const allResources: McpResource[] = [];
      let cursor: string | undefined;

      do {
        const result = await client.listResources(cursor ? { cursor } : undefined);
        allResources.push(...(result.resources ?? []));
        cursor = result.nextCursor;
      } while (cursor);

      return allResources;
    } catch {
      return [];
    }
  }

  async close(name: string): Promise<void> {
    const connection = this.connections.get(name);
    if (!connection) return;

    connection.status = "closed";
    this.connections.delete(name);
    await connection.client.close().catch(() => {});
    await connection.transport.close().catch(() => {});
  }

  async closeAll(): Promise<void> {
    const names = [...this.connections.keys()];
    await Promise.all(names.map((name) => this.close(name)));
  }

  getConnection(name: string): ServerConnection | undefined {
    return this.connections.get(name);
  }

  getAllConnections(): Map<string, ServerConnection> {
    return new Map(this.connections);
  }

  touch(name: string): void {
    const connection = this.connections.get(name);
    if (connection) {
      connection.lastUsedAt = Date.now();
    }
  }

  incrementInFlight(name: string): void {
    const connection = this.connections.get(name);
    if (connection) {
      connection.inFlight = (connection.inFlight ?? 0) + 1;
    }
  }

  decrementInFlight(name: string): void {
    const connection = this.connections.get(name);
    if (connection && connection.inFlight) {
      connection.inFlight--;
    }
  }

  isIdle(name: string, timeoutMs: number): boolean {
    const connection = this.connections.get(name);
    if (!connection || connection.status !== "connected") return false;
    if (connection.inFlight > 0) return false;
    return Date.now() - connection.lastUsedAt > timeoutMs;
  }
}

function resolveEnv(env?: Record<string, string>): Record<string, string> {
  const resolved: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      resolved[key] = value;
    }
  }

  if (!env) return resolved;

  const overrides = interpolateEnvRecord(env);
  return overrides ? { ...resolved, ...overrides } : resolved;
}

function resolveHeaders(headers?: Record<string, string>): Record<string, string> | undefined {
  return interpolateEnvRecord(headers);
}
