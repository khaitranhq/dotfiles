/**
 * Lightweight MCP (Model Context Protocol) client.
 *
 * Supports three transports:
 *   - stdio:  Spawns a child process, communicates via newline-delimited
 *             JSON-RPC 2.0 on stdin/stdout.
 *   - sse:    Connects to an HTTP endpoint with Server-Sent Events for
 *             receiving responses and POST for sending requests.
 *   - http:   Streamable HTTP transport with optional OAuth 2.0 support
 *             (authorization code flow with PKCE, token refresh).
 *
 * Token-efficiency: No heavy SDK dependency — just Node.js built-ins.
 * Messages are logged at trace level only (stderr passthrough for stdio).
 */

import { spawn, type ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { createInterface } from "node:readline";
import * as crypto from "node:crypto";
import * as http from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// ── Types ──────────────────────────────────────────────────────────────

export interface StdioServerConfig {
  transport: "stdio";
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  timeout?: number;
}

export interface SseServerConfig {
  transport: "sse";
  name: string;
  url: string;
  headers?: Record<string, string>;
  timeout?: number;
}

export interface OAuthConfig {
  /** Enable OAuth for this HTTP server. */
  enabled: boolean;
  /** URL to the OAuth authorization server metadata (.well-known).
   * If omitted, the client will try to discover it from the MCP server. */
  authorizationServer?: string;
  /** Explicit authorization endpoint (overrides discovery). */
  authorizationUrl?: string;
  /** Explicit token endpoint (overrides discovery). */
  tokenUrl?: string;
  /** Dynamic client registration endpoint (overrides discovery). */
  registrationUrl?: string;
  /** Pre-registered client ID (skips dynamic registration if provided). */
  clientId?: string;
  /** Client secret (for confidential clients). */
  clientSecret?: string;
  /** Redirect URI for the authorization code callback.
   * Defaults to http://localhost:<port>/callback with a random port. */
  redirectUri?: string;
  /** Fixed redirect port (default: random available port). */
  redirectPort?: number;
  /** Scopes to request. */
  scopes?: string[];
  /** Path to a JSON file for persisting tokens across sessions.
   * Defaults to ~/.pi/agent/mcp-tokens/<server-name>.json */
  tokenStorePath?: string;
}

export interface HttpServerConfig {
  transport: "http";
  name: string;
  url: string;
  headers?: Record<string, string>;
  timeout?: number;
  /** Optional OAuth 2.0 configuration. */
  oauth?: OAuthConfig;
}

export type ServerConfig = StdioServerConfig | SseServerConfig | HttpServerConfig;

export interface OAuthStatus {
  /** Whether OAuth is configured for this server. */
  configured: boolean;
  /** Whether we currently hold a valid access token. */
  authenticated: boolean;
  /** Whether cached tokens exist on disk. */
  hasTokens: boolean;
  /** Unix-ms timestamp when the current token expires (if known). */
  tokenExpiry?: number;
  /** Scopes granted by the current token. */
  scopes?: string[];
  /** Path to the persisted token store. */
  tokenStorePath?: string | null;
}

export interface McpTool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export interface McpServerCapabilities {
  tools?: Record<string, unknown>;
  resources?: Record<string, unknown>;
  prompts?: Record<string, unknown>;
}

export interface InitializeResult {
  protocolVersion: string;
  capabilities: McpServerCapabilities;
  serverInfo?: {
    name: string;
    version: string;
  };
}

// ── JSON-RPC types ─────────────────────────────────────────────────────

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: unknown;
}

interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

type JsonRpcMessage = JsonRpcRequest | JsonRpcNotification | JsonRpcResponse;

// ── Error types ────────────────────────────────────────────────────────

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

// ── Transport interface ────────────────────────────────────────────────

interface Transport extends EventEmitter {
  start(): Promise<void>;
  send(message: JsonRpcRequest | JsonRpcNotification): void | Promise<void>;
  close(): void;
}

// ── Stdio Transport ────────────────────────────────────────────────────

class StdioTransport extends EventEmitter implements Transport {
  private process: ChildProcess | null = null;

  constructor(private readonly config: StdioServerConfig) {
    super();
  }

