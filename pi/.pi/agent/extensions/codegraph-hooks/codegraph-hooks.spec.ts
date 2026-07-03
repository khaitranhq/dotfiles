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

function makeCtx(cwd: string, notify = vi.fn()): ExtensionContext {
  return {
    cwd,
    ui: { notify } as never,
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
    const notify = vi.fn();
    events.get("session_start")!(startEvent("new"), makeCtx(tempDir, notify));
    expect(execFile).toHaveBeenCalledWith(
      "codegraph",
      ["init", tempDir],
      expect.any(Object),
      expect.any(Function),
    );
    expect(notify).toHaveBeenCalledWith("Codegraph initializing…", "info");
  });

  it("skips init when .codegraph/ already exists", () => {
    fs.mkdirSync(path.join(tempDir, ".codegraph"));
    const events = createHarness();
    const notify = vi.fn();
    events.get("session_start")!(startEvent("new"), makeCtx(tempDir, notify));
    expect(execFile).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it("skips init on startup reason (avoid re-init on reload)", () => {
    const events = createHarness();
    const notify = vi.fn();
    events.get("session_start")!(startEvent("startup"), makeCtx(tempDir, notify));
    expect(execFile).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it("skips init on reload reason", () => {
    const events = createHarness();
    const notify = vi.fn();
    events.get("session_start")!(startEvent("reload"), makeCtx(tempDir, notify));
    expect(execFile).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it.each<SessionStartEvent["reason"]>(["new", "resume", "fork"])(
    "runs init on reason=%s",
    (reason) => {
      const events = createHarness();
      const notify = vi.fn();
      events.get("session_start")!(startEvent(reason), makeCtx(tempDir, notify));
      expect(execFile).toHaveBeenCalledOnce();
      expect(notify).toHaveBeenCalledWith("Codegraph initializing…", "info");
    },
  );
});

// ── session_shutdown ────────────────────────────────────────────────────

describe("session_shutdown hook", () => {
  it("runs codegraph sync -q when .codegraph/ exists", () => {
    fs.mkdirSync(path.join(tempDir, ".codegraph"));
    const events = createHarness();
    const notify = vi.fn();
    events.get("session_shutdown")!(shutdownEvent("quit"), makeCtx(tempDir, notify));
    expect(execFile).toHaveBeenCalledWith(
      "codegraph",
      ["sync", "-q", tempDir],
      expect.any(Object),
      expect.any(Function),
    );
    expect(notify).toHaveBeenCalledWith("Codegraph syncing…", "info");
  });

  it("skips sync when .codegraph/ is missing", () => {
    const events = createHarness();
    const notify = vi.fn();
    events.get("session_shutdown")!(shutdownEvent("quit"), makeCtx(tempDir, notify));
    expect(execFile).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it.each<SessionShutdownEvent["reason"]>(["quit", "reload", "new", "resume", "fork"])(
    "runs sync on reason=%s",
    (reason) => {
      fs.mkdirSync(path.join(tempDir, ".codegraph"));
      const events = createHarness();
      const notify = vi.fn();
      events.get("session_shutdown")!(shutdownEvent(reason), makeCtx(tempDir, notify));
      expect(execFile).toHaveBeenCalledOnce();
      expect(notify).toHaveBeenCalledWith("Codegraph syncing…", "info");
    },
  );
});

// ── Default extension wiring ───────────────────────────────────────────

describe("completion/error notify", () => {
  it("notifies completion on successful init", () => {
    const events = createHarness();
    const notify = vi.fn();
    execFile.mockImplementation((_bin, _args, _opts, cb: any) => cb(null));
    events.get("session_start")!(startEvent("new"), makeCtx(tempDir, notify));
    expect(notify).toHaveBeenCalledWith("Codegraph initializing…", "info");
    expect(notify).toHaveBeenCalledWith("Codegraph init complete", "info");
  });

  it("notifies error on failed init", () => {
    const events = createHarness();
    const notify = vi.fn();
    execFile.mockImplementation((_bin, _args, _opts, cb: any) => cb(new Error("not found")));
    events.get("session_start")!(startEvent("new"), makeCtx(tempDir, notify));
    expect(notify).toHaveBeenCalledWith("Codegraph initializing…", "info");
    expect(notify).toHaveBeenCalledWith("Codegraph init failed: not found", "error");
  });

  it("notifies completion on successful sync", () => {
    fs.mkdirSync(path.join(tempDir, ".codegraph"));
    const events = createHarness();
    const notify = vi.fn();
    execFile.mockImplementation((_bin, _args, _opts, cb: any) => cb(null));
    events.get("session_shutdown")!(shutdownEvent("quit"), makeCtx(tempDir, notify));
    expect(notify).toHaveBeenCalledWith("Codegraph syncing…", "info");
    expect(notify).toHaveBeenCalledWith("Codegraph sync complete", "info");
  });

  it("notifies error on failed sync", () => {
    fs.mkdirSync(path.join(tempDir, ".codegraph"));
    const events = createHarness();
    const notify = vi.fn();
    execFile.mockImplementation((_bin, _args, _opts, cb: any) => cb(new Error("timeout")));
    events.get("session_shutdown")!(shutdownEvent("quit"), makeCtx(tempDir, notify));
    expect(notify).toHaveBeenCalledWith("Codegraph syncing…", "info");
    expect(notify).toHaveBeenCalledWith("Codegraph sync failed: timeout", "error");
  });

  it("does not choke when notify is a no-op (no-UI mode)", () => {
    const events = createHarness();
    const noUiCtx: ExtensionContext = {
      cwd: tempDir,
      ui: { notify() {} } as never,
      hasUI: false,
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
    expect(() => events.get("session_start")!(startEvent("new"), noUiCtx)).not.toThrow();
  });
});

describe("default extension wiring", () => {
  it("registers handlers for both events", () => {
    const events = createHarness();
    expect(events.has("session_start")).toBe(true);
    expect(events.has("session_shutdown")).toBe(true);
    expect(events.size).toBe(2);
  });
});
