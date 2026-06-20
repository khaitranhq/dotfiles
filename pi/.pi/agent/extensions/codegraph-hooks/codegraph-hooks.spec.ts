/**
 * codegraph-hooks — vitest specs.
 *
 * Verifies the extension runs `codegraph init <cwd>` on session_start
 * (new/resume/fork) only when `.codegraph/` is missing, and
 * `codegraph sync -q <cwd>` on session_shutdown only when it exists.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as childProcess from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import codegraphHooksExtension from "./index.js";
import type {
  ExtensionAPI,
  ExtensionContext,
  SessionShutdownEvent,
  SessionStartEvent,
} from "@earendil-works/pi-coding-agent";

vi.mock("node:child_process", async () => {
  const actual = await vi.importActual<typeof import("node:child_process")>("node:child_process");
  return { ...actual, execFile: vi.fn() };
});

// ── Harness ─────────────────────────────────────────────────────────────

function createHarness() {
  const events = new Map<string, (event: unknown, ctx: unknown) => Promise<unknown> | unknown>();
  const pi = {
    on(eventName: string, handler: (event: unknown, ctx: unknown) => Promise<unknown> | unknown) {
      events.set(eventName, handler);
    },
  } as unknown as ExtensionAPI;
  codegraphHooksExtension(pi);
  return events;
}

function makeCtx(cwd: string): ExtensionContext {
  return {
    cwd,
    ui: { notify() {} } as never,
    hasUI: true,
    sessionManager: {} as never,
    modelRegistry: {} as never,
    model: undefined,
    isIdle: () => true,
    signal: undefined,
    abort: () => {},
    hasPendingMessages: () => false,
    shutdown: () => {},
    getContextUsage: () => undefined,
    compact: () => {},
    getSystemPrompt: () => "",
  } as ExtensionContext;
}

const startEvent = (reason: SessionStartEvent["reason"]): SessionStartEvent => ({
  type: "session_start",
  reason,
});
const shutdownEvent = (reason: SessionShutdownEvent["reason"]): SessionShutdownEvent => ({
  type: "session_shutdown",
  reason,
});

const execFile = vi.mocked(childProcess.execFile);

// ── Setup ───────────────────────────────────────────────────────────────

let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "codegraph-hooks-test-"));
  execFile.mockReset();
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

// ── session_start ───────────────────────────────────────────────────────

describe("session_start hook", () => {
  it("runs codegraph init when cwd uninitialised and reason=new", () => {
    const events = createHarness();
    events.get("session_start")!(startEvent("new"), makeCtx(tempDir));
    expect(execFile).toHaveBeenCalledWith(
      "codegraph",
      ["init", tempDir],
      expect.any(Object),
      expect.any(Function),
    );
  });

  it("skips init when .codegraph/ already exists", () => {
    fs.mkdirSync(path.join(tempDir, ".codegraph"));
    const events = createHarness();
    events.get("session_start")!(startEvent("new"), makeCtx(tempDir));
    expect(execFile).not.toHaveBeenCalled();
  });

  it("skips init on startup reason (avoid re-init on reload)", () => {
    const events = createHarness();
    events.get("session_start")!(startEvent("startup"), makeCtx(tempDir));
    expect(execFile).not.toHaveBeenCalled();
  });

  it("skips init on reload reason", () => {
    const events = createHarness();
    events.get("session_start")!(startEvent("reload"), makeCtx(tempDir));
    expect(execFile).not.toHaveBeenCalled();
  });

  it.each<SessionStartEvent["reason"]>(["new", "resume", "fork"])(
    "runs init on reason=%s",
    (reason) => {
      const events = createHarness();
      events.get("session_start")!(startEvent(reason), makeCtx(tempDir));
      expect(execFile).toHaveBeenCalledOnce();
    },
  );
});

// ── session_shutdown ────────────────────────────────────────────────────

describe("session_shutdown hook", () => {
  it("runs codegraph sync -q when .codegraph/ exists", () => {
    fs.mkdirSync(path.join(tempDir, ".codegraph"));
    const events = createHarness();
    events.get("session_shutdown")!(shutdownEvent("quit"), makeCtx(tempDir));
    expect(execFile).toHaveBeenCalledWith(
      "codegraph",
      ["sync", "-q", tempDir],
      expect.any(Object),
      expect.any(Function),
    );
  });

  it("skips sync when .codegraph/ is missing", () => {
    const events = createHarness();
    events.get("session_shutdown")!(shutdownEvent("quit"), makeCtx(tempDir));
    expect(execFile).not.toHaveBeenCalled();
  });

  it.each<SessionShutdownEvent["reason"]>(["quit", "reload", "new", "resume", "fork"])(
    "runs sync on reason=%s",
    (reason) => {
      fs.mkdirSync(path.join(tempDir, ".codegraph"));
      const events = createHarness();
      events.get("session_shutdown")!(shutdownEvent(reason), makeCtx(tempDir));
      expect(execFile).toHaveBeenCalledOnce();
    },
  );
});

// ── Default extension wiring ───────────────────────────────────────────

describe("default extension wiring", () => {
  it("registers handlers for both events", () => {
    const events = createHarness();
    expect(events.has("session_start")).toBe(true);
    expect(events.has("session_shutdown")).toBe(true);
    expect(events.size).toBe(2);
  });
});