  async start(): Promise<void> {
    const { command, args = [], env, cwd } = this.config;

    const childEnv = {
      ...process.env,
      ...Object.fromEntries(
        Object.entries(env ?? {}).map(([k, v]) => [
          k,
          // Expand ${VAR} and $VAR in env values
          v.replace(/\$\{?(\w+)\}?/g, (_, name) => process.env[name] ?? ""),
        ]),
      ),
    };

    this.process = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: childEnv,
      cwd: cwd ?? process.cwd(),
    });

    // Read newline-delimited JSON from stdout
    const rl = createInterface({
      input: this.process.stdout!,
      crlfDelay: Infinity,
    });

    rl.on("line", (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        const msg = JSON.parse(trimmed) as JsonRpcMessage;
        if ("id" in msg && msg.id !== undefined && "method" in msg) {
          // Server→Client request (unlikely but spec-compliant)
          this.emit("request", msg);
        } else if ("id" in msg && msg.id !== undefined) {
          // Response to our request
          this.emit("response", msg as JsonRpcResponse);
        } else {
          // Notification from server
          this.emit("notification", msg as JsonRpcNotification);
        }
      } catch {
        // Non-JSON line (likely log output) — ignore
      }
    });

    // Passthrough stderr for debugging (suppressed in production)
    this.process.stderr?.on("data", (_data: Buffer) => {
      // MCP spec: stderr may contain log messages — ignore for token efficiency
    });

    this.process.on("exit", (code, signal) => {
      this.emit("close", { code, signal });
    });

    this.process.on("error", (err) => {
      this.emit("error", err);
    });

    // Wait briefly for the process to start
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
  }

  send(message: JsonRpcRequest | JsonRpcNotification): void {
    if (!this.process || this.process.killed) {
      throw new McpError("Transport closed");
    }
    const line = JSON.stringify(message) + "\n";
    this.process.stdin!.write(line);
  }

  close(): void {
    if (this.process && !this.process.killed) {
      // Send SIGTERM, then SIGKILL after a grace period
      this.process.kill("SIGTERM");
      setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.process.kill("SIGKILL");
        }
      }, 2000);
    }
    this.process = null;
  }
}

// ── SSE Transport ──────────────────────────────────────────────────────

class SseTransport extends EventEmitter implements Transport {
  private messageEndpoint: string | null = null;
  private endpointReceived = false;
  private endpointPromise: Promise<void>;
  private endpointResolve!: () => void;
  private abortController: AbortController | null = null;

  constructor(private readonly config: SseServerConfig) {
    super();
    this.endpointPromise = new Promise((resolve, reject) => {
      this.endpointResolve = resolve;
      // Timeout if no endpoint within 10s
      setTimeout(() => {
        if (!this.endpointReceived) {
          reject(new McpError("SSE endpoint not received within 10s"));
        }
      }, 10000);
    });
  }

