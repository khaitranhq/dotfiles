/**
 * MCP OAuth Callback Server
 *
 * HTTP server that handles OAuth callbacks from the authorization server.
 * Uses Node.js http module for compatibility.
 */

import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import {
  DEFAULT_OAUTH_CALLBACK_PATH,
  getConfiguredOAuthCallbackPort,
  getOAuthCallbackPath,
  getOAuthCallbackPort,
  setOAuthCallbackPath,
  setOAuthCallbackPort,
} from "./oauth-provider";

const CALLBACK_TIMEOUT_MS = 5 * 60 * 1000;
const HOST_DEFAULT = "localhost";

interface PendingAuth {
  resolve: (code: string) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

function escapeHtml(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const HTML_SUCCESS = `<!DOCTYPE html>
<html><head><title>Pi - Authorization Successful</title><style>
body{font-family:system-ui,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#1a1a2e;color:#eee}
.container{text-align:center;padding:2rem}h1{color:#4ade80;margin-bottom:1rem}p{color:#aaa}
</style></head><body><div class="container"><h1>Authorization Successful</h1>
<p>You can close this window and return to Pi.</p></div><script>setTimeout(()=>window.close(),2000)</script></body></html>`;

function errorHtml(err: string): string {
  return `<!DOCTYPE html>
<html><head><title>Pi - Authorization Failed</title><style>
body{font-family:system-ui,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#1a1a2e;color:#eee}
.container{text-align:center;padding:2rem}h1{color:#f87171;margin-bottom:1rem}p{color:#aaa}
.error{color:#fca5a5;font-family:monospace;margin-top:1rem;padding:1rem;background:rgba(248,113,113,.1);border-radius:.5rem}
</style></head><body><div class="container"><h1>Authorization Failed</h1>
<p>An error occurred during authorization.</p><div class="error">${escapeHtml(err)}</div></div></body></html>`;
}

class OAuthCallbackServer {
  private server?: Server;
  private bindingPromise?: Promise<void>;
  private pending = new Map<string, PendingAuth>();
  private reserved = new Set<string>();
  private host = HOST_DEFAULT;

  get isRunning(): boolean {
    return this.server !== undefined;
  }

  get pendingCount(): number {
    return this.pending.size;
  }

  // ── Public ────────────────────────────────────────────────────────

  cancel(state: string): void {
    this.reserved.delete(state);
    const p = this.pending.get(state);
    if (p) {
      clearTimeout(p.timeout);
      this.pending.delete(state);
      p.reject(new Error("Authorization cancelled"));
    }
  }

  async ensure(
    options: {
      strictPort?: boolean;
      port?: number;
      callbackHost?: string;
      callbackPath?: string;
      oauthState?: string;
      reserveState?: boolean;
    } = {},
  ): Promise<void> {
    while (this.bindingPromise) await this.bindingPromise;

    const op = this.ensureLocked(options);
    this.bindingPromise = op;
    try {
      await op;
    } finally {
      if (this.bindingPromise === op) this.bindingPromise = undefined;
    }
  }

  release(state: string): void {
    this.reserved.delete(state);
  }

  reserve(state: string): void {
    this.reserved.add(state);
  }

  async stop(): Promise<void> {
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => resolve());
      });
      this.server = undefined;
    }
    setOAuthCallbackPort(getConfiguredOAuthCallbackPort());
    this.host = HOST_DEFAULT;
    setOAuthCallbackPath(DEFAULT_OAUTH_CALLBACK_PATH);

    const list = Array.from(this.pending.entries());
    this.pending.clear();
    this.reserved.clear();
    setTimeout(() => {
      for (const [, p] of list) {
        clearTimeout(p.timeout);
        p.reject(new Error("OAuth callback server stopped"));
      }
    }, 0);
  }

  wait(state: string): Promise<string> {
    this.reserved.delete(state);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.pending.has(state)) {
          this.pending.delete(state);
          reject(new Error("OAuth callback timeout - authorization took too long"));
        }
      }, CALLBACK_TIMEOUT_MS);
      this.pending.set(state, { resolve, reject, timeout });
    });
  }

  // ── Private ───────────────────────────────────────────────────────

  private closeQuiet(srv: Server): Promise<void> {
    return new Promise((resolve) => {
      srv.close(() => resolve());
    });
  }

  private async ensureLocked(opts: {
    strictPort?: boolean;
    port?: number;
    callbackHost?: string;
    callbackPath?: string;
    oauthState?: string;
    reserveState?: boolean;
  }): Promise<void> {
    const requiredPort = opts.port ?? getConfiguredOAuthCallbackPort();
    const strictPort = opts.strictPort === true;
    const host = opts.callbackHost ?? HOST_DEFAULT;
    const path = opts.callbackPath ?? DEFAULT_OAUTH_CALLBACK_PATH;

    if (opts.reserveState && !opts.oauthState)
      throw new Error("OAuth callback reservation requires an oauthState");

    const prev = this.server;
    const needsRebind = Boolean(prev && strictPort && getOAuthCallbackPort() !== requiredPort);
    const needsHost = Boolean(prev && this.host !== host);
    const needsPath = Boolean(prev && getOAuthCallbackPath() !== path);

    if (prev) {
      if (!needsRebind && !needsHost) {
        if (needsPath) {
          if (this.hasPending()) throwBusy(path);
          setOAuthCallbackPath(path);
        }
        if (opts.reserveState && opts.oauthState) this.reserved.add(opts.oauthState);
        return;
      }
      if (this.hasPending()) throwBusy(host, requiredPort);
    }

    const srv = createServer((req, res) => this.handleRequest(req, res));
    const listenPort = strictPort ? requiredPort : 0;

    try {
      await this.listen(srv, listenPort, host);
    } catch (err) {
      await this.closeQuiet(srv);
      if (strictPort && (err as NodeJS.ErrnoException).code === "EADDRINUSE") {
        throw new Error(
          `OAuth callback port ${requiredPort} is already in use. ` +
            `Pre-registered OAuth clients require an exact redirect URI; ` +
            `set MCP_OAUTH_CALLBACK_PORT to your registered port or free port ${requiredPort}`,
          { cause: err },
        );
      }
      throw err;
    }

    if (strictPort) setOAuthCallbackPort(requiredPort);
    else {
      const addr = srv.address();
      if (!addr || typeof addr === "string" || typeof addr.port !== "number")
        throw new Error("OAuth callback server did not report an assigned port");
      setOAuthCallbackPort(addr.port);
    }

    if (prev && (needsRebind || needsHost)) await this.closeQuiet(prev);

    this.host = host;
    setOAuthCallbackPath(path);
    this.server = srv;
    if (opts.reserveState && opts.oauthState) this.reserved.add(opts.oauthState);
    srv.unref();
  }

  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    if (url.pathname !== getOAuthCallbackPath()) {
      res.writeHead(404).end("Not found");
      return;
    }

    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");
    const desc = url.searchParams.get("error_description");

    if (!state) {
      this.reply(res, 400, errorHtml("Missing required state parameter - potential CSRF attack"));
      return;
    }

    const pending = this.pending.get(state);
    const isReserved = this.reserved.has(state);

    if (error) {
      if (!pending && !isReserved) {
        this.reply(res, 400, errorHtml("Invalid or expired state parameter"));
        return;
      }
      this.reserved.delete(state);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pending.delete(state);
        setTimeout(() => pending.reject(new Error(desc || error)), 0);
      }
      res.writeHead(200, { "Content-Type": "text/html" }).end(errorHtml(desc || error));
      return;
    }

    if (!pending) {
      this.reply(res, 400, errorHtml("Invalid or expired state parameter"));
      return;
    }
    if (!code) {
      this.reply(res, 400, errorHtml("No authorization code provided"));
      return;
    }

    clearTimeout(pending.timeout);
    this.pending.delete(state);
    pending.resolve(code);
    res.writeHead(200, { "Content-Type": "text/html" }).end(HTML_SUCCESS);
  }

  private hasPending(): boolean {
    return this.pending.size > 0 || this.reserved.size > 0;
  }

  private listen(srv: Server, port: number, host: string): Promise<void> {
    return new Promise((resolve, reject) => {
      srv.once("error", reject);
      srv.listen(port, host, () => resolve());
    });
  }

  private reply(res: ServerResponse, status: number, body: string): void {
    res.writeHead(status, { "Content-Type": "text/html" }).end(body);
  }
}

/** Singleton instance */
export const callbackServer = new OAuthCallbackServer();

function throwBusy(host: string, port?: number): never {
  throw new Error(
    `OAuth callback server is running on ${host}:${port ?? getOAuthCallbackPort()}, ` +
      `but a different endpoint is required and cannot be switched while authorizations are pending`,
  );
}
