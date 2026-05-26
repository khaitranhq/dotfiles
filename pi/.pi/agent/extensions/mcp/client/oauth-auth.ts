/**
 * MCP Auth Storage Module
 *
 * Handles secure storage of OAuth credentials, tokens, client information,
 * and PKCE state for MCP servers.
 *
 * Token storage location: $MCP_OAUTH_DIR/sha256-<server-hash>/tokens.json when set,
 * otherwise <Pi agent dir>/mcp-oauth/sha256-<server-hash>/tokens.json
 */

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { getAgentPath } from "../../shared/config.ts";

// ── Types ────────────────────────────────────────────────────────────

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

export interface AuthEntry {
  tokens?: StoredTokens;
  clientInfo?: StoredClientInfo;
  codeVerifier?: string;
  oauthState?: string;
  serverUrl?: string;
}

// ── AuthStorage class ────────────────────────────────────────────────

export class AuthStorage {
  private readonly dir: string;
  private readonly tokensPath: string;

  constructor(serverName: string) {
    this.dir = this.computeDir(serverName);
    this.tokensPath = join(this.dir, "tokens.json");
  }

  // ── Read/write ──────────────────────────────────────────────────

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
    if (!entry?.serverUrl) return undefined;
    if (entry.serverUrl !== serverUrl) return undefined;
    return entry;
  }

  saveEntry(entry: AuthEntry, serverUrl?: string): void {
    if (serverUrl) entry.serverUrl = serverUrl;
    this.ensureDir();
    writeFileSync(this.tokensPath, JSON.stringify(entry, null, 2), { mode: 0o600 });
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

  // ── Token helpers ────────────────────────────────────────────────

  get tokens(): StoredTokens | undefined {
    return this.getEntry()?.tokens;
  }

  set tokens(t: StoredTokens) {
    this.update("tokens", t);
  }

  get isExpired(): boolean | null {
    const entry = this.getEntry();
    if (!entry?.tokens) return null;
    if (!entry.tokens.expiresAt) return false;
    return entry.tokens.expiresAt < Date.now() / 1000;
  }

  get hasTokens(): boolean {
    return !!this.getEntry()?.tokens;
  }

  // ── Client info ──────────────────────────────────────────────────

  get clientInfo(): StoredClientInfo | undefined {
    return this.getEntry()?.clientInfo;
  }

  set clientInfo(info: StoredClientInfo) {
    this.update("clientInfo", info);
  }

  // ── PKCE / OAuth state ───────────────────────────────────────────

  get codeVerifier(): string | undefined {
    return this.getEntry()?.codeVerifier;
  }

  set codeVerifier(v: string) {
    this.update("codeVerifier", v);
  }

  clearCodeVerifier(): void {
    this.clearField("codeVerifier");
  }

  get oauthState(): string | undefined {
    return this.getEntry()?.oauthState;
  }

  set oauthState(s: string) {
    this.update("oauthState", s);
  }

  clearOAuthState(): void {
    this.clearField("oauthState");
  }

  // ── Bulk operations ──────────────────────────────────────────────

  clearAll(): void {
    this.remove();
  }

  clearClientInfo(): void {
    this.clearField("clientInfo");
  }

  clearTokens(): void {
    this.clearField("tokens");
  }

  // ── Private ──────────────────────────────────────────────────────

  private computeDir(name: string): string {
    const storageKey = createHash("sha256").update(name, "utf8").digest("hex");
    const base = process.env.MCP_OAUTH_DIR?.trim() || getAgentPath("mcp");
    return join(base, `sha256-${storageKey}`);
  }

  private ensureDir(): void {
    if (!existsSync(this.dir)) mkdirSync(this.dir, { recursive: true, mode: 0o700 });
  }

  private update<K extends keyof AuthEntry>(key: K, value: AuthEntry[K]): void {
    const entry = this.getEntry() ?? {};
    entry[key] = value;
    this.saveEntry(entry);
  }

  private clearField(key: keyof AuthEntry): void {
    const entry = this.getEntry();
    if (entry) {
      delete entry[key];
      this.saveEntry(entry);
    }
  }
}