  async start(): Promise<void> {
    this.abortController = new AbortController();
    const baseUrl = this.config.url.replace(/\/$/, "");

    // Connect to SSE endpoint
    const response = await fetch(baseUrl, {
      headers: {
        Accept: "text/event-stream",
        ...this.config.headers,
      },
      signal: this.abortController.signal,
    });

    if (!response.ok) {
      throw new McpError(`SSE connection failed: ${response.status} ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new McpError("SSE response has no body");

    const decoder = new TextDecoder();
    let buffer = "";

    // Parse SSE stream in background
    const readLoop = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          let eventType = "";
          let data = "";

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              data += line.slice(6);
            } else if (line === "") {
              // Empty line = event boundary
              if (eventType === "endpoint") {
                this.messageEndpoint = new URL(data.trim(), baseUrl).toString();
                this.endpointReceived = true;
                this.endpointResolve();
                this.emit("ready");
              } else if (eventType === "message" || eventType === "" || !eventType) {
                try {
                  const msg = JSON.parse(data.trim()) as JsonRpcMessage;
                  if ("id" in msg && msg.id !== undefined && "method" in msg) {
                    this.emit("request", msg);
                  } else if ("id" in msg && msg.id !== undefined) {
                    this.emit("response", msg as JsonRpcResponse);
                  } else {
                    this.emit("notification", msg as JsonRpcNotification);
                  }
                } catch {
                  // Ignore parse errors
                }
              }
              eventType = "";
              data = "";
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          this.emit("error", err);
        }
      }
    };

    readLoop().catch(() => {});
  }

  async send(message: JsonRpcRequest | JsonRpcNotification): Promise<void> {
    // Wait for the endpoint event if not yet received
    if (!this.endpointReceived) {
      await this.endpointPromise;
    }
    if (!this.messageEndpoint) {
      throw new McpError("SSE transport not ready (no endpoint received)");
    }

    const body = JSON.stringify(message);

    // Fire-and-forget POST (responses come via SSE)
    fetch(this.messageEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.config.headers,
      },
      body,
      signal: this.abortController?.signal,
    }).catch((err) => {
      if ((err as Error).name !== "AbortError") {
        this.emit("error", err);
      }
    });
  }

  close(): void {
    this.abortController?.abort();
    this.abortController = null;
    this.messageEndpoint = null;
  }
}

// ── OAuth 2.0 helpers ─────────────────────────────────────────────────

interface OAuthMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint?: string;
  scopes_supported?: string[];
  response_types_supported?: string[];
}

interface OAuthTokens {
  access_token: string;
  token_type: string;
  expires_at?: number;
  refresh_token?: string;
  scope?: string;
}

interface OAuthClientRegistration {
  client_id: string;
  client_secret?: string;
  registration_access_token?: string;
  registration_client_uri?: string;
}

/** Generate PKCE code verifier (43 random URL-safe chars). */
function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString("base64url").slice(0, 43);
}

/** Generate PKCE code challenge from verifier (S256 method). */
function generateCodeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

/** Generate a random state parameter for CSRF protection. */
function generateState(): string {
  return crypto.randomBytes(16).toString("hex");
}

// ── OAuth Token Manager ────────────────────────────────────────────────

class OAuthTokenManager {
  private tokens: OAuthTokens | null = null;
  private readonly storePath: string;

  constructor(storePath?: string) {
    this.storePath =
      storePath ?? path.join(os.homedir(), ".pi", "agent", "mcp-tokens", "default.json");
  }

  /** Load tokens from disk. */
  load(): OAuthTokens | null {
    try {
      if (fs.existsSync(this.storePath)) {
        const raw = fs.readFileSync(this.storePath, "utf-8");
        const parsed = JSON.parse(raw) as OAuthTokens;
        if (parsed.access_token) {
          this.tokens = parsed;
          return parsed;
        }
      }
    } catch {
      // Ignore load errors
    }
    return null;
  }

  /** Persist tokens to disk. */
  save(tokens: OAuthTokens): void {
    this.tokens = tokens;
    try {
      const dir = path.dirname(this.storePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.storePath, JSON.stringify(tokens, null, 2), {
        mode: 0o600,
      });
    } catch (err) {
      console.error(`[mcp:oauth] Failed to save tokens: ${err}`);
    }
  }

  /** Get a valid access token, refreshing if needed. */
  async getAccessToken(
    tokenEndpoint: string,
    clientId: string,
    clientSecret?: string,
  ): Promise<string | null> {
    if (!this.tokens) return null;

    // Check if token is still valid (5s buffer)
    if (this.tokens.expires_at && Date.now() < this.tokens.expires_at - 5000) {
      return this.tokens.access_token;
    }

    // Try to refresh
    if (this.tokens.refresh_token) {
      try {
        const newTokens = await refreshAccessToken(
          tokenEndpoint,
          this.tokens.refresh_token,
          clientId,
          clientSecret,
        );
        this.save(newTokens);
        return newTokens.access_token;
      } catch (err) {
        console.error(`[mcp:oauth] Token refresh failed: ${err}`);
        this.tokens = null;
        return null;
      }
    }

    this.tokens = null;
    return null;
  }

  /** Clear stored tokens. */
  clear(): void {
    this.tokens = null;
    try {
      if (fs.existsSync(this.storePath)) {
        fs.unlinkSync(this.storePath);
      }
    } catch {
      // Ignore
    }
  }
}

/**
 * Discover OAuth authorization server metadata from a well-known URL.
 */
async function discoverOAuthMetadata(
  serverUrl: string,
  config: OAuthConfig,
): Promise<OAuthMetadata> {
  // If explicit endpoints are provided, use them directly
  if (config.authorizationUrl && config.tokenUrl) {
    return {
      issuer: config.authorizationServer ?? "",
      authorization_endpoint: config.authorizationUrl,
      token_endpoint: config.tokenUrl,
      registration_endpoint: config.registrationUrl,
    };
  }

  // Try config-provided authorization server metadata URL
  if (config.authorizationServer) {
    const metaUrl = config.authorizationServer.replace(/\/$/, "");
    const resp = await fetch(metaUrl);
    if (!resp.ok) {
      throw new McpError(`OAuth metadata discovery failed (${resp.status}): ${metaUrl}`);
    }
    return (await resp.json()) as OAuthMetadata;
  }

  // Try to discover from the MCP server's well-known endpoint
  const wellKnownUrl = new URL("/.well-known/oauth-authorization-server", serverUrl).toString();

  try {
    const resp = await fetch(wellKnownUrl);
    if (resp.ok) {
      return (await resp.json()) as OAuthMetadata;
    }
  } catch {
    // Discovery failed, will fall back to explicit config
  }

  throw new McpError(
    "OAuth authorization server not discoverable. " +
      "Provide authorizationServer, authorizationUrl/tokenUrl, " +
      "or ensure the MCP server exposes .well-known/oauth-authorization-server",
  );
}

/**
 * Dynamically register an OAuth client with the authorization server.
 */
async function registerOAuthClient(
  registrationEndpoint: string,
  redirectUri: string,
  scopes: string[],
): Promise<OAuthClientRegistration> {
  const body = JSON.stringify({
    redirect_uris: [redirectUri],
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
    scope: scopes.join(" "),
  });

  const resp = await fetch(registrationEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new McpError(`OAuth client registration failed (${resp.status}): ${errText}`);
  }

  return (await resp.json()) as OAuthClientRegistration;
}

/** Start a local HTTP server to receive the OAuth redirect callback. */
function startRedirectServer(port: number): {
  server: http.Server;
  callbackPromise: Promise<string>;
} {
  let server: http.Server;

  const callbackPromise = new Promise<string>((resolve, reject) => {
    server = http.createServer((req, res) => {
      const reqUrl = new URL(req.url ?? "/", `http://localhost:${port}`);

      if (reqUrl.pathname === "/callback") {
        const code = reqUrl.searchParams.get("code");
        const error = reqUrl.searchParams.get("error");
        // CSRF state parameter received but not yet validated.
        // Future: validate against the expected state from runOAuthFlow.
        void reqUrl.searchParams.get("state");

        if (error) {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end(
            `<html><body><h1>Authorization Failed</h1><p>${error}</p><p>You may close this window.</p></body></html>`,
          );
          reject(new McpError(`OAuth authorization error: ${error}`));
        } else if (code) {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(
            `<html><body><h1>Authorization Successful</h1><p>You may close this window and return to your terminal.</p></body></html>`,
          );
          resolve(code);
        } else {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end(
            `<html><body><h1>Invalid Callback</h1><p>Missing authorization code. You may close this window.</p></body></html>`,
          );
          reject(new McpError("No authorization code received"));
        }
      } else {
        res.writeHead(404);
        res.end("Not found");
      }
    });

    server.on("error", (err) => {
      reject(err);
    });
  });

  return { server: server!, callbackPromise };
}

