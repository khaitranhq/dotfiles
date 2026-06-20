/**
 * Ponytail extension — vitest specs.
 *
 * Mirrors the upstream node:test suite from the original ponytail repo:
 *   - extension registration and command dispatch
 *   - session_start restores the latest persisted mode
 *   - skill aliases send /skill: messages
 *   - /ponytail off disables the prompt injection
 *   - "normal mode" mention inside a sentence does NOT deactivate
 *   - parser: bare invocation falls back to full when default is off
 *   - parser: parses modes, status, and `default <mode>` subcommand
 *   - resolveSessionMode picks the most recent ponytail-mode entry
 *   - readDefaultMode / writeDefaultMode use the XDG config path
 *   - filterSkillBodyForMode keeps only the requested intensity rows
 *   - filterSkillBodyForMode keeps rule bullets that contain a colon
 *
 * The fixture SKILL.md (./fixtures/ponytail-skill.md) gives the filter test
 * a stable body independent of the live ~/.agents/skills/ponytail/SKILL.md.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import ponytailExtension, {
  filterSkillBodyForMode,
  parsePonytailCommand,
  readDefaultMode,
  resolveSessionMode,
  writeDefaultMode,
} from "./index.js";
import { _resetSkillPathCache } from "./ponytail-instructions.js";

// ── Pi harness ─────────────────────────────────────────────────────────

interface PiHarness {
  pi: ReturnType<typeof createHarness>["pi"];
  commands: Map<string, { handler: (args: string, ctx: unknown) => Promise<void> }>;
  events: Map<string, (event: unknown, ctx: unknown) => Promise<unknown> | unknown>;
  appendedEntries: Array<{ customType: string; data: unknown }>;
  sentUserMessages: Array<{ text: string; options?: { deliverAs?: "followUp" | "steer" } }>;
  registeredCommands: string[];
}

function createHarness(): PiHarness {
  const events = new Map<string, (event: unknown, ctx: unknown) => Promise<unknown> | unknown>();
  const commands = new Map<string, { handler: (args: string, ctx: unknown) => Promise<void> }>();
  const appendedEntries: Array<{ customType: string; data: unknown }> = [];
  const sentUserMessages: Array<{
    text: string;
    options?: { deliverAs?: "followUp" | "steer" };
  }> = [];
  const registeredCommands: string[] = [];

  const pi = {
    on(eventName: string, handler: (event: unknown, ctx: unknown) => Promise<unknown> | unknown) {
      events.set(eventName, handler);
    },
    registerCommand(
      name: string,
      options: { handler: (args: string, ctx: unknown) => Promise<void> },
    ) {
      registeredCommands.push(name);
      commands.set(name, options);
    },
    appendEntry(customType: string, data: unknown) {
      appendedEntries.push({ customType, data });
    },
    sendUserMessage(text: string, options?: { deliverAs?: "followUp" | "steer" }) {
      sentUserMessages.push({ text, options });
    },
  };

  ponytailExtension(pi as never);
  return {
    pi: pi as never,
    commands,
    events,
    appendedEntries,
    sentUserMessages,
    registeredCommands,
  };
}

interface CommandContextOverrides {
  isIdle?: () => boolean;
  sessionManager?: {
    getBranch?: () => unknown[];
    getEntries?: () => unknown[];
  };
  ui?: { notify?: (msg: string, level: string) => void };
}

function createCommandContext(overrides: CommandContextOverrides = {}) {
  return {
    isIdle: overrides.isIdle ?? (() => true),
    sessionManager: overrides.sessionManager ?? { getEntries: () => [], getBranch: () => [] },
    ui: overrides.ui ?? { notify() {} },
    hasUI: true,
    cwd: "/tmp",
    modelRegistry: {} as never,
    model: undefined,
    signal: undefined,
    abort: () => {},
    hasPendingMessages: () => false,
    shutdown: () => {},
    getContextUsage: () => undefined,
    compact: () => {},
    getSystemPrompt: () => "",
  };
}

async function withTempConfig<T>(fn: () => Promise<T>): Promise<T> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ponytail-test-"));
  const previousXdg = process.env.XDG_CONFIG_HOME;
  const previousDefault = process.env.PONYTAIL_DEFAULT_MODE;
  const previousSkillPath = process.env.PONYTAIL_SKILL_PATH;
  process.env.XDG_CONFIG_HOME = tempDir;
  delete process.env.PONYTAIL_DEFAULT_MODE;
  process.env.PONYTAIL_SKILL_PATH = path.join(
    path.dirname(new URL(import.meta.url).pathname),
    "fixtures",
    "ponytail-skill.md",
  );
  _resetSkillPathCache();
  try {
    return await fn();
  } finally {
    if (previousXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = previousXdg;
    if (previousDefault === undefined) delete process.env.PONYTAIL_DEFAULT_MODE;
    else process.env.PONYTAIL_DEFAULT_MODE = previousDefault;
    if (previousSkillPath === undefined) delete process.env.PONYTAIL_SKILL_PATH;
    else process.env.PONYTAIL_SKILL_PATH = previousSkillPath;
    _resetSkillPathCache();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("extension registration", () => {
  it("registers ponytail and skill-alias commands", () => {
    const { registeredCommands } = createHarness();
    expect([...registeredCommands].sort()).toEqual([
      "ponytail",
      "ponytail-audit",
      "ponytail-debt",
      "ponytail-gain",
      "ponytail-help",
      "ponytail-review",
    ]);
  });
});

describe("/ponytail handler", () => {
  it("updates session mode and injects instructions on before_agent_start", async () => {
    await withTempConfig(async () => {
      const { events, commands, appendedEntries } = createHarness();
      const ctx = createCommandContext();

      await events.get("session_start")!({ reason: "startup" }, ctx);
      await commands.get("ponytail")!.handler("ultra", ctx);

      expect(appendedEntries.at(-1)).toEqual({
        customType: "ponytail-mode",
        data: { mode: "ultra" },
      });

      const result = (await events.get("before_agent_start")!({ systemPrompt: "BASE" }, ctx)) as {
        systemPrompt: string;
      };
      expect(result.systemPrompt).toContain("PONYTAIL MODE ACTIVE");
      expect(result.systemPrompt).toContain("ultra");
    });
  });

  it("session_start restores the latest persisted mode from the branch", async () => {
    await withTempConfig(async () => {
      const { events } = createHarness();
      const ctx = createCommandContext({
        sessionManager: {
          getBranch: () => [
            {
              type: "custom",
              customType: "ponytail-mode",
              data: { mode: "lite" },
            },
          ],
          getEntries: () => [],
        },
      });

      await events.get("session_start")!({ reason: "resume" }, ctx);
      const result = (await events.get("before_agent_start")!({ systemPrompt: "BASE" }, ctx)) as {
        systemPrompt: string;
      };
      expect(result.systemPrompt).toContain("lite");
    });
  });

  it("skill-alias commands send /skill: messages to pi", async () => {
    const { commands, sentUserMessages } = createHarness();
    const ctx = createCommandContext();

    await commands.get("ponytail-review")!.handler("", ctx);
    await commands.get("ponytail-audit")!.handler("", ctx);
    await commands.get("ponytail-debt")!.handler("", ctx);
    await commands.get("ponytail-gain")!.handler("", ctx);
    await commands.get("ponytail-help")!.handler("", ctx);

    expect(sentUserMessages.map((m) => m.text)).toEqual([
      "/skill:ponytail-review",
      "/skill:ponytail-audit",
      "/skill:ponytail-debt",
      "/skill:ponytail-gain",
      "/skill:ponytail-help",
    ]);
  });

  it("'normal mode' disables persistent instructions via the input event", async () => {
    await withTempConfig(async () => {
      const { commands, events, appendedEntries } = createHarness();
      const ctx = createCommandContext();

      await events.get("session_start")!({ reason: "startup" }, ctx);
      await commands.get("ponytail")!.handler("ultra", ctx);
      await events.get("input")!({ text: "normal mode", source: "interactive" }, ctx);

      expect(appendedEntries.at(-1)).toEqual({
        customType: "ponytail-mode",
        data: { mode: "off" },
      });

      const disabled = await events.get("before_agent_start")!({ systemPrompt: "BASE" }, ctx);
      expect(disabled).toBeUndefined();
    });
  });

  it("a request mentioning normal mode stays active", async () => {
    await withTempConfig(async () => {
      const { commands, events } = createHarness();
      const ctx = createCommandContext();

      await events.get("session_start")!({ reason: "startup" }, ctx);
      await commands.get("ponytail")!.handler("ultra", ctx);
      await events.get("input")!(
        { text: "add a normal mode toggle next to dark mode", source: "interactive" },
        ctx,
      );

      const result = (await events.get("before_agent_start")!({ systemPrompt: "BASE" }, ctx)) as {
        systemPrompt: string;
      };
      expect(result.systemPrompt).toMatch(/PONYTAIL MODE ACTIVE/);
    });
  });
});

describe("parsePonytailCommand", () => {
  it("falls back to full when invoked bare and default is off", () => {
    expect(parsePonytailCommand("", "off")).toEqual({ type: "set-mode", mode: "full" });
  });

  it("parses modes, status, and the default subcommand", () => {
    expect(parsePonytailCommand("ultra", "full")).toEqual({
      type: "set-mode",
      mode: "ultra",
    });
    expect(parsePonytailCommand("status", "full")).toEqual({ type: "status" });
    expect(parsePonytailCommand("default lite", "full")).toEqual({
      type: "set-default",
      mode: "lite",
    });
  });
});

describe("resolveSessionMode", () => {
  it("prefers the latest persisted mode entry on the branch", () => {
    const entries = [
      { type: "custom", customType: "ponytail-mode", data: { mode: "lite" } },
      { type: "custom", customType: "ponytail-mode", data: { mode: "ultra" } },
    ];
    expect(resolveSessionMode(entries, "full")).toBe("ultra");
  });

  it("falls back when the branch has no ponytail-mode entries", () => {
    expect(resolveSessionMode([], "full")).toBe("full");
  });

  it("returns the fallback when entries is null or undefined", () => {
    expect(resolveSessionMode(null, "full")).toBe("full");
    expect(resolveSessionMode(undefined, "ultra")).toBe("ultra");
  });
});

describe("default-mode config", () => {
  it("reads and writes the default mode via XDG config path", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ponytail-config-"));
    const previousXdg = process.env.XDG_CONFIG_HOME;
    const previousDefault = process.env.PONYTAIL_DEFAULT_MODE;
    const configPath = path.join(tempDir, "ponytail", "config.json");
    process.env.XDG_CONFIG_HOME = tempDir;
    delete process.env.PONYTAIL_DEFAULT_MODE;

    try {
      expect(readDefaultMode()).toBe("full");
      expect(writeDefaultMode("ultra")).toBe("ultra");
      expect(readDefaultMode()).toBe("ultra");
      expect(fs.existsSync(configPath)).toBe(true);
      expect(JSON.parse(fs.readFileSync(configPath, "utf8"))).toEqual({
        defaultMode: "ultra",
      });
    } finally {
      if (previousXdg === undefined) delete process.env.XDG_CONFIG_HOME;
      else process.env.XDG_CONFIG_HOME = previousXdg;
      if (previousDefault === undefined) delete process.env.PONYTAIL_DEFAULT_MODE;
      else process.env.PONYTAIL_DEFAULT_MODE = previousDefault;
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe("filterSkillBodyForMode", () => {
  it("keeps only the requested intensity rows and examples", () => {
    const body = [
      "---",
      "name: ponytail",
      "---",
      "| **lite** | keep lite |",
      "| **full** | keep full |",
      "| **ultra** | keep ultra |",
      "- lite: Lite example",
      "- full: Full example",
      "- ultra: Ultra example",
      "Other line",
    ].join("\n");

    const filtered = filterSkillBodyForMode(body, "ultra");

    expect(filtered).not.toContain("keep lite");
    expect(filtered).not.toContain("keep full");
    expect(filtered).toContain("keep ultra");
    expect(filtered).not.toContain("Lite example");
    expect(filtered).toContain("Ultra example");
    expect(filtered).toContain("Other line");
  });

  it("keeps rule bullets that contain a colon and filters the intensity table", async () => {
    // Use the bundled fixture so the test is hermetic — independent of
    // whether ~/.agents/skills/ponytail/SKILL.md exists in the test env.
    const fixturePath = path.join(
      path.dirname(new URL(import.meta.url).pathname),
      "fixtures",
      "ponytail-skill.md",
    );
    const body = fs.readFileSync(fixturePath, "utf8");

    const filtered = filterSkillBodyForMode(body, "full");

    expect(filtered).toContain("No unrequested abstractions");
    expect(filtered).toContain("Mark deliberate simplifications");
    expect(filtered).toContain('full: "`@lru_cache');
    expect(filtered).not.toContain('lite: "Done');
    expect(filtered).not.toContain('ultra: "No cache');
  });
});

describe("skill-path resolution", () => {
  beforeEach(() => _resetSkillPathCache());
  afterEach(() => _resetSkillPathCache());

  it("honors the PONYTAIL_SKILL_PATH override", async () => {
    const overridePath = path.join(
      path.dirname(new URL(import.meta.url).pathname),
      "fixtures",
      "ponytail-skill.md",
    );
    const previous = process.env.PONYTAIL_SKILL_PATH;
    process.env.PONYTAIL_SKILL_PATH = overridePath;
    try {
      const { events, commands } = createHarness();
      const ctx = createCommandContext();
      await events.get("session_start")!({ reason: "startup" }, ctx);
      await commands.get("ponytail")!.handler("full", ctx);
      const result = (await events.get("before_agent_start")!({ systemPrompt: "BASE" }, ctx)) as {
        systemPrompt: string;
      };
      expect(result.systemPrompt).toContain("PONYTAIL MODE ACTIVE — level: full");
      // The fixture contains the 'full' intensity row and example but not
      // the lite/ultra rows — this proves the override path is being read
      // and the body is being filtered against the active mode.
      expect(result.systemPrompt).toContain('full: "`@lru_cache');
      expect(result.systemPrompt).not.toContain('lite: "Done');
      expect(result.systemPrompt).not.toContain('ultra: "No cache');
    } finally {
      if (previous === undefined) delete process.env.PONYTAIL_SKILL_PATH;
      else process.env.PONYTAIL_SKILL_PATH = previous;
    }
  });
});
