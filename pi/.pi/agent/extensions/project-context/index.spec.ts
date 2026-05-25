/**
 * Tests for project-context extension helpers.
 *
 * Covers: resolveAbsPath, extractPathsFromToolInput,
 * discoverFromFilePath, updateWidget.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// ── Constants (mirrored from index.ts) ────────────────────────────────

const AGENTS_FILES = ["AGENTS.md", "CLAUDE.md"];
const WIDGET_ID = "project-context";

// ── Re-implement helpers here for isolated testing ────────────────────

function resolveAbsPath(rawPath: string, cwd: string): string {
  return path.isAbsolute(rawPath) ? path.resolve(rawPath) : path.resolve(cwd, rawPath);
}

function extractPathsFromToolInput(toolName: string, input: unknown): string[] {
  if (!input || typeof input !== "object") return [];

  switch (toolName) {
    case "read":
    case "write":
    case "edit": {
      const p = (input as Record<string, unknown>).path;
      if (typeof p === "string") return [p];
      return [];
    }
  }

  return [];
}

function discoverFromFilePath(
  filePath: string,
  cwd: string,
  discovered: Map<string, string>,
): string[] {
  const absPath = resolveAbsPath(filePath, cwd);
  const found: string[] = [];
  let dir = path.dirname(absPath);
  const root = path.parse(dir).root;

  while (dir !== root) {
    for (const name of AGENTS_FILES) {
      const candidate = path.join(dir, name);
      if (discovered.has(candidate)) continue;

      try {
        if (fs.existsSync(candidate)) {
          const content = fs.readFileSync(candidate, "utf-8");
          discovered.set(candidate, content);
          found.push(candidate);
        }
      } catch {
        // Skip files that can't be read
      }
    }

    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return found;
}

function updateWidget(
  discovered: Map<string, string>,
): { id: string; lines: string[] | undefined } | null {
  const id = WIDGET_ID;

  if (discovered.size === 0) {
    return { id, lines: undefined };
  }

  const lines = ["📋 Discovered Context Files:"];
  for (const absPath of discovered.keys()) {
    lines.push(`  ${absPath}`);
  }
  return { id, lines };
}

// ── Tests: resolveAbsPath ─────────────────────────────────────────────

describe("resolveAbsPath", () => {
  it("resolves relative path against cwd", () => {
    const result = resolveAbsPath("src/file.txt", "/home/user/project");
    expect(result).toBe("/home/user/project/src/file.txt");
  });

  it("keeps absolute path unchanged (resolved)", () => {
    const result = resolveAbsPath("/absolute/path/file.txt", "/home/user");
    expect(result).toBe("/absolute/path/file.txt");
  });

  it("resolves path with .. segments", () => {
    const result = resolveAbsPath("../sibling/file.txt", "/home/user/project/src");
    expect(result).toBe("/home/user/project/sibling/file.txt");
  });
});

// ── Tests: extractPathsFromToolInput ──────────────────────────────────

describe("extractPathsFromToolInput", () => {
  it("extracts path from read tool input", () => {
    const input = { path: "/tmp/file.txt" };
    expect(extractPathsFromToolInput("read", input)).toEqual(["/tmp/file.txt"]);
  });

  it("extracts path from write tool input", () => {
    const input = { path: "./output.md", content: "hello" };
    expect(extractPathsFromToolInput("write", input)).toEqual(["./output.md"]);
  });

  it("extracts path from edit tool input", () => {
    const input = { path: "src/app.ts", edits: [] };
    expect(extractPathsFromToolInput("edit", input)).toEqual(["src/app.ts"]);
  });

  it("returns empty for unrecognized tool names", () => {
    expect(extractPathsFromToolInput("bash", { command: "ls" })).toEqual([]);
    expect(extractPathsFromToolInput("web_search", { query: "test" })).toEqual([]);
  });

  it("returns empty for null/undefined input", () => {
    expect(extractPathsFromToolInput("read", null)).toEqual([]);
    expect(extractPathsFromToolInput("write", undefined)).toEqual([]);
  });

  it("returns empty for non-object input (string)", () => {
    expect(extractPathsFromToolInput("read", "just a string")).toEqual([]);
  });

  it("returns empty when input has no path property", () => {
    expect(extractPathsFromToolInput("read", {})).toEqual([]);
    expect(extractPathsFromToolInput("read", { content: "x" })).toEqual([]);
  });

  it("returns empty when path is not a string", () => {
    expect(extractPathsFromToolInput("read", { path: 123 })).toEqual([]);
    expect(extractPathsFromToolInput("read", { path: null })).toEqual([]);
    expect(extractPathsFromToolInput("read", { path: ["a", "b"] })).toEqual([]);
  });
});

// ── Tests: discoverFromFilePath ───────────────────────────────────────

describe("discoverFromFilePath", () => {
  const tmpBase = path.join(os.tmpdir(), "pi-project-context-test");

  beforeEach(() => {
    fs.mkdirSync(tmpBase, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpBase, { recursive: true, force: true });
  });

  it("finds AGENTS.md in the same directory as the file", () => {
    // Setup: /tmp/.../project/AGENTS.md + /tmp/.../project/src/file.ts
    const projectDir = path.join(tmpBase, "project");
    const srcDir = path.join(projectDir, "src");
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, "AGENTS.md"), "# Project Rules\nUse tabs.", "utf-8");

    const discovered = new Map<string, string>();
    const found = discoverFromFilePath(path.join(srcDir, "file.ts"), tmpBase, discovered);

    expect(found).toHaveLength(1);
    expect(found[0]).toBe(path.join(projectDir, "AGENTS.md"));
    expect(discovered.get(found[0])).toBe("# Project Rules\nUse tabs.");
  });

  it("finds CLAUDE.md in a parent directory", () => {
    const aDir = path.join(tmpBase, "a", "b", "c");
    fs.mkdirSync(aDir, { recursive: true });
    fs.writeFileSync(path.join(tmpBase, "a", "CLAUDE.md"), "# Rules", "utf-8");

    const discovered = new Map<string, string>();
    const found = discoverFromFilePath(path.join(aDir, "deep.ts"), tmpBase, discovered);

    expect(found).toHaveLength(1);
    expect(found[0]).toBe(path.join(tmpBase, "a", "CLAUDE.md"));
  });

  it("finds multiple context files walking up the tree", () => {
    const deep = path.join(tmpBase, "x", "y", "z");
    fs.mkdirSync(deep, { recursive: true });
    fs.writeFileSync(path.join(tmpBase, "x", "y", "AGENTS.md"), "# Mid-level", "utf-8");
    fs.writeFileSync(path.join(tmpBase, "x", "CLAUDE.md"), "# Upper", "utf-8");

    const discovered = new Map<string, string>();
    const found = discoverFromFilePath(path.join(deep, "code.ts"), tmpBase, discovered);

    // Walk order: z → y → x (then stop at root or tmpBase depending on setup)
    // Should find AGENTS.md in y/ and CLAUDE.md in x/
    expect(found.length).toBeGreaterThanOrEqual(2);
    const foundPaths = found.map((p) => path.basename(p));
    expect(foundPaths).toContain("AGENTS.md");
    expect(foundPaths).toContain("CLAUDE.md");
  });

  it("skips already-discovered files", () => {
    const dir = path.join(tmpBase, "proj");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "AGENTS.md"), "# First", "utf-8");

    const discovered = new Map<string, string>();
    discovered.set(path.join(dir, "AGENTS.md"), "# First");

    const found = discoverFromFilePath(path.join(dir, "file.ts"), tmpBase, discovered);

    expect(found).toHaveLength(0);
  });

  it("returns empty when no context files exist", () => {
    const dir = path.join(tmpBase, "empty-project");
    fs.mkdirSync(dir, { recursive: true });

    const discovered = new Map<string, string>();
    const found = discoverFromFilePath(path.join(dir, "main.ts"), tmpBase, discovered);

    expect(found).toHaveLength(0);
  });

  it("resolves relative file path against cwd", () => {
    const projectDir = path.join(tmpBase, "rel-project");
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, "AGENTS.md"), "# Rel rules", "utf-8");

    const discovered = new Map<string, string>();
    const found = discoverFromFilePath("src/app.ts", projectDir, discovered);

    expect(found).toHaveLength(1);
    expect(found[0]).toBe(path.join(projectDir, "AGENTS.md"));
  });
});

// ── Tests: updateWidget ───────────────────────────────────────────────

describe("updateWidget", () => {
  it("returns undefined lines when no files discovered", () => {
    const discovered = new Map<string, string>();
    const result = updateWidget(discovered);
    expect(result!.id).toBe(WIDGET_ID);
    expect(result!.lines).toBeUndefined();
  });

  it("returns widget lines with all discovered paths", () => {
    const discovered = new Map<string, string>();
    discovered.set("/home/user/project/AGENTS.md", "# Rules");
    discovered.set("/home/user/CLAUDE.md", "# Home config");

    const result = updateWidget(discovered);
    expect(result!.id).toBe(WIDGET_ID);
    expect(result!.lines).toBeDefined();
    expect(result!.lines![0]).toBe("📋 Discovered Context Files:");
    expect(result!.lines).toContain("  /home/user/project/AGENTS.md");
    expect(result!.lines).toContain("  /home/user/CLAUDE.md");
  });

  it("returns widget lines with a single file", () => {
    const discovered = new Map<string, string>();
    discovered.set("/tmp/.pi/AGENTS.md", "# Agent rules");

    const result = updateWidget(discovered);
    expect(result!.lines).toBeDefined();
    expect(result!.lines).toHaveLength(2); // header + 1 path
    expect(result!.lines![1]).toBe("  /tmp/.pi/AGENTS.md");
  });
});
