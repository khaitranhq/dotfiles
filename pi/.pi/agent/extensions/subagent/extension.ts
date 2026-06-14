/**
 * SubagentExtension — tool, command, and event wiring for the subagent extension.
 */

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import type { Message } from "@earendil-works/pi-ai";
import { type ExtensionAPI, type ToolCallEvent } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import {
  extractAllCommandSegments,
  extractCommandBasis,
  matchesToolPattern,
} from "../shared/command-utils";
import { defaultConfig, type ToolPermissions } from "../shared/config";
import {
  addBashPermission,
  addToolPermission,
  lookupPermission,
  resolveBashPermission,
} from "../shared/tool-permissions";
import { notifyAgentDone, notifyPermissionRequired, notifyQuestion } from "./notification";
import {
  discoverAgents,
  getFinalOutput,
  getModelRef,
  getPiInvocation,
  mapWithConcurrencyLimit,
  MAX_CONCURRENCY,
  MAX_PARALLEL_TASKS,
  type OnUpdateCallback,
  type SingleResult,
  type SubagentDetails,
  type ToolOverride,
  writePromptToTempFile,
} from "./agents";
import { renderCall, renderResult } from "./render";

// ── Tool parameter schema ──────────────────────────────────────────────

const TaskItem = Type.Object({
  agent: Type.String({
    description:
      "Name of the subagent to invoke (from pi). See ## Available subagents in the system prompt for the list.",
  }),
  task: Type.String({ description: "Task to delegate to the subagent" }),
  cwd: Type.Optional(Type.String({ description: "Working directory for the subagent process" })),
});

const ChainItem = Type.Object({
  agent: Type.String({
    description:
      "Name of the subagent to invoke (from pi). See ## Available subagents in the system prompt for the list.",
  }),
  task: Type.String({
    description: "Task with optional {previous} placeholder for the output of the prior step",
  }),
  cwd: Type.Optional(Type.String({ description: "Working directory for the subagent process" })),
});

const SubagentParams = Type.Object({
  agent: Type.Optional(
    Type.String({
      description:
        "Name of the subagent to invoke (single mode). See ## Available subagents in the system prompt for the list. The calling agent is pi.",
    }),
  ),
  task: Type.Optional(Type.String({ description: "Task to delegate (single mode)" })),
  tasks: Type.Optional(
    Type.Array(TaskItem, { description: "Array of {agent, task} for parallel execution" }),
  ),
  chain: Type.Optional(
    Type.Array(ChainItem, { description: "Array of {agent, task} for sequential execution" }),
  ),
  cwd: Type.Optional(
    Type.String({ description: "Working directory for the subagent (single mode)" }),
  ),
});

// ── SubagentExtension ──────────────────────────────────────────────────

export class SubagentExtension {
  private pi: ExtensionAPI;
  private activePrimaryAgent: string | null = null;
  /** Global tool restrictions applied to primary agent and all subagents. */
  private globalToolOverride: ToolOverride | null = null;
  /** Per-agent tool overrides (overrides agent's default tools from YAML). */
  private agentToolOverrides = new Map<string, ToolOverride>();

  // ── Permission-gate state ─────────────────────────────────────────

  /** Tools/commands granted session-only approval. */
  private sessionApprovals = new Set<string>();
  /** Permission map loaded from custom-settings.yaml `tools` key. */
  private settingsPerms: ToolPermissions = {};

  constructor(pi: ExtensionAPI) {
    this.pi = pi;
    this.registerTool();
    this.registerCommand();
    this.registerEvents();
    this.setupPermissionGate();
    this.setupNotifications();
  }

  // ── Tool registration ──────────────────────────────────────────────

  private registerTool(): void {
    this.pi.registerTool({
      name: "subagent",
      label: "Subagent",
      description:
        "Delegate tasks from pi to specialized subagents with isolated context. " +
        "Modes: single (agent + task), parallel (tasks array), chain (sequential with {previous} placeholder). " +
        "Agent definitions live in custom-settings.yaml under the `agents` key.",
      promptSnippet:
        "Delegate task from pi to a named subagent. Available subagent names are listed in the system prompt under ## Available subagents.",
      parameters: SubagentParams,
      execute: this.execute as any,
      renderCall,
      renderResult: renderResult as any,
    });
  }

  // ── Execute ─────────────────────────────────────────────────────────

