// app/session.ts - MCP session lifecycle (handlers + shutdown)
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { McpExtensionState } from "../core/types";
import { initializeMcp } from "./bootstrap";
import { flushMetadataCache } from "./bootstrap";
import { callbackServer } from "../client/oauth-callback";

// ── Session context ──────────────────────────────────────────────────

export interface McpSessionContext {
  state: McpExtensionState | null;
  initPromise: Promise<McpExtensionState> | null;
  generation: number;
}

// ── Shutdown ─────────────────────────────────────────────────────────

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

// ── Session event handlers ───────────────────────────────────────────

export function registerMcpSessionHandlers(pi: ExtensionAPI, sessionCtx: McpSessionContext): void {
  pi.on("session_start", async (_event, ctx) => {
    sessionCtx.generation++;
    const generation = sessionCtx.generation;
    const previousState = sessionCtx.state;
    sessionCtx.state = null;
    sessionCtx.initPromise = null;

    try {
      await shutdownMcpState(previousState);
    } catch (error) {
      console.error("MCP: failed to shut down previous session state", error);
    }

    if (generation !== sessionCtx.generation) {
      return;
    }

    const promise = initializeMcp(ctx);
    sessionCtx.initPromise = promise;

    promise
      .then(async (nextState) => {
        if (generation !== sessionCtx.generation || sessionCtx.initPromise !== promise) {
          try {
            await shutdownMcpState(nextState);
          } catch (error) {
            console.error("MCP: failed to clean stale session state", error);
          }
          return;
        }

        sessionCtx.state = nextState;
        sessionCtx.initPromise = null;
      })
      .catch((err) => {
        if (generation !== sessionCtx.generation) return;
        if (sessionCtx.initPromise !== promise && sessionCtx.initPromise !== null) return;
        console.error("MCP initialization failed:", err);
        sessionCtx.initPromise = null;
      });
  });

  pi.on("session_shutdown", async () => {
    sessionCtx.generation++;
    const currentState = sessionCtx.state;
    sessionCtx.state = null;
    sessionCtx.initPromise = null;

    try {
      await shutdownMcpState(currentState);
    } catch (error) {
      console.error("MCP: session shutdown cleanup failed", error);
    }
  });
}
