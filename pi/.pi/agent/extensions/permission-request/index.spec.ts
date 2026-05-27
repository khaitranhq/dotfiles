import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ExtensionAPI, ToolCallEvent } from "@earendil-works/pi-coding-agent";
import createPermissionRequestExtension from "./index";

// ── Mock config module ────────────────────────────────────────────────

let mockSettings: Record<string, unknown> = {};

vi.mock("../shared/config", () => ({
  loadToolPermissions: vi.fn(() => {
    const tools = mockSettings.tools;
    if (tools && typeof tools === "object" && !Array.isArray(tools)) {
      return tools as Record<string, unknown>;
    }
    return {};
  }),
  updateCustomSettings: vi.fn(
    (updater: (s: Record<string, unknown>) => Record<string, unknown>) => {
      mockSettings = updater(mockSettings);
    },
  ),
}));

import { loadToolPermissions, updateCustomSettings } from "../shared/config";

// ── Helpers ───────────────────────────────────────────────────────────

interface HandlerRegistration {
  event: string;
  handler: (...args: any[]) => any;
}

function createMockPi(): {
  pi: ExtensionAPI;
  registrations: HandlerRegistration[];
} {
  const registrations: HandlerRegistration[] = [];

  const pi = {
    on: vi.fn((event: string, handler: (...args: any[]) => any) => {
      registrations.push({ event, handler });
    }),
    sendUserMessage: vi.fn(),
    registerTool: vi.fn(),
    registerCommand: vi.fn(),
    registerShortcut: vi.fn(),
    registerFlag: vi.fn(),
    getFlag: vi.fn(),
    registerMessageRenderer: vi.fn(),
    sendMessage: vi.fn(),
  } as unknown as ExtensionAPI;

  return { pi, registrations };
}

function getHandler(
  registrations: HandlerRegistration[],
  event: string,
): ((...args: any[]) => any) | undefined {
  return registrations.find((r) => r.event === event)?.handler;
}

type UICtx = {
  hasUI: boolean;
  cwd: string;
  ui: {
    notify: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
    input: ReturnType<typeof vi.fn>;
  };
};

function mockCtx(overrides: { hasUI?: boolean; cwd?: string } = {}): UICtx {
  return {
    hasUI: overrides.hasUI ?? true,
    cwd: overrides.cwd ?? "/home/user",
    ui: {
      notify: vi.fn(),
      select: vi.fn(),
      input: vi.fn(),
    },
  };
}

function bashEvent(command: string): ToolCallEvent {
  return {
    type: "tool_call",
    toolCallId: "call-1",
    toolName: "bash",
    input: { command },
  } as ToolCallEvent;
}

function readEvent(filePath: string): ToolCallEvent {
  return {
    type: "tool_call",
    toolCallId: "call-2",
    toolName: "read",
    input: { path: filePath },
  } as ToolCallEvent;
}

function toolEvent(toolName: string, input?: Record<string, unknown>): ToolCallEvent {
  return {
    type: "tool_call",
    toolCallId: `call-${toolName}`,
    toolName,
    input: input ?? {},
  } as ToolCallEvent;
}

// ── Env helper ────────────────────────────────────────────────────────

