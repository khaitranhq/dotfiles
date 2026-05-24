/**
 * MCP client — thin wrapper around @modelcontextprotocol/sdk.
 *
 * Handles connection lifecycle, OAuth callback capture, and exposes
 * listTools / callTool for pi's extension system.
 */
import * as http from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  StreamableHTTPClientTransport,
  type StreamableHTTPClientTransportOptions,
} from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { PiOAuthProvider, type PiOAuthConfig } from "./oauth-provider";
import { mcpLogInfo, mcpLogError } from "./logger";

export interface ServerConfig {
  name: string;
  url: string;
  headers?: Record<string, string>;
  timeout?: number;
  oauth?: PiOAuthConfig;
}

export interface OAuthStatus {
  configured: boolean;
  authenticated: boolean;
  hasTokens: boolean;
  tokenExpiry?: number;
  scopes?: string[];
  tokenStorePath?: string | null;
}

/** Re-export Tool as McpTool for convenience. */
export { type Tool as McpTool };

export class McpError extends Error {
  constructor(
    message: string,
    public readonly code?: number,
    public readonly data?: unknown,
  ) {
    super(message);
    this.name = "McpError";
  }
}

export class McpClient {
  private client: Client;
  private transport: StreamableHTTPClientTransport | null = null;
  private oauthProvider: PiOAuthProvider;
  private _connected = false;
  private _tools: Tool[] | null = null;
  private _serverInfo: { name: string; version: string } | null = null;
  private _log: ((msg: string) => void) | null = null;
  private _callbackServer: http.Server | null = null;
  private _authCodeResolve: ((code: string) => void) | null = null;
  private _authCodeReject: ((err: Error) => void) | null = null;

  constructor(
    private readonly config: ServerConfig,
    private readonly defaultTimeout = 30000,
  ) {
    this.oauthProvider = new PiOAuthProvider(config.name, config.oauth);
    this.client = new Client({ name: "pi-mcp-extension", version: "1.0.0" }, {});
  }

  /** Attach a logger callback for UI notifications. */
  setLogger(fn: (msg: string) => void): void {
    this._log = fn;
  }

  private logInfo(msg: string): void {
    this._log?.(`[mcp:${this.config.name}] ${msg}`);
  }

  // ── Connection ────────────────────────────────────────────────────

  async connect(): Promise<void> {
    if (this._connected) return;

    mcpLogInfo(this.config.name, `Connecting to ${this.config.url}`);
    mcpLogInfo(this.config.name, `Token store: ${this.oauthProvider.tokenStorePath}`);
    mcpLogInfo(this.config.name, `Has tokens: ${this.oauthProvider.tokens() !== undefined}`);
    await this.oauthProvider.setupRedirectUrl();
    mcpLogInfo(this.config.name, `Redirect URL: ${this.oauthProvider.redirectUrl}`);

    this.transport = this.createTransport();

    this.transport.onerror = (error: Error) => {
      const detail = `${error.constructor?.name ?? "Error"}: ${error.message || "(empty)"}${error.stack ? "\n" + error.stack : ""}`;
      mcpLogError(this.config.name, `Transport error: ${detail}`);
      this.logInfo(`Transport error: ${detail}`);
    };

    this.transport.onclose = () => {
      this._connected = false;
      mcpLogInfo(this.config.name, "Transport closed");
    };

    // Connect with OAuth callback handling
    await this.connectWithOAuth();

    const serverVersion = this.client.getServerVersion();
    this._serverInfo = serverVersion
      ? { name: serverVersion.name, version: serverVersion.version }
      : null;

    this._connected = true;
    const msg = `Connected${this._serverInfo ? ` — ${this._serverInfo.name} v${this._serverInfo.version}` : ""}`;
    this.logInfo(msg);
    mcpLogInfo(this.config.name, msg);
  }

  private createTransport(): StreamableHTTPClientTransport {
    const opts: StreamableHTTPClientTransportOptions = {
      authProvider: this.oauthProvider,
    };

    if (this.config.headers) {
      opts.requestInit = { headers: this.config.headers };
    }

    return new StreamableHTTPClientTransport(new URL(this.config.url), opts);
  }

  /**
   * Connect with OAuth callback support.
   * If the server requires authorization, starts a local HTTP server
   * to capture the authorization code callback, then retries.
   */
  private async connectWithOAuth(): Promise<void> {
    try {
      await this.client.connect(this.transport!);
    } catch (err) {
      const detail = `${(err as any)?.constructor?.name ?? "Error"}: ${(err instanceof Error ? err.message : String(err)) || "(empty)"}${err instanceof Error && err.stack ? "\n" + err.stack : ""}`;
      mcpLogError(this.config.name, `connectWithOAuth error: ${detail}`);
      if (!(err instanceof UnauthorizedError) || !this.transport) {
        throw err;
      }

      // OAuth flow: start callback server, wait for code, finish auth, retry
      mcpLogInfo(this.config.name, "OAuth authorization required");
      this.logInfo("OAuth authorization required — waiting for browser callback...");

      const authCode = await this.waitForAuthCallback();
      await this.transport.finishAuth(authCode);

      // Recreate transport for a clean reconnection
      this.transport.close().catch(() => {});
      this.transport = this.createTransport();
      await this.client.connect(this.transport);
    }
  }

