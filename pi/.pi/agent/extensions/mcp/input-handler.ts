/**
 * @agentName input handler — delegates user input to subagents.
 *
 * When a user types "@agentName task", this handler intercepts the input
 * and transforms it into a subagent tool call instruction.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { discoverAgents, type AgentConfig } from "../subagent/agents";

export function registerInputHandler(pi: ExtensionAPI): void {
  pi.on("input", async (event, ctx) => {
    if (event.source !== "interactive") return;

    const match = event.text.match(/^@([\w.-]+)\s+(.*)/);
    if (!match) return;

    const [, agentName, task] = match;
    const trimmedTask = task.trim();
    if (!trimmedTask) return;

    const discovery = discoverAgents(ctx.cwd, "both");

    // Check if it's a subagent
    const subagent = discovery.subagents.find((a: AgentConfig) => a.name === agentName);
    if (subagent) {
      return {
        action: "transform",
        text: `Use the subagent tool to delegate the following task to the "${agentName}" agent: ${trimmedTask}`,
      };
    }

    // Check if it's a primary agent (misuse)
    const primaryAgent = discovery.primaryAgents.find((a: AgentConfig) => a.name === agentName);
    if (primaryAgent) {
      ctx.ui.notify(
        `"${agentName}" is a primary agent. Use /agent ${agentName} to switch.`,
        "warning",
      );
      return { action: "handled" };
    }

    // Agent not found
    const available = discovery.subagents.map((a: AgentConfig) => a.name).join(", ") || "none";
    ctx.ui.notify(`Unknown agent: "@${agentName}". Available subagents: ${available}`, "error");
    return { action: "handled" };
  });
}
