/**
 * Agent discovery and configuration
 *
 * Agents are defined in custom-settings.yaml under the `agents` key
 * using an opencode-compatible schema:
 *
 *   mode:   "primary" | "subagent"
 *           Primary agents can be switched to as the main agent.
 *           Subagents are dispatched by the primary agent for delegated work.
 *
 *   model:  Optional model override (e.g. "claude-sonnet-4-5").
 *
 *   tools:  Optional tool list (array) or permission map (object).
 *           For subagents, these are passed as --tools to pi subprocess.
 *           For primary agents, pi.setActiveTools() is used.
 *
 *   prompt: System prompt text. Supports ${file:/path/to/prompt.md}.
 *
 * Agent config locations:
 *   User-level:    ~/.pi/agent/custom-settings.yaml `agents` key  (always loaded)
 *   Project-level: .pi/agents.yaml                                 (travelled up from cwd)
 *
 * The built-in "pi" primary agent is always available and is the default.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { parse as parseYaml } from "yaml";
import {
  loadAgentsConfig,
  resolveFileRefs,
  type AgentYamlDefinition,
  type AgentsConfig,
  type ToolPermissions,
} from "../shared/config";

// ── Types ──────────────────────────────────────────────────────────────

export type AgentMode = "primary" | "subagent";
export type AgentScope = "user" | "project" | "both";

export interface AgentConfig {
  name: string;
  description: string;
  mode: AgentMode;
  model?: string;
  /** Tool availability list (derived from tools array or permission map keys). */
  tools?: string[];
  /**
   * Tool permission map (from tools object format in YAML).
   * If undefined, defaults to custom-settings.yaml or "ask".
   */
  toolPermissions?: ToolPermissions;
  systemPrompt: string;
  source: "user" | "project";
  /** Path to the config file that defined this agent. */
  filePath: string;
}

export interface AgentDiscoveryResult {
  agents: AgentConfig[];
  primaryAgents: AgentConfig[];
  subagents: AgentConfig[];
  projectAgentsDir: string | null;
}

// ── Built-in pi agent ──────────────────────────────────────────────────

/**
 * The default primary agent "pi" is always available even when not
 * explicitly defined in custom-settings.yaml.
 */
const BUILTIN_PI_AGENT: AgentConfig = {
  name: "pi",
  description: "Default primary agent — full capabilities with all tools and extensions",
  mode: "primary",
  systemPrompt: "",
  source: "user",
  filePath: "(built-in)",
};

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Convert a raw agent definition from YAML into an AgentConfig.
 */
function agentDefToConfig(
  name: string,
  def: AgentYamlDefinition,
  source: "user" | "project",
  filePath: string,
): AgentConfig {
  let tools: string[] | undefined;
  let toolPermissions: ToolPermissions | undefined;

  if (Array.isArray(def.tools)) {
    tools = def.tools.filter((t): t is string => typeof t === "string");
  } else if (def.tools && typeof def.tools === "object") {
    toolPermissions = def.tools as ToolPermissions;
    tools = Object.keys(toolPermissions);
  }

  return {
    name,
    description: def.description,
    mode: def.mode,
    model: def.model,
    tools: tools && tools.length > 0 ? tools : undefined,
    toolPermissions,
    systemPrompt: def.prompt,
    source,
    filePath,
  };
}

/**
 * Walk up from cwd to find the nearest .pi/agents.yaml file.
 * Returns the YAML file path, or null if none found.
 */
function findNearestProjectAgentsFile(cwd: string): string | null {
  let currentDir = path.resolve(cwd);
  while (true) {
    const candidate = path.join(currentDir, ".pi", "agents.yaml");
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      // permission denied, continue up
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) return null;
    currentDir = parentDir;
  }
}

/**
 * Load project-level agents from .pi/agents.yaml.
 * Resolves ${file:...} references relative to the YAML file's directory.
 */
function loadProjectAgents(filePath: string): AgentsConfig {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const baseDir = path.dirname(filePath);
    const resolved = resolveFileRefs(raw, baseDir);
    const parsed = parseYaml(resolved) as { agents?: AgentsConfig } | undefined;
    return parsed?.agents ?? {};
  } catch (err) {
    console.error(`[agents] Failed to load project agents from ${filePath}: ${err}`);
    return {};
  }
}

// ── Discovery ──────────────────────────────────────────────────────────

export function discoverAgents(cwd: string, scope: AgentScope): AgentDiscoveryResult {
  const projectAgentsFile = findNearestProjectAgentsFile(cwd);

  // Load user agents from custom-settings.yaml
  const userDefs: AgentsConfig = scope === "project" ? {} : loadAgentsConfig();

  // Load project agents from .pi/agents.yaml
  const projectDefs: AgentsConfig =
    scope === "user" || !projectAgentsFile ? {} : loadProjectAgents(projectAgentsFile);

  // Merge: project overrides user for same-named agents
  const mergedDefs: AgentsConfig =
    scope === "both" ? { ...userDefs, ...projectDefs } : scope === "user" ? userDefs : projectDefs;

  // Convert to AgentConfig array
  const configs: AgentConfig[] = [];
  const seen = new Set<string>();

  for (const [name, def] of Object.entries(mergedDefs)) {
    // Determine source (user vs project) for merged entries
    const isProject = projectDefs[name] !== undefined;
    const source: "user" | "project" = isProject ? "project" : "user";
    const fp = isProject && projectAgentsFile ? projectAgentsFile : "custom-settings.yaml";

    configs.push(agentDefToConfig(name, def, source, fp));
    seen.add(name);
  }

  // Always include built-in "pi" primary agent (unless explicitly overridden)
  if (!seen.has("pi")) {
    configs.push(BUILTIN_PI_AGENT);
  }

  const all = configs;
  return {
    agents: all,
    primaryAgents: all.filter((a) => a.mode === "primary"),
    subagents: all.filter((a) => a.mode === "subagent"),
    projectAgentsDir: projectAgentsFile ? path.dirname(projectAgentsFile) : null,
  };
}

// ── Formatting ─────────────────────────────────────────────────────────

export function formatAgentList(
  agents: AgentConfig[],
  maxItems: number,
): { text: string; remaining: number } {
  if (agents.length === 0) return { text: "none", remaining: 0 };
  const listed = agents.slice(0, maxItems);
  const remaining = agents.length - listed.length;
  return {
    text: listed.map((a) => `${a.name} (${a.source}, ${a.mode}): ${a.description}`).join("; "),
    remaining,
  };
}
