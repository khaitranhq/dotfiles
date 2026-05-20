import { describe, it, expect, vi, beforeEach } from "vitest";
import * as path from "node:path";
import type { ExtensionAPI, ToolCallEvent } from "@earendil-works/pi-coding-agent";
import createDefenderExtension from "./index";

// ── Helpers ───────────────────────────────────────────────────────────

const HOME_DIR = process.env.HOME || "/home/" + (process.env.USER || "user");

interface HandlerRegistration {
  event: string;
  handler: (...args: any[]) => any;
}

function createMockPi(): {
  pi: ExtensionAPI;
  registrations: HandlerRegistration[];
  sentMessages: Array<{ content: string; options?: Record<string, unknown> }>;
} {
  const registrations: HandlerRegistration[] = [];
  const sentMessages: Array<{ content: string; options?: Record<string, unknown> }> = [];

  const pi = {
    on: vi.fn((event: string, handler: (...args: any[]) => any) => {
      registrations.push({ event, handler });
    }),
    sendUserMessage: vi.fn((content: string, options?: Record<string, unknown>) => {
      sentMessages.push({ content, options });
      return Promise.resolve();
    }),
    registerTool: vi.fn(),
    registerCommand: vi.fn(),
    registerShortcut: vi.fn(),
    registerFlag: vi.fn(),
    getFlag: vi.fn(),
    registerMessageRenderer: vi.fn(),
    sendMessage: vi.fn(),
  } as unknown as ExtensionAPI;

  return { pi, registrations, sentMessages };
}

function getHandler(
  registrations: HandlerRegistration[],
  event: string,
): ((...args: any[]) => any) | undefined {
  return registrations.find((r) => r.event === event)?.handler;
}