/** Find an available TCP port. */
function findAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = http.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      if (addr && typeof addr === "object") {
        const port = addr.port;
        srv.close(() => resolve(port));
      } else {
        srv.close(() => reject(new Error("Could not determine port")));
      }
    });
    srv.on("error", reject);
  });
}

/**
 * Exchange authorization code for tokens.
 */
async function exchangeCodeForTokens(
  tokenEndpoint: string,
  code: string,
  redirectUri: string,
  codeVerifier: string,
  clientId: string,
  clientSecret?: string,
): Promise<OAuthTokens> {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
    client_id: clientId,
  });

  if (clientSecret) {
    params.set("client_secret", clientSecret);
  }

  const resp = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new McpError(`Token exchange failed (${resp.status}): ${errText}`);
  }

  const data = (await resp.json()) as {
    access_token: string;
    token_type: string;
    expires_in?: number;
    refresh_token?: string;
    scope?: string;
  };

  return {
    access_token: data.access_token,
    token_type: data.token_type ?? "Bearer",
    expires_at: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
    refresh_token: data.refresh_token,
    scope: data.scope,
  };
}

/**
 * Refresh an expired access token.
 */
async function refreshAccessToken(
  tokenEndpoint: string,
  refreshToken: string,
  clientId: string,
  clientSecret?: string,
): Promise<OAuthTokens> {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
  });

  if (clientSecret) {
    params.set("client_secret", clientSecret);
  }

  const resp = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new McpError(`Token refresh failed (${resp.status}): ${errText}`);
  }

  const data = (await resp.json()) as {
    access_token: string;
    token_type: string;
    expires_in?: number;
    refresh_token?: string;
    scope?: string;
  };

  return {
    access_token: data.access_token,
    token_type: data.token_type ?? "Bearer",
    expires_at: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
    // Use new refresh token if provided, otherwise keep old one
    refresh_token: data.refresh_token ?? refreshToken,
    scope: data.scope,
  };
}

/**
 * Run the full OAuth authorization code flow with PKCE.
 * Opens a browser for user consent, captures the callback, and returns tokens.
 */
async function runOAuthFlow(
  oauth: OAuthConfig,
  metadata: OAuthMetadata,
  tokenManager: OAuthTokenManager,
  log?: (msg: string) => void,
): Promise<OAuthTokens> {
  // 1. Determine redirect URI
  let redirectPort = oauth.redirectPort;
  if (!redirectPort) {
    redirectPort = await findAvailablePort();
  }

  const redirectUri = oauth.redirectUri ?? `http://localhost:${redirectPort}/callback`;

  const scopes = oauth.scopes ?? [];

  // 2. Register client dynamically if no clientId provided
  let clientId = oauth.clientId;
  let clientSecret = oauth.clientSecret;

  if (!clientId && metadata.registration_endpoint) {
    log?.("Dynamically registering OAuth client...");
    try {
      const registration = await registerOAuthClient(
        metadata.registration_endpoint,
        redirectUri,
        scopes,
      );
      clientId = registration.client_id;
      clientSecret = registration.client_secret;
      log?.(`Registered client: ${clientId}`);
    } catch (err) {
      log?.(`Dynamic client registration failed (${err}), will try without it`);
    }
  }

  if (!clientId) {
    throw new McpError(
      "OAuth requires a client_id. Provide one via oauth.clientId or ensure the " +
        "authorization server supports dynamic client registration.",
    );
  }

  // Update token manager with the correct clientId for future refreshes
  // We store clientId in the token store path lookup

  // 3. Generate PKCE parameters
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = generateState();

  // 4. Build authorization URL
  const authParams = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
  });

  if (scopes.length > 0) {
    authParams.set("scope", scopes.join(" "));
  }

  const authUrl = `${metadata.authorization_endpoint}?${authParams.toString()}`;

  // 5. Start local redirect server
  const { server, callbackPromise } = startRedirectServer(redirectPort);

  await new Promise<void>((resolve, reject) => {
    server.listen(redirectPort, "127.0.0.1", () => resolve());
    server.on("error", reject);
  });

  try {
    // 6. Open browser for user authorization
    log?.(
      `Opening browser for OAuth authorization...\nIf the browser does not open, visit:\n  ${authUrl}`,
    );

    const { exec } = await import("node:child_process");
    const platform = process.platform;
    const openCmd =
      platform === "darwin"
        ? `open "${authUrl}"`
        : platform === "win32"
          ? `start "" "${authUrl}"`
          : `xdg-open "${authUrl}"`;
    exec(openCmd, (err) => {
      if (err) {
        // Browser open failed — show the URL prominently so the user can copy it
        log?.(`[OAuth] Could not open browser automatically.`);
        log?.(`[OAuth] Please visit this URL to authorize:\n  ${authUrl}`);
      }
    });

    // 7. Wait for callback (with 5-minute timeout)
    const timeoutMs = 300_000;
    const codePromise: Promise<string> = Promise.race([
      callbackPromise,
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new McpError("OAuth authorization timed out (5 min)")), timeoutMs),
      ),
    ]);

    const code = await codePromise;

    // 8. Exchange code for tokens
    log?.("Exchanging authorization code for tokens...");
    const tokens = await exchangeCodeForTokens(
      metadata.token_endpoint,
      code,
      redirectUri,
      codeVerifier,
      clientId,
      clientSecret,
    );

    // 9. Persist tokens
    tokenManager.save(tokens);
    log?.("OAuth authorization complete.");

    return tokens;
  } finally {
    // Clean up the redirect server
    server.close();
  }
}

