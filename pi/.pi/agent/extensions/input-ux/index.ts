/**
 * Input UX Extension
 *
 * Unified input experience:
 * - @mention autocomplete (agents, files, directories)
 * - @mention input transform (agent delegation, file/directory inspection)
 * - Cwd-scoped prompt history on ↑/↓
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { CustomEditor, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { AutocompleteProvider, AutocompleteSuggestions } from "@earendil-works/pi-tui";
import { FileSystemIndex } from "./file-system-index";
import { CandidateRanker } from "./candidate-ranker";
import {
  candidateToAutocompleteItem,
  buildPathInstruction,
  buildAgentInstruction,
  maybeNotifyMatch,
  filterByMinScore,
} from "./autocomplete";
import { extractMentionContext } from "./mention-parser";
import { InputHistoryManager } from "./input-history";
import { applyAutocompleteSize, attachScopedInputHistory } from "./editor-patcher";

export default function (pi: ExtensionAPI) {
  const fileIndex = new FileSystemIndex();
  const historyManager = new InputHistoryManager();
  const ranker = new CandidateRanker(fileIndex);

  pi.on("tool_result", async (event) => {
    if (
      event.toolName === "write" ||
      event.toolName === "edit" ||
      (event.toolName === "bash" &&
        event.input &&
        typeof event.input.command === "string" &&
        /\b(?:mkdir|touch|rm|mv|cp)\b/.test(event.input.command))
    ) {
      fileIndex.invalidate();
    }
  });

  pi.on("session_start", async (_event, ctx) => {
    const currentEditorFactory = ctx.ui.getEditorComponent();
    ctx.ui.setEditorComponent((tui, theme, keybindings) => {
      const editor = currentEditorFactory
        ? currentEditorFactory(tui, theme, keybindings)
        : new CustomEditor(tui, theme, keybindings);
      applyAutocompleteSize(editor);
      attachScopedInputHistory(editor, ctx.cwd, keybindings, historyManager);
      return editor;
    });

    ctx.ui.addAutocompleteProvider(
      (current: AutocompleteProvider): AutocompleteProvider => ({
        async getSuggestions(
          lines: string[],
          cursorLine: number,
          cursorCol: number,
          options,
        ): Promise<AutocompleteSuggestions | null> {
          const line = lines[cursorLine] ?? "";
          const beforeCursor = line.slice(0, cursorCol);
          const mention = extractMentionContext(beforeCursor);
          if (!mention) {
            return current.getSuggestions(lines, cursorLine, cursorCol, options);
          }

          const ranked = ranker.rankCandidates(ctx.cwd, mention.prefix);
          if (ranked.length === 0) {
            return current.getSuggestions(lines, cursorLine, cursorCol, options);
          }

          return {
            prefix: `@${mention.prefix}`,
            items: ranked.map((entry) => candidateToAutocompleteItem(entry.candidate)),
          };
        },

        applyCompletion(lines, cursorLine, cursorCol, item, prefix) {
          return current.applyCompletion(lines, cursorLine, cursorCol, item, prefix);
        },

        shouldTriggerFileCompletion(lines, cursorLine, cursorCol) {
          const line = lines[cursorLine] ?? "";
          const beforeCursor = line.slice(0, cursorCol);
          if (extractMentionContext(beforeCursor)) return false;
          return current.shouldTriggerFileCompletion?.(lines, cursorLine, cursorCol) ?? true;
        },
      }),
    );
  });

  pi.on("input", async (event, ctx) => {
    if (event.source !== "interactive") return;

    historyManager.remember(ctx.cwd, event.text);

    const match = event.text.match(/^@(\S+)(?:\s+(.*))?$/);
    if (!match) return;

    const [, rawName, rawRest] = match;
    const name = rawName.trim();
    const trailing = rawRest?.trim() ?? "";

    if (name.length < 2 && trailing === "") {
      return { action: "continue" };
    }

    const agents = ranker.getAgents(ctx.cwd);
    const exactAgent = agents.find((agent) => agent.name === name);

    if (exactAgent && trailing) {
      if (exactAgent.mode === "primary") {
        ctx.ui.notify(`"${name}" is a primary agent. Use /agent ${name} to switch.`, "warning");
        return { action: "handled" };
      }

      return {
        action: "transform",
        text: buildAgentInstruction(exactAgent.name, trailing),
      };
    }

    const resolvedPath = path.resolve(ctx.cwd, name);
    if (fs.existsSync(resolvedPath)) {
      const relativePath = path.relative(ctx.cwd, resolvedPath) || ".";
      const stat = fs.statSync(resolvedPath);

      if (stat.isFile()) {
        return {
          action: "transform",
          text: buildPathInstruction("file", relativePath, trailing),
        };
      }

      if (stat.isDirectory()) {
        return {
          action: "transform",
          text: buildPathInstruction("directory", relativePath, trailing),
        };
      }
    }

    if (exactAgent) {
      return { action: "continue" };
    }

    const ranked = filterByMinScore(ranker.rankCandidates(ctx.cwd, name));
    if (ranked.length === 0) {
      if (trailing) {
        ctx.ui.notify(`No agent, file, or folder matched "@${name}".`, "error");
        return { action: "handled" };
      }
      return { action: "continue" };
    }

    const best = ranked[0].candidate;

    if (best.kind === "agent") {
      if (!trailing) return { action: "continue" };

      if (best.agent.mode === "primary") {
        ctx.ui.notify(
          `Matched @${name} → @${best.agent.name}. "${best.agent.name}" is a primary agent. Use /agent ${best.agent.name} to switch.`,
          "warning",
        );
        return { action: "handled" };
      }

      if (ctx.hasUI) {
        maybeNotifyMatch(name, ranked, ctx.ui.notify.bind(ctx.ui));
      }

      return {
        action: "transform",
        text: buildAgentInstruction(best.agent.name, trailing),
      };
    }

    if (ctx.hasUI) {
      maybeNotifyMatch(name, ranked, ctx.ui.notify.bind(ctx.ui));
    }

    return {
      action: "transform",
      text: buildPathInstruction(best.kind, best.key, trailing),
    };
  });
}
