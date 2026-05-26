// tools/register.ts - Register MCP tools as Pi tools
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { McpExtensionState } from "../core/state";
import type { McpConfig } from "../core/types";
import { Type } from "typebox";
import { MetadataCacheManager } from "../config/cache";
import { resolveTools, createToolExecutor } from "../proxy/direct";
import { truncateAtWord } from "../../shared/text-utils";

export class McpToolRegistry {
  private cache = new MetadataCacheManager();
  private prefix: "server" | "none" | "short";

  constructor(
    private pi: ExtensionAPI,
    private config: McpConfig,
    private getState: () => McpExtensionState | null,
    private getInitPromise: () => Promise<McpExtensionState> | null,
  ) {
    this.prefix = config.settings?.toolPrefix ?? "server";
  }

  register(): void {
    const cache = this.cache.load();
    const envRaw = process.env.MCP_DIRECT_TOOLS;
    const specs =
      envRaw === "__none__"
        ? []
        : resolveTools(
            this.config,
            cache,
            this.prefix,
            envRaw
              ?.split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          );

    for (const spec of specs) {
      this.pi.registerTool({
        name: spec.prefixedName,
        label: `MCP: ${spec.originalName}`,
        description: spec.description || "(no description)",
        promptSnippet: truncateAtWord(spec.description, 100) || `MCP tool from ${spec.serverName}`,
        parameters: Type.Unsafe((spec.inputSchema || { type: "object", properties: {} }) as never),
        execute: createToolExecutor(this.getState, this.getInitPromise, spec),
      });
    }
  }
}