// ── HTTP Transport (Streamable HTTP + OAuth) ───────────────────────────

class HttpTransport extends EventEmitter implements Transport {
  private abortController: AbortController | null = null;
  private accessToken: string | null = null;
  private tokenManager: OAuthTokenManager | null = null;
  private oauthMetadata: OAuthMetadata | null = null;
  private oauthClientId: string | null = null;
  private oauthReady = false;
  private sessionId: string | null = null;
  private baseUrl: string;
  private isOAuth: boolean;

  constructor(private readonly config: HttpServerConfig) {
    super();
    this.baseUrl = config.url.replace(/\/$/, "");
    this.isOAuth = config.oauth?.enabled === true;

    if (this.isOAuth && config.oauth) {
      const oauth = config.oauth;
      const storePath =
        oauth.tokenStorePath ??
        path.join(
          os.homedir(),
          ".pi",
          "agent",
          "mcp-tokens",
          `${sanitizeForFilename(config.name)}.json`,
        );
      this.tokenManager = new OAuthTokenManager(storePath);
    }
  }

  async start(): Promise<void> {
    // If OAuth is enabled, perform the auth flow first
    if (this.isOAuth && this.config.oauth) {
      await this.performOAuthFlow();
    }

    this.abortController = new AbortController();
  }

  private async performOAuthFlow(): Promise<void> {
    const oauth = this.config.oauth!;
    const log = (msg: string) => this.emit("oauthLog", msg);

    // 1. Discover OAuth metadata
    log("Discovering OAuth authorization server...");
    this.oauthMetadata = await discoverOAuthMetadata(this.baseUrl, oauth);

    // 2. Check for cached tokens first
    const cached = this.tokenManager!.load();
    if (cached) {
      const accessToken = await this.tokenManager!.getAccessToken(
        this.oauthMetadata.token_endpoint,
        oauth.clientId ?? "",
        oauth.clientSecret,
      );
      if (accessToken) {
        this.accessToken = accessToken;
        this.oauthClientId = oauth.clientId ?? "";
        this.oauthReady = true;
        log("Using cached OAuth tokens");
        return;
      }
    }

    // 3. Run the full authorization flow
    const tokens = await runOAuthFlow(oauth, this.oauthMetadata, this.tokenManager!, log);

    this.accessToken = tokens.access_token;
    this.oauthClientId = oauth.clientId ?? "";
    this.oauthReady = true;
  }

  private async ensureValidToken(): Promise<void> {
    if (!this.isOAuth || this.oauthReady) return;

    if (this.tokenManager && this.oauthMetadata) {
      const token = await this.tokenManager.getAccessToken(
        this.oauthMetadata.token_endpoint,
        this.oauthClientId ?? "",
        this.config.oauth?.clientSecret,
      );
      if (token) {
        this.accessToken = token;
        this.oauthReady = true;
        return;
      }
    }

    // Re-run the OAuth flow if token is missing/expired
    if (this.config.oauth) {
      await this.performOAuthFlow();
    }
  }

  async send(message: JsonRpcRequest | JsonRpcNotification): Promise<void> {
    // Ensure we have a valid token before sending
    await this.ensureValidToken();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...this.config.headers,
    };

    if (this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
    }

    // Include session ID for all requests after the initialize handshake
    if (this.sessionId) {
      headers["Mcp-Session-Id"] = this.sessionId;
    }

    const body = JSON.stringify(message);

