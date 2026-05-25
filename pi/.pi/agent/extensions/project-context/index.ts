/**
 * Project Context Discovery Extension
 *
 * Replaces the "Project Context Discovery" section previously in AGENTS.md.
 *
 * When the agent works with files outside the cwd-to-root chain, this extension
 * discovers AGENTS.md/CLAUDE.md files in parent directories of those files and
 * injects their content into the system prompt.
 *
 * A UI widget displays all discovered context files with absolute paths.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import * as fs from "node:fs";
import * as path from "node:path";

// ── Constants ──────────────────────────────────────────────────────────────

const AGENTS_FILES = ["AGENTS.md", "CLAUDE.md"];
const WIDGET_ID = "project-context";

// ── Extension ──────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  // Path → content for all discovered context files
  const discovered = new Map<string, string>();
  // Paths whose content has already been injected into the system prompt
  const injected = new Set<string>();

  // ── Helpers ──────────────────────────────────────────────────────────

  function resolveAbsPath(rawPath: string, cwd: string): string {
    return path.isAbsolute(rawPath) ? path.resolve(rawPath) : path.resolve(cwd, rawPath);
  }

  /**
   * Walk up from a file's directory toward the filesystem root, discovering
   * any AGENTS.md or CLAUDE.md files in parent directories.
   *
   * Returns absolute paths of newly discovered files.
   */
  function discoverFromFilePath(filePath: string, cwd: string): string[] {
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
          // Skip files that can't be read (permissions, etc.)
        }
      }

      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }

    return found;
  }

  /**
   * Extract file paths from tool call input.
   */
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

  // ── Widget ───────────────────────────────────────────────────────────

  function updateWidget(ctx: {
    ui: {
      setWidget: (id: string, lines: string[] | undefined) => void;
    };
  }) {
    if (discovered.size === 0) {
      ctx.ui.setWidget(WIDGET_ID, undefined);
      return;
    }

    const lines = ["📋 Discovered Context Files:"];
    for (const absPath of discovered.keys()) {
      lines.push(`  ${absPath}`);
    }
    ctx.ui.setWidget(WIDGET_ID, lines);
  }

  // ── Event Handlers ───────────────────────────────────────────────────

  // Intercept tool calls: when the agent reads/writes/edits a file, walk up
  // from that file's directory to discover AGENTS.md/CLAUDE.md files.
  pi.on("tool_call", async (event, ctx) => {
    const filePaths = extractPathsFromToolInput(event.toolName, event.input);
    const newFiles: string[] = [];
    for (const fp of filePaths) {
      newFiles.push(...discoverFromFilePath(fp, ctx.cwd));
    }

    if (newFiles.length > 0) {
      updateWidget(ctx);
    }
  });

  // Before each agent turn, inject newly discovered context into the system
  // prompt so the agent follows the rules defined in those files.
  pi.on("before_agent_start", async (event, _) => {
    const newFiles: string[] = [];
    for (const absPath of discovered.keys()) {
      if (!injected.has(absPath)) {
        newFiles.push(absPath);
      }
    }

    if (newFiles.length === 0) return;

    // Mark as injected so we don't append them again
    for (const f of newFiles) {
      injected.add(f);
    }

    // Build additional system prompt content
    let extra = "\n\n## Discovered Project Context\n\n";
    extra += "The following context files were discovered in parent directories ";
    extra += "of files being worked on. Follow any rules or conventions ";
    extra += "defined in them:\n\n";

    for (const absPath of newFiles) {
      const content = discovered.get(absPath) ?? "";
      extra += `<!-- BEGIN ${absPath} -->\n${content}\n<!-- END ${absPath} -->\n\n`;
    }

    const base = event.systemPrompt ?? "";
    return { systemPrompt: base + extra };
  });

  // Show widget on lifecycle events
  pi.on("session_start", async (_event, ctx) => {
    updateWidget(ctx);
  });

  pi.on("agent_start", async (_event, ctx) => {
    updateWidget(ctx);
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    ctx.ui.setWidget(WIDGET_ID, undefined);
  });
}
