/**
 * OAuth 2.0 provider for MCP — implements the SDK's OAuthClientProvider interface
 * with disk-based token/verifier/client storage under ~/.pi/agent/mcp-tokens/.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as http from "node:http";
import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import { mcpLogInfo, mcpLogError } from "./logger";

// ── Local type definitions matching SDK shapes (not exported by the SDK) ─

interface OAuthTokens {
  access_token: string;
  token_type: string;
  expires_in?: number;
  scope?: string;
  refresh_token?: string;
}

interface OAuthClientMetadata {
  redirect_uris: string[];
  grant_types?: string[];
  response_types?: string[];
  token_endpoint_auth_method?: string;
  client_name?: string;
  scope?: string;
}

interface OAuthClientInformationMixed {
  client_id: string;
  client_secret?: string;
  client_id_issued_at?: number;
  client_secret_expires_at?: number;
  registration_access_token?: string;
  registration_client_uri?: string;
}

export interface PiOAuthConfig {
  clientId?: string;
  clientSecret?: string;
  clientName?: string;
  scopes?: string[];
  tokenStorePath?: string;
  /** Fixed port for OAuth redirect callback. Default: 14815.
   * Must match the callback URL registered in your OAuth app settings. */
  redirectPort?: number;
}

function sanitizeForFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 64);
}

/** Default OAuth redirect port — register this in your OAuth app settings. */
const DEFAULT_REDIRECT_PORT = 14815;

/** Check if a port is available on localhost. */
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = http.createServer();
    srv.on("error", () => resolve(false));
    srv.listen(port, "127.0.0.1", () => {
      srv.close(() => resolve(true));
    });
  });
}

export class PiOAuthProvider implements OAuthClientProvider {
  private _redirectUrl: string | undefined;
  private _codeVerifier: string | null = null;
  private _onAuthUrl: ((url: string) => void) | null = null;
  private readonly storePath: string;
  private readonly clientInfoPath: string;
  private readonly codeVerifierPath: string;

  constructor(
    private readonly serverName: string,
    private readonly oauthConfig: PiOAuthConfig = {},
  ) {
    const base = path.join(os.homedir(), ".pi", "agent", "mcp-tokens");
    const safeName = sanitizeForFilename(serverName);
    this.storePath = oauthConfig.tokenStorePath ?? path.join(base, `${safeName}.json`);
    this.clientInfoPath = path.join(base, `.${safeName}-client.json`);
    this.codeVerifierPath = path.join(base, `.${safeName}-verifier.json`);
  }

  // ── Redirect URL ─────────────────────────────────────────────────

  get redirectUrl(): string | URL | undefined {
    return this._redirectUrl;
  }

  async setupRedirectUrl(): Promise<void> {
    const desiredPort = this.oauthConfig.redirectPort ?? DEFAULT_REDIRECT_PORT;

    if (await isPortAvailable(desiredPort)) {
      this._redirectUrl = `http://localhost:${desiredPort}/callback`;
    } else {
      // Fall back to any available port — user should register a fixed port
      // in their OAuth app settings to avoid callback URL mismatches.
      const fallbackPort = await new Promise<number>((resolve, reject) => {
        const srv = http.createServer();
        srv.on("error", reject);
        srv.listen(0, "127.0.0.1", () => {
          const addr = srv.address();
          const p = addr && typeof addr === "object" ? addr.port : 0;
          srv.close(() => resolve(p));
        });
      });
      mcpLogError(
        this.serverName,
        `Port ${desiredPort} is in use. Falling back to port ${fallbackPort}. ` +
          `⚠️  This redirect URL may not match your registered OAuth callback. ` +
          `Set oauth.redirectPort in your config or free port ${desiredPort}.`,
      );
      this._redirectUrl = `http://localhost:${fallbackPort}/callback`;
    }
  }

  // ── Client metadata ──────────────────────────────────────────────