    try {
      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers,
        body,
        signal: this.abortController?.signal,
      });

      // Capture Mcp-Session-Id from response headers (set on initialize response)
      const newSessionId = response.headers.get("Mcp-Session-Id");
      if (newSessionId) {
        this.sessionId = newSessionId;
      }

      if (!response.ok) {
        const errText = await response.text().catch(() => "");

        // Try to parse as a JSON-RPC error response first.
        // Streamable HTTP servers may return JSON-RPC errors with non-2xx
        // status codes (e.g. 400 for "no session ID" or "not initialized").
        // Those must be routed through the event system so the caller
        // receives a proper JSON-RPC error instead of a transport error.
        try {
          const errMsg = JSON.parse(errText);
          if (errMsg && typeof errMsg === "object" && errMsg.jsonrpc === "2.0") {
            if ("id" in errMsg && errMsg.id !== undefined && "method" in errMsg) {
              this.emit("request", errMsg);
              return;
            } else if ("id" in errMsg && errMsg.id !== undefined) {
              this.emit("response", errMsg as JsonRpcResponse);
              return;
            } else if ("id" in message && message.id !== undefined) {
              // Response has no id but we know it — synthesize a proper response
              // so the pending callback can be settled (JSON-RPC allows omitting
              // id for parse errors, but servers sometimes omit it for other
              // errors too).
              this.emit("response", {
                jsonrpc: "2.0",
                id: message.id,
                error: errMsg.error,
              } as JsonRpcResponse);
              return;
            } else {
              // No id in either direction — emit as notification
              this.emit("notification", errMsg as JsonRpcNotification);
              return;
            }
          }
        } catch {
          // Not valid JSON-RPC — fall through to transport error handling
        }

        // Check for OAuth errors
        if (response.status === 401 && this.isOAuth && this.config.oauth) {
          // Token may have expired — try to refresh and retry once.
          // Clear session ID: a new token may need a fresh session.
          this.oauthReady = false;
          this.accessToken = null;
          this.sessionId = null;
          await this.ensureValidToken();

          // Retry the request with new token
          const retryHeaders: Record<string, string> = {
            ...headers,
          };
          delete retryHeaders["Mcp-Session-Id"];
          if (this.accessToken) {
            retryHeaders["Authorization"] = `Bearer ${this.accessToken}`;
          }
          const retryResp = await fetch(this.baseUrl, {
            method: "POST",
            headers: retryHeaders,
            body,
            signal: this.abortController?.signal,
          });

          // Capture session ID from retry response
          const retrySessionId = retryResp.headers.get("Mcp-Session-Id");
          if (retrySessionId) {
            this.sessionId = retrySessionId;
          }

          if (retryResp.ok) {
            await this.handleResponse(retryResp, message);
            return;
          }

          // Retry also returned an error — try to parse as JSON-RPC
          const retryErrText = await retryResp.text().catch(() => "");
          try {
            const retryErrMsg = JSON.parse(retryErrText);
            if (retryErrMsg && typeof retryErrMsg === "object" && retryErrMsg.jsonrpc === "2.0") {
              if ("id" in retryErrMsg && retryErrMsg.id !== undefined) {
                this.emit("response", retryErrMsg as JsonRpcResponse);
                return;
              } else if ("id" in message && message.id !== undefined) {
                // Synthesize response with known id
                this.emit("response", {
                  jsonrpc: "2.0",
                  id: message.id,
                  error: retryErrMsg.error,
                } as JsonRpcResponse);
                return;
              } else {
                this.emit("notification", retryErrMsg as JsonRpcNotification);
                return;
              }
            }
          } catch {
            // Fall through
          }

          throw new McpError(
            `HTTP request failed (${retryResp.status}): ${retryErrText.slice(0, 200)}`,
          );
        }

        // MCP auth-required check: if server returns 401/403 with JSON-RPC error
        // containing auth info, try to discover and run OAuth if not already done
        if ([401, 403].includes(response.status) && !this.isOAuth) {
          try {
            const errorBody = JSON.parse(errText);
            // Check for MCP auth required pattern
            if (
              errorBody.error ||
              errText.includes("auth") ||
              errText.includes("unauthorized") ||
              errText.includes("OAuth")
            ) {
              throw new McpError(
                `Server requires authentication (HTTP ${response.status}). ` +
                  `Add oauth config to your MCP server settings.`,
              );
            }
          } catch (err) {
            if (err instanceof McpError) throw err;
          }
        }

        throw new McpError(`HTTP request failed (${response.status}): ${errText.slice(0, 200)}`);
      }

      await this.handleResponse(response, message);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      throw err;
    }
  }

  /** Parse an HTTP response — either direct JSON or SSE stream. */
  private async handleResponse(
    response: Response,
    request: JsonRpcRequest | JsonRpcNotification,
  ): Promise<void> {
    const contentType = response.headers.get("content-type") ?? "";

    if (contentType.includes("text/event-stream")) {
      // Server → SSE streaming response
      await this.handleSseStream(response, request);
    } else {
      // Direct JSON response
      const text = await response.text();
      if (!text.trim()) return;

      try {
        const msg = JSON.parse(text) as JsonRpcMessage;
        if ("id" in msg && msg.id !== undefined && "method" in msg) {
          this.emit("request", msg);
        } else if ("id" in msg && msg.id !== undefined) {
          this.emit("response", msg as JsonRpcResponse);
        } else {
          this.emit("notification", msg as JsonRpcNotification);
        }
      } catch {
        // Non-JSON response — emit as error notification
        this.emit("error", new McpError(`Unexpected response: ${text.slice(0, 200)}`));
      }
    }
  }

  /** Handle SSE stream from the server. */
  private async handleSseStream(
    response: Response,
    _request: JsonRpcRequest | JsonRpcNotification,
  ): Promise<void> {
    const reader = response.body?.getReader();
    if (!reader) {
      this.emit("error", new McpError("SSE response has no body"));
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let eventType = "";
    let data = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            data += line.slice(6);
          } else if (line === "") {
            // Event boundary
            if (eventType === "message" || eventType === "" || !eventType) {
              try {
                const msg = JSON.parse(data.trim()) as JsonRpcMessage;
                if ("id" in msg && msg.id !== undefined && "method" in msg) {
                  this.emit("request", msg);
                } else if ("id" in msg && msg.id !== undefined) {
                  this.emit("response", msg as JsonRpcResponse);
                } else {
                  this.emit("notification", msg as JsonRpcNotification);
                }
              } catch {
                // Ignore parse errors
              }
            } else if (eventType === "error") {
              this.emit("error", new McpError(`SSE error event: ${data.trim()}`));
            }
            eventType = "";
            data = "";
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        this.emit("error", err);
      }
    }
  }

  /** Clear cached OAuth tokens (forces re-auth on next connect). */
  clearOAuthTokens(): void {
    this.tokenManager?.clear();
    this.accessToken = null;
    this.oauthReady = false;
    this.oauthMetadata = null;
    this.sessionId = null;
  }

  /** Get the path to the persisted token store, if any. */
  getTokenStorePath(): string | null {
    if (!this.isOAuth) return null;
    return (
      this.config.oauth?.tokenStorePath ??
      path.join(
        os.homedir(),
        ".pi",
        "agent",
        "mcp-tokens",
        `${sanitizeForFilename(this.config.name)}.json`,
      )
    );
  }

  /** Return OAuth diagnostic info for the current transport. */
  getOAuthStatus(): OAuthStatus {
    const cached = this.tokenManager?.load() ?? null;
    return {
      configured: this.isOAuth,
      authenticated: this.oauthReady,
      hasTokens: cached !== null,
      tokenExpiry: cached?.expires_at,
      scopes: cached?.scope?.split(" ") ?? this.config.oauth?.scopes,
      tokenStorePath: this.getTokenStorePath(),
    };
  }

  close(): void {
    this.abortController?.abort();
    this.abortController = null;
    this.accessToken = null;
    this.oauthReady = false;
    this.sessionId = null;
  }
}

