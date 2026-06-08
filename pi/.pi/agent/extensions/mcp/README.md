# MCP Extension

Full MCP client that connects to configured MCP servers, discovers their tools,
and registers them with pi. Includes OAuth 2.1 Dynamic Client Registration
for servers that require authentication.

All MCP server tools are registered with `mcp_<server>_<tool>` prefix.

## Commands

| Command       | Description                                          |
| ------------- | ---------------------------------------------------- |
| `/mcp-status` | Show MCP server connection status overlay with icons |

## Architecture

pi only talks to three modules directly:

```
pi (Extension)
  ├── McpClientManager      — Connects to MCP servers, handles OAuth automatically
  └── AuthStore             — Persistent storage (~/.pi/agent/mcp/auth.json)
```

McpClientManager encapsulates all MCP protocol and OAuth complexity:

```
McpClientManager
  ├── Client (SDK)          — MCP Streamable HTTP or stdio transport
  ├── CallbackServer        — Local HTTP server for OAuth redirect callbacks
  └── McpOAuthProvider      — OAuth 2.1 client with DCR, PKCE, token exchange
```

See [design/oauth-dynamic-registration.d2](design/oauth-dynamic-registration.d2) for the OAuth sequence diagram.
See [design/stdio-local-mcp.d2](design/stdio-local-mcp.d2) for the stdio transport sequence diagram.

## MCP Server Configuration

Configure servers in `~/.pi/agent/custom-settings.yaml` under the `mcp` key.
Two transport types are supported: `http` (Streamable HTTP, default) and `stdio`
(local child process).

### Streamable HTTP (`transport: http`)

```yaml
mcp:
  servers:
    - name: myserver
      transport: http
      url: http://localhost:3000/mcp/
      headers:
        Authorization: Bearer ${MY_TOKEN}
```

### stdio (`transport: stdio`)

Spawns a local MCP server as a child process, communicating over stdin/stdout
via JSON-RPC. The process is started on connect and killed on disconnect.

```yaml
mcp:
  servers:
    - name: local-filesystem
      transport: stdio
      command: npx
      args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
      env:
        HOME: /home/user
      cwd: /path/to/working/dir
```

Stdio servers auto-restart on reconnect (disconnect then connect again).
OAuth is not used with stdio — authentication is handled by the local
process environment.

| Field       | Required | Description                                                 |
| ----------- | -------- | ----------------------------------------------------------- |
| `transport` | yes      | Must be `"stdio"`                                           |
| `command`   | yes      | Executable or command to spawn                              |
| `args`      | no       | Command arguments (default: `[]`)                           |
| `env`       | no       | Extra environment variables merged into `process.env`       |
| `cwd`       | no       | Working directory for the child process (default: pi's cwd) |

On startup, the extension connects to each configured server (HTTP or stdio),
calls `tools/list`, and registers every discovered tool with `pi.registerTool()`.

### Tool Naming

MCP tools are registered as `mcp_<server>_<tool>` — e.g., a tool named `search`
on server `atlassian` becomes `mcp_atlassian_search`.

## OAuth 2.1

OAuth authentication is handled **automatically** by McpClientManager. When an MCP server
returns a 401 with OAuth metadata (RFC 9728), the client transparently performs
discovery, dynamic client registration (RFC 7591), PKCE authorization, token exchange,
and silent refresh — no manual OAuth tools needed.

See [design/oauth-dynamic-registration.d2](design/oauth-dynamic-registration.d2) for the full sequence diagram.

## Programmatic Use

```typescript
import { McpClientManager } from "./mcp";

const manager = new McpClientManager();

manager.setStatusCallback((statuses) => {
  for (const s of statuses) {
    console.log(`${s.name}: ${s.status} (${s.toolCount} tools)`);
  }
});

const tools = await manager.connectAll();
// tools: McpToolSchema[]

const result = await manager.callTool("myserver", "echo", { message: "hello" });
// result: { content: [...], isError?: boolean }

await manager.disconnectAll();
```

## Storage

OAuth tokens and client info are persisted in `~/.pi/agent/mcp/auth.json` (permissions: 0600).
