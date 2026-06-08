/**
 * Todo Extension — OpenCode-style todowrite tool with full-replacement strategy.
 *
 * Design (from OpenCode):
 * - LLM sends the COMPLETE todo list each time it calls `todowrite`.
 * - The tool replaces the entire in-memory list with what the LLM sends.
 * - No individual add/toggle/delete — the LLM owns the list.
 * - State is stored in tool-result details so session branching works.
 *
 * States: pending | in_progress | completed | cancelled
 * Priority: high | medium | low
 */

import { StringEnum } from "@earendil-works/pi-ai";
import {
  type ExtensionAPI,
  type ExtensionContext,
  type Theme,
  DynamicBorder,
} from "@earendil-works/pi-coding-agent";
import { Container, matchesKey, Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";

// ── Types ─────────────────────────────────────────────────────────────

const TodoStatus = ["pending", "in_progress", "completed", "cancelled"] as const;
const TodoPriority = ["high", "medium", "low"] as const;

const TodoItemSchema = Type.Object({
  content: Type.String({ description: "Todo item text" }),
  status: StringEnum(TodoStatus),
  priority: StringEnum(TodoPriority),
});

const TodowriteParams = Type.Object({
  todos: Type.Array(TodoItemSchema, {
    description:
      "The complete todo list. Send ALL todos every time — the tool replaces the entire list.",
  }),
});

interface TodoItem {
  content: string;
  status: (typeof TodoStatus)[number];
  priority: (typeof TodoPriority)[number];
}

interface TodoDetails {
  todos: TodoItem[];
}

// ── LLM-facing tool description ───────────────────────────────────────

const DESCRIPTION = [
  "Use this tool to create and manage a structured task list for your current coding session.",
  "This helps you track progress, organize complex tasks, and demonstrate thoroughness.",
  "",
  "## When to Use This Tool",
  "Use proactively for:",
  "1. Complex multi-step tasks (3+ distinct steps)",
  "2. Non-trivial tasks requiring careful planning",
  "3. User explicitly requests todo list",
  "4. User provides multiple tasks (numbered/comma-separated)",
  "5. After receiving new instructions — capture requirements as todos",
  "6. **IMPORTANT: When you START working on a task** — mark it as in_progress",
  "7. **IMPORTANT: IMMEDIATELY after COMPLETING a task** — mark it as completed",
  "8. When you need to add a new task to existing list",
  "",
  "## When NOT to Use",
  "Do NOT use for:",
  "1. Single, straightforward tasks",
  "2. Trivial tasks with no organizational benefit",
  "3. Tasks completable in < 3 trivial steps",
  "4. Purely conversational/informational requests",
  "5. Todo items should NOT include operational actions done in service of higher-level tasks",
  "",
  "## Task States",
  "- pending: Not yet started",
  "- in_progress: Currently working on (ONLY ONE at a time)",
  "- completed: Finished successfully",
  "- cancelled: No longer needed",
  "",
  "## Priority Levels",
  "- high: Critical/urgent tasks",
  "- medium: Normal priority (default)",
  "- low: Nice-to-have, can defer",
  "",
  "## Rules",
  "- Send the COMPLETE todo list every call — the tool replaces the entire list.",
  "- Keep exactly ONE todo in_progress at a time.",
  "- Complete current tasks before starting new ones.",
  "- Mark a task completed ONLY when you have fully verified it is done.",
  "- ALWAYS include a summary of changes made in your response after calling todowrite.",
  "- Preserve user's exact wording when creating tasks from their instructions.",
  "- Break large complex work into smaller, manageable steps.",
  "- Use the priority field to help the user understand relative importance.",
].join("\n");

// ── Status icons ──────────────────────────────────────────────────────

const STATUS_ICONS: Record<TodoItem["status"], string> = {
  pending: "○",
  in_progress: "●",
  completed: "✓",
  cancelled: "✗",
};

function statusColor(status: TodoItem["status"]): "warning" | "success" | "dim" {
  switch (status) {
    case "in_progress":
      return "warning";
    case "completed":
      return "success";
    default:
      return "dim";
  }
}

function priorityColor(priority: TodoItem["priority"]): "error" | "muted" | "dim" {
  switch (priority) {
    case "high":
      return "error";
    case "medium":
      return "muted";
    default:
      return "dim";
  }
}

// ── Count summary helper ──────────────────────────────────────────────

function summarize(todos: TodoItem[]): string {
  const counts: Record<string, number> = {};
  for (const t of todos) counts[t.status] = (counts[t.status] ?? 0) + 1;
  const parts: string[] = [];
  if (counts.completed) parts.push(`${counts.completed} done`);
  if (counts.in_progress) parts.push(`${counts.in_progress} active`);
  if (counts.pending) parts.push(`${counts.pending} pending`);
  if (counts.cancelled) parts.push(`${counts.cancelled} cancelled`);
  return parts.length > 0 ? parts.join(", ") : "empty";
}

// ── TUI Component for /todos command ──────────────────────────────────

class TodoListComponent extends Container {
  private todos: TodoItem[];
  private onClose: () => void;

  constructor(todos: TodoItem[], theme: Theme, onClose: () => void) {
    super();
    this.todos = todos;
    this.onClose = onClose;
    this.rebuild(theme);
  }

  private rebuild(theme: Theme): void {
    this.clear();

    this.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));
    this.addChild(new Text(theme.fg("accent", theme.bold(" Todos ")), 1, 0));

    if (this.todos.length === 0) {
      this.addChild(new Text("  No todos yet.", 1, 0));
    } else {
      const summary = summarize(this.todos);
      this.addChild(new Text(`  ${theme.fg("muted", summary)}`, 1, 0));
      this.addChild(new Text("", 0, 0));

      for (const todo of this.todos) {
        const icon = STATUS_ICONS[todo.status];
        const text =
          todo.status === "completed"
            ? theme.fg("dim", todo.content)
            : theme.fg("text", todo.content);
        const priLabel = theme.fg(priorityColor(todo.priority), `[${todo.priority}]`);

        this.addChild(
          new Text(`  ${theme.fg(statusColor(todo.status), icon)} ${priLabel} ${text}`, 1, 0),
        );
      }
    }

    this.addChild(new Text(theme.fg("dim", "  Escape to close"), 1, 0));
    this.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));
  }

  override handleInput(data: string): void {
    if (matchesKey(data, "escape") || matchesKey(data, "ctrl+c")) {
      this.onClose();
    }
  }

  override invalidate(): void {
    super.invalidate();
  }
}

