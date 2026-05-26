# MCP

MCP (Model Context Protocol) gateway — connect to MCP servers and register their tools in Pi.

Supports `stdio` and HTTP (StreamableHTTP + SSE) transports.

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
    - name: obsidian
      transport: http
      url: http://127.0.0.1:27123/mcp/
      headers:
        Authorization: Bearer ${OBSIDIAN_MCP_TOKEN}
    - name: local-tool
      transport: stdio
      command: node
      args: ["server.js"]
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
| `directTools`     | boolean \| string[]                     | Register tools as Pi tools                              |
| `excludeTools`    | string[]                                | Tools to exclude                                        |
| `debug`           | boolean                                 | Show server stderr                                      |

### Tool Registration

MCP tools are registered as native Pi tools using the `directTools` setting. Set it to `true` to register all tools from a server, or provide a list of specific tool names. Tools are available directly by name (prefixed with the server name).
