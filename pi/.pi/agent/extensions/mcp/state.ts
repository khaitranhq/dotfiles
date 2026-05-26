import type { McpLifecycleManager } from "./client/lifecycle.ts";
import type { McpServerManager } from "./client/manager.ts";
import type { ToolMetadata, McpConfig } from "./types.ts";

export interface McpExtensionState {
  manager: McpServerManager;
  lifecycle: McpLifecycleManager;
  toolMetadata: Map<string, ToolMetadata[]>;
  config: McpConfig;
  failureTracker: Map<string, number>;
}
