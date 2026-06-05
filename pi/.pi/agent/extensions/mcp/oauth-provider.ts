/**
 * McpOAuthProvider — OAuth 2.1 client for MCP server authorization.
 *
 * Implements the full MCP authorization flow as specified in:
 *   - OAuth 2.1 (draft-ietf-oauth-v2-1-13)
 *   - OAuth 2.0 Authorization Server Metadata (RFC 8414)
 *   - OAuth 2.0 Dynamic Client Registration Protocol (RFC 7591)
 *   - OAuth 2.0 Protected Resource Metadata (RFC 9728)
 *
 * Flow (per the design diagram):
 *   1. MCP server returns 401 with WWW-Authenticate header (RFC 9728)
 *   2. Provider discovers OAuth metadata (authorizationUrl, tokenUrl, registrationUrl)
 *   3. Dynamic client registration (RFC 7591) → clientId + clientSecret
 *   4. Build authorization URL with PKCE, state (CSRF), redirect_uri
 *   5. Open browser for user auth → callback receives auth code
 *   6. Exchange auth code for access/refresh tokens
 *   7. Store tokens for silent refresh on expiry
 */

import * as crypto from "node:crypto";
import type { AuthStore } from "./auth-store.js";

export interface OAuthMetadata {
  authorizationUrl: string;
  tokenUrl: string;
  registrationUrl?: string;
  resourceUrl: string;
  scopesSupported?: string[];
}

export interface ClientInfo {
  clientId: string;
  clientSecret?: string;
}

export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // epoch ms
}

interface OAuthServerMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint?: string;
  scopes_supported?: string[];
  [key: string]: unknown;
}

/**
 * Generate a PKCE code verifier (cryptographically random, 43-128 chars).
 * Uses the S256 method.
 */
function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * Generate a PKCE code challenge from a verifier using SHA-256.
 */
function generateCodeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

/**
 * Generate a cryptographically random CSRF state parameter.
 */
function generateState(): string {
  return crypto.randomBytes(16).toString("base64url");
}

/**
 * Parse a WWW-Authenticate header per RFC 9728 to extract the
 * resource metadata URL.
 *
 * Example header:
 *   WWW-Authenticate: Bearer resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource"
 */
function parseWwwAuthenticate(header: string): string | undefined {
  // Match Bearer auth scheme with resource_metadata parameter
  const match = header.match(/Bearer\s+.*resource_metadata\s*=\s*"([^"]+)"/i);
  if (match) return match[1];

  // Also try without Bearer prefix but with resource_metadata
  const altMatch = header.match(/resource_metadata\s*=\s*"([^"]+)"/i);
  if (altMatch) return altMatch[1];

  return undefined;
}

export class McpOAuthProvider {
  private serverName: string;
  private resourceUrl: string;
  private redirectUri: string;
  private authStore: AuthStore;
  private metadata: OAuthMetadata | null = null;
  private clientInfo: ClientInfo | null = null;
  private tokenSet: TokenSet | null = null;
  private currentState: string | null = null;
  private codeVerifier: string | null = null;

  /**
   * @param serverName   - Human-readable name for the MCP server
   * @param resourceUrl  - The MCP server's resource URL (canonical URI per RFC 8707)
   * @param redirectUri  - The callback URL (must be from a running CallbackServer)
   * @param authStore    - Persistent storage for tokens/client info
   */
  constructor(serverName: string, resourceUrl: string, redirectUri: string, authStore: AuthStore) {
    this.serverName = serverName;
    this.resourceUrl = resourceUrl;
    this.redirectUri = redirectUri;
    this.authStore = authStore;
  }

