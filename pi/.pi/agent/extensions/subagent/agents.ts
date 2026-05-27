/**
 * Agent discovery, types, and stateless helpers for the subagent extension.
 *
 * Agent definitions live in `~/.pi/agent/custom-settings.yaml` under the
 * `agents` key. The built-in "pi" primary agent is always available.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { AgentToolResult } from "@earendil-works/pi-agent-core";
import type { Message } from "@earendil-works/pi-ai";
import { withFileMutationQueue } from "@earendil-works/pi-coding-agent";
import {
  loadAgentsConfig,
  type AgentYamlDefinition,
  type AgentsConfig,
  type ToolPermissions,
} from "../shared/config";

// ── Constants ──────────────────────────────────────────────────────────

export const MAX_PARALLEL_TASKS = 8;
export const MAX_CONCURRENCY = 4;
export const COLLAPSED_ITEM_COUNT = 10;

// ── Types ─────────────────────────────────────────────────────────────

export interface UsageStats {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cost: number;
  contextTokens: number;
  turns: number;
}

export interface SingleResult {
  agent: string;
  task: string;
  exitCode: number;
  messages: Message[];
  stderr: string;
  usage: UsageStats;
  model?: string;
  stopReason?: string;
  errorMessage?: string;
  step?: number;
}

export interface SubagentDetails {
  mode: "single" | "parallel" | "chain";
  results: SingleResult[];
}

export interface AgentConfig {
  name: string;
  description: string;
  mode: "primary" | "subagent";
  model?: string;
  /** Tool availability list (derived from tools array or permission map keys). */
  tools?: string[];
  /** Tool permission map (from tools object format in YAML). */
  toolPermissions?: ToolPermissions;
  systemPrompt: string;
  /** Source of the agent definition (always "user"). */
  source: "user";
  /** Path to the config file that defined this agent. */
  filePath: string;
}

export interface AgentDiscoveryResult {
  agents: AgentConfig[];
  primaryAgents: AgentConfig[];
  subagents: AgentConfig[];
}

export interface ToolOverride {
  type: "allow" | "deny";
  tools: string[];
}

export type DisplayItem =
  | { type: "text"; text: string }
  | { type: "toolCall"; name: string; args: Record<string, any> };

export type OnUpdateCallback = (partial: AgentToolResult<SubagentDetails>) => void;

// ── Built-in pi agent ──────────────────────────────────────────────────

export const BUILTIN_PI_AGENT: AgentConfig = {
  name: "pi",
  description: "Default primary agent — full capabilities with all tools and extensions",
  mode: "primary",
  systemPrompt: "",
  source: "user",
  filePath: "(built-in)",
};

// ── Agent discovery (user config only) ─────────────────────────────────

function agentDefToConfig(name: string, def: AgentYamlDefinition, filePath: string): AgentConfig {
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
    source: "user" as const,
    filePath,
  };
}

/**
 * Discover agents from custom-settings.yaml.
 *
 * Kept backward-compatible: accepts optional (cwd, scope) parameters
 * that are ignored (only user-level agents are supported).
 */
export function discoverAgents(_cwd?: string, _scope?: string): AgentDiscoveryResult {
  const userDefs: AgentsConfig = loadAgentsConfig();
  const configs: AgentConfig[] = [];

  for (const [name, def] of Object.entries(userDefs)) {
    configs.push(agentDefToConfig(name, def, "custom-settings.yaml"));
  }

  // Always include built-in "pi" primary agent (unless explicitly overridden)
  if (!userDefs["pi"]) {
    configs.push(BUILTIN_PI_AGENT);
  }

  return {
    agents: configs,
    primaryAgents: configs.filter((a) => a.mode === "primary"),
    subagents: configs.filter((a) => a.mode === "subagent"),
  };
}

// ── Formatting helpers ─────────────────────────────────────────────────

export function formatTokens(count: number): string {
  if (count < 1000) return count.toString();
  if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
  if (count < 1000000) return `${Math.round(count / 1000)}k`;
  return `${(count / 1000000).toFixed(1)}M`;
}

export function formatUsageStats(
  usage: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    cost: number;
    contextTokens?: number;
    turns?: number;
  },
  model?: string,
): string {
  const parts: string[] = [];
  if (usage.turns) parts.push(`${usage.turns} turn${usage.turns > 1 ? "s" : ""}`);
  if (usage.input) parts.push(`↑${formatTokens(usage.input)}`);
  if (usage.output) parts.push(`↓${formatTokens(usage.output)}`);
  if (usage.cacheRead) parts.push(`R${formatTokens(usage.cacheRead)}`);
  if (usage.cacheWrite) parts.push(`W${formatTokens(usage.cacheWrite)}`);
  if (usage.cost) parts.push(`$${usage.cost.toFixed(4)}`);
  if (usage.contextTokens && usage.contextTokens > 0) {
    parts.push(`ctx:${formatTokens(usage.contextTokens)}`);
  }
  if (model) parts.push(model);
  return parts.join(" ");
}

export function getModelRef(
  model: { provider: string; id: string } | undefined,
  thinkingLevel?: string,
): string | undefined {
  if (!model) return undefined;
  const ref = `${model.provider}/${model.id}`;
  return thinkingLevel && thinkingLevel !== "off" ? `${ref}:${thinkingLevel}` : ref;
}