/** Sanitize a server name for use in filenames. */
function sanitizeForFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 64);
}

// ── MCP Client ─────────────────────────────────────────────────────────

export class McpClient {
  private transport: Transport | null = null;
  private nextId = 1;
  private pending = new Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  private serverCapabilities: McpServerCapabilities | null = null;
  private serverInfo: InitializeResult["serverInfo"] | null = null;
  private _tools: McpTool[] | null = null;
  private connected = false;
  private closed = false;
  private log: ((msg: string) => void) | null = null;

  constructor(
    private readonly config: ServerConfig,
    private readonly defaultTimeout = 30000,
  ) {}

  /** Attach a logger (for extension-side reporting). */
  setLogger(fn: (msg: string) => void): void {
    this.log = fn;
  }

  private logInfo(msg: string): void {
    this.log?.(`[mcp:${this.config.name}] ${msg}`);
  }

  /** Connect to the MCP server and perform the initialization handshake. */
  async connect(): Promise<void> {
    if (this.connected) return;
    if (this.closed) throw new McpError("Client closed");

    try {
      this.transport = this.createTransport();

      // Wire up response handler
      this.transport.on("response", (msg: JsonRpcResponse) => {
        const pending = this.pending.get(msg.id);
        if (!pending) return;
        this.pending.delete(msg.id);
        clearTimeout(pending.timer);

        if (msg.error) {
          pending.reject(new McpError(msg.error.message, msg.error.code, msg.error.data));
        } else {
          pending.resolve(msg.result);
        }
      });

      this.transport.on("close", () => {
        this.connected = false;
        this.logInfo("Transport closed");
      });

      this.transport.on("error", (err: Error) => {
        this.logInfo(`Transport error: ${err.message}`);
      });

      this.transport.on("oauthLog", (msg: string) => {
        this.logInfo(`OAuth: ${msg}`);
      });

      await this.transport.start();

      // MCP initialization handshake
      const initResult = await this.request<InitializeResult>("initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {},
        },
        clientInfo: {
          name: "pi-mcp-extension",
          version: "1.0.0",
        },
      });

      this.serverCapabilities = initResult.capabilities;
      this.serverInfo = initResult.serverInfo;

      // Send initialized notification
      Promise.resolve(
        this.transport.send({
          jsonrpc: "2.0",
          method: "notifications/initialized",
        }),
      ).catch((err: Error) => {
        this.logInfo(`Failed to send initialized notification: ${err.message}`);
      });

