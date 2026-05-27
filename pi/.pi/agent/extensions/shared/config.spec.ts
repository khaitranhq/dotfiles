import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// ── Helpers ───────────────────────────────────────────────────────────

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "pi-config-spec-"));
}

function writeFile(dir: string, name: string, content: string): string {
  const filePath = path.join(dir, name);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
}

function setAgentDir(dir: string): string {
  const prev = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = dir;
  return prev ?? "";
}

// ── resolveFileRefs ───────────────────────────────────────────────────

describe("resolveFileRefs", () => {
  let tmpDir: string;
  let resolveFileRefs: (yaml: string, baseDir: string) => string;

  beforeEach(async () => {
    tmpDir = tempDir();
    const mod = await import("./config");
    resolveFileRefs = mod.resolveFileRefs;
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("resolves an absolute file reference", () => {
    const filePath = writeFile(tmpDir, "prompt.md", "Hello from absolute file");
    const input = `prompt: "\${file:${filePath}}"`;
    const result = resolveFileRefs(input, "/some/base");
    expect(result).toBe(`prompt: "Hello from absolute file"`);
  });

  it("resolves a relative file reference", () => {
    writeFile(tmpDir, "relative.md", "Hello from relative file");
    const input = 'prompt: "${file:relative.md}"';
    const result = resolveFileRefs(input, tmpDir);
    expect(result).toBe('prompt: "Hello from relative file"');
  });

  it("resolves multiple file references in one string", () => {
    const f1 = writeFile(tmpDir, "a.md", "Content A");
    const f2 = writeFile(tmpDir, "b.md", "Content B");
    const input = `first: "\${file:${f1}}"\nsecond: "\${file:${f2}}"`;
    const result = resolveFileRefs(input, "/irrelevant");
    expect(result).toBe('first: "Content A"\nsecond: "Content B"');
  });

  it("returns placeholder for missing file", () => {
    const missing = path.join(tmpDir, "does-not-exist.md");
    const input = `prompt: "\${file:${missing}}"`;
    const result = resolveFileRefs(input, "/some/base");
    expect(result).toContain("[File not found:");
    expect(result).toContain(missing);
  });

  it("passes through content with no file references unchanged", () => {
    const input = "prompt: plain text\nmore: content";
    const result = resolveFileRefs(input, "/some/base");
    expect(result).toBe(input);
  });

  it("handles empty input", () => {
    const result = resolveFileRefs("", "/some/base");
    expect(result).toBe("");
  });

  it("resolves relative path joined with baseDir", () => {
    writeFile(tmpDir, "sub/nested.md", "Nested content");
    const input = 'prompt: "${file:sub/nested.md}"';
    const result = resolveFileRefs(input, tmpDir);
    expect(result).toBe('prompt: "Nested content"');
  });
});

// ── loadAgentsConfig ──────────────────────────────────────────────────

describe("loadAgentsConfig", () => {
  let tmpDir: string;
  let prevAgentDir: string;

  beforeEach(() => {
    tmpDir = tempDir();
    prevAgentDir = setAgentDir(tmpDir);
  });

  afterEach(() => {
    process.env.PI_CODING_AGENT_DIR = prevAgentDir;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns empty object when no agents defined", async () => {
    // No custom-settings.yaml file exists
    const mod = await import("./config");
    const result = mod.loadAgentsConfig();
    expect(result).toEqual({});
  });

  it("loads agents without file references", async () => {
    writeFile(
      tmpDir,
      "custom-settings.yaml",
      [
        "agents:",
        "  helper:",
        "    mode: subagent",
        "    description: A helper agent",
        "    prompt: You are a helpful assistant.",
      ].join("\n"),
    );

    const mod = await import("./config");
    const result = mod.loadAgentsConfig();

    expect(result).toHaveProperty("helper");
    expect(result["helper"].mode).toBe("subagent");
    expect(result["helper"].description).toBe("A helper agent");
    expect(result["helper"].prompt).toBe("You are a helpful assistant.");
  });

  it("resolves file references in agent prompts", async () => {
    const promptFile = writeFile(tmpDir, "agent-prompt.md", "System prompt from file.");
    writeFile(
      tmpDir,
      "custom-settings.yaml",
      [
        "agents:",
        "  coder:",
        "    mode: subagent",
        "    description: Coding subagent",
        `    prompt: "\${file:${promptFile}}"`,
      ].join("\n"),
    );

    const mod = await import("./config");
    const result = mod.loadAgentsConfig();

    expect(result["coder"].prompt).toBe("System prompt from file.");
  });

  it("handles agents with mixed file refs and inline text", async () => {
    const promptFile = writeFile(tmpDir, "rules.md", "Rule section content.");
    writeFile(
      tmpDir,
      "custom-settings.yaml",
      [
        "agents:",
        "  bot:",
        "    mode: subagent",
        "    description: Mixed prompt agent",
        `    prompt: |`,
        "      Before rules.",
        `      \${file:${promptFile}}`,
        "      After rules.",
      ].join("\n"),
    );

    const mod = await import("./config");
    const result = mod.loadAgentsConfig();

    expect(result["bot"].prompt).toContain("Before rules.");
    expect(result["bot"].prompt).toContain("Rule section content.");
    expect(result["bot"].prompt).toContain("After rules.");
  });

  it("preserves other agent fields while resolving prompt", async () => {
    writeFile(
      tmpDir,
      "custom-settings.yaml",
      [
        "agents:",
        "  full:",
        "    mode: primary",
        "    description: Full agent",
        "    model: claude-sonnet-4-5",
        "    tools:",
        "      - read",
        "      - write",
        "    prompt: Hello world.",
      ].join("\n"),
    );

    const mod = await import("./config");
    const result = mod.loadAgentsConfig();

    expect(result["full"]).toMatchObject({
      mode: "primary",
      description: "Full agent",
      model: "claude-sonnet-4-5",
      prompt: "Hello world.",
    });
    expect(result["full"].tools).toEqual(["read", "write"]);
  });

  it("returns empty object when agents key is missing from settings", async () => {
    writeFile(tmpDir, "custom-settings.yaml", "subagent:\n  defaultScope: user\n");

    const mod = await import("./config");
    const result = mod.loadAgentsConfig();

    expect(result).toEqual({});
  });
});
