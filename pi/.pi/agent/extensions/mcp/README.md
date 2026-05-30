# MCP Extension

Pi extension providing **Model Context Protocol (MCP)** client support. Connects the agent to MCP servers and exposes their tools directly in the agent's tool registry.

## Features

| Feature                      | Description                                                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Multi-transport**          | stdio (local processes), SSE (Server-Sent Events), Streamable HTTP                                                       |
| **OAuth 2.1**                | Full authorization-code and client-credentials flows with auto-discovery, dynamic client registration, and token refresh |
| **Bearer auth**              | Static token or environment variable based                                                                               |
| **Lifecycle modes**          | `keep-alive` (auto-reconnect), `lazy` (connect on demand), `eager` (connect at startup)                                  |
| **Idle timeout**             | Per-server and global idle timeout with automatic shutdown                                                               |
| **Tool prefixing**           | Namespace tools by server: `server` (full), `short` (abbreviated), or `none`                                             |
| **Metadata caching**         | 7-day persistent cache of tool/resource schemas — avoids re-listing on every session                                     |
| **Direct tool registration** | Selectively expose tools as native agent tools via config or `MCP_DIRECT_TOOLS` env                                      |
| **Resource exposure**        | Expose MCP resources as read-only tools (`get_<resource_name>`)                                                          |
| **Tool exclusion**           | Blacklist specific tools per server                                                                                      |
| **Health checks**            | Periodic health checks with auto-reconnect for keep-alive servers                                                        |
| **Session lifecycle**        | Clean startup/shutdown tied to agent sessions                                                                            |
| **OAuth callback server**    | Built-in local HTTP server for OAuth redirect handling                                                                   |
| **Env interpolation**        | `${VAR}` and `$env:VAR` in config values resolved from process environment                                               |

## Configuration

All MCP server configuration lives in `~/.pi/agent/custom-settings.yaml` under the `mcp.servers` key.

```yaml
mcp:
  servers:
    - name: atlassian
      transport: http
      url: https://mcp.atlassian.com/v1/mcp/authv2
      auth: oauth
```

### Server definition

Each entry in the `mcp.servers` array has a `name`, `transport`, and transport-specific fields.

#### stdio transport

```yaml
mcp:
  servers:
    - name: my-local-tool
      transport: stdio
      command: node
      args:
        - server.js
      env:
        NODE_ENV: production
      cwd: /path/to/server
```

| Field     | Type                  | Description                 |
| --------- | --------------------- | --------------------------- |
| `command` | string                | Executable to spawn         |
| `args`    | string[]              | CLI arguments               |
| `env`     | Record<string,string> | Extra environment variables |
| `cwd`     | string                | Working directory           |

#### HTTP transport

```yaml
mcp:
  servers:
    - name: atlassian
      transport: http
      url: https://mcp.atlassian.com/v1/mcp/authv2
      auth: oauth
    - name: obsidian
      transport: http
      url: http://127.0.0.1:27123/mcp/
      headers:
        Authorization: Bearer ${OBSIDIAN_TOKEN}
```

| Field            | Type                    | Description                                                               |
| ---------------- | ----------------------- | ------------------------------------------------------------------------- |
| `url`            | string                  | MCP server URL                                                            |
| `headers`        | Record<string,string>   | HTTP headers (supports `${VAR}` interpolation)                            |
| `auth`           | `"oauth"` \| `"bearer"` | Auth type. OAuth auto-detected if URL present and no explicit auth header |
| `bearerToken`    | string                  | Static Bearer token (supports env interpolation)                          |
| `bearerTokenEnv` | string                  | Env var name containing Bearer token                                      |

#### OAuth configuration

```yaml
mcp:
  servers:
    - name: my-api
      transport: http
      url: https://api.example.com/mcp
      auth: oauth
      oauth:
        grantType: authorization_code
        clientId: my-client-id
        clientSecret: my-secret
        scope: read write
        redirectUri: http://localhost:19876/callback
```

If `oauth` is omitted, the SDK performs **dynamic client registration** automatically.

| Field          | Type                                             | Default                           | Description                                   |
| -------------- | ------------------------------------------------ | --------------------------------- | --------------------------------------------- |
| `grantType`    | `"authorization_code"` \| `"client_credentials"` | `authorization_code`              | OAuth grant type                              |
| `clientId`     | string                                           | —                                 | Pre-registered client ID                      |
| `clientSecret` | string                                           | —                                 | Client secret for confidential clients        |
| `scope`        | string                                           | —                                 | Requested OAuth scopes                        |
| `redirectUri`  | string                                           | `http://localhost:19876/callback` | Exact redirect URI for pre-registered clients |
| `clientName`   | string                                           | `"Khai Tran Agent"`               | Display name for dynamic registration         |
| `clientUri`    | string                                           | `"https://github.com/khaitranrh"` | Homepage URI for dynamic registration         |