function mockCtx(
  overrides: {
    hasUI?: boolean;
    cwd?: string;
  } = {},
) {
  return {
    hasUI: overrides.hasUI ?? true,
    cwd: overrides.cwd ?? HOME_DIR,
    ui: {
      notify: vi.fn(),
      select: vi.fn(),
      input: vi.fn(),
    },
    sessionManager: {} as any,
    modelRegistry: {} as any,
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

function writeEvent(filePath: string): ToolCallEvent {
  return {
    type: "tool_call",
    toolCallId: "call-3",
    toolName: "write",
    input: { path: filePath, content: "test" },
  } as ToolCallEvent;
}

function editEvent(filePath: string): ToolCallEvent {
  return {
    type: "tool_call",
    toolCallId: "call-4",
    toolName: "edit",
    input: { path: filePath, edits: [] },
  } as ToolCallEvent;
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("defender extension", () => {
  let mock: ReturnType<typeof createMockPi>;
  let toolCallHandler: (...args: any[]) => any;
  let turnEndHandler: (() => void) | undefined;

  beforeEach(() => {
    mock = createMockPi();
    createDefenderExtension(mock.pi);

    toolCallHandler = getHandler(mock.registrations, "tool_call")!;
    turnEndHandler = getHandler(mock.registrations, "turn_end");
    expect(toolCallHandler).toBeDefined();
    expect(turnEndHandler).toBeDefined();
  });

  // ── Bash ───────────────────────────────────────────────────────────

  describe("bash tool", () => {
    it("allows safe bash commands", async () => {
      const result = await toolCallHandler(bashEvent("ls -la"), mockCtx());
      expect(result).toBeUndefined();
    });

    it("blocks sudo command", async () => {
      const result = await toolCallHandler(bashEvent("sudo ls"), mockCtx());
      expect(result).toEqual({
        block: true,
        reason: expect.stringContaining("Dangerous command"),
      });
    });

    it("blocks rm outside HOME", async () => {
      const result = await toolCallHandler(bashEvent("rm /etc/hosts"), mockCtx());
      expect(result).toEqual({
        block: true,
        reason: expect.stringContaining("rm blocked"),
      });
    });

    it("blocks fork bomb", async () => {
      const result = await toolCallHandler(bashEvent(":(){ :|:& };:"), mockCtx());
      expect(result).toEqual({
        block: true,
        reason: expect.stringContaining("Dangerous command"),
      });
    });

    it("sends steering instruction only once per turn", async () => {
      await toolCallHandler(bashEvent("sudo rm /etc/hosts"), mockCtx());
      expect(mock.sentMessages).toHaveLength(1);
      expect(mock.sentMessages[0].options).toEqual({ deliverAs: "steer" });

      await toolCallHandler(bashEvent("sudo rm /etc/passwd"), mockCtx());
      expect(mock.sentMessages).toHaveLength(1);
    });

    it("resets blockedThisTurn on turn_end", async () => {
      await toolCallHandler(bashEvent("sudo rm /etc/hosts"), mockCtx());
      expect(mock.sentMessages).toHaveLength(1);

      await turnEndHandler!();

      await toolCallHandler(bashEvent("sudo rm /etc/passwd"), mockCtx());
      expect(mock.sentMessages).toHaveLength(2);
    });

    it("notifies via UI when hasUI is true", async () => {
      const ctx = mockCtx({ hasUI: true });
      await toolCallHandler(bashEvent("sudo rm /etc/hosts"), ctx);
      expect(ctx.ui.notify).toHaveBeenCalledWith(expect.stringContaining("Blocked"), "warning");
    });

    it("does not call ui.notify when hasUI is false", async () => {
      const ctx = mockCtx({ hasUI: false });
      await toolCallHandler(bashEvent("sudo rm /etc/hosts"), ctx);
      expect(ctx.ui.notify).not.toHaveBeenCalled();
    });
  });

  // ── Read ────────────────────────────────────────────────────────────

  describe("read tool", () => {
    it("allows reading files inside HOME_DIR", async () => {
      const result = await toolCallHandler(
        readEvent(path.join(HOME_DIR, "project", "file.ts")),
        mockCtx(),
      );
      expect(result).toBeUndefined();
    });

    it("blocks reading files outside HOME_DIR", async () => {
      const result = await toolCallHandler(readEvent("/etc/passwd"), mockCtx());
      expect(result).toEqual({
        block: true,
        reason: expect.stringContaining("blocked"),
      });
    });

    it("blocks reading .env files", async () => {
      const result = await toolCallHandler(readEvent(path.join(HOME_DIR, ".env")), mockCtx());
      expect(result).toEqual({
        block: true,
        reason: expect.stringContaining("env file"),
      });
    });

    it("blocks reading .env.local", async () => {
      const result = await toolCallHandler(readEvent(path.join(HOME_DIR, ".env.local")), mockCtx());
      expect(result).toEqual({
        block: true,
        reason: expect.stringContaining("env file"),
      });
    });

    it("notifies via UI on blocked read", async () => {
      const ctx = mockCtx({ hasUI: true });
      await toolCallHandler(readEvent("/etc/passwd"), ctx);
      expect(ctx.ui.notify).toHaveBeenCalled();
    });
  });

  // ── Write ───────────────────────────────────────────────────────────

  describe("write tool", () => {
    it("allows writing files inside HOME_DIR", async () => {
      const result = await toolCallHandler(
        writeEvent(path.join(HOME_DIR, "output.txt")),
        mockCtx(),
      );
      expect(result).toBeUndefined();
    });

    it("blocks writing files outside HOME_DIR", async () => {
      const result = await toolCallHandler(writeEvent("/etc/config"), mockCtx());
      expect(result).toEqual({
        block: true,
        reason: expect.stringContaining("blocked"),
      });
    });

    it("blocks writing .env files", async () => {
      const result = await toolCallHandler(writeEvent(path.join(HOME_DIR, ".env")), mockCtx());
      expect(result).toEqual({
        block: true,
        reason: expect.stringContaining("env file"),
      });
    });
  });

  // ── Edit ────────────────────────────────────────────────────────────

  describe("edit tool", () => {
    it("allows editing files inside HOME_DIR", async () => {
      const result = await toolCallHandler(editEvent(path.join(HOME_DIR, "file.ts")), mockCtx());
      expect(result).toBeUndefined();
    });

    it("blocks editing files outside HOME_DIR", async () => {
      const result = await toolCallHandler(editEvent("/etc/nginx/nginx.conf"), mockCtx());
      expect(result).toEqual({
        block: true,
        reason: expect.stringContaining("blocked"),
      });
    });

    it("blocks editing .env files", async () => {
      const result = await toolCallHandler(
        editEvent(path.join(HOME_DIR, "project", ".env.production")),
        mockCtx(),
      );
      expect(result).toEqual({
        block: true,
        reason: expect.stringContaining("env file"),
      });
    });
  });

  // ── Unknown tools ───────────────────────────────────────────────────

  describe("unknown tools", () => {
    it("passes through unhandled tool names", async () => {
      const event: ToolCallEvent = {
        type: "tool_call",
        toolCallId: "call-99",
        toolName: "grep" as any,
        input: { pattern: "foo" },
      } as ToolCallEvent;
      const result = await toolCallHandler(event, mockCtx());
      expect(result).toBeUndefined();
    });
  });
});
