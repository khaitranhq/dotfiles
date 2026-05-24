/**
 * MCP configuration types and loading.
 */
import * as path from "node:path";
import * as os from "node:os";
import type { ServerConfig } from "./client";
import { loadCustomSettings, type CustomSettings } from "../shared/config";

// ── Types ──────────────────────────────────────────────────────────────

export interface McpConfig {
  servers?: ServerConfig[];
  /** Prefix for registered tool names. Default: "mcp" */
  toolPrefix?: string;
  /** Max result bytes before truncation. Default: 10240 (10 KB). */
  maxResultBytes?: number;
  /** Max result lines before truncation. Default: 500. */
  maxResultLines?: number;
  /** Whether to attempt reconnection on failure. Default: true. */
  reconnectEnabled?: boolean;
  /** Max reconnection attempts. Default: 3. */
  reconnectMaxRetries?: number;
}

// ── Constants ──────────────────────────────────────────────────────────

export const DEFAULTS: Required<McpConfig> = {
  servers: [],
  toolPrefix: "mcp",
  maxResultBytes: 10240, // 10 KB
  maxResultLines: 500,
  reconnectEnabled: true,
  reconnectMaxRetries: 3,
};

// ── Helpers ────────────────────────────────────────────────────────────

/** Build default token store path for a server name. */
export function defaultTokenStorePath(serverName: string): string {
  return path.join(
    os.homedir(),
    ".pi",
    "agent",
    "mcp-tokens",
    `${serverName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 64)}.json`,
  );
}

// ── Config loading ─────────────────────────────────────────────────────

export function loadMcpConfig(): McpConfig {
  try {
    const settings: CustomSettings = loadCustomSettings();
    const mcp = settings.mcp as McpConfig | undefined;

    if (!mcp) {
      return { ...DEFAULTS };
    }

    return {
      toolPrefix: mcp.toolPrefix ?? DEFAULTS.toolPrefix,
      maxResultBytes: mcp.maxResultBytes ?? DEFAULTS.maxResultBytes,
      maxResultLines: mcp.maxResultLines ?? DEFAULTS.maxResultLines,
      reconnectEnabled: mcp.reconnectEnabled ?? DEFAULTS.reconnectEnabled,
      reconnectMaxRetries: mcp.reconnectMaxRetries ?? DEFAULTS.reconnectMaxRetries,
      servers: mcp.servers ?? [],
    };
  } catch (err) {
    console.error(`[mcp] Failed to load config from custom-settings.yaml: ${err}`);
    return { ...DEFAULTS };
  }
}
