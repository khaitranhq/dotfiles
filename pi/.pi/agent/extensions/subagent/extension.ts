/**
 * SubagentExtension — tool, command, and event wiring for the subagent extension.
 */

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import type { Message } from "@earendil-works/pi-ai";
import { type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { matchesToolPattern } from "../shared/command-utils";
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

  constructor(pi: ExtensionAPI) {
    this.pi = pi;
    this.registerTool();
    this.registerCommand();
    this.registerEvents();
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
      effective = Array.from(expanded);
    }

    return effective && effective.length > 0 ? effective : undefined;
  }

  // ── Command: /agent ─────────────────────────────────────────────────

  private registerCommand(): void {
    this.pi.registerCommand("agent", {
      description: "Switch or list primary agents",
      handler: this.handleAgentCommand,
    });
  }

  handleAgentCommand = async (args: string, ctx: any): Promise<void> => {
    const discovery = discoverAgents();
    const primaryAgents = discovery.primaryAgents;

    if (!args || args.trim() === "") {
      if (primaryAgents.length === 0) {
        ctx.ui.notify(
          "No primary agents found. Define agents in custom-settings.yaml under the `agents` key.",
          "warning",
        );
        return;
      }

      const items = primaryAgents.map(
        (a) =>
          `${a.name}${
            this.activePrimaryAgent === a.name || (!this.activePrimaryAgent && a.name === "pi")
              ? " [active]"
              : ""
          }: ${a.description}`,
      );
      ctx.ui.notify(`Primary agents:\n${items.join("\n")}`, "info");
      return;
    }

    const targetName = args.trim();

    if (targetName === "pi") {
      if (this.activePrimaryAgent) {
        this.activePrimaryAgent = null;
        this.pi.events.emit("agent:changed", { name: "pi" });
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
    if (this.activePrimaryAgent) {
      ctx.ui.setStatus("agent", `agent: ${this.activePrimaryAgent}`);
    }
  };
}
