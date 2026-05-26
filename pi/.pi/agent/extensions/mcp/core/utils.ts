import type { ServerEntry } from "./types.ts";
import type { McpExtensionState } from "./state.ts";
import { interpolateEnvVars } from "../../shared/env-utils.ts";

// Re-export shared utilities for convenience within the MCP extension
// (new code should import directly from shared/)
export {
  interpolateEnvVars,
  interpolateEnvRecord,
  resolveConfigPath,
} from "../../shared/env-utils.ts";
export { parallelLimit } from "../../shared/async-utils.ts";
export { truncateAtWord } from "../../shared/text-utils.ts";

export async function getOrInitMcpState(
  getState: () => McpExtensionState | null,
  getInitPromise: () => Promise<McpExtensionState> | null,
): Promise<{ state: McpExtensionState | null; error?: string }> {
  let state = getState();
  if (!state) {
    const initPromise = getInitPromise();
    if (initPromise) {
      try {
        state = await initPromise;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { state: null, error: `MCP initialization failed: ${message}` };
      }
    }
  }
  if (!state) {
    return { state: null, error: "MCP not initialized" };
  }
  return { state };
}

export function resolveBearerToken(
  definition: Pick<ServerEntry, "bearerToken" | "bearerTokenEnv">,
): string | undefined {
  if (definition.bearerToken !== undefined) {
    return interpolateEnvVars(definition.bearerToken);
  }
  return definition.bearerTokenEnv ? process.env[definition.bearerTokenEnv] : undefined;
}