function setAgentPermissions(perms: Record<string, unknown> | null): void {
  if (perms) {
    process.env.PI_AGENT_TOOL_PERMISSIONS = JSON.stringify(perms);
  } else {
    delete process.env.PI_AGENT_TOOL_PERMISSIONS;
  }
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("permission-request extension (new tools format)", () => {
  let mock: ReturnType<typeof createMockPi>;
  let toolCallHandler: (...args: any[]) => any;
  let sessionStartHandler: (() => void) | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.PI_AGENT_TOOL_PERMISSIONS;
    mockSettings = {
      tools: {
        read: "allow",
        write: "allow",
        edit: "allow",
        "mcp_atlassian_*": "deny",
        bash: {
          cd: "allow",
          ls: "allow",
          grep: "allow",
          cat: "allow",
          rg: "allow",
          "git diff": "allow",
          "git log": "allow",
          "git status": "allow",
          "go test": "allow",
          rm: "deny",
        },
      },
    };
    mock = createMockPi();
  });

  afterEach(() => {
    delete process.env.PI_AGENT_TOOL_PERMISSIONS;
  });

  function initExtension() {
    createPermissionRequestExtension(mock.pi);
    toolCallHandler = getHandler(mock.registrations, "tool_call")!;
    sessionStartHandler = getHandler(mock.registrations, "session_start");
    expect(toolCallHandler).toBeDefined();
  }

  // ── Allowed non-bash tools ───────────────────────────────────────

  describe("allowed non-bash tools", () => {
    beforeEach(() => initExtension());

    it("allows read without prompt", async () => {
      const result = await toolCallHandler(readEvent("/file.txt"), mockCtx());
      expect(result).toBeUndefined();
    });

    it("allows write without prompt", async () => {
      const result = await toolCallHandler(
        toolEvent("write", { path: "/f", content: "x" }),
        mockCtx(),
      );
      expect(result).toBeUndefined();
    });

    it("allows edit without prompt", async () => {
      const result = await toolCallHandler(toolEvent("edit", { path: "/f" }), mockCtx());
      expect(result).toBeUndefined();
    });
  });

  // ── Denied non-bash tools ────────────────────────────────────────

  describe("denied non-bash tools", () => {
    beforeEach(() => initExtension());

    it("denies mcp_atlassian_* wildcard match", async () => {
      const result = await toolCallHandler(toolEvent("mcp_atlassian_getpage"), mockCtx());
      expect(result).toEqual({
        block: true,
        reason: expect.stringContaining("denied"),
      });
    });

    it("denies mcp_atlassian_search via wildcard", async () => {
      const result = await toolCallHandler(toolEvent("mcp_atlassian_search"), mockCtx());
      expect(result).toEqual({
        block: true,
        reason: expect.stringContaining("denied"),
      });
    });
  });

  // ── Unlisted tools → ask ─────────────────────────────────────────

  describe("unlisted tools prompt the user", () => {
    beforeEach(() => initExtension());

    it("prompts for subagent tool (not in permissions)", async () => {
      const uiCtx = mockCtx();
      uiCtx.ui.select.mockResolvedValue("✅ Allow");

      const result = await toolCallHandler(
        toolEvent("subagent", { agent: "test", task: "do" }),
        uiCtx,
      );
      expect(result).toBeUndefined();
      expect(uiCtx.ui.select).toHaveBeenCalled();
    });

    it("prompts for question tool (not in permissions)", async () => {
      const uiCtx = mockCtx();
      uiCtx.ui.select.mockResolvedValue("✅ Allow");

      const result = await toolCallHandler(toolEvent("question"), uiCtx);
      expect(result).toBeUndefined();
      expect(uiCtx.ui.select).toHaveBeenCalled();
    });

    it("blocks in non-interactive mode for unlisted tool", async () => {
      const result = await toolCallHandler(toolEvent("subagent"), mockCtx({ hasUI: false }));
      expect(result).toEqual({
        block: true,
        reason: expect.stringContaining("requires approval"),
      });
    });
  });

  // ── Allowed bash commands ────────────────────────────────────────

  describe("allowed bash commands", () => {
    beforeEach(() => initExtension());

    it("allows simple allowed command", async () => {
      const result = await toolCallHandler(bashEvent("ls -la"), mockCtx());
      expect(result).toBeUndefined();
    });

    it("allows multi-word allowed subcommand", async () => {
      const result = await toolCallHandler(bashEvent("git diff --cached"), mockCtx());
      expect(result).toBeUndefined();
    });

    it("allows compound command with all-allowed segments", async () => {
      const result = await toolCallHandler(bashEvent("cd /tmp && ls -la"), mockCtx());
      expect(result).toBeUndefined();
    });
  });

  // ── Denied bash commands ─────────────────────────────────────────

  describe("denied bash commands", () => {
    beforeEach(() => initExtension());

    it("denies rm command", async () => {
      const result = await toolCallHandler(bashEvent("rm -rf /tmp"), mockCtx());
      expect(result).toEqual({
        block: true,
        reason: expect.stringContaining("denied"),
      });
    });

    it("denies when denied command is in compound", async () => {
      // cd is allowed, rm is denied → denied wins
      const result = await toolCallHandler(bashEvent("cd /tmp && rm -rf *"), mockCtx());
      expect(result).toEqual({
        block: true,
        reason: expect.stringContaining("denied"),
      });
    });
  });

  // ── Unlisted bash commands → ask ─────────────────────────────────

  describe("unlisted bash commands prompt the user", () => {
    beforeEach(() => initExtension());

    it("prompts for pnpm install (not in permissions)", async () => {
      const uiCtx = mockCtx();
      uiCtx.ui.select.mockResolvedValue("✅ Allow");

      const result = await toolCallHandler(bashEvent("pnpm install"), uiCtx);
      expect(result).toBeUndefined();
      expect(uiCtx.ui.select).toHaveBeenCalled();
    });

    it("denies with user reason", async () => {
      const uiCtx = mockCtx();
      uiCtx.ui.select.mockResolvedValue("❌ Deny (with reason)");
      uiCtx.ui.input.mockResolvedValue("not needed");

      const result = await toolCallHandler(bashEvent("pnpm install"), uiCtx);
      expect(result).toEqual({ block: true, reason: "not needed" });
    });

    it("blocks in non-interactive mode for unlisted bash", async () => {
      const result = await toolCallHandler(bashEvent("pnpm install"), mockCtx({ hasUI: false }));
      expect(result).toEqual({
        block: true,
        reason: expect.stringContaining("requires approval"),
      });
    });
  });

  // ── Always approve persistence (new format) ──────────────────────

  describe("always approve persistence", () => {
    beforeEach(() => initExtension());

    it('persists tool to permissions when "Always approve" selected', async () => {
      const uiCtx = mockCtx();
      uiCtx.ui.select.mockResolvedValue("🔓 Always approve");

      await toolCallHandler(toolEvent("subagent"), uiCtx);

      expect(updateCustomSettings).toHaveBeenCalled();
      const perms = loadToolPermissions() as Record<string, unknown>;
      expect(perms["subagent"]).toBe("allow");
    });

    it('persists bash command basis when "Always approve" selected', async () => {
      const uiCtx = mockCtx();
      uiCtx.ui.select.mockResolvedValue("🔓 Always approve");

      await toolCallHandler(bashEvent("pnpm install"), uiCtx);

      const perms = loadToolPermissions() as Record<string, unknown>;
      const bashPerms = perms["bash"] as Record<string, string>;
      expect(bashPerms["pnpm install"]).toBe("allow");
    });

    it("persists command basis (stripping flags/args)", async () => {
      // Use fresh mock with no bash permissions
      mockSettings = { tools: { bash: {} } };
      vi.clearAllMocks();
      const mock2 = createMockPi();
      createPermissionRequestExtension(mock2.pi);
      const handler = getHandler(mock2.registrations, "tool_call")!;
      expect(handler).toBeDefined();

      const uiCtx = mockCtx();
      uiCtx.ui.select.mockResolvedValue("🔓 Always approve");

      // Approve "pnpm install --save-dev" — basis is "pnpm install"
      await handler(bashEvent("pnpm install --save-dev"), uiCtx);
      expect(updateCustomSettings).toHaveBeenCalled();

      // Verify basis was stored (not the full args)
      const perms = loadToolPermissions() as Record<string, unknown>;
      const bashPerms = perms["bash"] as Record<string, string>;
      expect(bashPerms["pnpm install"]).toBe("allow");
    });
  });

  // ── Session approval ─────────────────────────────────────────────

  describe("session approval", () => {
    beforeEach(() => initExtension());

    it("approves tool for this session only", async () => {
      const uiCtx = mockCtx();
      uiCtx.ui.select.mockResolvedValue("🕐 Approve in this session only");

      await toolCallHandler(toolEvent("subagent"), uiCtx);
      expect(uiCtx.ui.select).toHaveBeenCalledTimes(1);

      // Second call: no prompt needed
      const result = await toolCallHandler(toolEvent("subagent"), mockCtx());
      expect(result).toBeUndefined();
    });

    it("clears session approvals on session_start", async () => {
      const uiCtx = mockCtx();
      uiCtx.ui.select.mockResolvedValue("🕐 Approve in this session only");

      await toolCallHandler(toolEvent("subagent"), uiCtx);

      // Simulate new session
      sessionStartHandler!();

      // Now should prompt again
      const uiCtx2 = mockCtx();
      uiCtx2.ui.select.mockResolvedValue("✅ Allow");
      const result = await toolCallHandler(toolEvent("subagent"), uiCtx2);
      expect(result).toBeUndefined();
      expect(uiCtx2.ui.select).toHaveBeenCalled();
    });

    it("approves compound bash for session", async () => {
      const uiCtx = mockCtx();
      uiCtx.ui.select.mockResolvedValue("🕐 Approve in this session only");

      await toolCallHandler(bashEvent("cd /tmp && pnpm install"), uiCtx);

      // Second call: no prompt
      const result = await toolCallHandler(bashEvent("cd /tmp && pnpm install"), mockCtx());
      expect(result).toBeUndefined();
    });
  });

  // ── Agent permissions (env var) override settings ────────────────

  describe("agent permissions override settings", () => {
    beforeEach(() => {
      setAgentPermissions({
        read: "allow",
        bash: {
          ls: "allow",
          rm: "allow", // agent allows rm even though settings deny it
        },
      });
      initExtension();
    });

    it("allows rm when agent permissions allow it (overrides settings deny)", async () => {
      const result = await toolCallHandler(bashEvent("rm -rf /tmp"), mockCtx());
      expect(result).toBeUndefined();
    });

    it("denies write when agent denies (no settings entry)", async () => {
      setAgentPermissions({ write: "deny" });
      // Re-init to pick up new env
      vi.clearAllMocks();
      const mock2 = createMockPi();
      createPermissionRequestExtension(mock2.pi);
      const handler = getHandler(mock2.registrations, "tool_call")!;

      const result = await handler(toolEvent("write", { path: "/f", content: "x" }), mockCtx());
      expect(result).toEqual({
        block: true,
        reason: expect.stringContaining("denied by agent"),
      });
    });

    it("falls through to settings when agent has no entry for tool", async () => {
      // Agent has no entry for "edit", settings has "edit: allow"
      const result = await toolCallHandler(toolEvent("edit", { path: "/f" }), mockCtx());
      expect(result).toBeUndefined(); // Settings allow wins
    });
  });

  // ── Wildcard matching ────────────────────────────────────────────

  describe("wildcard matching for tools", () => {
    beforeEach(() => {
      mockSettings = {
        tools: {
          read: "allow",
          "mcp_*": "deny",
          "web_*": "allow",
        },
      };
      initExtension();
    });

    it("matches mcp_atlassian_getpage with mcp_* deny", async () => {
      const result = await toolCallHandler(toolEvent("mcp_atlassian_getpage"), mockCtx());
      expect(result).toEqual({
        block: true,
        reason: expect.stringContaining("denied"),
      });
    });

    it("matches web_search with web_* allow", async () => {
      const result = await toolCallHandler(toolEvent("web_search"), mockCtx());
      expect(result).toBeUndefined();
    });

    it("prompts for tool not matching any wildcard", async () => {
      const uiCtx = mockCtx();
      uiCtx.ui.select.mockResolvedValue("✅ Allow");

      const result = await toolCallHandler(toolEvent("bash"), uiCtx);
      expect(result).toBeUndefined();
      expect(uiCtx.ui.select).toHaveBeenCalled();
    });
  });

  // ── Compound bash with mixed permissions ─────────────────────────

  describe("compound bash with mixed permissions", () => {
    beforeEach(() => {
      mockSettings = {
        tools: {
          bash: {
            ls: "allow",
            pnpm: "ask",
            rm: "deny",
          },
        },
      };
      initExtension();
    });

    it("prompts when one segment is ask and none are deny", async () => {
      const uiCtx = mockCtx();
      uiCtx.ui.select.mockResolvedValue("✅ Allow");

      // ls is allow, pnpm is ask → should prompt
      const result = await toolCallHandler(bashEvent("ls && pnpm install"), uiCtx);
      expect(result).toBeUndefined();
      expect(uiCtx.ui.select).toHaveBeenCalled();
    });

    it("denies when one segment is deny regardless of others", async () => {
      // ls is allow, rm is deny → block
      const result = await toolCallHandler(bashEvent("ls && rm -rf /tmp"), mockCtx());
      expect(result).toEqual({
        block: true,
        reason: expect.stringContaining("denied"),
      });
    });
  });
});
