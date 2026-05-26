/**
 * MCP OAuth Provider
 *
 * Implementation of the MCP SDK's OAuthClientProvider interface.
 * Handles OAuth client registration, token storage, and authorization redirection.
 */

import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import type {
  OAuthClientMetadata,
  OAuthTokens,
  OAuthClientInformation,
  OAuthClientInformationFull,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import { AuthStorage, type StoredClientInfo } from "./oauth-auth.ts";

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
export function getOAuthCallbackPort(): number {
  return activePort;
}
export function setOAuthCallbackPort(port: number): void {
  activePort = port;
}
export function getOAuthCallbackPath(): string {
  return activePath;
}
export function setOAuthCallbackPath(path: string): void {
  activePath = path.startsWith("/") ? path : `/${path}`;
}

export interface McpOAuthConfig {
  grantType?: "authorization_code" | "client_credentials";
  clientId?: string;
  clientSecret?: string;
  scope?: string;
  redirectUri?: string;
  clientName?: string;
  clientUri?: string;
}

export interface McpOAuthCallbacks {
  onRedirect: (url: URL) => void | Promise<void>;
}

export { DEFAULT_PORT as DEFAULT_OAUTH_CALLBACK_PORT, DEFAULT_PATH as DEFAULT_OAUTH_CALLBACK_PATH };

export class McpOAuthProvider implements OAuthClientProvider {
  private readonly redirectUrlSnapshot: string | undefined;
  private readonly storage: AuthStorage;

  constructor(
    private serverName: string,
    private serverUrl: string,
    private config: McpOAuthConfig,
    private callbacks: McpOAuthCallbacks,
  ) {
    this.storage = new AuthStorage(serverName);
    this.redirectUrlSnapshot =
      config.grantType === "client_credentials"
        ? undefined
        : (config.redirectUri ??
          `http://localhost:${getOAuthCallbackPort()}${getOAuthCallbackPath()}`);
  }

  private get usesClientCredentials(): boolean {
    return this.config.grantType === "client_credentials";
  }

  get redirectUrl(): string | undefined {
    return this.redirectUrlSnapshot;
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

  async saveClientInformation(info: OAuthClientInformationFull): Promise<void> {
    const ci: StoredClientInfo = {
      clientId: info.client_id,
      clientSecret: info.client_secret,
      clientIdIssuedAt: info.client_id_issued_at,
      clientSecretExpiresAt: info.client_secret_expires_at,
      redirectUris: info.redirect_uris ?? (this.redirectUrl ? [this.redirectUrl] : undefined),
    };
    this.storage.clientInfo = ci;
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

  async saveTokens(tokens: OAuthTokens): Promise<void> {
    this.storage.tokens = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expires_in ? Date.now() / 1000 + tokens.expires_in : undefined,
      scope: tokens.scope,
    };
  }

  async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
    if (this.usesClientCredentials)
      throw new Error("redirectToAuthorization is not used for client_credentials flow");
    const entry = this.storage.getForUrl(this.serverUrl);
    if (!entry?.oauthState)
      throw new UnauthorizedError(`Re-authentication required for MCP server: ${this.serverName}`);
    await this.callbacks.onRedirect(authorizationUrl);
  }

  async saveCodeVerifier(codeVerifier: string): Promise<void> {
    this.storage.codeVerifier = codeVerifier;
  }

  async codeVerifier(): Promise<string> {
    if (this.usesClientCredentials)
      throw new Error("codeVerifier is not used for client_credentials flow");
    const entry = this.storage.getForUrl(this.serverUrl);
    if (!entry?.codeVerifier)
      throw new Error(`No code verifier saved for MCP server: ${this.serverName}`);
    return entry.codeVerifier;
  }

  async saveState(state: string): Promise<void> {
    this.storage.oauthState = state;
  }

  async state(): Promise<string> {
    if (this.usesClientCredentials)
      throw new Error("state is not used for client_credentials flow");
    const entry = this.storage.getForUrl(this.serverUrl);
    if (!entry?.oauthState)
      throw new UnauthorizedError(`Re-authentication required for MCP server: ${this.serverName}`);
    return entry.oauthState;
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
}