  /**
   * Discover OAuth metadata from the MCP server's 401 response.
   *
   * Per RFC 9728, the 401 response includes:
   *   WWW-Authenticate: Bearer resource_metadata="https://..."
   *
   * The resource metadata document contains authorization_servers,
   * and we then fetch the OAuth server metadata (RFC 8414).
   */
  async discoverFrom401(wwwAuthenticateHeader: string): Promise<OAuthMetadata> {
    const resourceMetadataUrl = parseWwwAuthenticate(wwwAuthenticateHeader);
    if (!resourceMetadataUrl) {
      throw new Error(
        `Failed to parse WWW-Authenticate header: "${wwwAuthenticateHeader}". ` +
          "Expected Bearer scheme with resource_metadata parameter (RFC 9728).",
      );
    }

    // Fetch Protected Resource Metadata (RFC 9728)
    const resourceMetadata = await this.fetchJson(resourceMetadataUrl);
    const authServers: string[] = resourceMetadata.authorization_servers;
    if (!authServers || authServers.length === 0) {
      throw new Error(
        `No authorization_servers found in resource metadata at ${resourceMetadataUrl}`,
      );
    }

    // Use the first authorization server (per RFC 9728 section 7.6)
    const authServerUrl = authServers[0];

    // Fetch OAuth Authorization Server Metadata (RFC 8414)
    const serverMetadataUrl = `${authServerUrl.replace(/\/$/, "")}/.well-known/oauth-authorization-server`;
    const serverMetadata: OAuthServerMetadata = await this.fetchJson(serverMetadataUrl);

    if (!serverMetadata.authorization_endpoint || !serverMetadata.token_endpoint) {
      throw new Error(
        `OAuth server metadata at ${serverMetadataUrl} missing required endpoints ` +
          "(authorization_endpoint, token_endpoint)",
      );
    }

    const metadata: OAuthMetadata = {
      authorizationUrl: serverMetadata.authorization_endpoint,
      tokenUrl: serverMetadata.token_endpoint,
      registrationUrl: serverMetadata.registration_endpoint,
      resourceUrl: this.resourceUrl,
      scopesSupported: serverMetadata.scopes_supported,
    };

    this.setMetadata(metadata);
    return metadata;
  }

  /**
   * Set OAuth metadata directly (for cases where metadata is obtained
   * through other means than 401/WWW-Authenticate discovery).
   */
  setMetadata(metadata: OAuthMetadata): void {
    this.metadata = metadata;
  }

