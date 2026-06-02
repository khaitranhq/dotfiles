/**
 * handlers.ts — Tool execute functions, render helpers, and command handlers
 * for the MCP OAuth extension.
 *
 * All business logic lives here. index.ts is a thin wiring layer that
 * registers tools/commands and delegates to these handlers.
 */

import { AuthStore } from "./auth-store.js";
import { CallbackServer } from "./callback-server.js";
import { McpOAuthProvider, type OAuthMetadata } from "./oauth-provider.js";
import { spawn } from "node:child_process";

// ─── Types ───────────────────────────────────────────────────────────────

interface AuthorizeParams {
  serverUrl: string;
  serverName?: string;
  scopes?: string[];
}

interface RefreshParams {
  serverUrl: string;
  serverName?: string;
}

interface GetTokenParams {
  serverUrl: string;
  serverName?: string;
}

interface ConfigureParams {
  serverUrl: string;
  serverName?: string;
  clientId: string;
  clientSecret?: string;
  authorizationUrl: string;
  tokenUrl: string;
  registrationUrl?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OnUpdateFn = any;

// ─── Constants ───────────────────────────────────────────────────────────

const DEFAULT_SCOPES = ["openid", "profile", "email"];

// ─── Tool Handler: mcp_oauth_authorize ───────────────────────────────────

export async function handleAuthorize(
  authStore: AuthStore,
  params: AuthorizeParams,
  onUpdate: OnUpdateFn,
  ctx: any,
): Promise<any> {
  const serverUrl = params.serverUrl.replace(/\/$/, "");
  const serverName = params.serverName ?? new URL(serverUrl).hostname;
  const scopes = params.scopes ?? DEFAULT_SCOPES;

  // Check if already authorized
  const stored = authStore.get(serverName, serverUrl);
  if (stored?.accessToken && !authStore.isExpired(stored)) {
    return {
      content: [
        {
          type: "text",
          text: `Already authorized for ${serverName}. Access token is valid.`,
        },
      ],
      details: {
        serverName,
        serverUrl,
        authorized: true,
        accessToken: stored.accessToken,
        maskedToken: stored.accessToken.slice(0, 8) + "...",
        expiresAt: stored.expiresAt,
      },
    };
  }

  // Try to refresh if expired but has refresh token
  if (stored && authStore.canRefresh(stored)) {
    onUpdateSafe(onUpdate, "Token expired. Attempting silent refresh...");

    const provider = new McpOAuthProvider(serverName, serverUrl, "", authStore);
    provider.loadFromStore();

    try {
      const newToken = await provider.getAccessToken();
      if (newToken) {
        return {
          content: [{ type: "text", text: `Token refreshed successfully for ${serverName}.` }],
          details: {
            serverName,
            serverUrl,
            authorized: true,
            maskedToken: newToken.slice(0, 8) + "...",
            refreshed: true,
          },
        };
      }
    } catch {
      // Refresh failed, continue with full auth flow
    }
  }

  onUpdateSafe(onUpdate, `Starting OAuth authorization for ${serverName}...`);

  // Start callback server
  const callbackServer = new CallbackServer();
  try {
    await callbackServer.start();
  } catch (err) {
    return {
      content: [
        {
          type: "text",
          text: `Failed to start callback server: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
      details: { error: true },
      isError: true,
    };
  }

  const redirectUri = callbackServer.getRedirectUri();
  const provider = new McpOAuthProvider(serverName, serverUrl, redirectUri, authStore);

  try {
    // Step 1: Trigger MCP server to get OAuth metadata via 401 response
    onUpdateSafe(onUpdate, "Discovering OAuth metadata from MCP server...");

    let metadata: OAuthMetadata;

    try {
      const response = await fetch(serverUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "initialize",
          params: {
            protocolVersion: "2025-06-18",
            capabilities: {},
            clientInfo: { name: "pi", version: "1.0.0" },
          },
          id: 1,
        }),
      });

      const wwwAuth =
        response.headers.get("WWW-Authenticate") || response.headers.get("www-authenticate");
      if (response.status === 401 && wwwAuth) {
        metadata = await provider.discoverFrom401(wwwAuth);
      } else if (response.ok) {
        return {
          content: [
            {
              type: "text",
              text: `MCP server at ${serverUrl} does not require OAuth authentication (connected successfully).`,
            },
          ],
          details: { serverName, serverUrl, noAuth: true, connected: true },
        };
      } else {
        return {
          content: [
            {
              type: "text",
              text:
                `MCP server returned unexpected response: ${response.status} ${response.statusText}. ` +
                "Expected 401 with WWW-Authenticate header for OAuth discovery.",
            },
          ],
          details: { serverName, serverUrl, error: true, status: response.status },
          isError: true,
        };
      }
    } catch (err) {
      callbackServer.stop();
      return {
        content: [
          {
            type: "text",
            text: `Failed to connect to MCP server ${serverUrl}: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        details: { error: true },
        isError: true,
      };
    }

    onUpdateSafe(
      onUpdate,
      `Discovered OAuth endpoints. Authorization URL: ${metadata.authorizationUrl}`,
    );

    // Step 2: Register client (if not already registered)
    const needsRegistration = !stored?.clientId;

    if (metadata.registrationUrl && needsRegistration) {
      onUpdateSafe(onUpdate, "Registering client with authorization server...");
      await provider.register();
    } else if (!metadata.registrationUrl && needsRegistration) {
      callbackServer.stop();
      return {
        content: [
          {
            type: "text",
            text:
              "Authorization server does not support dynamic client registration. " +
              "A pre-configured client ID is required. Please provide clientId and clientSecret " +
              "via the mcp_oauth_configure tool.",
          },
        ],
        details: {
          serverName,
          serverUrl,
          needsManualRegistration: true,
          authorizationUrl: metadata.authorizationUrl,
          tokenUrl: metadata.tokenUrl,
        },
        isError: true,
      };
    } else {
      // Reuse stored client info
      provider.setClientInfo({
        clientId: stored!.clientId!,
        clientSecret: stored!.clientSecret,
      });
      provider.setMetadata(metadata);
    }

    // Step 3: Build authorization URL and open browser
    const authUrl = provider.buildAuthorizationUrl(scopes);

    onUpdateSafe(onUpdate, `Opening browser for authorization: ${authUrl.slice(0, 100)}...`);

    if (ctx.hasUI) {
      ctx.ui.notify(`Opening browser for MCP OAuth authorization (${serverName})`);
    }

    openUrl(authUrl);

    // Step 4: Wait for callback
    onUpdateSafe(onUpdate, "Waiting for authorization in browser...");

    const callbackResult = await callbackServer.waitForCallback(300_000);

    // Step 5: Validate CSRF state
    if (!provider.validateState(callbackResult.state)) {
      callbackServer.stop();
      return {
        content: [
          {
            type: "text",
            text: "CSRF state validation failed. The authorization response may have been tampered with.",
          },
        ],
        details: { error: true, csrfMismatch: true },
        isError: true,
      };
    }

    onUpdateSafe(onUpdate, "Authorization code received. Exchanging for tokens...");

    // Step 6: Exchange code for tokens
    const tokenSet = await provider.exchangeCode(callbackResult.code);
    callbackServer.stop();

    return {
      content: [
        {
          type: "text",
          text:
            `Successfully authorized MCP server "${serverName}" via OAuth 2.1.\n` +
            `Access token (first 8 chars): ${tokenSet.accessToken.slice(0, 8)}...\n` +
            `Expires: ${new Date(tokenSet.expiresAt).toISOString()}\n` +
            `Refresh token: ${tokenSet.refreshToken ? "available (silent refresh enabled)" : "not available"}`,
        },
      ],
      details: {
        serverName,
        serverUrl,
        authorized: true,
        maskedToken: tokenSet.accessToken.slice(0, 8) + "...",
        expiresAt: tokenSet.expiresAt,
        hasRefreshToken: !!tokenSet.refreshToken,
      },
    };
  } catch (err) {
    callbackServer.stop();
    return {
      content: [
        {
          type: "text",
          text: `OAuth authorization failed: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
      details: { error: true },
      isError: true,
    };
  }
}

// ─── Tool Handler: mcp_oauth_refresh ───────────────────────────────────

export async function handleRefresh(authStore: AuthStore, params: RefreshParams): Promise<any> {
  const serverUrl = params.serverUrl.replace(/\/$/, "");
  const serverName = params.serverName ?? new URL(serverUrl).hostname;

  const stored = authStore.get(serverName, serverUrl);
  if (!stored?.refreshToken) {
    return {
      content: [
        {
          type: "text",
          text: `No refresh token available for ${serverName}. Full re-authorization required.`,
        },
      ],
      details: { error: true, needsReAuth: true },
      isError: true,
    };
  }

  const provider = new McpOAuthProvider(serverName, serverUrl, "", authStore);
  provider.loadFromStore();

  try {
    const tokenSet = await provider.refresh();
    return {
      content: [
        {
          type: "text",
          text: `Token refreshed for ${serverName}. Expires: ${new Date(tokenSet.expiresAt).toISOString()}`,
        },
      ],
      details: {
        serverName,
        serverUrl,
        refreshed: true,
        maskedToken: tokenSet.accessToken.slice(0, 8) + "...",
        expiresAt: tokenSet.expiresAt,
      },
    };
  } catch (err) {
    return {
      content: [
        {
          type: "text",
          text: `Token refresh failed: ${err instanceof Error ? err.message : String(err)}. Full re-authorization required.`,
        },
      ],
      details: { error: true, needsReAuth: true },
      isError: true,
    };
  }
}

// ─── Tool Handler: mcp_oauth_get_token ──────────────────────────────────

export async function handleGetToken(authStore: AuthStore, params: GetTokenParams): Promise<any> {
  const serverUrl = params.serverUrl.replace(/\/$/, "");
  const serverName = params.serverName ?? new URL(serverUrl).hostname;

  const stored = authStore.get(serverName, serverUrl);

  // Check if valid token exists
  if (stored?.accessToken && !authStore.isExpired(stored)) {
    return {
      content: [
        {
          type: "text",
          text: `Access token for ${serverName} is valid until ${new Date(stored.expiresAt!).toISOString()}`,
        },
      ],
      details: {
        serverName,
        serverUrl,
        token: stored.accessToken,
        maskedToken: stored.accessToken.slice(0, 8) + "...",
        expiresAt: stored.expiresAt,
      },
    };
  }

  // Try refresh
  if (stored?.refreshToken) {
    const provider = new McpOAuthProvider(serverName, serverUrl, "", authStore);
    provider.loadFromStore();

    try {
      const token = await provider.getAccessToken();
      if (token) {
        const updated = authStore.get(serverName, serverUrl);
        return {
          content: [
            {
              type: "text",
              text: `Token refreshed for ${serverName}. Valid until ${updated?.expiresAt ? new Date(updated.expiresAt).toISOString() : "unknown"}`,
            },
          ],
          details: {
            serverName,
            serverUrl,
            token,
            maskedToken: token.slice(0, 8) + "...",
            expiresAt: updated?.expiresAt,
            refreshed: true,
          },
        };
      }
    } catch {
      // fall through to error
    }
  }

  return {
    content: [
      {
        type: "text",
        text: `No valid token for ${serverName}. Run mcp_oauth_authorize to authenticate.`,
      },
    ],
    details: { error: true, notAuthorized: true },
    isError: true,
  };
}

// ─── Tool Handler: mcp_oauth_configure ──────────────────────────────────

export async function handleConfigure(authStore: AuthStore, params: ConfigureParams): Promise<any> {
  const serverUrl = params.serverUrl.replace(/\/$/, "");
  const serverName = params.serverName ?? new URL(serverUrl).hostname;

  authStore.save({
    serverName,
    resourceUrl: serverUrl,
    clientId: params.clientId,
    clientSecret: params.clientSecret,
    authorizationUrl: params.authorizationUrl,
    tokenUrl: params.tokenUrl,
    registrationUrl: params.registrationUrl,
  });

  return {
    content: [
      {
        type: "text",
        text: `OAuth client credentials configured for ${serverName}. Use mcp_oauth_authorize to complete authorization.`,
      },
    ],
    details: { serverName, serverUrl, configured: true },
  };
}

// ─── Tool Handler: mcp_oauth_list ───────────────────────────────────────

export async function handleList(authStore: AuthStore): Promise<any> {
  const entries = authStore.list();
  const lines = entries.map((e) => {
    const status = e.accessToken
      ? authStore.isExpired(e)
        ? "expired"
        : e.refreshToken
          ? "valid + refreshable"
          : "valid"
      : "not authorized";
    return `- **${e.serverName}** (${e.resourceUrl}): ${status}`;
  });

  return {
    content: [
      {
        type: "text",
        text:
          entries.length === 0
            ? "No MCP OAuth credentials stored."
            : `Stored MCP OAuth credentials:\n\n${lines.join("\n")}`,
      },
    ],
    details: {
      entries: entries.map((e) => ({
        ...e,
        accessToken: undefined,
        refreshToken: undefined,
      })),
    },
  };
}

// ─── Render Helpers ─────────────────────────────────────────────────────

export function renderAuthorizeCall(
  args: AuthorizeParams,
  theme: Record<string, any>,
  _context: unknown,
): any {
  const { Text } = require("@earendil-works/pi-tui");
  const serverName = args.serverName ?? "MCP Server";
  const preview = args.serverUrl.length > 50 ? `${args.serverUrl.slice(0, 50)}...` : args.serverUrl;

  let text = "";
  text += theme.fg("toolTitle", theme.bold("mcp_oauth_authorize "));
  text += theme.fg("accent", serverName);
  text += `\n  ${theme.fg("dim", preview)}`;
  return new Text(text, 0, 0);
}

export function renderAuthorizeResult(
  result: any,
  _options: unknown,
  theme: Record<string, any>,
  _context: unknown,
): any {
  const { Text } = require("@earendil-works/pi-tui");
  const details = result.details;
  const text = result.content[0];
  const textStr = text?.type === "text" ? text.text : "(no output)";

  let output = "";
  if (details.authorized) {
    output += theme.fg("success", "✓ Authorized");
  } else if (details.error) {
    output += theme.fg("error", "✗ Failed");
  } else if (details.noAuth) {
    output += theme.fg("muted", "ℹ No auth required");
  }
  output += `\n${theme.fg("dim", textStr.split("\n")[0] || "")}`;
  return new Text(output, 0, 0);
}

// ─── Internal Helpers ───────────────────────────────────────────────────

function onUpdateSafe(onUpdate: OnUpdateFn, text: string): void {
  if (onUpdate) {
    onUpdate({ content: [{ type: "text" as const, text }], details: {} });
  }
}

function openUrl(url: string): void {
  const platform = process.platform;
  let command: string;
  let args: string[];

  if (platform === "darwin") {
    command = "open";
    args = [url];
  } else if (platform === "win32") {
    command = "cmd";
    args = ["/c", "start", '""', url];
  } else {
    command = "xdg-open";
    args = [url];
  }

  const proc = spawn(command, args, {
    stdio: "ignore",
    detached: true,
  });
  proc.unref();
}
