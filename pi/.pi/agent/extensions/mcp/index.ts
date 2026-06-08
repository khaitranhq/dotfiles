/**
 * MCP Extension — Full MCP client with automatic OAuth 2.1 support.
 *
 * Connects to MCP servers configured in custom-settings.yaml, discovers
 * their tools, and registers them with pi. Handles OAuth 2.1
 * authorization automatically (DCR, PKCE, token refresh) — no
 * manual OAuth tools required.
 *
 * All MCP tools are registered with "mcp_" prefix.
 */

import { type ExtensionAPI, type Theme, DynamicBorder } from "@earendil-works/pi-coding-agent";
import { AuthStore } from "./auth-store.js";
import { McpClientManager, buildToolParameters, type McpServerStatus } from "./mcp-client.js";
import { Logger } from "../shared/logger.js";
import { Container, matchesKey, Text } from "@earendil-works/pi-tui";
import * as os from "node:os";
import * as path from "node:path";

// ── Status icons ──────────────────────────────────────────────────

const MCP_STATUS_ICONS: Record<McpServerStatus["status"], string> = {
  connecting: "○",
  connected: "✓",
  error: "✗",
};

function mcpStatusThemeColor(
  status: McpServerStatus["status"],
): "success" | "error" | "warning" | "dim" {
  switch (status) {
    case "connected":
      return "success";
    case "error":
      return "error";
    case "connecting":
      return "warning";
  }
}

// ── TUI Component for /mcp-status command ────────────────────────

class McpStatusComponent extends Container {
  private statuses: McpServerStatus[];
  private onClose: () => void;

  constructor(statuses: McpServerStatus[], theme: Theme, onClose: () => void) {
    super();
    this.statuses = statuses;
    this.onClose = onClose;
    this.rebuild(theme);
  }

  private rebuild(theme: Theme): void {
    this.clear();

    this.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));
    this.addChild(new Text(theme.fg("accent", theme.bold(" MCP Servers ")), 1, 0));

    if (this.statuses.length === 0) {
      this.addChild(new Text("  No MCP servers configured.", 1, 0));
    } else {
      for (const s of this.statuses) {
        const icon = MCP_STATUS_ICONS[s.status];
        const color = mcpStatusThemeColor(s.status);
        const toolInfo =
          s.status === "connected"
            ? ` (${s.toolCount} tools)`
            : s.status === "error" && s.error
              ? ` — ${s.error}`
              : " (connecting...)";

        this.addChild(
          new Text(
            `  ${theme.fg(color, icon)} ${theme.fg("text", s.name)}${theme.fg("muted", toolInfo)}`,
            1,
            0,
          ),
        );
      }
    }

    this.addChild(new Text(theme.fg("dim", "  Escape to close"), 1, 0));
    this.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));
  }

  handleInput(data: string): void {
    if (matchesKey(data, "escape") || matchesKey(data, "ctrl+c")) {
      this.onClose();
    }
  }

  override invalidate(): void {
    super.invalidate();
  }
}

// ─── Extension Entry Point ──────────────────────────────────────────────

export default async function (pi: ExtensionAPI) {
  const authStore = new AuthStore();
  const logPath = path.join(os.homedir(), ".pi", "agent", "mcp", "mcp.log");
  const logger = new Logger(logPath);
  const mcpManager = new McpClientManager(authStore, logger);

  pi.on("session_start", async (_event, _) => {
    const tools = await mcpManager.connectAll();

    for (const tool of tools) {
      const params = buildToolParameters(tool.inputSchema);

      pi.registerTool({
        name: tool.name,
        label: `MCP: ${tool.serverName}/${tool.originalName}`,
        description: tool.description || `MCP tool: ${tool.originalName} from ${tool.serverName}`,
        promptSnippet: `${tool.name}: ${tool.description?.slice(0, 80) ?? `MCP tool from ${tool.serverName}`}`,
        promptGuidelines: [
          `Use ${tool.name} for operations on the ${tool.serverName} MCP server. ` +
            (tool.description ? tool.description.slice(0, 200) : ""),
        ],
        parameters: params as any,
        async execute(_toolCallId, args, _signal, _onUpdate, _ctx) {
          const result = await mcpManager.callTool(
            tool.serverName,
            tool.originalName,
            args as Record<string, unknown>,
          );
          return {
            content: result.content,
            details: { serverName: tool.serverName, toolName: tool.originalName },
            isError: result.isError,
          };
        },
      });
    }

    // MCP connected silently — sidebar shows status via tool_execution events.
  });

  pi.on("session_shutdown", async () => {
    await mcpManager.disconnectAll();
  });

  // ── Register /mcp-status command ────────────────────────────────

  pi.registerCommand("mcp-status", {
    description: "Show MCP server connection status",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("/mcp-status requires interactive mode", "error");
        return;
      }

      const statuses = mcpManager.getStatuses();

      await ctx.ui.custom<void>(
        (_tui, theme, _kb, done) => {
          return new McpStatusComponent(statuses, theme, () => done());
        },
        {
          overlay: true,
          overlayOptions: {
            width: "40%",
            minWidth: 30,
            maxHeight: "60%",
            margin: 1,
          },
        },
      );
    },
  });
}
