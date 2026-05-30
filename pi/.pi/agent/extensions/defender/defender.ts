/**
 * Defender Class
 *
 * Encapsulates all defender logic: pattern matching, path extraction from
 * bash commands (via tree-sitter AST), and read/write path checks.
 *
 * index.ts uses this class as a thin orchestration layer — it extracts
 * paths and decides whether to block each tool call.
 */

import Parser from "tree-sitter";
import Bash from "tree-sitter-bash";
import { isPathAllowed, isEnvFile } from "../shared/path-guard";
import { DANGEROUS_PATTERNS, BLOCK_INSTRUCTION } from "./patterns";

// ── Types ─────────────────────────────────────────────────────────────

export interface FileCheckResult {
  blocked: boolean;
  reason?: string;
}

// ── Container node types for AST walking ─────────────────────────────

const COMMAND_CONTAINER_TYPES = new Set(["program", "list", "pipeline", "redirected_statement"]);

// ── Defender ──────────────────────────────────────────────────────────

export class Defender {
  // ── Fields ──────────────────────────────────────────────────────

  private _parser: Parser | null = null;

  // ── Public accessors ────────────────────────────────────────────

  /** Dangerous command patterns (regex). */
  get patterns(): RegExp[] {
    return DANGEROUS_PATTERNS;
  }

  /** Steering message sent to the agent when a command is blocked. */
  get blockInstruction(): string {
    return BLOCK_INSTRUCTION;
  }

  // ── Path extraction from bash ───────────────────────────────────

  /**
   * Extract candidate file-path arguments from a bash command using
   * tree-sitter AST parsing.
   *
   * Walks `command` nodes, skips the command name, and collects
   * `word` tokens that are not flags (don't start with `-`).
   * Redirect targets, command substitutions, and subshells are
   * intentionally excluded.
   */
  getBashTargetPaths(command: string): string[] {
    if (!command || !command.trim()) return [];

    const parser = this.getParser();
    const tree = parser.parse(command);
    const paths: string[] = [];
    this._collectPathArgs(tree.rootNode, paths);
    return paths;
  }

  // ── Danger pattern matching ─────────────────────────────────────

  /**
   * Test a command against all dangerous patterns.
   * Returns the first matching RegExp, or null.
   */
  findDangerousPattern(command: string): RegExp | null {
    for (const pattern of this.patterns) {
      if (pattern.test(command)) return pattern;
    }
    return null;
  }

  // ── File read / write guards ────────────────────────────────────

  /**
   * Check whether reading the given path is allowed.
   *
   * Blocks:
   *  - .env files
   *  - Files outside the allowed prefixes
   */
  checkRead(filePath: string, cwd?: string, allowedPrefixes?: string[]): FileCheckResult {
    if (isEnvFile(filePath)) {
      return {
        blocked: true,
        reason: `Reading "${filePath}" is blocked — it looks like an env file`,
      };
    }

    if (!isPathAllowed(filePath, cwd, allowedPrefixes)) {
      return {
        blocked: true,
        reason: `Reading "${filePath}" is blocked — only files under $HOME and /tmp are allowed`,
      };
    }

    return { blocked: false };
  }

  /**
   * Check whether writing/editing the given path is allowed.
   *
   * Blocks:
   *  - .env files
   *  - Files outside the allowed prefixes
   */
  checkWrite(filePath: string, cwd?: string, allowedPrefixes?: string[]): FileCheckResult {
    if (isEnvFile(filePath)) {
      return {
        blocked: true,
        reason: `Writing to "${filePath}" is blocked — it looks like an env file`,
      };
    }

    if (!isPathAllowed(filePath, cwd, allowedPrefixes)) {
      return {
        blocked: true,
        reason: `Writing to "${filePath}" is blocked — only files under $HOME and /tmp are allowed`,
      };
    }

    return { blocked: false };
  }

  // ── Private ─────────────────────────────────────────────────────

  private getParser(): Parser {
    if (!this._parser) {
      this._parser = new Parser();
      this._parser.setLanguage(Bash as unknown as Parser.Language);
    }
    return this._parser;
  }

  /**
   * Recursively walk tree-sitter AST to collect path arguments.
   *
   * For `command` nodes: skips `command_name`, collects non-flag
   * `word` children (stripping quotes), and skips children inside
   * `file_redirect` / `io_redirect` nodes.
   *
   * For container nodes (`program`, `list`, `pipeline`,
   * `redirected_statement`): recurses into children.
   */
  private _collectPathArgs(node: Parser.SyntaxNode, paths: string[]): void {
    if (node.type === "command") {
      let passedName = false;
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i)!;
        if (child.type === "command_name") {
          passedName = true;
          continue;
        }
        if (passedName && child.type === "word") {
          const text = child.text.replace(/^["']|["']$/g, "").trim();
          if (text && !text.startsWith("-")) {
            paths.push(text);
          }
        }
        // Skip file_redirect, io_redirect — their children are
        // redirect operators / targets, not command arguments.
      }
      return;
    }

    if (COMMAND_CONTAINER_TYPES.has(node.type)) {
      for (let i = 0; i < node.childCount; i++) {
        this._collectPathArgs(node.child(i)!, paths);
      }
    }
  }
}