  get clientMetadata(): OAuthClientMetadata {
    const metadata: OAuthClientMetadata = {
      redirect_uris: this._redirectUrl ? [this._redirectUrl] : [],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: this.oauthConfig.clientSecret ? "client_secret_basic" : "none",
      client_name: this.oauthConfig.clientName ?? `khaitran-mcp-${this.serverName}`,
    };
    if (this.oauthConfig.scopes && this.oauthConfig.scopes.length > 0) {
      metadata.scope = this.oauthConfig.scopes.join(" ");
    }
    return metadata;
  }

  // ── Client registration ──────────────────────────────────────────

  clientInformation(): OAuthClientInformationMixed | undefined {
    if (this.oauthConfig.clientId) {
      return {
        client_id: this.oauthConfig.clientId,
        client_secret: this.oauthConfig.clientSecret,
      };
    }
    try {
      if (fs.existsSync(this.clientInfoPath)) {
        return JSON.parse(fs.readFileSync(this.clientInfoPath, "utf-8"));
      }
    } catch {
      // Ignore
    }
    return undefined;
  }

  saveClientInformation(info: OAuthClientInformationMixed): void {
    try {
      const dir = path.dirname(this.clientInfoPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.clientInfoPath, JSON.stringify(info, null, 2), {
        mode: 0o600,
      });
    } catch (err) {
      mcpLogError(this.serverName, `Failed to save client info: ${err}`);
    }
  }

  // ── Token storage ────────────────────────────────────────────────

  tokens(): OAuthTokens | undefined {
    try {
      if (fs.existsSync(this.storePath)) {
        return JSON.parse(fs.readFileSync(this.storePath, "utf-8")) as OAuthTokens;
      }
    } catch {
      // Ignore
    }
    return undefined;
  }

  saveTokens(tokens: OAuthTokens): void {
    try {
      const dir = path.dirname(this.storePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.storePath, JSON.stringify(tokens, null, 2), {
        mode: 0o600,
      });
    } catch (err) {
      mcpLogError(this.serverName, `Failed to save tokens: ${err}`);
    }
  }

  // ── Auth URL callback ────────────────────────────────────────────

  /** Register a callback to show the authorization URL on UI (e.g. when browser can't open). */
  setOnAuthUrl(fn: (url: string) => void): void {
    this._onAuthUrl = fn;
  }

  // ── Authorization redirect ───────────────────────────────────────

  async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
    const url = authorizationUrl.toString();
    mcpLogInfo(this.serverName, `Opening browser for OAuth authorization...`);

    const { exec } = await import("node:child_process");
    let openCmd: string;
    const platform = process.platform;
    openCmd =
      platform === "darwin"
        ? `open "${url}"`
        : platform === "win32"
          ? `start "" "${url}"`
          : `xdg-open "${url}"`;
    mcpLogInfo(this.serverName, `Executing command: ${openCmd}`);
    exec(openCmd, (err) => {
      if (err) {
        mcpLogInfo(this.serverName, `Could not open browser automatically. Visit:\n  ${url}`);
        this._onAuthUrl?.(url);
      }
    });
  }

  // ── PKCE code verifier ───────────────────────────────────────────

  saveCodeVerifier(codeVerifier: string): void {
    this._codeVerifier = codeVerifier;
    try {
      const dir = path.dirname(this.codeVerifierPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.codeVerifierPath, codeVerifier, { mode: 0o600 });
    } catch {
      // Ignore
    }
  }

  async codeVerifier(): Promise<string> {
    if (this._codeVerifier) return this._codeVerifier;
    try {
      if (fs.existsSync(this.codeVerifierPath)) {
        this._codeVerifier = fs.readFileSync(this.codeVerifierPath, "utf-8");
        return this._codeVerifier;
      }
    } catch {
      // Ignore
    }
    throw new Error("No PKCE code verifier available");
  }

  // ── Cleanup ──────────────────────────────────────────────────────

  /** Clear all stored tokens, client info, and code verifier. */
  clear(): void {
    this._codeVerifier = null;
    for (const p of [this.storePath, this.clientInfoPath, this.codeVerifierPath]) {
      try {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      } catch {
        // Ignore
      }
    }
  }

  /** Path to the persisted token store. */
  get tokenStorePath(): string {
    return this.storePath;
  }
}