  /**
   * Dynamically register this client with the authorization server
   * per RFC 7591.
   *
   * The registration includes the redirect_uris so the authorization
   * server can validate redirects during the auth flow.
   */
  async register(): Promise<ClientInfo> {
    if (!this.metadata) {
      throw new Error("OAuth metadata not set. Call setMetadata() or discoverFrom401() first.");
    }

    if (!this.metadata.registrationUrl) {
      throw new Error(
        "Authorization server does not support dynamic client registration. " +
          "Provide a clientId and clientSecret manually.",
      );
    }

    const body: Record<string, unknown> = {
      client_name: `pi-mcp-${this.serverName}`,
      redirect_uris: [this.redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none", // public client (PKCE)
    };

    const response = await fetch(this.metadata.registrationUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(
        `Dynamic client registration failed (${response.status}): ${errorText || response.statusText}`,
      );
    }

    const data = (await response.json()) as {
      client_id: string;
      client_secret?: string;
      client_secret_expires_at?: number;
    };

    const clientInfo: ClientInfo = {
      clientId: data.client_id,
      clientSecret: data.client_secret,
    };

    this.clientInfo = clientInfo;

    // Persist client info
    this.authStore.save({
      serverName: this.serverName,
      resourceUrl: this.resourceUrl,
      clientId: clientInfo.clientId,
      clientSecret: clientInfo.clientSecret,
      authorizationUrl: this.metadata.authorizationUrl,
      tokenUrl: this.metadata.tokenUrl,
      registrationUrl: this.metadata.registrationUrl,
    });

    return clientInfo;
  }

  /**
   * Set client info directly (for authorization servers that don't
   * support dynamic registration, or for pre-configured clients).
   */
  setClientInfo(clientInfo: ClientInfo): void {
    this.clientInfo = clientInfo;
  }

  /**
   * Build the authorization URL with PKCE and CSRF state.
   *
   * Returns the URL that should be opened in the browser.
   * Saves the state and code verifier for later validation.
   */
  buildAuthorizationUrl(scopes?: string[]): string {
    if (!this.metadata) {
      throw new Error("OAuth metadata not set. Call setMetadata() or discoverFrom401() first.");
    }

    if (!this.clientInfo) {
      throw new Error("Client not registered. Call register() or setClientInfo() first.");
    }

    // Generate PKCE
    this.codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(this.codeVerifier);

    // Generate CSRF state
    this.currentState = generateState();

    // Build the URL
    const params = new URLSearchParams();
    params.set("response_type", "code");
    params.set("client_id", this.clientInfo.clientId);
    params.set("redirect_uri", this.redirectUri);
    params.set("code_challenge", codeChallenge);
    params.set("code_challenge_method", "S256");
    params.set("state", this.currentState);
    params.set("resource", this.resourceUrl); // RFC 8707 resource indicator

    // Default scopes if none provided
    const effectiveScopes = scopes ?? this.metadata.scopesSupported ?? [];
    if (effectiveScopes.length > 0) {
      params.set("scope", effectiveScopes.join(" "));
    }

    return `${this.metadata.authorizationUrl}?${params.toString()}`;
  }

  /**
   * Get the current CSRF state (for callback validation).
   */
  getState(): string | null {
    return this.currentState;
  }

  /**
   * Validate that the received state matches the one we sent.
   */
  validateState(state: string): boolean {
    if (!this.currentState) return false;
    return crypto.timingSafeEqual(Buffer.from(state), Buffer.from(this.currentState));
  }

  /**
   * Exchange an authorization code for access/refresh tokens.
   *
   * Per OAuth 2.1, uses the PKCE code_verifier and includes
   * the resource parameter (RFC 8707).
   */
  async exchangeCode(code: string): Promise<TokenSet> {
    if (!this.metadata) {
      throw new Error("OAuth metadata not set.");
    }

    if (!this.clientInfo) {
      throw new Error("Client not registered.");
    }

    if (!this.codeVerifier) {
      throw new Error(
        "No PKCE code_verifier. Authorization URL must be built before exchanging code.",
      );
    }

    const body = new URLSearchParams();
    body.set("grant_type", "authorization_code");
    body.set("code", code);
    body.set("redirect_uri", this.redirectUri);
    body.set("client_id", this.clientInfo.clientId);
    body.set("code_verifier", this.codeVerifier);
    body.set("resource", this.resourceUrl); // RFC 8707

    const response = await fetch(this.metadata.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(
        `Token exchange failed (${response.status}): ${errorText || response.statusText}`,
      );
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      token_type: string;
    };

    const tokenSet: TokenSet = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : Date.now() + 3600_000,
    };

    this.tokenSet = tokenSet;
    this.codeVerifier = null; // Clear after use

    // Persist tokens
    this.authStore.save({
      serverName: this.serverName,
      resourceUrl: this.resourceUrl,
      clientId: this.clientInfo.clientId,
      clientSecret: this.clientInfo.clientSecret,
      accessToken: tokenSet.accessToken,
      refreshToken: tokenSet.refreshToken,
      expiresAt: tokenSet.expiresAt,
      authorizationUrl: this.metadata.authorizationUrl,
      tokenUrl: this.metadata.tokenUrl,
      registrationUrl: this.metadata.registrationUrl,
    });

    return tokenSet;
  }

  /**
   * Refresh an expired access token using the refresh token.
   *
   * Per OAuth 2.1, refresh tokens MUST be rotated (new refresh token
   * issued with each use).
   */
  async refresh(): Promise<TokenSet> {
    if (!this.metadata) {
      throw new Error("OAuth metadata not set.");
    }

    if (!this.clientInfo) {
      throw new Error("Client not registered.");
    }

    const stored = this.authStore.get(this.serverName, this.resourceUrl);
    if (!stored || !stored.refreshToken) {
      throw new Error("No refresh token available. Re-authorization required.");
    }

    const body = new URLSearchParams();
    body.set("grant_type", "refresh_token");
    body.set("refresh_token", stored.refreshToken);
    body.set("client_id", stored.clientId || this.clientInfo.clientId);
    body.set("resource", this.resourceUrl); // RFC 8707

    // Public clients don't send client_secret; confidential clients may
    if (stored.clientSecret) {
      body.set("client_secret", stored.clientSecret);
    }

    const response = await fetch(this.metadata.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!response.ok) {
      // If refresh fails, clear stored tokens so we re-authorize
      this.authStore.save({
        serverName: this.serverName,
        resourceUrl: this.resourceUrl,
        clientId: stored.clientId,
        clientSecret: stored.clientSecret,
        refreshToken: undefined,
        accessToken: undefined,
        expiresAt: undefined,
        authorizationUrl: stored.authorizationUrl,
        tokenUrl: stored.tokenUrl,
        registrationUrl: stored.registrationUrl,
      });

      const errorText = await response.text().catch(() => "");
      throw new Error(
        `Token refresh failed (${response.status}): ${errorText || response.statusText}`,
      );
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      token_type: string;
    };

    const tokenSet: TokenSet = {
      accessToken: data.access_token,
      // OAuth 2.1: rotate refresh tokens
      refreshToken: data.refresh_token ?? stored.refreshToken,
      expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : Date.now() + 3600_000,
    };

    this.tokenSet = tokenSet;

    // Persist rotated tokens
    this.authStore.save({
      serverName: this.serverName,
      resourceUrl: this.resourceUrl,
      clientId: stored.clientId,
      clientSecret: stored.clientSecret,
      accessToken: tokenSet.accessToken,
      refreshToken: tokenSet.refreshToken,
      expiresAt: tokenSet.expiresAt,
      authorizationUrl: stored.authorizationUrl,
      tokenUrl: stored.tokenUrl,
      registrationUrl: stored.registrationUrl,
    });

    return tokenSet;
  }