export function formatToolCall(
  toolName: string,
  args: Record<string, unknown>,
  themeFg: (color: any, text: string) => string,
): string {
  const shortenPath = (p: string) => {
    const home = os.homedir();
    return p.startsWith(home) ? `~${p.slice(home.length)}` : p;
  };

  switch (toolName) {
    case "bash": {
      const command = (args.command as string) || "...";
      const preview = command.length > 60 ? `${command.slice(0, 60)}...` : command;
      return themeFg("muted", "$ ") + themeFg("toolOutput", preview);
    }
    case "read": {
      const rawPath = (args.file_path || args.path || "...") as string;
      const filePath = shortenPath(rawPath);
      const offset = args.offset as number | undefined;
      const limit = args.limit as number | undefined;
      let text = themeFg("accent", filePath);
      if (offset !== undefined || limit !== undefined) {
        const startLine = offset ?? 1;
        const endLine = limit !== undefined ? startLine + limit - 1 : "";
        text += themeFg("warning", `:${startLine}${endLine ? `-${endLine}` : ""}`);
      }
      return themeFg("muted", "read ") + text;
    }
    case "write": {
      const rawPath = (args.file_path || args.path || "...") as string;
      const filePath = shortenPath(rawPath);
      const content = (args.content || "") as string;
      const lines = content.split("\n").length;
      let text = themeFg("muted", "write ") + themeFg("accent", filePath);
      if (lines > 1) text += themeFg("dim", ` (${lines} lines)`);
      return text;
    }
    case "edit": {
      const rawPath = (args.file_path || args.path || "...") as string;
      return themeFg("muted", "edit ") + themeFg("accent", shortenPath(rawPath));
    }
    case "ls": {
      const rawPath = (args.path || ".") as string;
      return themeFg("muted", "ls ") + themeFg("accent", shortenPath(rawPath));
    }
    case "find": {
      const pattern = (args.pattern || "*") as string;
      const rawPath = (args.path || ".") as string;
      return (
        themeFg("muted", "find ") +
        themeFg("accent", pattern) +
        themeFg("dim", ` in ${shortenPath(rawPath)}`)
      );
    }
    case "grep": {
      const pattern = (args.pattern || "") as string;
      const rawPath = (args.path || ".") as string;
      return (
        themeFg("muted", "grep ") +
        themeFg("accent", `/${pattern}/`) +
        themeFg("dim", ` in ${shortenPath(rawPath)}`)
      );
    }
    default: {
      const argsStr = JSON.stringify(args);
      const preview = argsStr.length > 50 ? `${argsStr.slice(0, 50)}...` : argsStr;
      return themeFg("accent", toolName) + themeFg("dim", ` ${preview}`);
    }
  }
}

// ── Message helpers ────────────────────────────────────────────────────

export function getFinalOutput(messages: Message[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === "assistant") {
      for (const part of msg.content) {
        if (part.type === "text") return part.text;
      }
    }
  }
  return "";
}

export function getDisplayItems(messages: Message[]): DisplayItem[] {
  const items: DisplayItem[] = [];
  for (const msg of messages) {
    if (msg.role === "assistant") {
      for (const part of msg.content) {
        if (part.type === "text") items.push({ type: "text", text: part.text });
        else if (part.type === "toolCall")
          items.push({ type: "toolCall", name: part.name, args: part.arguments });
      }
    }
  }
  return items;
}

// ── Concurrency helper ─────────────────────────────────────────────────

export async function mapWithConcurrencyLimit<TIn, TOut>(
  items: TIn[],
  concurrency: number,
  fn: (item: TIn, index: number) => Promise<TOut>,
): Promise<TOut[]> {
  if (items.length === 0) return [];
  const limit = Math.max(1, Math.min(concurrency, items.length));
  const results: TOut[] = Array.from({ length: items.length });
  let nextIndex = 0;
  const workers = Array.from({ length: limit })
    .fill(null)
    .map(async () => {
      while (true) {
        const current = nextIndex++;
        if (current >= items.length) return;
        results[current] = await fn(items[current], current);
      }
    });
  await Promise.all(workers);
  return results;
}

// ── I/O helpers ────────────────────────────────────────────────────────

export async function writePromptToTempFile(
  agentName: string,
  prompt: string,
): Promise<{ dir: string; filePath: string }> {
  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "pi-subagent-"));
  const safeName = agentName.replace(/[^\w.-]+/g, "_");
  const filePath = path.join(tmpDir, `prompt-${safeName}.md`);
  await withFileMutationQueue(filePath, async () => {
    await fs.promises.writeFile(filePath, prompt, { encoding: "utf-8", mode: 0o600 });
  });
  return { dir: tmpDir, filePath };
}

export function getPiInvocation(args: string[]): { command: string; args: string[] } {
  const currentScript = process.argv[1];
  const isBunVirtualScript = currentScript?.startsWith("/$bunfs/root/");
  if (currentScript && !isBunVirtualScript && fs.existsSync(currentScript)) {
    return { command: process.execPath, args: [currentScript, ...args] };
  }

  const execName = path.basename(process.execPath).toLowerCase();
  const isGenericRuntime = /^(node|bun)(\.exe)?$/.test(execName);
  if (!isGenericRuntime) {
    return { command: process.execPath, args };
  }

  return { command: "pi", args };
}