// ── Extension ─────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  let todos: TodoItem[] = [];

  // ── Reconstruct state from session entries ───────────────────────

  const reconstructState = (ctx: ExtensionContext) => {
    todos = [];
    for (const entry of ctx.sessionManager.getBranch()) {
      if (entry.type !== "message") continue;
      const msg = entry.message;
      if (msg.role !== "toolResult" || msg.toolName !== "todowrite") continue;
      const details = msg.details as TodoDetails | undefined;
      if (details?.todos) todos = details.todos;
    }
  };

  pi.on("session_start", async (_event, ctx) => reconstructState(ctx));
  pi.on("session_tree", async (_event, ctx) => reconstructState(ctx));

  // ── Register todowrite tool ────────────────────────────────────

  pi.registerTool({
    name: "todowrite",
    label: "TodoWrite",
    description: DESCRIPTION,
    promptSnippet: "Create and manage a structured task list (full replacement)",
    promptGuidelines: [
      "Use todowrite to track tasks for complex multi-step work. Send the COMPLETE todo list every call — the tool replaces the entire list. Keep exactly one todo in_progress at a time. Mark tasks completed ONLY after full verification.",
    ],
    parameters: TodowriteParams,

    async execute(_toolCallId, params) {
      todos = params.todos.map((t) => ({ ...t })); // shallow clone

      const summary = summarize(todos);
      const activeCount = todos.filter(
        (t) => t.status !== "completed" && t.status !== "cancelled",
      ).length;

      return {
        content: [
          {
            type: "text",
            text: [
              `${activeCount} active todos (${summary})`,
              "",
              todos.length > 0
                ? todos
                    .map((t) => `[${STATUS_ICONS[t.status]}] [${t.priority}] ${t.content}`)
                    .join("\n")
                : "(empty)",
            ].join("\n"),
          },
        ],
        details: { todos } as TodoDetails,
      };
    },

    renderCall(args, theme) {
      const list = args.todos as TodoItem[] | undefined;
      const count = list?.length ?? 0;
      const active =
        list?.filter((t) => t.status !== "completed" && t.status !== "cancelled").length ?? 0;
      return new Text(
        theme.fg("toolTitle", theme.bold("todowrite ")) +
          theme.fg("muted", `${count} todos, ${active} active`),
        0,
        0,
      );
    },

    renderResult(result, { expanded }, theme) {
      const details = result.details as TodoDetails | undefined;
      const list = details?.todos ?? [];

      if (list.length === 0) {
        return new Text(theme.fg("dim", "No todos"), 0, 0);
      }

      let output = theme.fg("muted", summarize(list));

      if (expanded) {
        for (const t of list) {
          const icon = STATUS_ICONS[t.status];
          const text =
            t.status === "completed" ? theme.fg("dim", t.content) : theme.fg("muted", t.content);
          output += `\n  ${theme.fg(statusColor(t.status), icon)} ${theme.fg(priorityColor(t.priority), `[${t.priority}]`)} ${text}`;
        }
      } else {
        const active = list.filter((t) => t.status === "in_progress");
        const pending = list.filter((t) => t.status === "pending");
        const display = [...active, ...pending].slice(0, 5);
        for (const t of display) {
          const icon = STATUS_ICONS[t.status];
          const text =
            t.status === "completed" ? theme.fg("dim", t.content) : theme.fg("muted", t.content);
          output += `\n  ${theme.fg(statusColor(t.status), icon)} ${text}`;
        }
        const remaining = list.length - display.length;
        if (remaining > 0) {
          output += `\n  ${theme.fg("dim", `... ${remaining} more`)}`;
        }
      }

      return new Text(output, 0, 0);
    },
  });

  // ── Register /todos command ────────────────────────────────────

  pi.registerCommand("todos", {
    description: "Show all todos on the current branch",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("/todos requires interactive mode", "error");
        return;
      }

      await ctx.ui.custom<void>(
        (_tui, theme, _kb, done) => {
          return new TodoListComponent(todos, theme, () => done());
        },
        {
          overlay: true,
          overlayOptions: {
            width: "50%",
            minWidth: 35,
            maxHeight: "70%",
            margin: 1,
          },
        },
      );
    },
  });
}
