/**
 * AuthStore — Persistent storage for MCP OAuth tokens and client registration info.
 *
 * Stores data in ~/.pi/agent/mcp/auth.json as a JSON map keyed by
 * "{serverName}::{resourceUrl}".
 *
 * Each entry holds:
 *   - clientId, clientSecret (from dynamic registration)
 *   - accessToken, refreshToken, expiresAt (from token exchange)
 *   - tokenUrl, authorizationUrl, registrationUrl (discovery metadata)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

export interface StoredAuthEntry {
  serverName: string;
  resourceUrl: string;
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number; // epoch ms
  tokenUrl?: string;
  authorizationUrl?: string;
  registrationUrl?: string;
}

interface AuthFile {
  entries: Record<string, StoredAuthEntry>;
}

export class AuthStore {
  // ── private static helpers ──────────────────────────────────────────

  private static storeDir(): string {
    return path.join(os.homedir(), ".pi", "agent", "mcp");
  }

  private static storePath(): string {
    return path.join(AuthStore.storeDir(), "auth.json");
  }

  private static entryKey(serverName: string, resourceUrl: string): string {
    return `${serverName}::${resourceUrl}`;
  }

  private static readStore(): AuthFile {
    try {
      const raw = fs.readFileSync(AuthStore.storePath(), "utf-8");
      return JSON.parse(raw) as AuthFile;
    } catch {
      return { entries: {} };
    }
  }

  private static writeStore(data: AuthFile): void {
    const dir = AuthStore.storeDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const storePath = AuthStore.storePath();
    const tmpPath = `${storePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), { encoding: "utf-8", mode: 0o600 });
    fs.renameSync(tmpPath, storePath);
  }

  /**
   * Save (or update) an auth entry for a given server + resource.
   */
  save(entry: StoredAuthEntry): void {
    const store = AuthStore.readStore();
    const key = AuthStore.entryKey(entry.serverName, entry.resourceUrl);
    const existing = store.entries[key];
    store.entries[key] = { ...existing, ...entry };
    AuthStore.writeStore(store);
  }

  /**
   * Retrieve an auth entry by server name and resource URL.
   */
  get(serverName: string, resourceUrl: string): StoredAuthEntry | undefined {
    const store = AuthStore.readStore();
    const key = AuthStore.entryKey(serverName, resourceUrl);
    return store.entries[key];
  }

  /**
   * Look up by server name and resource URL (alias for get).
   * Named getForUrl to match the D2 design diagram.
   */
  getForUrl(serverName: string, resourceUrl: string): StoredAuthEntry | undefined {
    return this.get(serverName, resourceUrl);
  }

  /**
   * Delete an auth entry.
   */
  delete(serverName: string, resourceUrl: string): void {
    const store = AuthStore.readStore();
    const key = AuthStore.entryKey(serverName, resourceUrl);
    delete store.entries[key];
    AuthStore.writeStore(store);
  }

  /**
   * List all stored entries.
   */
  list(): StoredAuthEntry[] {
    const store = AuthStore.readStore();
    return Object.values(store.entries);
  }

  /**
   * Check if tokens are expired (or about to expire within bufferSeconds).
   */
  isExpired(entry: StoredAuthEntry, bufferSeconds = 60): boolean {
    if (!entry.expiresAt) return true;
    return Date.now() >= entry.expiresAt - bufferSeconds * 1000;
  }

  /**
   * Check if an entry has a refresh token (can be refreshed).
   */
  canRefresh(entry: StoredAuthEntry): boolean {
    return !!entry.refreshToken;
  }
}
