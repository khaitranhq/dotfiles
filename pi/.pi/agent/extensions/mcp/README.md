# MCP

MCP (Model Context Protocol) gateway — connect to MCP servers and register their tools in Pi.

Supports `stdio` and HTTP (StreamableHTTP + SSE) transports.

## Features

- **Multi-transport** — stdio (local processes) and HTTP (StreamableHTTP with automatic SSE fallback)
- **Layered config** — standard + Pi-specific JSON files, plus YAML `custom-settings.yaml` override
- **Lifecycle modes** — `keep-alive` (persistent, auto-reconnect), `eager` (connect on startup, idle indefinitely), `lazy` (connect on first tool call, idle timeout)
- **Tool registration** — MCP tools exposed as native Pi tools with configurable prefix (`server` / `short` / `none`)
- **Resource-as-tool** — MCP resources surfaced as `get_<resource>` tools (configurable via `exposeResources`)
- **Tool filtering** — include/exclude specific tools per server via `directTools` / `excludeTools`
- **OAuth 2.1** — auto-discovery, dynamic client registration, authorization code + client credentials flows, interactive browser-based auth (`mcp auth <name>` / `mcp logout <name>`)
- **Bearer token** — static token or env-var-based (`bearerToken` / `bearerTokenEnv`)
- **Environment interpolation** — `${VAR}` expansion in `env`, `headers`, `BearerToken`, and `cwd`
- **Metadata cache** — tools/resources cached to `~/.pi/agent/mcp-cache.json` (7-day TTL, hash-based invalidation on config change)
- **Connection health** — keep-alive auto-reconnect loop; lazy servers with failure backoff (60s)
- **Idle shutdown** — inactive `lazy` servers disconnected after configurable idle timeout (default 10min)
- **OAuth callback server** — local HTTP server for authorization-code redirect flow on configurable port
- **Structured logging** — leveled logs to console + `~/.pi/agent/mcp/mcp.log` (10MB rotation)
- **Collision guard** — skips tool names that collide with built-in Pi tools

## Config Sources

MCP servers are loaded from (in order, later overrides earlier):

1. `~/.config/mcp/mcp.json` — standard user-global MCP config
2. `~/.pi/agent/mcp.json` — Pi global override
3. `.mcp.json` — project standard MCP config
4. `.pi/mcp.json` — project Pi override
5. `~/.pi/agent/custom-settings.yaml` `mcp.servers[]` — YAML server list (overrides all above)

Config is always loaded from these default locations; no CLI flag is needed.

## Commands

| Command                | Description                             |
| ---------------------- | --------------------------------------- |
| `mcp`                  | Show MCP server status                  |
| `mcp reconnect [name]` | Reconnect all servers or a specific one |
| `mcp tools`            | List tools from all connected servers   |
| `mcp auth <name>`      | Authenticate an OAuth server            |
| `mcp logout <name>`    | Remove stored OAuth credentials         |

## Settings (`mcp` in `custom-settings.yaml`)

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
        Authorization: Bearer ${OBSIDIAN_MCP_TOKEN}
    - name: local-tool
      transport: stdio
      command: node
      args: ["server.js"]
      lifecycle: lazy
      idleTimeout: 5
      debug: true
    - name: secure-api
      transport: http
      url: https://api.example.com/mcp
      auth: bearer
      bearerTokenEnv: MCP_API_TOKEN
  settings:
    toolPrefix: server
    idleTimeout: 10
    directTools: true
```

### Server Entry Fields

| Field             | Type                                    | Description                                             |
| ----------------- | --------------------------------------- | ------------------------------------------------------- |
| `name`            | string                                  | Server name (becomes prefix for tool names)             |
| `transport`       | `"http"` \| `"stdio"`                   | Transport type                                          |
| `url`             | string                                  | HTTP endpoint URL                                       |
| `command`         | string                                  | Command for stdio transport                             |
| `args`            | string[]                                | Command arguments                                       |
| `env`             | object                                  | Environment variables (supports `${VAR}` interpolation) |
| `headers`         | object                                  | HTTP headers (supports `${VAR}` interpolation)          |
| `lifecycle`       | `"keep-alive"` \| `"lazy"` \| `"eager"` | Connection lifecycle                                    |
| `idleTimeout`     | number                                  | Idle timeout in minutes                                 |
| `exposeResources` | boolean                                 | Expose MCP resources as tools                           |
| `directTools`     | boolean \| string[]                     | Register tools as Pi tools (default: `true`)              |
| `excludeTools`    | string[]                                | Tools to exclude                                        |
| `debug`           | boolean                                 | Show server stderr                                      |

### Lifecycle Modes

| Mode         | Behavior                                                                              |
| ------------ | ------------------------------------------------------------------------------------- |
| `keep-alive` | Persistent connection; auto-reconnects on failure via 30s health check loop           |
| `eager`      | Connected on startup, never idled out (`idleTimeout` defaults to 0, i.e. disabled)    |
| `lazy`       | Connected on first tool call; disconnected after `idleTimeout` minutes of inactivity. Default: `lazy` |

### Auth Modes

| Mode     | Description                                                                                  |
| -------- | -------------------------------------------------------------------------------------------- |
| `oauth`  | OAuth 2.1 with auto-discovery, dynamic client registration, authorization code + refresh     |
| `bearer` | Static Bearer token via `bearerToken` field or `${VAR}` from `bearerTokenEnv` env var       |
| (unset)  | Auto-detected: OAuth attempted if server has no `Authorization` header; skip auth if header present |

OAuth options (under `oauth:` key): `grantType`, `clientId`, `clientSecret`, `scope`, `redirectUri`, `clientName`, `clientUri`.

### Tool Registration

MCP tools are registered as native Pi tools by default. Set `directTools: false` to disable tool registration for a server, or provide a list of specific tool names to register only those tools. Tools are available directly by name (prefixed with the server name).