  execute = async (
    _toolCallId: string,
    params: Record<string, unknown>,
    signal: AbortSignal | undefined,
    onUpdate: OnUpdateCallback | undefined,
    ctx: any,
  ) => {
    const subagents = discoverAgents().subagents;
    const parentModel = getModelRef(ctx.model, this.pi.getThinkingLevel());

    const chainLen = (params.chain as any[] | undefined)?.length ?? 0;
    const tasksLen = (params.tasks as any[] | undefined)?.length ?? 0;
    const hasChain = chainLen > 0;
    const hasTasks = tasksLen > 0;
    const hasSingle = Boolean(params.agent && params.task);
    const modeCount = Number(hasChain) + Number(hasTasks) + Number(hasSingle);

    if (modeCount !== 1) {
      const available = subagents.map((a) => a.name).join(", ") || "none";
      return {
        content: [
          {
            type: "text",
            text: `Invalid parameters. Provide exactly one mode (agent+task, tasks, or chain).\nAvailable subagents: ${available}`,
          },
        ],
        details: { mode: "single", results: [] } as SubagentDetails,
      };
    }

    // ── Chain mode ───────────────────────────────────────────────────
    if (hasChain) {
      const chain = params.chain as Array<{ agent: string; task: string; cwd?: string }>;
      const results: SingleResult[] = [];
      let previousOutput = "";

      for (let i = 0; i < chain.length; i++) {
        const step = chain[i];
        const taskWithContext = step.task.replace(/\{previous\}/g, previousOutput);

        const chainUpdate: OnUpdateCallback | undefined = onUpdate
          ? (partial) => {
              const cr = partial.details?.results[0];
              if (cr) {
                onUpdate({
                  content: partial.content,
                  details: { mode: "chain", results: [...results, cr] },
                });
              }
            }
          : undefined;

        const result = await this.runSingleAgent(
          ctx.cwd,
          step.agent,
          taskWithContext,
          step.cwd,
          i + 1,
          signal,
          chainUpdate,
          "chain",
          parentModel,
        );
        results.push(result);

        const isError =
          result.exitCode !== 0 || result.stopReason === "error" || result.stopReason === "aborted";
        if (isError) {
          const errorMsg =
            result.errorMessage ||
            result.stderr ||
            getFinalOutput(result.messages) ||
            "(no output)";
          return {
            content: [
              {
                type: "text",
                text: `Chain stopped at step ${i + 1} (${step.agent}): ${errorMsg}`,
              },
            ],
            details: { mode: "chain", results },
            isError: true,
          };
        }
        previousOutput = getFinalOutput(result.messages);
      }
      return {
        content: [
          {
            type: "text",
            text: getFinalOutput(results[results.length - 1].messages) || "(no output)",
          },
        ],
        details: { mode: "chain", results },
      };
    }

    // ── Parallel mode ────────────────────────────────────────────────
    if (hasTasks) {
      const tasks = params.tasks as Array<{ agent: string; task: string; cwd?: string }>;
      if (tasks.length > MAX_PARALLEL_TASKS) {
        return {
          content: [
            {
              type: "text",
              text: `Too many parallel tasks (${tasks.length}). Max is ${MAX_PARALLEL_TASKS}.`,
            },
          ],
          details: { mode: "parallel", results: [] },
        };
      }

      const allResults: SingleResult[] = tasks.map((t) => ({
        agent: t.agent,
        task: t.task,
        exitCode: -1,
        messages: [],
        stderr: "",
        usage: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          cost: 0,
          contextTokens: 0,
          turns: 0,
        },
      }));

      const emitParallelUpdate = () => {
        if (onUpdate) {
          const running = allResults.filter((r) => r.exitCode === -1).length;
          const done = allResults.filter((r) => r.exitCode !== -1).length;
          onUpdate({
            content: [
              {
                type: "text",
                text: `Parallel: ${done}/${allResults.length} done, ${running} running...`,
              },
            ],
            details: { mode: "parallel", results: [...allResults] },
          });
        }
      };

      const results = await mapWithConcurrencyLimit(tasks, MAX_CONCURRENCY, async (t, index) => {
        const result = await this.runSingleAgent(
          ctx.cwd,
          t.agent,
          t.task,
          t.cwd,
          undefined,
          signal,
          (partial) => {
            if (partial.details?.results[0]) {
              allResults[index] = partial.details.results[0];
              emitParallelUpdate();
            }
          },
          "parallel",
          parentModel,
        );
        allResults[index] = result;
        emitParallelUpdate();
        return result;
      });

      const successCount = results.filter((r) => r.exitCode === 0).length;
      const summaries = results.map((r) => {
        const output = getFinalOutput(r.messages);
        const preview = output.slice(0, 100) + (output.length > 100 ? "..." : "");
        return `[${r.agent}] ${r.exitCode === 0 ? "completed" : "failed"}: ${preview || "(no output)"}`;
      });
      return {
        content: [
          {
            type: "text",
            text: `Parallel: ${successCount}/${results.length} succeeded\n\n${summaries.join("\n\n")}`,
          },
        ],
        details: { mode: "parallel", results },
      };
    }

