# MCP (Model Context Protocol)

Connects to remote MCP servers via Streamable HTTP with automatic OAuth 2.0
(authorization code flow with PKCE + token refresh).

**OAuth is auto-detected** from the server's `/.well-known/oauth-authorization-server`
endpoint. No manual endpoint configuration needed.

**Token efficiency:** truncated results (10 KB / 500 lines), lazy schema conversion,
connection reuse.

## Commands

| Command | Description |
|---------|-------------|
| `/mcp-status` | Show connection status & registered tools |
| `/mcp-reload` | Reload config and reconnect all servers |
| `/mcp-auth` | Show OAuth status for all servers |
| `/mcp-auth login [name]` | Start OAuth login flow (clears cached tokens, re-auths) |
| `/mcp-auth logout [name]` | Clear stored OAuth tokens |

## Settings (`mcp` in `custom-settings.yaml`)

```yaml
mcp:
  toolPrefix: "mcp"
  maxResultBytes: 10240
  maxResultLines: 500
  reconnectEnabled: true
  reconnectMaxRetries: 3
  servers:
    - name: "atlassian"
      url: "https://mcp.atlassian.com/v1/mcp/authv2"

    - name: "atlassian-scoped"
      url: "https://mcp.atlassian.com/v1/mcp/authv2"
      oauth:
        scopes: ["read:jira-work", "write:jira-work"]

    - name: "custom-client"
      url: "https://mcp.example.com/v1"
      headers:
        X-Custom-Header: "value"
      timeout: 60000
      oauth:
        clientId: "pre-registered-client-id"
        clientSecret: "client-secret"
        tokenStorePath: "/path/to/tokens.json"
```

### Server config fields

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `name` | ✅ | — | Unique server identifier |
| `url` | ✅ | — | MCP server URL (Streamable HTTP) |
| `headers` | ❌ | — | Extra HTTP headers per request |
| `timeout` | ❌ | `30000` | Request timeout in ms |
| `oauth` | ❌ | auto-detected | OAuth overrides (see below) |

### OAuth overrides (`oauth`)

All fields optional. If omitted entirely, OAuth is auto-detected:

1. Check for cached tokens on disk
2. If no valid tokens → fetch `/.well-known/oauth-authorization-server`
3. Dynamically register client (if supported) → browser PKCE flow → store tokens

| Field | Description |
|-------|-------------|
| `clientId` | Pre-registered client ID (skips dynamic registration) |
| `clientSecret` | Secret for confidential clients |
| `scopes` | Scopes to request (default: server-defined) |
| `tokenStorePath` | Custom path for persisted tokens |

## OAuth flow

```
Server URL: https://mcp.atlassian.com/v1/mcp/authv2

start():
  ├─ Load cached tokens from ~/.pi/agent/mcp-tokens/<name>.json
  ├─ Valid? → use them ✓
  └─ No valid tokens:
      ├─ GET https://mcp.atlassian.com/.well-known/oauth-authorization-server
      ├─ Dynamic client registration (if /register endpoint available)
      └─ PKCE flow: open browser → authorize → exchange code → persist tokens

send() on 401:
  └─ Try refresh token → if fails, re-run OAuth flow → retry request
```

Tool naming: `<prefix>_<server>_<tool>` (sanitized).