  /** Start an HTTP server to capture the OAuth redirect, return the code. */
  private waitForAuthCallback(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      this._authCodeResolve = resolve;
      this._authCodeReject = reject;

      const redirectUrl = this.oauthProvider.redirectUrl as string;
      const redirectPort = new URL(redirectUrl).port;

      const server = http.createServer((req, res) => {
        const reqUrl = new URL(req.url ?? "/", `http://localhost:${redirectPort}`);

        if (reqUrl.pathname === "/callback") {
          const code = reqUrl.searchParams.get("code");
          const error = reqUrl.searchParams.get("error");

          if (error) {
            res.writeHead(400, { "Content-Type": "text/html" });
            res.end(
              `<html><body><h1>Authorization Failed</h1><p>${error}</p><p>You may close this window.</p></body></html>`,
            );
            this._authCodeReject?.(new McpError(`OAuth error: ${error}`));
          } else if (code) {
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(
              `<html><body><h1>Authorization Successful</h1><p>You may close this window and return to your terminal.</p></body></html>`,
            );
            this._authCodeResolve?.(code);
          } else {
            res.writeHead(400, { "Content-Type": "text/html" });
            res.end(
              `<html><body><h1>Invalid Callback</h1><p>Missing authorization code.</p></body></html>`,
            );
            this._authCodeReject?.(new McpError("No authorization code received"));
          }
        } else {
          res.writeHead(404);
          res.end("Not found");
        }
      });

      server.on("error", (err) => {
        this._authCodeReject?.(err);
      });

      server.listen(parseInt(redirectPort), "127.0.0.1", () => {
        this._callbackServer = server;
      });
    }).finally(() => {
      this.cleanupCallbackServer();
    });
  }

  private cleanupCallbackServer(): void {
    if (this._callbackServer) {
      this._callbackServer.close();
      this._callbackServer = null;
    }
    this._authCodeResolve = null;
    this._authCodeReject = null;
  }

  // ── Tools ──────────────────────────────────────────────────────────

  get hasTools(): boolean {
    const caps = this.client.getServerCapabilities();
    return !!caps?.tools;
  }

  get connected(): boolean {
    return this._connected;
  }

  get info(): { name: string; version: string } | null {
    return this._serverInfo;
  }

  async listTools(): Promise<Tool[]> {
    if (this._tools) return this._tools;

    if (!this.hasTools) {
      this._tools = [];
      return [];
    }

    const allTools: Tool[] = [];
    let cursor: string | undefined;
    do {
      const result = await this.client.listTools({ cursor });
      allTools.push(...result.tools);
      cursor = result.nextCursor;
    } while (cursor);

    this._tools = allTools;
    this.logInfo(`Found ${allTools.length} tool(s)`);
    return allTools;
  }

  async callTool(
    name: string,
    args: Record<string, unknown>,
    _signal?: AbortSignal,
  ): Promise<{
    content: Array<{
      type: "text" | "image" | "resource";
      text?: string;
      data?: string;
      mimeType?: string;
    }>;
    isError?: boolean;
  }> {
    const result = await this.client.callTool({ name, arguments: args }, undefined, {
      timeout: this.config.timeout ?? this.defaultTimeout,
    });

    return {
      content: result.content as Array<{
        type: "text" | "image" | "resource";
        text?: string;
        data?: string;
        mimeType?: string;
      }>,
      isError: result.isError as boolean | undefined,
    };
  }

  // ── OAuth ──────────────────────────────────────────────────────────

  getOAuthStatus(): OAuthStatus {
    const tokens = this.oauthProvider.tokens();
    return {
      configured: true,
      authenticated: this._connected,
      hasTokens: tokens !== undefined,
      tokenExpiry: tokens?.expires_in ? Date.now() + tokens.expires_in * 1000 : undefined,
      scopes: tokens?.scope?.split(" "),
      tokenStorePath: this.oauthProvider.tokenStorePath,
    };
  }

  clearOAuthTokens(): void {
    mcpLogInfo(this.config.name, "Clearing OAuth tokens");
    this.oauthProvider.clear();
  }

  // ── Teardown ───────────────────────────────────────────────────────

  disconnect(): void {
    mcpLogInfo(this.config.name, "Disconnecting");
    this._connected = false;
    this._tools = null;
    this.cleanupCallbackServer();
    if (this.transport) {
      this.transport.close().catch(() => {});
      this.transport = null;
    }
  }
}