    // ── Single mode ──────────────────────────────────────────────────
    const agent = params.agent as string;
    const task = params.task as string;
    const cwd = params.cwd as string | undefined;

    const result = await this.runSingleAgent(
      ctx.cwd,
      agent,
      task,
      cwd,
      undefined,
      signal,
      onUpdate,
      "single",
      parentModel,
    );

    const isError =
      result.exitCode !== 0 || result.stopReason === "error" || result.stopReason === "aborted";
    if (isError) {
      const errorMsg =
        result.errorMessage || result.stderr || getFinalOutput(result.messages) || "(no output)";
      return {
        content: [
          {
            type: "text",
            text: `Agent ${result.stopReason || "failed"}: ${errorMsg}`,
          },
        ],
        details: { mode: "single", results: [result] },
        isError: true,
      };
    }
    return {
      content: [
        {
          type: "text",
          text: getFinalOutput(result.messages) || "(no output)",
        },
      ],
      details: { mode: "single", results: [result] },
    };
  };

  // ── Run a single subagent process ───────────────────────────────────

  private async runSingleAgent(
    defaultCwd: string,
    agentName: string,
    task: string,
    subCwd: string | undefined,
    step: number | undefined,
    signal: AbortSignal | undefined,
    onUpdate: OnUpdateCallback | undefined,
    mode: "single" | "parallel" | "chain",
    parentModel?: string,
  ): Promise<SingleResult> {
    const discovery = discoverAgents();
    const agent = discovery.agents.find((a) => a.name === agentName);

    if (!agent) {
      const available = discovery.subagents.map((a) => `"${a.name}"`).join(", ") || "none";
      return {
        agent: agentName,
        task,
        exitCode: 1,
        messages: [],
        stderr: `Unknown subagent: "${agentName}". Available subagents: ${available}.`,
        usage: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          cost: 0,
          contextTokens: 0,
          turns: 0,
        },
        step,
      };
    }

    const args: string[] = ["--mode", "json", "-p", "--no-session"];
    const modelToUse = parentModel || agent.model;
    if (modelToUse) args.push("--model", modelToUse);

    const effectiveTools = this.computeEffectiveTools(agentName, agent.tools);
    if (effectiveTools && effectiveTools.length > 0) args.push("--tools", effectiveTools.join(","));

    let tmpPromptDir: string | null = null;
    let tmpPromptPath: string | null = null;

    const currentResult: SingleResult = {
      agent: agentName,
      task,
      exitCode: 0,
      messages: [],
      stderr: "",
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        cost: 0,
        contextTokens: 0,
        turns: 0,
      },
      model: modelToUse,
      step,
    };

    const emitUpdate = () => {
      onUpdate?.({
        content: [{ type: "text", text: getFinalOutput(currentResult.messages) || "(running...)" }],
        details: { mode, results: [currentResult] },
      });
    };

    try {
      if (agent.systemPrompt.trim()) {
        const tmp = await writePromptToTempFile(agent.name, agent.systemPrompt);
        tmpPromptDir = tmp.dir;
        tmpPromptPath = tmp.filePath;
        args.push("--append-system-prompt", tmpPromptPath);
      }

      args.push(`Task: ${task}`);
      let wasAborted = false;

      const exitCode = await new Promise<number>((resolve) => {
        const invocation = getPiInvocation(args);
        const proc = spawn(invocation.command, invocation.args, {
          cwd: subCwd ?? defaultCwd,
          shell: false,
          stdio: ["ignore", "pipe", "pipe"],
          env: {
            ...process.env,
            ...(agent.toolPermissions
              ? { PI_AGENT_TOOL_PERMISSIONS: JSON.stringify(agent.toolPermissions) }
              : {}),
          },
        });
        let buffer = "";

        const processLine = (line: string) => {
          if (!line.trim()) return;
          let event: any;
          try {
            event = JSON.parse(line);
          } catch {
            return;
          }

          if (event.type === "message_end" && event.message) {
            const msg = event.message as Message;
            currentResult.messages.push(msg);

            if (msg.role === "assistant") {
              currentResult.usage.turns++;
              const usage = msg.usage;
              if (usage) {
                currentResult.usage.input += usage.input || 0;
                currentResult.usage.output += usage.output || 0;
                currentResult.usage.cacheRead += usage.cacheRead || 0;
                currentResult.usage.cacheWrite += usage.cacheWrite || 0;
                currentResult.usage.cost += usage.cost?.total || 0;
                currentResult.usage.contextTokens = usage.totalTokens || 0;
              }
              if (!currentResult.model && msg.model) currentResult.model = msg.model;
              if (msg.stopReason) currentResult.stopReason = msg.stopReason;
              if (msg.errorMessage) currentResult.errorMessage = msg.errorMessage;
            }
            emitUpdate();
          }

          if (event.type === "tool_result_end" && event.message) {
            currentResult.messages.push(event.message as Message);
            emitUpdate();
          }
        };

        proc.stdout.on("data", (data) => {
          buffer += data.toString();
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) processLine(line);
        });

        proc.stderr.on("data", (data) => {
          currentResult.stderr += data.toString();
        });

        proc.on("close", (code) => {
          if (buffer.trim()) processLine(buffer);
          resolve(code ?? 0);
        });

        proc.on("error", () => {
          resolve(1);
        });

        const handleSignal = () => {
          wasAborted = true;
          proc.kill("SIGTERM");
          setTimeout(() => {
            if (!proc.killed) proc.kill("SIGKILL");
          }, 5000);
        };

        if (signal) {
          if (signal.aborted) handleSignal();
          else signal.addEventListener("abort", handleSignal, { once: true });
        }
      });

      currentResult.exitCode = exitCode;
      if (wasAborted) throw new Error("Subagent was aborted");
      return currentResult;
    } finally {
      if (tmpPromptPath)
        try {
          fs.unlinkSync(tmpPromptPath);
        } catch {
          /* ignore */
        }
      if (tmpPromptDir)
        try {
          fs.rmdirSync(tmpPromptDir);
        } catch {
          /* ignore */
        }
    }
  }

  // ── Compute effective tools for a subagent ─────────────────────────

  private computeEffectiveTools(
    agentName: string,
    agentDefaultTools?: string[],
  ): string[] | undefined {
    let effective: string[] | undefined = agentDefaultTools ? [...agentDefaultTools] : undefined;

    const resolveAll = () => this.pi.getAllTools().map((t) => t.name);

    const agentOverride = this.agentToolOverrides.get(agentName);
    if (agentOverride) {
      if (agentOverride.type === "allow") {
        effective = [...agentOverride.tools];
      } else {
        effective = (effective ?? resolveAll()).filter((t) => !agentOverride.tools.includes(t));
      }
    }

    if (this.globalToolOverride) {
      if (this.globalToolOverride.type === "allow") {
        effective = effective
          ? effective.filter((t) => this.globalToolOverride!.tools.includes(t))
          : [...this.globalToolOverride.tools];
      } else {
        effective = (effective ?? resolveAll()).filter(
          (t) => !this.globalToolOverride!.tools.includes(t),
        );
      }
    }

    if (effective) {
      const allToolNames = resolveAll();

      // Expand wildcards
      const expanded = new Set<string>();
      for (const entry of effective) {
        if (entry.includes("*")) {
          const patternSet = new Set([entry]);
          for (const name of allToolNames) {
            if (matchesToolPattern(name, patternSet)) {
              expanded.add(name);
            }
          }
        } else {
          expanded.add(entry);
        }
      }

      // Remove globally denied tools (from custom-settings.yaml `tools` key)
      const filtered = new Set<string>();
      for (const name of expanded) {
        const perm = lookupPermission(name, this.settingsPerms);
        if (perm !== "deny") {
          filtered.add(name);
        }
      }

      effective = Array.from(filtered);
    }

    // Prevent subagents from spawning subagents (recursive delegation).
    // Resolve to all tools when no restrictions are configured, then always
    // strip "subagent" so subagents can never delegate further.
    effective = (effective ?? resolveAll()).filter((t) => t !== "subagent");

    return effective && effective.length > 0 ? effective : undefined;
  }

  // ── Command: /agent ─────────────────────────────────────────────────

  private registerCommand(): void {
    this.pi.registerCommand("agent", {
      description: "Select or switch primary agents",
      handler: this.handleAgentCommand,
    });
  }

  handleAgentCommand = async (args: string, ctx: any): Promise<void> => {
    const discovery = discoverAgents();
    const primaryAgents = discovery.primaryAgents;

    let targetName: string;

    // No args: show select popup to pick a primary agent
    if (!args || args.trim() === "") {
      if (primaryAgents.length === 0) {
        ctx.ui.notify(
          "No primary agents found. Define agents in custom-settings.yaml under the `agents` key.",
          "warning",
        );
        return;
      }

      const activeName = this.activePrimaryAgent || "pi";
      const items = primaryAgents.map(
        (a) => `${a.name}${a.name === activeName ? " [active]" : ""}: ${a.description}`,
      );
      const selected = await ctx.ui.select("Select Primary Agent", items);
      if (selected === null || selected === undefined) return;

      // Parse agent name from selected display item. Format: "name [active]: description"
      // TODO: use Map<string, Agent> instead of string parsing when item format changes.
      targetName = selected.split(":")[0].replace(" [active]", "").trim();
    } else {
      targetName = args.trim();
    }

    if (targetName === "pi") {
      if (this.activePrimaryAgent) {
        this.activePrimaryAgent = null;
        this.pi.events.emit("agent:changed", { name: "pi" });
        this.applyActiveTools();
        ctx.ui.notify("Switched to default agent: pi", "info");
        ctx.ui.setStatus("agent", undefined);
      } else {
        ctx.ui.notify("Already using default agent: pi", "info");
      }
      return;
    }

    const agent = primaryAgents.find((a) => a.name === targetName);

    if (!agent) {
      const available = primaryAgents.map((a) => `"${a.name}"`).join(", ") || "none";
      ctx.ui.notify(`Unknown primary agent: "${targetName}". Available: ${available}`, "error");
      return;
    }

    if (agent.model) {
      const modelObj = ctx.modelRegistry.find(
        agent.model.split("/")[0] || "",
        agent.model.split("/")[1] || agent.model,
      );
      if (modelObj) {
        await this.pi.setModel(modelObj);
      }
    }

    if (agent.tools) {
      this.pi.setActiveTools(agent.tools);
    } else {
      this.applyActiveTools();
    }

    this.activePrimaryAgent = targetName;
    this.pi.events.emit("agent:changed", { name: agent.name });

    ctx.ui.notify(`Switched to primary agent: ${agent.name}`, "info");
    ctx.ui.setStatus("agent", `agent: ${agent.name}`);
  };

  // ── Events ──────────────────────────────────────────────────────────

  private registerEvents(): void {
    this.pi.on("before_agent_start", this.onBeforeAgentStartInjectSubagents);
    this.pi.on("before_agent_start", this.onBeforeAgentStartInjectPrimary);
    this.pi.on("session_start", this.onSessionStart);
  }

  onBeforeAgentStartInjectSubagents = async (event: any, _ctx: any) => {
    const subagents = discoverAgents().subagents;
    if (subagents.length === 0) return;

    const agentList = subagents.map((a) => `- **${a.name}**: ${a.description}`).join("\n");

    return {
      systemPrompt:
        event.systemPrompt +
        `\n\n## Available subagents\n${agentList}\n\nUse the subagent tool to delegate tasks to these agents.`,
    };
  };

  onBeforeAgentStartInjectPrimary = async (event: any, ctx: any) => {
    if (!this.activePrimaryAgent) return;

    const agent = discoverAgents().primaryAgents.find((a) => a.name === this.activePrimaryAgent);

    if (!agent) {
      this.activePrimaryAgent = null;
      this.pi.events.emit("agent:changed", { name: "pi" });
      ctx.ui.setStatus("agent", undefined);
      return;
    }

    if (!agent.systemPrompt.trim()) return;

    return {
      systemPrompt: event.systemPrompt + "\n\n" + agent.systemPrompt,
    };
  };

  onSessionStart = async (_event: any, ctx: any) => {
    this.sessionApprovals.clear();
    this.reloadPermissions();
    this.applyActiveTools();
    if (this.activePrimaryAgent) {
      ctx.ui.setStatus("agent", `agent: ${this.activePrimaryAgent}`);
    }
  };

  // ── Permission gate ────────────────────────────────────────────────

  private setupPermissionGate(): void {
    this.reloadPermissions();

    this.pi.on("tool_call", async (event: ToolCallEvent, ctx) => {
      return this.handleToolCall(event, ctx);
    });
  }

  private reloadPermissions(): void {
    defaultConfig.invalidateConfigCache();
    this.settingsPerms = defaultConfig.loadToolPermissions();
  }

  /** Load agent-level permissions from PI_AGENT_TOOL_PERMISSIONS env var. */
  private loadAgentToolPermissions(): ToolPermissions | null {
    try {
      const raw = process.env.PI_AGENT_TOOL_PERMISSIONS;
      if (!raw) return null;
      return JSON.parse(raw) as ToolPermissions;
    } catch {
      return null;
    }
  }

  /** Compute the set of active tools by removing denied ones. */
  private applyActiveTools(): void {
    const allTools = this.pi.getAllTools().map((t) => t.name);
    const agentPerms = this.loadAgentToolPermissions();
    const denied = new Set<string>();

    for (const name of allTools) {
      // Decision order: agent config > global config > default "ask"
      const agentResult = lookupPermission(name, agentPerms);
      if (agentResult === "deny") {
        denied.add(name);
        continue;
      }
      if (agentResult !== null) continue; // allow or ask — keep active

      const settingsResult = lookupPermission(name, this.settingsPerms);
      if (settingsResult === "deny") {
        denied.add(name);
      }
    }

    if (denied.size > 0) {
      const active = allTools.filter((n) => !denied.has(n));
      this.pi.setActiveTools(active);
    }
  }

  // ── Notifications ────────────────────────────────────────────────

  private setupNotifications(): void {
    // Notify when the primary agent finishes processing.
    this.pi.on("agent_end", async (event) => {
      const msgCount = event.messages?.length ?? 0;
      if (msgCount === 0) return;
      const lastMsg = event.messages[msgCount - 1];
      let preview = "";
      if (lastMsg && lastMsg.role === "assistant" && Array.isArray(lastMsg.content)) {
        for (const block of lastMsg.content) {
          if (block.type === "text" && typeof block.text === "string") {
            preview = block.text.slice(0, 80).replace(/\n/g, " ");
            break;
          }
        }
      }
      notifyAgentDone(preview);
    });

    // Notify when the LLM uses the question tool.
    this.pi.on("tool_call", async (event: ToolCallEvent, _ctx) => {
      if (event.toolName !== "question") return;
      const questions = (event.input as { questions?: Array<{ prompt: string }> }).questions;
      if (!questions || questions.length === 0) return;
      const prompts = questions.map((q) => q.prompt).join(" | ");
      notifyQuestion(prompts);
    });
  }

  /** Gate every tool call with permission checks. */
  private async handleToolCall(
    event: ToolCallEvent,
    ctx: any,
  ): Promise<{ block: boolean; reason?: string } | undefined> {
    const toolName = event.toolName;
    const agentPerms = this.loadAgentToolPermissions();

    // ── Bash: resolve command-level permission ──────────────────────
    if (toolName === "bash") {
      const command = (event.input as { command: string }).command;
      const segments = extractAllCommandSegments(command);

      // Empty/whitespace-only command — skip permission check
      if (segments.length === 0) return undefined;

      // Check if ALL segments are session-approved (using basis keys)
      const allSessionApproved = segments.every((s) =>
        this.sessionApprovals.has(extractCommandBasis(s)),
      );
      if (allSessionApproved) return undefined;

      // Memoize permission lookups per segment to avoid redundant calls
      const bashPermCache = new Map<string, "allow" | "deny" | "ask" | null>();
      const getBashPerm = (seg: string): "allow" | "deny" | "ask" | null => {
        const cached = bashPermCache.get(seg);
        if (cached !== undefined) return cached;
        const agentResult = resolveBashPermission(seg, agentPerms);
        if (agentResult !== null) {
          bashPermCache.set(seg, agentResult);
          return agentResult;
        }
        const settingsResult = resolveBashPermission(seg, this.settingsPerms);
        bashPermCache.set(seg, settingsResult);
        return settingsResult;
      };

      let denied = false;

      for (const seg of segments) {
        // Session approval uses the command basis (strips flags/args)
        const basis = extractCommandBasis(seg);
        if (this.sessionApprovals.has(basis)) continue;

        const perm = getBashPerm(seg);
        if (perm === "deny") {
          denied = true;
          break;
        }
        if (perm === "allow") continue;
        // perm is null or "ask" — will prompt
      }

      if (denied) {
        return { block: true, reason: "Bash command denied by tool permissions." };
      }

      // If all segments are session-approved or explicitly allowed, skip prompt
      if (
        segments.every(
          (s) => this.sessionApprovals.has(extractCommandBasis(s)) || getBashPerm(s) === "allow",
        )
      ) {
        return undefined;
      }
    } else {
      // ── Non-bash tool ────────────────────────────────────────────
      if (this.sessionApprovals.has(toolName)) return undefined;

      const agentResult = lookupPermission(toolName, agentPerms);
      if (agentResult === "deny") {
        return { block: true, reason: `Tool "${toolName}" denied by agent permissions.` };
      }
      if (agentResult === "allow") return undefined;

      if (agentResult === null) {
        const settingsResult = lookupPermission(toolName, this.settingsPerms);
        if (settingsResult === "deny") {
          return {
            block: true,
            reason: `Tool "${toolName}" denied by tool permissions.`,
          };
        }
        if (settingsResult === "allow") return undefined;
      }
    }

    // ── Ask ──────────────────────────────────────────────────────────
    if (!ctx.hasUI) {
      return {
        block: true,
        reason: `Tool "${toolName}" requires approval (no UI available).`,
      };
    }

    const desc = this.describeCall(event);
    notifyPermissionRequired(desc);

    const selected = await ctx.ui.select(`🔐 Permission required — ${desc}`, [
      "✅ Allow",
      "❌ Deny (with reason)",
      "🔓 Always approve",
      "🕐 Approve in this session only",
    ]);

    if (selected === null || selected === undefined) {
      return { block: true, reason: "Cancelled by user." };
    }

    switch (selected) {
      case "✅ Allow":
        return undefined;

      case "❌ Deny (with reason)": {
        const reason = await ctx.ui.input("Reason for denial:", "e.g., not needed, dangerous, ...");
        return { block: true, reason: reason || "Blocked by user." };
      }

      case "🔓 Always approve": {
        if (toolName === "bash") {
          const command = (event.input as { command: string }).command;
          const segments = extractAllCommandSegments(command);
          if (segments.length > 0) {
            for (const seg of segments) {
              const basis = extractCommandBasis(seg);
              if (basis) {
                defaultConfig.updateCustomSettings((s) => addBashPermission(s, basis, "allow"));
              }
            }
          }
        } else {
          defaultConfig.updateCustomSettings((s) => addToolPermission(s, toolName, "allow"));
        }
        this.reloadPermissions();
        this.applyActiveTools();
        return undefined;
      }

      case "🕐 Approve in this session only": {
        if (toolName === "bash") {
          const command = (event.input as { command: string }).command;
          const segments = extractAllCommandSegments(command);
          if (segments.length > 0) {
            for (const seg of segments) {
              const basis = extractCommandBasis(seg);
              if (basis) this.sessionApprovals.add(basis);
            }
          } else {
            this.sessionApprovals.add(toolName);
          }
        } else {
          this.sessionApprovals.add(toolName);
        }
        return undefined;
      }

      default:
        return { block: true, reason: "Unknown choice." };
    }
  }

  /** Build a human-readable description of the tool call for the prompt. */
  private describeCall(event: ToolCallEvent): string {
    const toolName = event.toolName;
    const input = event.input as Record<string, unknown>;

    switch (toolName) {
      case "bash":
        return `bash: ${input.command ?? "(no command)"}`;
      case "read":
        return `read: ${input.path ?? "?"}`;
      case "write":
        return `write: ${input.path ?? "?"}`;
      case "edit":
        return `edit: ${input.path ?? "?"}`;
      case "ls":
        return `ls: ${input.path ?? "."}`;
      case "grep":
        return `grep: ${input.pattern ?? "?"} in ${input.path ?? "?"}`;
      case "find":
        return `find: ${input.path ?? "."}`;
      default:
        return `${toolName}: ${JSON.stringify(input).slice(0, 120)}`;
    }
  }
}
