/**
 * Agent discovery and configuration
 *
 * Agents are defined as markdown files with YAML frontmatter using an
 * opencode-compatible schema:
 *
 *   mode:   "primary" | "subagent"
 *           Primary agents can be switched to as the main agent.
 *           Subagents are dispatched by the primary agent for delegated work.
 *
 *   model:  Optional model override (e.g. "claude-sonnet-4-5").
 *
 *   tools:  Optional comma-separated list of tools the agent can use.
 *           For subagents, these are passed as --tools to pi subprocess.
 *           For primary agents, pi.setActiveTools() is used.
 *
 * Discovery locations:
 *   User-level:  ~/.pi/agent/agents/*.md  (always loaded)
 *   Project-level: .pi/agents/*.md         (travelled up from cwd)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { getAgentDir, parseFrontmatter } from "@earendil-works/pi-coding-agent";

// ── Types ──────────────────────────────────────────────────────────────

export type AgentMode = "primary" | "subagent";
export type AgentScope = "user" | "project" | "both";

export interface AgentConfig {
  name: string;
  description: string;
  mode: AgentMode;
  model?: string;
  tools?: string[];
  systemPrompt: string;
  source: "user" | "project";
  filePath: string;
}

export interface AgentDiscoveryResult {
  agents: AgentConfig[];
  primaryAgents: AgentConfig[];
  subagents: AgentConfig[];
  projectAgentsDir: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────

function loadAgentsFromDir(dir: string, source: "user" | "project"): AgentConfig[] {
  const agents: AgentConfig[] = [];

  if (!fs.existsSync(dir)) return agents;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return agents;
  }

  for (const entry of entries) {
    if (!entry.name.endsWith(".md")) continue;
    if (!entry.isFile() && !entry.isSymbolicLink()) continue;

    const filePath = path.join(dir, entry.name);
    let content: string;
    try {
      content = fs.readFileSync(filePath, "utf-8");
    } catch {
      continue;
    }

    const { frontmatter, body } = parseFrontmatter<Record<string, string>>(content);

    if (!frontmatter.name || !frontmatter.description) continue;

    const mode: AgentMode =
      frontmatter.mode === "primary" ? "primary" : "subagent";

    const tools = frontmatter.tools
      ?.split(",")
      .map((t: string) => t.trim())
      .filter(Boolean);

    agents.push({
      name: frontmatter.name,
      description: frontmatter.description,
      mode,
      model: frontmatter.model || undefined,
      tools: tools && tools.length > 0 ? tools : undefined,
      systemPrompt: body,
      source,
      filePath,
    });
  }

  return agents;
}

function isDirectory(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function findNearestProjectAgentsDir(cwd: string): string | null {
  let currentDir = path.resolve(cwd);
  while (true) {
    const candidate = path.join(currentDir, ".pi", "agents");
    if (isDirectory(candidate)) return candidate;

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) return null;
    currentDir = parentDir;
  }
}

// ── Discovery ──────────────────────────────────────────────────────────

export function discoverAgents(cwd: string, scope: AgentScope): AgentDiscoveryResult {
  const userDir = path.join(getAgentDir(), "agents");
  const projectAgentsDir = findNearestProjectAgentsDir(cwd);

  const userAgents = scope === "project" ? [] : loadAgentsFromDir(userDir, "user");
  const projectAgents =
    scope === "user" || !projectAgentsDir ? [] : loadAgentsFromDir(projectAgentsDir, "project");

  const agentMap = new Map<string, AgentConfig>();

  if (scope === "both") {
    for (const agent of userAgents) agentMap.set(agent.name, agent);
    for (const agent of projectAgents) agentMap.set(agent.name, agent); // project overrides
  } else if (scope === "user") {
    for (const agent of userAgents) agentMap.set(agent.name, agent);
  } else {
    for (const agent of projectAgents) agentMap.set(agent.name, agent);
  }

  const all = Array.from(agentMap.values());
  return {
    agents: all,
    primaryAgents: all.filter((a) => a.mode === "primary"),
    subagents: all.filter((a) => a.mode === "subagent"),
    projectAgentsDir,
  };
}

// ── Formatting ─────────────────────────────────────────────────────────

export function formatAgentList(agents: AgentConfig[], maxItems: number): { text: string; remaining: number } {
  if (agents.length === 0) return { text: "none", remaining: 0 };
  const listed = agents.slice(0, maxItems);
  const remaining = agents.length - listed.length;
  return {
    text: listed
      .map((a) => `${a.name} (${a.source}, ${a.mode}): ${a.description}`)
      .join("; "),
    remaining,
  };
}
