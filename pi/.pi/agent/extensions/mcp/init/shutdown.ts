// init/shutdown.ts - MCP state shutdown
import type { McpExtensionState } from "../core/state.ts";
import { flushMetadataCache } from "./bootstrap.ts";
import { callbackServer } from "../client/oauth-callback.ts";

export async function shutdownMcpState(currentState: McpExtensionState | null): Promise<void> {
  if (!currentState) return;

  try {
    flushMetadataCache(currentState);
  } catch (error) {
    console.error("MCP: metadata flush failed during shutdown", error);
  }

  try {
    await currentState.lifecycle.gracefulShutdown();
  } catch (error) {
    console.error("MCP: graceful shutdown failed", error);
  }

  try {
    await callbackServer.stop();
  } catch (error) {
    console.error("MCP: OAuth shutdown failed", error);
  }
}
