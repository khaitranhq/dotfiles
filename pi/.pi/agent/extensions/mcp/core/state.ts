import type { McpLifecycleManager } from "../client/lifecycle";
import type { McpServerManager } from "../client/manager";
import type { ToolMetadata, McpConfig } from "./types";

export interface McpExtensionState {
  manager: McpServerManager;
  lifecycle: McpLifecycleManager;
  toolMetadata: Map<string, ToolMetadata[]>;
  config: McpConfig;
  failureTracker: Map<string, number>;
}