      this.connected = true;
      this.logInfo(
        `Connected (v${initResult.protocolVersion})${
          this.serverInfo ? ` — ${this.serverInfo.name} v${this.serverInfo.version}` : ""
        }`,
      );
    } catch (err) {
      this.transport?.close();
      this.transport = null;
      throw err;
    }
  }

  private createTransport(): Transport {
    switch (this.config.transport) {
      case "stdio":
        return new StdioTransport(this.config);
      case "sse":
        return new SseTransport(this.config);
      case "http":
        return new HttpTransport(this.config);
      default:
        throw new McpError(`Unsupported transport: ${(this.config as any).transport}`);
    }
  }

  /** Send a JSON-RPC request and wait for the response. */
  async request<T = unknown>(method: string, params?: unknown, timeout?: number): Promise<T> {
    if (!this.transport) throw new McpError("Not connected");

    const id = this.nextId++;
    const effectiveTimeout = timeout ?? this.defaultTimeout;

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new McpError(`Request timed out: ${method}`));
      }, effectiveTimeout);

      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer });

      try {
        const result = this.transport!.send({
          jsonrpc: "2.0",
          id,
          method,
          params,
        });
        if (result instanceof Promise) {
          result.catch((err) => {
            this.pending.delete(id);
            clearTimeout(timer);
            reject(err);
          });
        }
      } catch (err) {
        this.pending.delete(id);
        clearTimeout(timer);
        reject(err);
      }
    });
  }

  /** List available tools from the server. Result is cached after first call. */
  async listTools(): Promise<McpTool[]> {
    if (this._tools) return this._tools;

    if (!this.serverCapabilities?.tools) {
      this._tools = [];
      return [];
    }

    const result = await this.request<{ tools: McpTool[] }>("tools/list");
    this._tools = result.tools ?? [];
    this.logInfo(`Found ${this._tools.length} tool(s)`);
    return this._tools;
  }

  /** Call a tool on the server and return the result. */
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
    const result = await this.request<{
      content: Array<{
        type: "text" | "image" | "resource";
        text?: string;
        data?: string;
        mimeType?: string;
      }>;
      isError?: boolean;
    }>("tools/call", {
      name,
      arguments: args,
    });

    return result;
  }

  /** Whether the server supports tools. */
  get hasTools(): boolean {
    return !!this.serverCapabilities?.tools;
  }

  /** Server capabilities from the initialize response. */
  get capabilities(): McpServerCapabilities | null {
    return this.serverCapabilities;
  }

  /** Server info from the initialize response. */
  get info(): InitializeResult["serverInfo"] | null {
    return this.serverInfo;
  }

  /** Unique server name. */
  get serverName(): string {
    return this.config.name;
  }

  /** Whether this server is configured with OAuth. */
  get hasOAuth(): boolean {
    return (
      this.config.transport === "http" && (this.config as HttpServerConfig).oauth?.enabled === true
    );
  }

  /** Get the OAuth config for this server, if any. */
  get oauthConfig(): OAuthConfig | null {
    if (this.config.transport === "http") {
      return (this.config as HttpServerConfig).oauth ?? null;
    }
    return null;
  }

  /** Get OAuth authentication status for diagnostics. */
  getOAuthStatus(): OAuthStatus | null {
    if (this.transport instanceof HttpTransport) {
      return (this.transport as HttpTransport).getOAuthStatus();
    }
    if (this.hasOAuth) {
      // Transport not yet created — check config + token file
      const storePath =
        this.oauthConfig?.tokenStorePath ??
        path.join(
          os.homedir(),
          ".pi",
          "agent",
          "mcp-tokens",
          `${sanitizeForFilename(this.config.name)}.json`,
        );
      let hasTokens = false;
      let tokenExpiry: number | undefined;
      try {
        if (fs.existsSync(storePath)) {
          const raw = fs.readFileSync(storePath, "utf-8");
          const parsed = JSON.parse(raw);
          if (parsed.access_token) {
            hasTokens = true;
            tokenExpiry = parsed.expires_at;
          }
        }
      } catch {
        // Ignore
      }
      return {
        configured: true,
        authenticated: false,
        hasTokens,
        tokenExpiry,
        scopes: this.oauthConfig?.scopes,
        tokenStorePath: storePath,
      };
    }
    return null;
  }

  /** Clear OAuth tokens (forces re-auth on next connect). */
  clearOAuthTokens(): void {
    if (this.transport instanceof HttpTransport) {
      (this.transport as HttpTransport).clearOAuthTokens();
    } else if (this.hasOAuth) {
      // Transport not created yet — delete token file directly
      const storePath =
        this.oauthConfig?.tokenStorePath ??
        path.join(
          os.homedir(),
          ".pi",
          "agent",
          "mcp-tokens",
          `${sanitizeForFilename(this.config.name)}.json`,
        );
      try {
        if (fs.existsSync(storePath)) {
          fs.unlinkSync(storePath);
        }
      } catch {
        // Ignore
      }
    }
  }

  /** Disconnect and clean up. */
  disconnect(): void {
    this.closed = true;
    this.connected = false;

    // Reject all pending requests
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new McpError("Client disconnected"));
    }
    this.pending.clear();

    this.transport?.close();
    this.transport = null;
    this._tools = null;
  }
}
