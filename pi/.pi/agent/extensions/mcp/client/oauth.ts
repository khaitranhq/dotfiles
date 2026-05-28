/**
 * MCP OAuth - Authentication, token storage, provider, and flow management.
 *
 * Dependency order:
 *   1. AuthStorage      (low-level token/client persistence)
 *   2. McpOAuthProvider  (MCP SDK OAuthClientProvider interface)
 *   3. OAuthFlow         (high-level OAuth flow orchestration)
 */

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import * as path from "node:path";
import { spawn } from "node:child_process";
import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import { auth as runSdkAuth, UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import type {
  OAuthClientMetadata,
  OAuthTokens,
  OAuthClientInformation,
  OAuthClientInformationFull,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { defaultConfig } from "../../shared/config";
import { callbackServer } from "./oauth-callback";
import type { ServerEntry } from "../core/types";

// ── Re-exports ─────────────────────────────────────────────────────────

export { UnauthorizedError };

// ═══════════════════════════════════════════════════════════════════════
// 1. AuthStorage — Token + client info persistence
// ═══════════════════════════════════════════════════════════════════════

export interface StoredTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  scope?: string;
}

export interface StoredClientInfo {
  clientId: string;
  clientSecret?: string;
  clientIdIssuedAt?: number;
  clientSecretExpiresAt?: number;
  redirectUris?: string[];
}

interface AuthEntry {
  tokens?: StoredTokens;
  clientInfo?: StoredClientInfo;
  codeVerifier?: string;
  oauthState?: string;
  serverUrl?: string;
}

export class AuthStorage {
  private readonly dir: string;
  private readonly tokensPath: string;
  private readonly storedServerUrl?: string;

  constructor(serverName: string, serverUrl?: string) {
    this.dir = this.computeDir(serverName);
    this.tokensPath = path.join(this.dir, "tokens.json");
    this.storedServerUrl = serverUrl;
  }

  clearAll(): void {
    this.remove();
  }
  clearClientInfo(): void {
    this.clearField("clientInfo");
  }
  clearCodeVerifier(): void {
    this.clearField("codeVerifier");
  }
  clearOAuthState(): void {
    this.clearField("oauthState");
  }
  clearTokens(): void {
    this.clearField("tokens");
  }

  get clientInfo(): StoredClientInfo | undefined {
    return this.getEntry()?.clientInfo;
  }
  set clientInfo(info: StoredClientInfo) {
    this.update("clientInfo", info);
  }

  get codeVerifier(): string | undefined {
    return this.getEntry()?.codeVerifier;
  }
  set codeVerifier(v: string) {
    this.update("codeVerifier", v);
  }

  getEntry(): AuthEntry | undefined {
    try {
      if (!existsSync(this.tokensPath)) return undefined;
      return JSON.parse(readFileSync(this.tokensPath, "utf-8")) as AuthEntry;
    } catch {
      return undefined;
    }
  }

  getForUrl(serverUrl: string): AuthEntry | undefined {
    const entry = this.getEntry();
    if (!entry) return undefined;
    // Backward-compat: if entry lacks serverUrl (older storage), trust it —
    // storage is already scoped to one server via SHA-256 directory.
    if (!entry.serverUrl) return entry;
    if (entry.serverUrl !== serverUrl) return undefined;
    return entry;
  }

  get hasTokens(): boolean {
    return !!this.getEntry()?.tokens;
  }

  get isExpired(): boolean | null {
    const entry = this.getEntry();
    if (!entry?.tokens) return null;
    if (!entry.tokens.expiresAt) return false;
    return entry.tokens.expiresAt < Date.now() / 1000;
  }

  get oauthState(): string | undefined {
    return this.getEntry()?.oauthState;
  }
  set oauthState(s: string) {
    this.update("oauthState", s);
  }

  remove(): void {
    try {
      if (existsSync(this.tokensPath)) writeFileSync(this.tokensPath, "{}", { mode: 0o600 });
      if (existsSync(this.dir)) {
        try {
          rmSync(this.dir, { recursive: true });
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* ignore */
    }
  }

  saveEntry(entry: AuthEntry, serverUrl?: string): void {
    if (serverUrl) entry.serverUrl = serverUrl;
    else if (!entry.serverUrl && this.storedServerUrl) entry.serverUrl = this.storedServerUrl;
    this.ensureDir();
    writeFileSync(this.tokensPath, JSON.stringify(entry, null, 2), { mode: 0o600 });
  }

  get tokens(): StoredTokens | undefined {
    return this.getEntry()?.tokens;
  }
  set tokens(t: StoredTokens) {
    this.update("tokens", t);
  }

  private clearField(key: keyof AuthEntry): void {
    const entry = this.getEntry();
    if (entry) {
      delete entry[key];
      this.saveEntry(entry);
    }
  }

  private computeDir(name: string): string {
    const storageKey = createHash("sha256").update(name, "utf8").digest("hex");
    const base = process.env.MCP_OAUTH_DIR?.trim() || path.join(defaultConfig.getAgentDir(), "mcp");
    return path.join(base, `sha256-${storageKey}`);
  }

  private ensureDir(): void {
    if (!existsSync(this.dir)) mkdirSync(this.dir, { recursive: true, mode: 0o700 });
  }

  private update<K extends keyof AuthEntry>(key: K, value: AuthEntry[K]): void {
    const entry = this.getEntry() ?? {};
    entry[key] = value;
    this.saveEntry(entry);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// 2. McpOAuthProvider — MCP SDK OAuthClientProvider implementation
// ═══════════════════════════════════════════════════════════════════════

const DEFAULT_PORT = 19876;
const DEFAULT_PATH = "/callback";

let configuredPort = DEFAULT_PORT;
if (process.env.MCP_OAUTH_CALLBACK_PORT) {
  const p = Number.parseInt(process.env.MCP_OAUTH_CALLBACK_PORT, 10);
  if (Number.isInteger(p) && p > 0 && p <= 65535) configuredPort = p;
}

let activePort = configuredPort;
let activePath = DEFAULT_PATH;

export function getConfiguredOAuthCallbackPort(): number {
  return configuredPort;
}
export function getOAuthCallbackPath(): string {
  return activePath;
}
export function getOAuthCallbackPort(): number {
  return activePort;
}

export function setOAuthCallbackPath(path: string): void {
  activePath = path.startsWith("/") ? path : `/${path}`;
}

export function setOAuthCallbackPort(port: number): void {
  activePort = port;
}

export const DEFAULT_OAUTH_CALLBACK_PATH = DEFAULT_PATH;

export interface McpOAuthConfig {
  grantType?: "authorization_code" | "client_credentials";
  clientId?: string;
  clientSecret?: string;
  scope?: string;
  redirectUri?: string;
  clientName?: string;
  clientUri?: string;
}

interface McpOAuthCallbacks {
  onRedirect: (url: URL) => void | Promise<void>;
}

export class McpOAuthProvider implements OAuthClientProvider {
  private readonly redirectUrlSnapshot: string | undefined;
  private readonly storage: AuthStorage;

  constructor(
    private serverName: string,
    private serverUrl: string,
    private config: McpOAuthConfig,
    private callbacks: McpOAuthCallbacks,
  ) {
    this.storage = new AuthStorage(serverName, serverUrl);
    this.redirectUrlSnapshot =
      config.grantType === "client_credentials"
        ? undefined
        : (config.redirectUri ??
          `http://localhost:${getOAuthCallbackPort()}${getOAuthCallbackPath()}`);
  }

  get clientMetadata(): OAuthClientMetadata {
    if (this.usesClientCredentials) {
      return {
        client_name: this.config.clientName ?? "Khai Tran AGENT",
        client_uri: this.config.clientUri ?? "https://github.com/khaitranrh",
        redirect_uris: [],
        grant_types: ["client_credentials"],
        token_endpoint_auth_method: this.config.clientSecret ? "client_secret_post" : "none",
      };
    }
    if (!this.redirectUrl) throw new Error("redirectUrl is required for authorization_code flow");
    return {
      redirect_uris: [this.redirectUrl],
      client_name: this.config.clientName ?? "Khai Tran Agent",
      client_uri: this.config.clientUri ?? "https://github.com/khaitranrh",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: this.config.clientSecret ? "client_secret_post" : "none",
    };
  }

  get redirectUrl(): string | undefined {
    return this.redirectUrlSnapshot;
  }

  private get usesClientCredentials(): boolean {
    return this.config.grantType === "client_credentials";
  }

  async clientInformation(): Promise<OAuthClientInformation | undefined> {
    if (this.config.clientId) {
      return { client_id: this.config.clientId, client_secret: this.config.clientSecret };
    }
    const entry = this.storage.getForUrl(this.serverUrl);
    if (entry?.clientInfo) {
      if (
        entry.clientInfo.clientSecretExpiresAt &&
        entry.clientInfo.clientSecretExpiresAt < Date.now() / 1000
      )
        return undefined;
      return { client_id: entry.clientInfo.clientId, client_secret: entry.clientInfo.clientSecret };
    }
    return undefined;
  }

  async codeVerifier(): Promise<string> {
    if (this.usesClientCredentials)
      throw new Error("codeVerifier is not used for client_credentials flow");
    const entry = this.storage.getForUrl(this.serverUrl);
    if (!entry?.codeVerifier)
      throw new Error(`No code verifier saved for MCP server: ${this.serverName}`);
    return entry.codeVerifier;
  }

  async invalidateCredentials(type: "all" | "client" | "tokens"): Promise<void> {
    switch (type) {
      case "all":
        this.storage.clearAll();
        break;
      case "client":
        this.storage.clearClientInfo();
        break;
      case "tokens":
        this.storage.clearTokens();
        break;
    }
  }

  prepareTokenRequest(scope?: string): URLSearchParams | undefined {
    if (!this.usesClientCredentials) return undefined;
    const params = new URLSearchParams({ grant_type: "client_credentials" });
    const s = scope ?? this.config.scope;
    if (s) params.set("scope", s);
    return params;
  }

  async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
    if (this.usesClientCredentials)
      throw new Error("redirectToAuthorization is not used for client_credentials flow");
    const entry = this.storage.getForUrl(this.serverUrl);
    if (!entry?.oauthState)
      throw new UnauthorizedError(`Re-authentication required for MCP server: ${this.serverName}`);
    await this.callbacks.onRedirect(authorizationUrl);
  }

  async saveClientInformation(info: OAuthClientInformationFull): Promise<void> {
    this.storage.clientInfo = {
      clientId: info.client_id,
      clientSecret: info.client_secret,
      clientIdIssuedAt: info.client_id_issued_at,
      clientSecretExpiresAt: info.client_secret_expires_at,
      redirectUris: info.redirect_uris ?? (this.redirectUrl ? [this.redirectUrl] : undefined),
    };
  }

  async saveCodeVerifier(codeVerifier: string): Promise<void> {
    this.storage.codeVerifier = codeVerifier;
  }
  async saveState(state: string): Promise<void> {
    this.storage.oauthState = state;
  }

  async saveTokens(tokens: OAuthTokens): Promise<void> {
    this.storage.tokens = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expires_in ? Date.now() / 1000 + tokens.expires_in : undefined,
      scope: tokens.scope,
    };
  }

  async state(): Promise<string> {
    if (this.usesClientCredentials)
      throw new Error("state is not used for client_credentials flow");
    const entry = this.storage.getForUrl(this.serverUrl);
    if (!entry?.oauthState)
      throw new UnauthorizedError(`Re-authentication required for MCP server: ${this.serverName}`);
    return entry.oauthState;
  }

  async tokens(): Promise<OAuthTokens | undefined> {
    const entry = this.storage.getForUrl(this.serverUrl);
    if (!entry?.tokens) return undefined;
    return {
      access_token: entry.tokens.accessToken,
      token_type: "Bearer",
      refresh_token: entry.tokens.refreshToken,
      expires_in: entry.tokens.expiresAt
        ? Math.max(0, Math.floor(entry.tokens.expiresAt - Date.now() / 1000))
        : undefined,
      scope: entry.tokens.scope,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════
// 3. OAuthFlow — High-level OAuth orchestration
// ═══════════════════════════════════════════════════════════════════════

type AuthStatus = "authenticated" | "expired" | "not_authenticated";

const pendingTransports = new Map<string, StreamableHTTPClientTransport>();
const pendingAuthentications = new Map<string, Promise<AuthStatus>>();
const pendingRefreshes = new Map<string, Promise<StoredTokens | null>>();

export function extractOAuthConfig(definition: ServerEntry): McpOAuthConfig {
  if (definition.oauth === false) return {};
  const config: McpOAuthConfig = {};
  const o = definition.oauth;
  if (o?.grantType) config.grantType = o.grantType;
  if (o?.clientId) config.clientId = o.clientId;
  if (o?.clientSecret) config.clientSecret = o.clientSecret;
  if (o?.scope) config.scope = o.scope;
  if (o?.redirectUri !== undefined) {
    if (typeof o.redirectUri !== "string") throw new Error("OAuth redirectUri must be a string");
    const uri = o.redirectUri.trim();
    if (!uri) throw new Error("OAuth redirectUri must not be empty");
    config.redirectUri = uri;
  }
  if (o?.clientName !== undefined) {
    if (typeof o.clientName !== "string") throw new Error("OAuth clientName must be a string");
    const name = o.clientName.trim();
    if (!name) throw new Error("OAuth clientName must not be empty");
    config.clientName = name;
  }
  if (o?.clientUri !== undefined) {
    if (typeof o.clientUri !== "string") throw new Error("OAuth clientUri must be a string");
    const uri = o.clientUri.trim();
    if (!uri) throw new Error("OAuth clientUri must not be empty");
    config.clientUri = uri;
  }
  return config;
}

export function supportsOAuth(definition: ServerEntry): boolean {
  if (!definition.url) return false;
  if (definition.auth === false) return false;
  if (definition.oauth === false) return false;
  if (definition.auth === "oauth") return true;
  if (definition.headers) {
    const hasAuth = Object.keys(definition.headers).some(
      (k) => k.toLowerCase() === "authorization",
    );
    if (hasAuth) return false;
  }
  return definition.auth === undefined;
}

export class OAuthFlow {
  readonly storage: AuthStorage;

  constructor(
    private readonly serverName: string,
    private readonly serverUrl: string,
    private readonly definition?: ServerEntry,
  ) {
    this.storage = new AuthStorage(serverName, serverUrl);
  }

  get authStatus(): AuthStatus {
    if (!this.storage.hasTokens) return "not_authenticated";
    return this.storage.isExpired ? "expired" : "authenticated";
  }

  async authenticate(): Promise<AuthStatus> {
    // Avoid concurrent runSdkAuth: await any in-flight refresh before starting auth.
    const pendingRefresh = pendingRefreshes.get(this.serverName);
    if (pendingRefresh) {
      try {
        await pendingRefresh;
      } catch {
        /* refresh failed — proceed with full auth */
      }
    }

    const inFlight = pendingAuthentications.get(this.serverName);
    if (inFlight) return inFlight;

    const op = this.doAuthenticate();
    pendingAuthentications.set(this.serverName, op);
    try {
      return await op;
    } finally {
      if (pendingAuthentications.get(this.serverName) === op)
        pendingAuthentications.delete(this.serverName);
    }
  }

  async removeAuth(): Promise<void> {
    pendingAuthentications.delete(this.serverName);
    pendingRefreshes.delete(this.serverName);
    const oauthState = this.storage.oauthState;
    if (oauthState) callbackServer.cancel(oauthState);
    const pt = pendingTransports.get(this.serverName);
    if (pt) {
      pendingTransports.delete(this.serverName);
      await pt.close().catch(() => {});
    }
    this.storage.clearAll();
    console.log(`MCP Auth: Removed credentials for ${this.serverName}`);
  }

  /**
   * Check token validity and attempt refresh if expired.
   * Returns null when tokens are missing or refresh fails.
   */
  async validToken(): Promise<StoredTokens | null> {
    const entry = this.storage.getForUrl(this.serverUrl);
    if (!entry?.tokens) return null;
    if (this.storage.isExpired !== true) return entry.tokens;
    if (!entry.tokens.refreshToken) return null;
    return this.doRefresh();
  }

  private async completeAuth(authorizationCode: string): Promise<AuthStatus> {
    const transport = pendingTransports.get(this.serverName);
    if (!transport) throw new Error(`No pending OAuth flow for server: ${this.serverName}`);

    try {
      await transport.finishAuth(authorizationCode);
      return "authenticated";
    } finally {
      pendingTransports.delete(this.serverName);
      await transport.close().catch(() => {});
    }
  }

  private async doAuthenticate(): Promise<AuthStatus> {
    const { authorizationUrl } = await this.startAuth();
    if (!authorizationUrl) return "authenticated";

    const oauthState = this.storage.oauthState;
    if (!oauthState) throw new Error("OAuth state not found");

    const callbackPromise = callbackServer.wait(oauthState);
    try {
      console.log(`MCP Auth: Opening browser for ${this.serverName}`);
      await openBrowser(authorizationUrl);
      const code = await callbackPromise;

      if (this.storage.oauthState !== oauthState) {
        this.storage.clearOAuthState();
        throw new Error("OAuth state mismatch - potential CSRF attack");
      }
      this.storage.clearOAuthState();
      return await this.completeAuth(code);
    } catch (error) {
      callbackServer.cancel(oauthState);
      this.storage.clearOAuthState();
      const pt = pendingTransports.get(this.serverName);
      if (pt) {
        pendingTransports.delete(this.serverName);
        await pt.close().catch(() => {});
      }
      throw error;
    }
  }

  private async doRefresh(): Promise<StoredTokens | null> {
    // Deduplicate concurrent refresh attempts.
    const inFlight = pendingRefreshes.get(this.serverName);
    if (inFlight) return inFlight;

    const op = this.doRefreshImpl();
    pendingRefreshes.set(this.serverName, op);
    try {
      return await op;
    } finally {
      if (pendingRefreshes.get(this.serverName) === op) pendingRefreshes.delete(this.serverName);
    }
  }

  private async doRefreshImpl(): Promise<StoredTokens | null> {
    // Avoid concurrent runSdkAuth: await any in-flight auth before starting refresh.
    const pendingAuth = pendingAuthentications.get(this.serverName);
    if (pendingAuth) {
      try {
        await pendingAuth;
      } catch {
        /* authenticate failed — proceed with our own refresh attempt */
      }
    }

    console.log(`MCP Auth: Token expired for ${this.serverName}, attempting refresh`);
    try {
      const config = this.definition ? extractOAuthConfig(this.definition) : {};
      const provider = new McpOAuthProvider(this.serverName, this.serverUrl, config, {
        onRedirect: async () => {
          throw new UnauthorizedError(
            `Interactive re-authentication required for ${this.serverName}. Run /mcp-auth ${this.serverName}.`,
          );
        },
      });

      const result = await runSdkAuth(provider, { serverUrl: this.serverUrl });
      if (result !== "AUTHORIZED") {
        console.warn(`MCP Auth: Token refresh returned ${result} for ${this.serverName}`);
        return null;
      }
      return this.storage.getForUrl(this.serverUrl)?.tokens ?? null;
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        console.warn(`MCP Auth: Re-auth needed for ${this.serverName}: ${error.message}`);
      } else {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`MCP Auth: Token refresh failed for ${this.serverName}: ${message}`);
      }
      return null;
    }
  }

  private async startAuth(): Promise<{ authorizationUrl: string }> {
    const config = this.definition ? extractOAuthConfig(this.definition) : {};

    if (config.grantType === "client_credentials") {
      const storedAuth = this.storage.getForUrl(this.serverUrl);
      if (storedAuth?.clientInfo && !storedAuth.tokens && !config.clientId) {
        this.storage.clearClientInfo();
        this.storage.clearCodeVerifier();
        this.storage.clearOAuthState();
      }
      const provider = new McpOAuthProvider(this.serverName, this.serverUrl, config, {
        onRedirect: async () => {
          throw new Error("Browser redirect is not used for client_credentials flow");
        },
      });
      const result = await runSdkAuth(provider, { serverUrl: this.serverUrl });
      if (result !== "AUTHORIZED") throw new UnauthorizedError("Failed to authorize");
      return { authorizationUrl: "" };
    }

    const redirectCallback = config.redirectUri
      ? parseOAuthRedirectUri(config.redirectUri)
      : undefined;
    const oauthState = generateState();

    try {
      await callbackServer.ensure({
        strictPort: Boolean(config.clientId) || config.redirectUri !== undefined,
        oauthState,
        reserveState: true,
        ...(redirectCallback
          ? {
              port: redirectCallback.port,
              callbackHost: redirectCallback.callbackHost,
              callbackPath: redirectCallback.callbackPath,
            }
          : {}),
      });
    } catch (error) {
      this.storage.clearOAuthState();
      throw error;
    }

    let capturedUrl: URL | undefined;
    const provider = new McpOAuthProvider(this.serverName, this.serverUrl, config, {
      onRedirect: async (url) => {
        capturedUrl = url;
      },
    });

    try {
      const storedAuth = this.storage.getForUrl(this.serverUrl);
      if (storedAuth?.clientInfo && !config.clientId) {
        if (!storedAuth.tokens) {
          this.storage.clearClientInfo();
          this.storage.clearCodeVerifier();
          this.storage.clearOAuthState();
        } else {
          const uris = storedAuth.clientInfo.redirectUris;
          if (!Array.isArray(uris) || !uris.includes(provider.redirectUrl ?? "")) {
            this.storage.clearClientInfo();
            this.storage.clearTokens();
            this.storage.clearCodeVerifier();
            this.storage.clearOAuthState();
          }
        }
      }

      this.storage.oauthState = oauthState;
      const result = await runSdkAuth(provider, { serverUrl: this.serverUrl });
      if (result === "AUTHORIZED") {
        callbackServer.release(oauthState);
        this.storage.clearOAuthState();
        return { authorizationUrl: "" };
      }
      if (!capturedUrl) throw new UnauthorizedError("OAuth authorization URL was not provided");
      pendingTransports.set(
        this.serverName,
        new StreamableHTTPClientTransport(new URL(this.serverUrl), { authProvider: provider }),
      );
      return { authorizationUrl: capturedUrl.toString() };
    } catch (error) {
      callbackServer.release(oauthState);
      this.storage.clearOAuthState();
      throw error;
    }
  }
}

// ── Internal helpers ───────────────────────────────────────────────────

function generateState(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function openBrowser(url: string): Promise<void> {
  const platform = process.platform;
  const cmd = platform === "darwin" ? "open" : platform === "win32" ? "start" : "xdg-open";
  const args = platform === "win32" ? ["", url] : [url];
  const shell = platform === "win32";

  return new Promise<void>((resolve, reject) => {
    const proc = spawn(cmd, args, { shell, stdio: "ignore", detached: true });
    proc.on("error", (err) => reject(new Error(`Failed to open browser: ${err.message}`)));
    proc.on("close", (code) => {
      if (code === 0 || code === null) resolve();
      else reject(new Error(`Browser command exited with code ${code}`));
    });
    proc.unref();
    setTimeout(() => resolve(), 500);
  });
}

function parseOAuthRedirectUri(redirectUri: string): {
  port: number;
  callbackHost: string;
  callbackPath: string;
} {
  let url: URL;
  try {
    url = new URL(redirectUri);
  } catch (err) {
    throw new Error(`Invalid OAuth redirectUri: ${redirectUri}. Error: ${(err as Error).message}`);
  }

  const hostname = url.hostname.toLowerCase();
  const isLocal =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname === "::1";
  if (url.protocol !== "http:" || !isLocal)
    throw new Error("OAuth redirectUri must be an http:// localhost or loopback URI");
  if (url.username || url.password)
    throw new Error("OAuth redirectUri must not include username or password");
  if (url.hash) throw new Error("OAuth redirectUri must not include a fragment");
  if (!url.port) throw new Error("OAuth redirectUri must include an explicit numeric port");

  const port = Number.parseInt(url.port, 10);
  if (!Number.isInteger(port) || port <= 0 || port > 65535)
    throw new Error("OAuth redirectUri must include an explicit numeric port");

  return {
    port,
    callbackHost: hostname === "[::1]" ? "::1" : hostname,
    callbackPath: url.pathname,
  };
}
