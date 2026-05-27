import type { KeybindingsManager } from "@earendil-works/pi-coding-agent";
import { AUTOCOMPLETE_MAX_VISIBLE, type EditorHistoryAdapter } from "./types";
import type { InputHistoryManager } from "./input-history";

export function applyAutocompleteSize(editor: unknown): void {
  if (!editor || typeof editor !== "object") return;
  const maybeEditor = editor as {
    setAutocompleteMaxVisible?: (value: number) => void;
  };
  if (typeof maybeEditor.setAutocompleteMaxVisible === "function") {
    maybeEditor.setAutocompleteMaxVisible(AUTOCOMPLETE_MAX_VISIBLE);
  }
}

export function canPatchEditorHistory(editor: unknown): editor is EditorHistoryAdapter {
  if (!editor || typeof editor !== "object") return false;
  const maybeEditor = editor as Partial<EditorHistoryAdapter>;
  return (
    typeof maybeEditor.handleInput === "function" &&
    typeof maybeEditor.setText === "function" &&
    typeof maybeEditor.getText === "function" &&
    typeof maybeEditor.getLines === "function" &&
    typeof maybeEditor.getCursor === "function"
  );
}

export function attachScopedInputHistory(
  editor: unknown,
  cwd: string,
  keybindings: KeybindingsManager,
  historyManager: InputHistoryManager,
): void {
  if (!canPatchEditorHistory(editor) || editor.__inputUxHistoryPatched) {
    return;
  }

  const historyEditor: EditorHistoryAdapter = editor;
  const historyEntries = historyManager.getForCwd(cwd);
  const originalHandleInput = historyEditor.handleInput.bind(historyEditor);
  let browseIndex = -1;
  let draftText = "";

  function isOnFirstInputLine(): boolean {
    return historyEditor.getCursor().line === 0;
  }

  function isOnLastInputLine(): boolean {
    const lines = historyEditor.getLines();
    return historyEditor.getCursor().line >= Math.max(0, lines.length - 1);
  }

  function navigateHistory(direction: -1 | 1): boolean {
    if (direction === -1) {
      if (historyEntries.length === 0) return false;

      if (browseIndex === -1) {
        draftText = historyEditor.getText();
      }

      const nextIndex = Math.min(historyEntries.length - 1, browseIndex + 1);
      if (nextIndex === browseIndex) return false;

      browseIndex = nextIndex;
      historyEditor.setText(historyEntries[browseIndex]!);
      return true;
    }

    if (browseIndex === -1) return false;

    const nextIndex = browseIndex - 1;
    if (nextIndex >= 0) {
      browseIndex = nextIndex;
      historyEditor.setText(historyEntries[browseIndex]!);
      return true;
    }

    browseIndex = -1;
    historyEditor.setText(draftText);
    draftText = "";
    return true;
  }

  historyEditor.handleInput = (data: string) => {
    if (keybindings.matches(data, "tui.editor.cursorUp") && isOnFirstInputLine()) {
      if (navigateHistory(-1)) return;
    }

    if (keybindings.matches(data, "tui.editor.cursorDown") && isOnLastInputLine()) {
      if (navigateHistory(1)) return;
    }

    if (browseIndex !== -1) {
      browseIndex = -1;
      draftText = "";
    }

    originalHandleInput(data);
  };

  historyEditor.addToHistory = () => {
    // No-op: use cwd-scoped history instead of pi's session history.
  };
  historyEditor.__inputUxHistoryPatched = true;
}
