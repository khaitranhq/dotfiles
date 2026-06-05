/**
 * CallbackServer — Local HTTP server to receive OAuth authorization redirects.
 *
 * Listens on localhost with a dynamically-assigned port. Provides the
 * redirect_uri needed for OAuth client registration and authorization.
 *
 * The server must be started BEFORE creating the McpOAuthProvider, because
 * the provider captures the redirect_uri from the active port.
 *
 * Flow:
 *   1. start() → resolves with the port number
 *   2. OAuth provider registers with redirect_uri = http://localhost:{port}/callback
 *   3. Browser redirect hits GET /callback?code=xxx&state=yyy
 *   4. Server validates state, resolves the pending auth promise with the code
 *   5. stop() shuts down the server
 */

import * as http from "node:http";

export interface CallbackResult {
  code: string;
  state: string;
}

export class CallbackServer {
  private server: http.Server | null = null;
  private port = 0;
  private pendingResolver: ((result: CallbackResult) => void) | null = null;
  private pendingRejecter: ((err: Error) => void) | null = null;
  private timeout: ReturnType<typeof setTimeout> | null = null;

  /**
   * Preferred port to use for the callback server.
   * A fixed port ensures the redirect URI is stable across sessions,
   * which is required for OAuth flows where the client's redirect_uris
   * are registered once with the authorization server.
   */
  static readonly PREFERRED_PORT = 40211;

  constructor() {}

  /**
   * Start the HTTP server, trying the preferred port first,
   * then falling back through a range, finally to a random port.
   * Resolves with the assigned port.
   */
  start(): Promise<number> {
    return this.tryListen(CallbackServer.PREFERRED_PORT);
  }

  private tryListen(preferredPort: number): Promise<number> {
    const portRange = 10;
    const ports = [preferredPort];
    for (let i = 1; i < portRange; i++) {
      ports.push(preferredPort + i);
    }
    ports.push(0); // fallback: random port

    return this.listenOnPorts(ports);
  }

  private listenOnPorts(ports: number[]): Promise<number> {
    if (ports.length === 0) {
      return Promise.reject(new Error("No ports available"));
    }

    const [port, ...remaining] = ports;

    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.on("error", (err: Error & { code?: string }) => {
        if (err.code === "EADDRINUSE") {
          // Port busy — try the next one
          this.server = null;
          this.listenOnPorts(remaining).then(resolve).catch(reject);
        } else {
          reject(err);
        }
      });

      this.server.listen(port, "127.0.0.1", () => {
        const addr = this.server!.address();
        if (addr && typeof addr === "object") {
          this.port = addr.port;
          resolve(this.port);
        } else {
          reject(new Error("Failed to get server address"));
        }
      });
    });
  }

  /**
   * Get the redirect URI for the current server instance.
   */
  getRedirectUri(): string {
    return `http://localhost:${this.port}/callback`;
  }

  /**
   * Wait for the OAuth callback to be received.
   * Returns a promise that resolves with the auth code.
   * Times out after the specified duration.
   */
  waitForCallback(timeoutMs = 300_000): Promise<CallbackResult> {
    return new Promise((resolve, reject) => {
      this.pendingResolver = resolve;
      this.pendingRejecter = reject;

      this.timeout = setTimeout(() => {
        this.pendingResolver = null;
        this.pendingRejecter = null;
        reject(new Error("OAuth callback timed out"));
      }, timeoutMs);
    });
  }

  /**
   * Stop the server and clean up.
   */
  stop(): void {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
    if (this.server) {
      this.server.close();
      this.server = null;
    }
    this.pendingResolver = null;
    this.pendingRejecter = null;
  }

  getPort(): number {
    return this.port;
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const url = new URL(req.url ?? "/", `http://localhost:${this.port}`);

    // Only handle GET /callback
    if (req.method !== "GET" || url.pathname !== "/callback") {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
      return;
    }

    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");
    const errorDescription = url.searchParams.get("error_description");

    if (error) {
      const html = this.buildHtmlPage(
        "Authorization Failed",
        `<p>Error: ${this.escapeHtml(error)}</p>` +
          (errorDescription ? `<p>${this.escapeHtml(errorDescription)}</p>` : "") +
          `<p>You can close this window.</p>`,
      );
      res.writeHead(400, { "Content-Type": "text/html" });
      res.end(html);

      if (this.pendingRejecter) {
        this.pendingRejecter(
          new Error(`OAuth error: ${error}${errorDescription ? ` - ${errorDescription}` : ""}`),
        );
        this.pendingRejecter = null;
        this.pendingResolver = null;
      }
      return;
    }

    if (!code) {
      const html = this.buildHtmlPage(
        "Missing Authorization Code",
        "<p>No authorization code was received.</p><p>You can close this window.</p>",
      );
      res.writeHead(400, { "Content-Type": "text/html" });
      res.end(html);

      if (this.pendingRejecter) {
        this.pendingRejecter(new Error("No authorization code received in callback"));
        this.pendingRejecter = null;
        this.pendingResolver = null;
      }
      return;
    }

    // Validate CSRF state
    if (!state) {
      const html = this.buildHtmlPage(
        "Missing State Parameter",
        "<p>No state parameter was received. This may indicate a CSRF attack.</p><p>You can close this window.</p>",
      );
      res.writeHead(400, { "Content-Type": "text/html" });
      res.end(html);

      if (this.pendingRejecter) {
        this.pendingRejecter(new Error("No state parameter in callback"));
        this.pendingRejecter = null;
        this.pendingResolver = null;
      }
      return;
    }

    // Success page
    const html = this.buildHtmlPage(
      "Authorization Successful",
      "<p>You have successfully authorized the MCP client.</p><p>You can close this window and return to pi.</p>",
    );
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(html);

    // Resolve the pending promise
    if (this.pendingResolver) {
      if (this.timeout) {
        clearTimeout(this.timeout);
        this.timeout = null;
      }
      this.pendingResolver({ code, state });
      this.pendingResolver = null;
      this.pendingRejecter = null;
    }
  }

  private buildHtmlPage(title: string, body: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(title)}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: #1a1a2e;
      color: #e0e0e0;
    }
    .container {
      text-align: center;
      padding: 2rem;
      border-radius: 8px;
      background: #16213e;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      max-width: 400px;
    }
    h1 { color: #0fbd8c; margin-bottom: 1rem; }
    p { color: #a0a0b0; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${this.escapeHtml(title)}</h1>
    ${body}
  </div>
</body>
</html>`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}
