import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ExtensionAPI, ToolCallEvent } from "@earendil-works/pi-coding-agent";
import createPermissionRequestExtension from "./index";

// ── Mock config module ────────────────────────────────────────────────

let mockSettings: Record<string, unknown> = {};

vi.mock("../shared/config", () => ({
  loadAlwaysApprove: vi.fn(() => mockSettings.always_approve ?? {}),
  updateCustomSettings: vi.fn(
    (updater: (s: Record<string, unknown>) => Record<string, unknown>) => {
      mockSettings = updater(mockSettings);
    },
  ),
}));

import { loadAlwaysApprove, updateCustomSettings } from "../shared/config";

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

// ── Tests ─────────────────────────────────────────────────────────────

describe("permission-request extension", () => {
  let mock: ReturnType<typeof createMockPi>;
  let toolCallHandler: (...args: any[]) => any;
  let sessionStartHandler: (() => void) | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSettings = {
      always_approve: {
        tools: ["read", "write", "edit"],
        bashCommands: ["cd", "ls", "grep", "cat", "git diff", "git log", "go test"],
      },
    };
    mock = createMockPi();
  });

  function initExtension() {
    createPermissionRequestExtension(mock.pi);
    toolCallHandler = getHandler(mock.registrations, "tool_call")!;
    sessionStartHandler = getHandler(mock.registrations, "session_start");
    expect(toolCallHandler).toBeDefined();
  }

  // ── Always-approved simple commands ──────────────────────────────

  describe("always-approved simple bash commands", () => {
    beforeEach(() => initExtension());

    it("allows simple command whose base is in always_approve", async () => {
      const result = await toolCallHandler(bashEvent("ls -la"), mockCtx());
      expect(result).toBeUndefined();
    });

    it("allows simple command with env assignments", async () => {
      const result = await toolCallHandler(
        bashEvent("FOO=bar cd /tmp"),
        mockCtx(),
      );
      expect(result).toBeUndefined();
    });

    it("allows multi-word always-approved subcommand", async () => {
      const result = await toolCallHandler(
        bashEvent("git diff --cached"),
        mockCtx(),
      );
      expect(result).toBeUndefined();
    });

    it("allows multi-word approved subcommand without extra flags", async () => {
      const result = await toolCallHandler(
        bashEvent("git log"),
        mockCtx(),
      );
      expect(result).toBeUndefined();
    });

    it("prompts for different subcommand of same base", async () => {
      const uiCtx = mockCtx();
      uiCtx.ui.select.mockResolvedValue("✅ Allow");

      // git push is NOT in always_approve, only git diff / git log
      const result = await toolCallHandler(
        bashEvent("git push origin main"),
        uiCtx,
      );
      expect(result).toBeUndefined();
      expect(uiCtx.ui.select).toHaveBeenCalled();
    });
  });

  // ── Compound commands: all approved ──────────────────────────────

  describe("compound commands — all segments approved", () => {
    beforeEach(() => initExtension());

    it("allows compound command when all bases are always-approved", async () => {
      const result = await toolCallHandler(
        bashEvent("cd /tmp && ls -la"),
        mockCtx(),
      );
      expect(result).toBeUndefined();
    });

    it("allows pipe chain with all-approved bases", async () => {
      const result = await toolCallHandler(
        bashEvent("cat file | grep foo"),
        mockCtx(),
      );
      expect(result).toBeUndefined();
    });

    it("allows semicolon chain with all-approved bases", async () => {
      const result = await toolCallHandler(
        bashEvent("cd /tmp; ls -la; cat file.txt"),
        mockCtx(),
      );
      expect(result).toBeUndefined();
    });

    it("allows compound command with multi-word subcommand segments", async () => {
      const result = await toolCallHandler(
        bashEvent("git diff --cached && go test ./..."),
        mockCtx(),
      );
      expect(result).toBeUndefined();
    });
  });

  // ── Compound commands: some not approved ─────────────────────────

  describe("compound commands — some segments not approved", () => {
    beforeEach(() => initExtension());

    it("requires approval when second command is not always-approved", async () => {
      const uiCtx = mockCtx();
      uiCtx.ui.select.mockResolvedValue("✅ Allow");

      const result = await toolCallHandler(
        bashEvent("cd /tmp && pnpm install"),
        uiCtx,
      );
      expect(result).toBeUndefined(); // allowed after user approval
      expect(uiCtx.ui.select).toHaveBeenCalled();
    });

    it("requires approval when first command is not always-approved", async () => {
      const uiCtx = mockCtx();
      uiCtx.ui.select.mockResolvedValue("✅ Allow");

      const result = await toolCallHandler(
        bashEvent("pnpm install && ls -la"),
        uiCtx,
      );
      expect(result).toBeUndefined();
      expect(uiCtx.ui.select).toHaveBeenCalled();
    });

    it("requires approval for completely unapproved chains", async () => {
      const uiCtx = mockCtx();
      uiCtx.ui.select.mockResolvedValue("✅ Allow");

      const result = await toolCallHandler(
        bashEvent("pnpm install && npm test"),
        uiCtx,
      );
      expect(result).toBeUndefined();
      expect(uiCtx.ui.select).toHaveBeenCalled();
    });

    it("blocks when user denies the approval", async () => {
      const uiCtx = mockCtx();
      uiCtx.ui.select.mockResolvedValue("❌ Deny (with reason)");
      uiCtx.ui.input.mockResolvedValue("not needed");

      const result = await toolCallHandler(
        bashEvent("cd /tmp && pnpm install"),
        uiCtx,
      );
      expect(result).toEqual({
        block: true,
        reason: "not needed",
      });
    });

    it("blocks in non-interactive mode", async () => {
      const result = await toolCallHandler(
        bashEvent("cd /tmp && pnpm install"),
        mockCtx({ hasUI: false }),
      );
      expect(result).toEqual({
        block: true,
        reason: expect.stringContaining("requires approval"),
      });
    });
  });

  // ── Always approve persistence ───────────────────────────────────

  describe("always approve persistence for compound commands", () => {
    beforeEach(() => initExtension());

    it('adds full segment texts to always_approve when "Always approve" is selected', async () => {
      const uiCtx = mockCtx();
      uiCtx.ui.select.mockResolvedValue("🔓 Always approve");

      await toolCallHandler(bashEvent("cd /tmp && pnpm install"), uiCtx);

      // Full segment texts should now be in always_approve
      const aa = loadAlwaysApprove();
      expect(aa.bashCommands).toContain("cd /tmp");
      expect(aa.bashCommands).toContain("pnpm install");
    });

    it('persists to disk via updateCustomSettings for compound commands', async () => {
      const uiCtx = mockCtx();
      uiCtx.ui.select.mockResolvedValue("🔓 Always approve");

      await toolCallHandler(bashEvent("cd /tmp && pnpm install"), uiCtx);

      expect(updateCustomSettings).toHaveBeenCalled();
      // After persistence, the compound command should pass without prompt
      vi.clearAllMocks();

      const result = await toolCallHandler(
        bashEvent("cd /tmp && pnpm install"),
        mockCtx(),
      );
      expect(result).toBeUndefined();
    });

    it('persists subcommand as full segment text', async () => {
      const uiCtx = mockCtx();
      uiCtx.ui.select.mockResolvedValue("🔓 Always approve");

      await toolCallHandler(bashEvent("git push origin main"), uiCtx);

      const aa = loadAlwaysApprove();
      expect(aa.bashCommands).toContain("git push origin main");
    });
  });

  // ── Session-only approval for compound commands ──────────────────

  describe("session-only approval for compound commands", () => {
    beforeEach(() => initExtension());

    it('adds all base commands to session approvals when "Approve in this session" is selected', async () => {
      const uiCtx = mockCtx();
      uiCtx.ui.select.mockResolvedValue("🕐 Approve in this session only");

      // First call: pnpm not approved → needs approval
      await toolCallHandler(bashEvent("cd /tmp && pnpm install"), uiCtx);
      expect(uiCtx.ui.select).toHaveBeenCalledTimes(1);

      // Second call: same chain should now pass without prompt
      vi.clearAllMocks();
      const result = await toolCallHandler(
        bashEvent("cd /tmp && pnpm install"),
        mockCtx(),
      );
      expect(result).toBeUndefined();
    });

    it("clears session approvals on session_start", async () => {
      const uiCtx = mockCtx();
      uiCtx.ui.select.mockResolvedValue("🕐 Approve in this session only");

      // Approve for this session
      await toolCallHandler(bashEvent("cd /tmp && pnpm install"), uiCtx);

      // Simulate new session
      sessionStartHandler!();

      // Now it should require approval again
      vi.clearAllMocks();
      uiCtx.ui.select.mockResolvedValue("✅ Allow");
      const result = await toolCallHandler(
        bashEvent("cd /tmp && pnpm install"),
        uiCtx,
      );
      expect(result).toBeUndefined();
      expect(uiCtx.ui.select).toHaveBeenCalled();
    });
  });

  // ── Session approval: compound with partial pre-approval ─────────

  describe("session approval with partial pre-approval", () => {
    beforeEach(() => initExtension());

    it("requires approval when only some bases are session-approved", async () => {
      const uiCtx = mockCtx();
      uiCtx.ui.select
        .mockResolvedValueOnce("🕐 Approve in this session only") // first: approve cd only
        .mockResolvedValueOnce("✅ Allow"); // second: allow

      // Approve a simple "cd" command for the session
      await toolCallHandler(bashEvent("cd /tmp"), uiCtx);

      // Now cd is session-approved but pnpm is not
      // cd && pnpm should still require approval
      const uiCtx2 = mockCtx();
      uiCtx2.ui.select.mockResolvedValue("✅ Allow");

      const result = await toolCallHandler(
        bashEvent("cd /tmp && pnpm install"),
        uiCtx2,
      );
      // The handler should prompt because pnpm is not approved
      expect(uiCtx2.ui.select).toHaveBeenCalled();
      expect(result).toBeUndefined();
    });
  });

  // ── Non-bash tools ───────────────────────────────────────────────

  describe("non-bash tools", () => {
    beforeEach(() => initExtension());

    it("allows always-approved tools without prompt", async () => {
      const result = await toolCallHandler(
        readEvent("/home/user/file.txt"),
        mockCtx(),
      );
      expect(result).toBeUndefined();
    });

    it("prompts for non-always-approved tools", async () => {
      // subagent tool is not in our mock always_approve tools
      const event: ToolCallEvent = {
        type: "tool_call",
        toolCallId: "call-99",
        toolName: "subagent" as any,
        input: { agent: "test", task: "do something" },
      } as ToolCallEvent;

      const uiCtx = mockCtx();
      uiCtx.ui.select.mockResolvedValue("✅ Allow");

      const result = await toolCallHandler(event, uiCtx);
      expect(result).toBeUndefined();
      expect(uiCtx.ui.select).toHaveBeenCalled();
    });
  });
});
