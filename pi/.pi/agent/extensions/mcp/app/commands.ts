// app/commands.ts - /mcp-auth command implementation
import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { loadMcpConfig } from "../core/config";
import { OAuthFlow, supportsOAuth } from "../client/oauth";

export async function mcpAuthCommand(args: string, ctx: ExtensionCommandContext): Promise<void> {
  const serverName = args?.trim();

  if (!serverName) {
    ctx.ui.notify("Usage: /mcp-auth <server-name>", "error");
    return;
  }

  const config = loadMcpConfig(undefined, ctx.cwd);
  const definition = config.mcpServers[serverName];

  if (!definition) {
    ctx.ui.notify(`MCP server "${serverName}" not found in config`, "error");
    return;
  }

  if (!supportsOAuth(definition)) {
    ctx.ui.notify(
      `Server "${serverName}" does not support OAuth authentication.\n` +
        `Configure "auth: oauth" in custom-settings.yaml or mcp.json to enable.`,
      "error",
    );
    return;
  }

  if (!definition.url) {
    ctx.ui.notify(`Server "${serverName}" has no URL configured`, "error");
    return;
  }

  const flow = new OAuthFlow(serverName);
  const status = flow.authStatus;

  if (status === "authenticated") {
    const reauth = await ctx.ui.confirm(
      `Server "${serverName}" is already authenticated.`,
      "Re-authenticate?",
    );
    if (!reauth) return;
  }

  try {
    ctx.ui.notify(`Starting OAuth flow for ${serverName}...`, "info");

    const result = await flow.authenticate(definition.url, definition);

    if (result === "authenticated") {
      ctx.ui.notify(`✅ Authenticated: ${serverName}`, "info");
    } else {
      ctx.ui.notify(`⚠️  Authentication result: ${result}`, "warning");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    ctx.ui.notify(`❌ Authentication failed: ${message}`, "error");
  }
}
