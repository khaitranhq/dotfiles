/**
 * MCP OAuth Flow
 *
 * High-level OAuth flow management using the MCP SDK's built-in auth functions.
 */

import { spawn } from "node:child_process";
import { auth as runSdkAuth, UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { McpOAuthProvider, type McpOAuthConfig } from "./oauth-provider.ts";
import { callbackServer } from "./oauth-callback.ts";
import { AuthStorage, type StoredTokens } from "./oauth-auth.ts";
import type { ServerEntry } from "../core/types.ts";

export type AuthStatus = "authenticated" | "expired" | "not_authenticated";

const pendingTransports = new Map<string, StreamableHTTPClientTransport>();
const pendingAuthentications = new Map<string, Promise<AuthStatus>>();

function generateState(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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

// ── Standalone helpers ────────────────────────────────────────────────

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

// ── OAuthFlow class ───────────────────────────────────────────────────

export class OAuthFlow {
  readonly storage: AuthStorage;

  constructor(private readonly serverName: string) {
    this.storage = new AuthStorage(serverName);
  }

  // ── Status ───────────────────────────────────────────────────────

  get authStatus(): AuthStatus {
    if (!this.storage.hasTokens) return "not_authenticated";
    return this.storage.isExpired ? "expired" : "authenticated";
  }

  async validToken(): Promise<StoredTokens | null> {
    const entry = this.storage.getForUrl(""); // url check done at call site
    if (!entry?.tokens) return null;
    if (this.storage.isExpired !== true) return entry.tokens;
    // Expired — try refresh
    if (!entry.tokens.refreshToken) return null;
    return this.doRefresh();
  }

  // ── Full authentication flow ─────────────────────────────────────

  async authenticate(serverUrl: string, definition?: ServerEntry): Promise<AuthStatus> {
    const inFlight = pendingAuthentications.get(this.serverName);
    if (inFlight) return inFlight;

    const op = this.doAuthenticate(serverUrl, definition);
    pendingAuthentications.set(this.serverName, op);
    try {
      return await op;
    } finally {
      if (pendingAuthentications.get(this.serverName) === op)
        pendingAuthentications.delete(this.serverName);
    }
  }

  private async doAuthenticate(serverUrl: string, definition?: ServerEntry): Promise<AuthStatus> {
    const { authorizationUrl } = await this.startAuth(serverUrl, definition);
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

  // ── Start/completion ─────────────────────────────────────────────

  private async startAuth(
    serverUrl: string,
    definition?: ServerEntry,
  ): Promise<{ authorizationUrl: string }> {
    const config = definition ? extractOAuthConfig(definition) : {};

    if (config.grantType === "client_credentials") {
      const storedAuth = this.storage.getForUrl(serverUrl);
      if (storedAuth?.clientInfo && !storedAuth.tokens && !config.clientId) {
        this.storage.clearClientInfo();
        this.storage.clearCodeVerifier();
        this.storage.clearOAuthState();
      }
      const provider = new McpOAuthProvider(this.serverName, serverUrl, config, {
        onRedirect: async () => {
          throw new Error("Browser redirect is not used for client_credentials flow");
        },
      });
      const result = await runSdkAuth(provider, { serverUrl });
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
    const provider = new McpOAuthProvider(this.serverName, serverUrl, config, {
      onRedirect: async (url) => {
        capturedUrl = url;
      },
    });

    try {
      const storedAuth = this.storage.getForUrl(serverUrl);
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
      const result = await runSdkAuth(provider, { serverUrl });
      if (result === "AUTHORIZED") {
        callbackServer.release(oauthState);
        this.storage.clearOAuthState();
        return { authorizationUrl: "" };
      }
      if (!capturedUrl) throw new UnauthorizedError("OAuth authorization URL was not provided");
      pendingTransports.set(
        this.serverName,
        new StreamableHTTPClientTransport(new URL(serverUrl), { authProvider: provider }),
      );
      return { authorizationUrl: capturedUrl.toString() };
    } catch (error) {
      callbackServer.release(oauthState);
      this.storage.clearOAuthState();
      throw error;
    }
  }

  private async completeAuth(authorizationCode: string): Promise<AuthStatus> {
    const transport = pendingTransports.get(this.serverName);
    if (!transport) throw new Error(`No pending OAuth flow for server: ${this.serverName}`);

    const oauthState = this.storage.oauthState;
    try {
      await transport.finishAuth(authorizationCode);
      return "authenticated";
    } finally {
      if (oauthState) callbackServer.release(oauthState);
      this.storage.clearOAuthState();
      pendingTransports.delete(this.serverName);
      await transport.close().catch(() => {});
    }
  }

  // ── Token refresh ────────────────────────────────────────────────

  private async doRefresh(): Promise<StoredTokens | null> {
    console.log(`MCP Auth: Token expired for ${this.serverName}, attempting refresh`);
    try {
      const provider = new McpOAuthProvider(
        this.serverName,
        "",
        {},
        { onRedirect: async () => {} },
      );
      const ci = await provider.clientInformation();
      if (!ci) return null;

      const result = await runSdkAuth(provider, { serverUrl: "" });
      if (result !== "AUTHORIZED") return null;
      return this.storage.getForUrl("")?.tokens ?? null;
    } catch (error) {
      console.error(`MCP Auth: Token refresh failed for ${this.serverName}`, { error });
      return null;
    }
  }

  // ── Cleanup ──────────────────────────────────────────────────────

  async removeAuth(): Promise<void> {
    const oauthState = this.storage.oauthState;
    if (oauthState) callbackServer.cancel(oauthState);
    const pt = pendingTransports.get(this.serverName);
    if (pt) {
      pendingTransports.delete(this.serverName);
      await pt.close().catch(() => {});
    }
    this.storage.clearAll();
    this.storage.clearOAuthState();
    console.log(`MCP Auth: Removed credentials for ${this.serverName}`);
  }
}

// ── Browser helper ────────────────────────────────────────────────────

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