  /**
   * Get the current valid access token.
   * If expired and a refresh token is available, attempts a silent refresh.
   * Returns undefined if no valid token can be obtained (needs re-auth).
   */
  async getAccessToken(): Promise<string | undefined> {
    // Check in-memory first
    if (
      this.tokenSet &&
      !this.authStore.isExpired({
        serverName: this.serverName,
        resourceUrl: this.resourceUrl,
        expiresAt: this.tokenSet.expiresAt,
      })
    ) {
      return this.tokenSet.accessToken;
    }

    // Check stored
    const stored = this.authStore.get(this.serverName, this.resourceUrl);
    if (stored?.accessToken && !this.authStore.isExpired(stored)) {
      this.tokenSet = {
        accessToken: stored.accessToken,
        refreshToken: stored.refreshToken,
        expiresAt: stored.expiresAt!,
      };
      return stored.accessToken;
    }

    // Try refresh
    if (stored && this.authStore.canRefresh(stored)) {
      try {
        const refreshed = await this.refresh();
        return refreshed.accessToken;
      } catch {
        return undefined;
      }
    }

    return undefined;
  }

  /**
   * Get the current token set (may be expired).
   */
  tokens(): TokenSet | undefined {
    if (this.tokenSet) return this.tokenSet;

    const stored = this.authStore.get(this.serverName, this.resourceUrl);
    if (stored?.accessToken) {
      return {
        accessToken: stored.accessToken,
        refreshToken: stored.refreshToken,
        expiresAt: stored.expiresAt ?? 0,
      };
    }

    return undefined;
  }

  /**
   * Load stored state from authStore into this instance.
   * Useful when reconnecting to a previously authorized server.
   */
  loadFromStore(): boolean {
    const stored = this.authStore.get(this.serverName, this.resourceUrl);
    if (!stored?.clientId) return false;

    this.clientInfo = {
      clientId: stored.clientId,
      clientSecret: stored.clientSecret,
    };

    if (stored.accessToken) {
      this.tokenSet = {
        accessToken: stored.accessToken,
        refreshToken: stored.refreshToken,
        expiresAt: stored.expiresAt ?? 0,
      };
    }

    if (stored.authorizationUrl && stored.tokenUrl) {
      this.metadata = {
        authorizationUrl: stored.authorizationUrl,
        tokenUrl: stored.tokenUrl,
        registrationUrl: stored.registrationUrl,
        resourceUrl: this.resourceUrl,
      };
    }

    return true;
  }

  /**
   * Check if this server has been previously authorized
   * (has stored tokens that can be refreshed).
   */
  isAuthorized(): boolean {
    const stored = this.authStore.get(this.serverName, this.resourceUrl);
    return !!(stored?.accessToken || stored?.refreshToken);
  }

  getServerName(): string {
    return this.serverName;
  }

  getResourceUrl(): string {
    return this.resourceUrl;
  }

  getRedirectUri(): string {
    return this.redirectUri;
  }

  // --- Private helpers ---

  private async fetchJson(url: string): Promise<any> {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(
        `Failed to fetch ${url} (${response.status}): ${errorText || response.statusText}`,
      );
    }
    return response.json();
  }
}