#### Common server options

| Field             | Type                                    | Default  | Description                                                             |
| ----------------- | --------------------------------------- | -------- | ----------------------------------------------------------------------- |
| `lifecycle`       | `"keep-alive"` \| `"lazy"` \| `"eager"` | `"lazy"` | Connection lifecycle                                                    |
| `idleTimeout`     | number                                  | `10`     | Idle timeout in minutes. 0 = never idle                                 |
| `exposeResources` | boolean                                 | `true`   | Expose MCP resources as `get_*` tools                                   |
| `directTools`     | boolean \| string[]                     | —        | Register tools directly as agent tools. `true` = all, `string[]` = list |
| `excludeTools`    | string[]                                | —        | Tool names to exclude                                                   |
| `debug`           | boolean                                 | `false`  | Show server stderr in agent output                                      |

#### Full example

```yaml
mcp:
  servers:
    - name: atlassian
      transport: http
      url: https://mcp.atlassian.com/v1/mcp/authv2
      auth: oauth
    - name: obsidian
      transport: http
      url: http://127.0.0.1:27123/mcp/
      headers:
        Authorization: Bearer ${OBSIDIAN_TOKEN}
    - name: my-local-tool
      transport: stdio
      command: node
      args:
        - server.js
      lifecycle: eager
      debug: true
```

### Tool prefixing

Servers are prefixed automatically to avoid name collisions:

| Server name     | Tool name  | Result                   |
| --------------- | ---------- | ------------------------ |
| `my-mcp-server` | `do_thing` | `my_mcp_server_do_thing` |

Prefixing strips trailing `-mcp` from server names and replaces all `-` with `_`.

If `exposeResources` is enabled (default), resources become `get_<resource_name>` tools under the same server prefix.

## Commands

| Command                   | Description                                    |
| ------------------------- | ---------------------------------------------- |
| `/mcp-auth <server-name>` | Start interactive OAuth flow for an MCP server |

## Environment Variables

| Variable                  | Description                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------- |
| `MCP_DIRECT_TOOLS`        | Comma-separated `server/tool` or `server` names. `__none__` disables all direct tools |
| `MCP_OAUTH_DIR`           | Custom OAuth token storage directory                                                  |
| `MCP_OAUTH_CALLBACK_PORT` | Custom OAuth callback port (default: `19876`)                                         |
| `MCP_UI_DEBUG`            | Set to `1` or `true` to enable debug logging                                          |

## Architecture

```
extensions/mcp/
├── index.ts              Entry point — registers tools, commands, session handlers
├── app/
│   ├── bootstrap.ts      MCP initialization, cache hydration, OAuth setup
│   ├── commands.ts        /mcp-auth command handler
│   ├── session.ts         Session start/shutdown lifecycle
│   ├── tools.ts           Tool registry, execution, metadata, resource tools
│   └── tools.spec.ts      Tool tests
├── client/
│   ├── lifecycle.ts       Health checks, keep-alive reconnection, idle shutdown
│   ├── manager.ts         Server connection management (connect/close/track)
│   ├── oauth.ts           OAuth storage, provider, flow orchestration
│   ├── oauth.spec.ts      OAuth tests
│   └── oauth-callback.ts  Local HTTP server for OAuth redirects
├── core/
│   ├── cache.ts           Persistent metadata cache (7-day TTL, atomic writes)
│   ├── config.ts          Config loading from custom-settings.yaml
│   ├── config.spec.ts     Config tests
│   ├── logger.ts          Structured logging (console + file, rotation)
│   ├── types.ts           All TypeScript type definitions
│   ├── utils.ts           State helpers, bearer token resolution
│   └── utils.spec.ts      Utility tests
```

## Logging

MCP logs are written to:

- **Console**: prefixed with `[MCP-UI]`, `[MCP-UI:WARN]`, `[MCP-UI:ERROR]`, `[MCP-UI:DEBUG]`
- **File**: `~/.pi/agent/mcp/mcp.log` (rotated at 10 MB)

Enable debug logging with `MCP_UI_DEBUG=1`.

## OAuth Flow

1. Agent starts → checks OAuth servers for valid tokens
2. If tokens missing or expired, prints a notice
3. User runs `/mcp-auth <server>` → opens browser for authorization
4. Local callback server (`http://localhost:19876/callback`) receives the code
5. SDK exchanges code for tokens, stores them encrypted on disk
6. Subsequent connections use stored tokens with automatic refresh

OAuth storage: `~/.pi/agent/mcp/sha256-<hash>/tokens.json`
