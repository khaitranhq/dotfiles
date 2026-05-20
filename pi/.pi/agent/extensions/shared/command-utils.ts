/**
 * Shared Command Utilities
 *
 * Reusable helpers for parsing, splitting, and analysing shell commands.
 * Used by defender (rm detection) and other extensions that introspect
 * bash tool inputs.
 */

import * as path from "node:path";
import Parser from "tree-sitter";
import Bash from "tree-sitter-bash";

// ── Tree-sitter parser singleton ────────────────────────────────────

let _parser: Parser | null = null;

function getParser(): Parser {
  if (!_parser) {
    _parser = new Parser();
    _parser.setLanguage(Bash);
  }
  return _parser;
}

// ── Command splitting ─────────────────────────────────────────────────

/** Shell command separators that introduce a new command in a chain. */
export const COMMAND_SEPARATORS = new Set(["&&", "||", ";", "|", "&"]);

/**
 * Extract the first "word" of a bash command for matching / display.
 *
 * Handles compound commands (&&, ;, |) by taking the first segment
 * and strips leading env assignments (KEY=val …).
 *
 * Uses tree-sitter-bash AST for accurate parsing.
 */
export function extractBaseCommand(fullCommand: string): string {
  return extractAllBaseCommands(fullCommand)[0] || "";
}

/**
 * Extract base commands from *all* segments of a (possibly compound) command
 * using tree-sitter-bash AST parsing.
 *
 * Splits on shell command separators (&&, ||, |&, ;, |, &) and newlines.
 * Respects shell quoting, redirections, and command substitutions — commands
 * nested inside $() or <() are *not* extracted (they are sub-processes, not
 * the top-level command being invoked).
 *
 * Strips leading variable assignments (KEY=val) and returns basename of the
 * command word (e.g. /usr/bin/git → git).
 *
 * Example:
 *   "cd /tmp && pnpm install"  →  ["cd", "pnpm"]
 *   "FOO=1 ls -la | grep foo"  →  ["ls", "grep"]
 *   "ls 2>&1"                  →  ["ls"]
 *   "grep 'a|b' | head"        →  ["grep", "head"]
 *   "echo \$(curl example.com)" →  ["echo"]  // curl inside $() skipped
 */
export function extractAllBaseCommands(fullCommand: string): string[] {
  if (!fullCommand || !fullCommand.trim()) return [];

  const parser = getParser();
  const tree = parser.parse(fullCommand);
  const commands: string[] = [];
  collectCommandNodes(tree.rootNode, commands);
  return commands;
}

// ── AST walker ──────────────────────────────────────────────────────

/**
 * Node types whose children can contain top-level commands we care about.
 */
const COMMAND_CONTAINER_TYPES = new Set([
  "program",
  "list",
  "pipeline",
  "redirected_statement",
]);

/**
 * Recursively walk the tree-sitter AST and collect base command names.
 *
 * Only descends into nodes whose type is in {@link COMMAND_CONTAINER_TYPES}.
 * This naturally skips command_substitution, subshell, process_substitution,
 * if/while/for/case/function bodies, and other nested contexts.
 */
function collectCommandNodes(
  node: Parser.SyntaxNode,
  commands: string[],
): void {
  if (node.type === "command") {
    const name = extractCommandName(node);
    if (name) commands.push(name);
    return;
  }

  if (COMMAND_CONTAINER_TYPES.has(node.type)) {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) collectCommandNodes(child, commands);
    }
  }
}

/**
 * Extract the base command name from a `command` AST node.
 *
 * Looks for `command_name` → `word` and returns `path.basename(word.text)`.
 * Skips leading variable_assignment siblings (env vars).
 */
function extractCommandName(commandNode: Parser.SyntaxNode): string {
  for (let i = 0; i < commandNode.childCount; i++) {
    const child = commandNode.child(i);
    if (child && child.type === "command_name") {
      // The command_name node contains a word child with the command text
      for (let j = 0; j < child.childCount; j++) {
        const word = child.child(j);
        if (word && word.type === "word") {
          return path.basename(word.text);
        }
      }
    }
  }
  return "";
}

// ── rm detection ──────────────────────────────────────────────────────

/**
 * Allowed command prefixes that can appear before rm in a command chain
 * (e.g., `sudo rm -rf /foo`, `env VAR=1 rm file`).
 */
const RM_PREFIXES = new Set([
  "env", "nice", "ionice", "nohup", "sudo", "pkexec", "doas",
]);

/**
 * Find the index of the "rm" token in a tokenised command.
 *
 * Skips shell command separators (&&, ||, ;, |, &) and allowed prefixes
 * (sudo, env, nice, etc.).  Returns -1 when rm is not the primary command
 * in any segment of the chain.
 */
export function findRmIndex(tokens: string[]): number {
  let sawPrefix = false;
  for (let i = 0; i < tokens.length; i++) {
    if (COMMAND_SEPARATORS.has(tokens[i])) {
      sawPrefix = false;
      continue;
    }

    const token = tokens[i].replace(/^\w+=\S+/, ""); // strip env assignments
    if (token === "rm") return i;

    if (RM_PREFIXES.has(token)) {
      sawPrefix = true;
      continue;
    }

    if (sawPrefix) {
      // After a prefix (sudo, env, etc.), skip past env vars / arguments
      // until we find rm — e.g., "env VAR=1 rm file"
      continue;
    }

    // Not a prefix, not rm, and no prefix seen — this token starts a
    // different command (e.g., "echo rm file").  Skip to next separator.
    while (i + 1 < tokens.length && !COMMAND_SEPARATORS.has(tokens[i + 1])) {
      i++;
    }
  }
  return -1;
}

/**
 * Extract target file paths from tokens after the rm invocation.
 *
 * Skips flag arguments (e.g., -rf, --recursive) and stops at the next
 * shell command separator.
 */
export function extractRmPaths(command: string): string[] {
  const tokens = command.match(/\S+/g) || [];
  const rmIdx = findRmIndex(tokens);
  if (rmIdx === -1) return [];

  const paths: string[] = [];
  let pastDoubleDash = false;
  for (let i = rmIdx + 1; i < tokens.length; i++) {
    let token = tokens[i];
    if (COMMAND_SEPARATORS.has(token)) break;
    token = token.replace(/^["']|["']$/g, ""); // strip surrounding quotes
    if (token === "--") {
      pastDoubleDash = true;
      continue;
    }
    if (!pastDoubleDash && token.startsWith("-")) continue;
    paths.push(token);
  }
  return paths;
}
