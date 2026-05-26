/**
 * MCP naming and description helpers.
 *
 * Token-efficient naming: sanitized tool names, compact descriptions,
 * and one-line prompt snippets for the system-prompt tool list.
 */
import type { McpTool } from "./client";
import { describeSchema } from "./schema";
import type { McpConfig } from "./config";
import { DEFAULTS } from "./config";

// ── Name helpers ───────────────────────────────────────────────────────

/** Sanitize a name for use in tool identifiers: keep only [a-zA-Z0-9_]. */
export function sanitizeName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase();
}

/** Build a prefixed tool name: "<prefix>_<server>_<tool>" */
export function makeToolName(prefix: string, serverName: string, toolName: string): string {
  return `${prefix}_${sanitizeName(serverName)}_${sanitizeName(toolName)}`;
}

// ── Description helpers ────────────────────────────────────────────────

/**
 * Build a concise tool description that includes the MCP tool's description
 * and parameter schema in a compact format for the LLM.
 *
 * Token-efficient: only includes what the LLM needs to make correct calls.
 */
export function buildToolDescription(mcpTool: McpTool): string {
  let desc = mcpTool.description ?? mcpTool.name;

  const hasParams =
    mcpTool.inputSchema &&
    typeof mcpTool.inputSchema === "object" &&
    Object.keys(mcpTool.inputSchema as Record<string, unknown>).length > 0;

  if (hasParams) {
    const compactSchema = describeSchema(mcpTool.inputSchema);
    if (compactSchema.length <= 300) {
      desc += `\nParams: ${compactSchema}`;
    }
  }

  return desc;
}

/**
 * Build a concise prompt snippet (one line) for the system-prompt tool list.
 * Keeps the tool list compact even with dozens of MCP tools.
 */
export function buildPromptSnippet(
  config: McpConfig,
  mcpTool: McpTool,
  serverName: string,
): string {
  const shortDesc = (mcpTool.description ?? mcpTool.name).split("\n")[0].slice(0, 80);
  const prefix = config.toolPrefix ?? DEFAULTS.toolPrefix;
  const fullName = makeToolName(prefix, serverName, mcpTool.name);
  return `${fullName}: ${shortDesc}`;
}

// ── Env variable expansion ────────────────────────────────────────────

/**
 * Replace `${ENV_VAR}` and `${ENV_VAR:-default}` patterns with their
 * environment variable values. Unset vars become empty string (unless
 * a default is provided via `:-` syntax).
 */
export function expandEnv(str: string): string {
  return str.replace(
    /\$\{(\w+)(?::-([^}]*))?\}/g,
    (_match, varName: string, defaultValue: string | undefined) => {
      const val = process.env[varName];
      if (val !== undefined) return val;
      return defaultValue ?? "";
    },
  );
}

/** Expand env vars in every value of a string record. */
export function expandEnvInRecord(obj: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = expandEnv(value);
  }
  return result;
}
