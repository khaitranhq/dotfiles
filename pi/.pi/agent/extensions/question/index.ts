/**
 * Question Extension - Interactive questions for the LLM
 *
 * Registers a `question` tool that lets the LLM ask the user structured
 * questions. Supports single and multiple questions in a single call with
 * tab-based navigation, confirm step, and three question types:
 * input, select, and multi_select.
 *
 * Features:
 * - Multiple questions with tab navigation (←/→ or Tab/Shift+Tab)
 * - Confirm tab at the end for multi-question calls
 * - Three question types: input (free text), select (single choice),
 *   multi_select (multiple choices)
 * - "Type something" custom option at end of select/multi_select lists
 */

import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  Editor,
  type EditorTheme,
  Key,
  matchesKey,
  Text,
  truncateToWidth,
} from "@earendil-works/pi-tui";
import { Type } from "typebox";

// ── Types ────────────────────────────────────────────────────────────

type QuestionType = "input" | "select" | "multi_select";

interface QuestionOption {
  value: string;
  label: string;
  description?: string;
}

interface DisplayOption extends QuestionOption {
  isOther?: boolean;
}

interface QuestionDefinition {
  id: string;
  label: string;
  prompt: string;
  type: QuestionType;
  options: QuestionOption[];
  allowOther: boolean;
}

interface QuestionAnswer {
  id: string;
  label: string;
  type: QuestionType;
  values: string[];
  labels: string[];
  customValues: string[];
}

interface QuestionResult {
  questions: QuestionDefinition[];
  answers: QuestionAnswer[];
  cancelled: boolean;
}

// ── Schema ────────────────────────────────────────────────────────────

const QuestionOptionSchema = Type.Object({
  value: Type.String({
    description: "The value returned when this option is selected",
  }),
  label: Type.String({
    description: "Display label for the option",
  }),
  description: Type.Optional(
    Type.String({
      description: "Optional description shown below the label",
    }),
  ),
});

const QuestionTypeSchema = StringEnum(
  ["input", "select", "multi_select"] as const,
  {
    description:
      "Question type: input (free text), select (single choice), or multi_select (multiple choices)",
  },
);

const QuestionSchema = Type.Object({
  id: Type.String({ description: "Unique identifier for this question" }),
  label: Type.Optional(
    Type.String({
      description:
        "Short label for the tab bar, e.g. 'Scope', 'Priority'. Defaults to Q1, Q2, etc.",
    }),
  ),
  prompt: Type.String({
    description: "The full question text displayed to the user",
  }),
  type: Type.Optional(QuestionTypeSchema, {
    description: "Question type. Defaults to 'select' if options provided, otherwise 'input'",
  }),
  options: Type.Optional(
    Type.Array(QuestionOptionSchema, {
      description: "Available options for select and multi_select types",
    }),
  ),
  allowOther: Type.Optional(
    Type.Boolean({
      description:
        "Add a 'Type something...' option at the end for select/multi_select types. Default: true",
    }),
  ),
});

const QuestionParams = Type.Object({
  questions: Type.Array(QuestionSchema, {
    description: "Questions to ask the user",
  }),
});

// ── Helpers ─────────────────────────────────────────────────────────────

function errorResult(
  message: string,
  questions: QuestionDefinition[] = [],
): { content: { type: "text"; text: string }[]; details: QuestionResult } {
  return {
    content: [{ type: "text", text: message }],
    details: { questions, answers: [], cancelled: true },
  };
}

// ── Extension ──────────────────────────────────────────────────────────

export default function question(pi: ExtensionAPI) {
  pi.registerTool({
    name: "question",
    label: "Question",
    description:
      "Ask the user one or more questions. Supports input (free text), select (single choice), " +
      "and multi_select (multiple choices) types. For multiple questions, shows a tab-based " +
      "interface with a confirm step at the end. Use ←/→ or Tab/Shift+Tab to navigate between tabs.",
    promptSnippet:
      "Ask user question(s): input (free text), select (single choice), multi_select (multiple choices)",
    promptGuidelines: [
      "Use the question tool when you need user input, clarification, preferences, or confirmation before proceeding.",
      "Prefer multi_select over asking the user to type comma-separated lists.",
      "Always provide a meaningful id for each question so answer values are easy to reference.",
      "Keep option labels concise and use descriptions for additional context.",
    ],
    parameters: QuestionParams,

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (!ctx.hasUI) {
        return errorResult(
          "Error: UI not available (running in non-interactive mode)",
        );
      }
      if (params.questions.length === 0) {
        return errorResult("Error: No questions provided");
      }

      // Normalize questions with defaults
      const questions: QuestionDefinition[] = params.questions.map(
        (q, i) => {
          const hasOptions = q.options && q.options.length > 0;
          const defaultType: QuestionType = hasOptions ? "select" : "input";
          return {
            ...q,
            label: q.label || `Q${i + 1}`,
            type: q.type || defaultType,
            options: q.options || [],
            allowOther: q.allowOther !== false,
          };
        },
      );

      // Validate: select and multi_select must have options
      for (const q of questions) {
        if (
          (q.type === "select" || q.type === "multi_select") &&
          q.options.length === 0
        ) {
          return errorResult(
            `Question "${q.label}" is type "${q.type}" but has no options`,
            questions,
          );
        }
      }

      const isMulti = questions.length > 1;
      const totalTabs = questions.length + 1; // questions + Confirm

      // ── Render the UI ───────────────────────────────────────────────
      const result = await ctx.ui.custom<QuestionResult>(
        (tui, theme, _kb, done) => {
          // State
          let currentTab = 0;
          let optionIndex = 0;
          let inputMode = false;
          let inputQuestionId: string | null = null;
          let cachedLines: string[] | undefined;

          // Answers: questionId -> answer
          const answers = new Map<string, QuestionAnswer>();

          // Multi-select state: questionId -> Set of selected option values
          const multiSelected = new Map<string, Set<string>>();

          // Initialize multiSelected
          for (const q of questions) {
            if (q.type === "multi_select") {
              if (!multiSelected.has(q.id)) {
                multiSelected.set(q.id, new Set());
              }
            }
          }

          // Editor for free-text input and "Type something" option
          const editorTheme: EditorTheme = {
            borderColor: (s: string) => theme.fg("accent", s),
            selectList: {
              selectedPrefix: (t: string) => theme.fg("accent", t),
              selectedText: (t: string) => theme.fg("accent", t),
              description: (t: string) => theme.fg("muted", t),
              scrollInfo: (t: string) => theme.fg("dim", t),
              noMatch: (t: string) => theme.fg("warning", t),
            },
          };
          const editor = new Editor(tui, editorTheme);

          // ── Helpers ─────────────────────────────────────────────────

          function refresh() {
            cachedLines = undefined;
            tui.requestRender();
          }

          function currentQuestion(): QuestionDefinition | undefined {
            return questions[currentTab];
          }

          function currentOptions(): DisplayOption[] {
            const q = currentQuestion();
            if (!q) return [];
            if (q.type === "input") return [];
            const opts: DisplayOption[] = [...q.options];
            if (q.allowOther) {
              opts.push({
                value: "__other__",
                label: "Type something...",
                isOther: true,
              });
            }
            return opts;
          }

          function allAnswered(): boolean {
            return questions.every((q) => {
              const a = answers.get(q.id);
              if (!a) return false;
              if (q.type === "multi_select") {
                return a.values.length > 0;
              }
              return a.values.length > 0 && a.values[0] !== "";
            });
          }

          function advanceAfterAnswer() {
            if (!isMulti) {
              submit(false);
              return;
            }
            if (currentTab < questions.length - 1) {
              currentTab++;
              optionIndex = 0;
            } else {
              currentTab = questions.length; // Confirm tab
            }
            refresh();
          }

          function submit(cancelled: boolean) {
            done({ questions, answers: Array.from(answers.values()), cancelled });
          }

          // ── Save answer helpers ──────────────────────────────────────

          function saveInputAnswer(questionId: string, text: string) {
            const q = questions.find((q) => q.id === questionId)!;
            const trimmed = text.trim();
            answers.set(questionId, {
              id: questionId,
              label: q.label,
              type: q.type,
              values: trimmed ? [trimmed] : [],
              labels: trimmed ? [trimmed] : [],
              customValues: trimmed ? [trimmed] : [],
            });
          }

          function saveSelectAnswer(
            questionId: string,
            value: string,
            label: string,
            wasCustom: boolean,
          ) {
            const q = questions.find((q) => q.id === questionId)!;
            answers.set(questionId, {
              id: questionId,
              label: q.label,
              type: q.type,
              values: [value],
              labels: [label],
              customValues: wasCustom ? [value] : [],
            });
          }

          function saveMultiSelectAnswer(questionId: string) {
            const q = questions.find((q) => q.id === questionId)!;
            const selected = multiSelected.get(questionId) || new Set();
            const values: string[] = [];
            const labels: string[] = [];
            const customValues: string[] = [];

            for (const opt of q.options) {
              if (selected.has(opt.value)) {
                values.push(opt.value);
                labels.push(opt.label);
              }
            }

            // Also include custom values (stored with "__custom__" prefix)
            for (const key of selected) {
              if (key.startsWith("__custom__")) {
                const customText = key.slice("__custom__".length);
                values.push(customText);
                labels.push(customText);
                customValues.push(customText);
              }
            }

            if (values.length > 0) {
              answers.set(questionId, {
                id: questionId,
                label: q.label,
                type: q.type,
                values,
                labels,
                customValues,
              });
            } else {
              answers.delete(questionId);
            }
          }

          // ── Editor submit callback ───────────────────────────────────

          editor.onSubmit = (value: string) => {
            if (!inputQuestionId) return;
            const q = questions.find((q) => q.id === inputQuestionId)!;
            const trimmed = value.trim() || "(no response)";

            if (q.type === "input") {
              saveInputAnswer(q.id, trimmed);
            } else if (q.type === "select") {
              saveSelectAnswer(q.id, trimmed, trimmed, true);
            } else if (q.type === "multi_select") {
              // Add custom value to multi_select set
              const selected = multiSelected.get(q.id) || new Set<string>();
              selected.add(`__custom__${trimmed}`);
              multiSelected.set(q.id, selected);
              saveMultiSelectAnswer(q.id);
            }

            inputMode = false;
            inputQuestionId = null;
            editor.setText("");
            advanceAfterAnswer();
          };

          // ── Input handler ────────────────────────────────────────────

          function handleInput(data: string) {
            // ── Input/Editor mode: route to editor ────────────────────
            if (inputMode) {
              // Tab / Shift+Tab: navigate tabs (intercepted before editor).
              // Left/Right arrows are NOT intercepted — they pass to the
              // editor for cursor movement.
              if (isMulti) {
                if (matchesKey(data, Key.tab)) {
                  inputMode = false;
                  inputQuestionId = null;
                  editor.setText("");
                  currentTab = (currentTab + 1) % totalTabs;
                  optionIndex = 0;
                  refresh();
                  return;
                }
                if (matchesKey(data, Key.shift("tab"))) {
                  inputMode = false;
                  inputQuestionId = null;
                  editor.setText("");
                  currentTab = (currentTab - 1 + totalTabs) % totalTabs;
                  optionIndex = 0;
                  refresh();
                  return;
                }
              }

              // Escape in editor mode
              if (matchesKey(data, Key.escape)) {
                const q = inputQuestionId
                  ? questions.find((q) => q.id === inputQuestionId)
                  : undefined;
                if (q && (q.type === "select" || q.type === "multi_select")) {
                  // Return to options view
                  inputMode = false;
                  inputQuestionId = null;
                  editor.setText("");
                  refresh();
                } else {
                  // For input type: cancel the whole thing
                  submit(true);
                }
                return;
              }

              editor.handleInput(data);
              refresh();
              return;
            }

            // ── Tab navigation (multi-question only) ──────────────────
            // Supports both Tab/Shift+Tab and Left/Right arrows.
            if (isMulti) {
              if (
                matchesKey(data, Key.tab) ||
                matchesKey(data, Key.right)
              ) {
                // Auto-save multi_select state when navigating away
                const q = currentQuestion();
                if (q && q.type === "multi_select") {
                  saveMultiSelectAnswer(q.id);
                }
                currentTab = (currentTab + 1) % totalTabs;
                optionIndex = 0;
                refresh();
                return;
              }
              if (
                matchesKey(data, Key.shift("tab")) ||
                matchesKey(data, Key.left)
              ) {
                const q = currentQuestion();
                if (q && q.type === "multi_select") {
                  saveMultiSelectAnswer(q.id);
                }
                currentTab = (currentTab - 1 + totalTabs) % totalTabs;
                optionIndex = 0;
                refresh();
                return;
              }
            }

            // ── Confirm tab ────────────────────────────────────────────
            if (currentTab === questions.length) {
              if (matchesKey(data, Key.enter)) {
                // Auto-save all multi_select answers before submit
                for (const q of questions) {
                  if (q.type === "multi_select") {
                    saveMultiSelectAnswer(q.id);
                  }
                }
                submit(false);
              } else if (matchesKey(data, Key.escape)) {
                submit(true);
              }
              return;
            }

            const q = currentQuestion();
            if (!q) return;

            // ── Esc to cancel ──────────────────────────────────────────
            if (matchesKey(data, Key.escape)) {
              submit(true);
              return;
            }

            // ── Input type: Enter to activate editor ───────────────────
            if (q.type === "input") {
              if (matchesKey(data, Key.enter)) {
                inputMode = true;
                inputQuestionId = q.id;
                // Pre-fill with existing answer if editing
                const existing = answers.get(q.id);
                if (existing && existing.values.length > 0) {
                  editor.setText(existing.values[0]);
                } else {
                  editor.setText("");
                }
                refresh();
                return;
              }
              return;
            }

            // ── Select and Multi_select: option navigation ─────────────
            const opts = currentOptions();
            if (opts.length === 0) return;

            if (matchesKey(data, Key.up)) {
              optionIndex = Math.max(0, optionIndex - 1);
              refresh();
              return;
            }
            if (matchesKey(data, Key.down)) {
              optionIndex = Math.min(opts.length - 1, optionIndex + 1);
              refresh();
              return;
            }

            // ── Select type: Enter to choose ──────────────────────────
            if (q.type === "select") {
              if (matchesKey(data, Key.enter)) {
                const opt = opts[optionIndex];
                if (opt.isOther) {
                  inputMode = true;
                  inputQuestionId = q.id;
                  editor.setText("");
                  refresh();
                } else {
                  saveSelectAnswer(q.id, opt.value, opt.label, false);
                  advanceAfterAnswer();
                }
                return;
              }
              return;
            }

            // ── Multi_select type: Space/Enter to toggle ──────────────
            if (q.type === "multi_select") {
              if (matchesKey(data, Key.space)) {
                const opt = opts[optionIndex];
                if (!opt.isOther) {
                  const selected =
                    multiSelected.get(q.id) || new Set<string>();
                  if (selected.has(opt.value)) {
                    selected.delete(opt.value);
                  } else {
                    selected.add(opt.value);
                  }
                  multiSelected.set(q.id, selected);
                  saveMultiSelectAnswer(q.id);
                  refresh();
                }
                return;
              }

              if (matchesKey(data, Key.enter)) {
                const opt = opts[optionIndex];
                if (opt.isOther) {
                  // Open editor for custom input
                  inputMode = true;
                  inputQuestionId = q.id;
                  editor.setText("");
                  refresh();
                } else if (!isMulti) {
                  // Single question: toggle and submit
                  const selected =
                    multiSelected.get(q.id) || new Set<string>();
                  if (!selected.has(opt.value)) {
                    selected.add(opt.value);
                    multiSelected.set(q.id, selected);
                    saveMultiSelectAnswer(q.id);
                  }
                  submit(false);
                } else {
                  // Multi question: just toggle
                  const selected =
                    multiSelected.get(q.id) || new Set<string>();
                  if (selected.has(opt.value)) {
                    selected.delete(opt.value);
                  } else {
                    selected.add(opt.value);
                  }
                  multiSelected.set(q.id, selected);
                  saveMultiSelectAnswer(q.id);
                  refresh();
                }
                return;
              }
              return;
            }
          }

          // ── Render ──────────────────────────────────────────────────

          function render(width: number): string[] {
            if (cachedLines) return cachedLines;

            const lines: string[] = [];
            const add = (s: string) =>
              lines.push(truncateToWidth(s, width));

            const q = currentQuestion();
            const opts = currentOptions();

            add(theme.fg("accent", "─".repeat(width)));

            // ── Tab bar (multi-question only) ─────────────────────────
            if (isMulti) {
              const tabs: string[] = ["← "];
              for (let i = 0; i < questions.length; i++) {
                const isActive = i === currentTab;
                const isAnswered = answers.has(questions[i].id);
                const lbl = questions[i].label;
                const box = isAnswered ? "■" : "□";
                const color = isAnswered ? "success" : "muted";
                const text = ` ${box} ${lbl} `;
                const styled = isActive
                  ? theme.bg("selectedBg", theme.fg("text", text))
                  : theme.fg(color, text);
                tabs.push(`${styled} `);
              }
              // Confirm tab
              const canSubmit = allAnswered();
              const isSubmitTab = currentTab === questions.length;
              const submitText = " ✓ Confirm ";
              const submitStyled = isSubmitTab
                ? theme.bg("selectedBg", theme.fg("text", submitText))
                : theme.fg(canSubmit ? "success" : "dim", submitText);
              tabs.push(`${submitStyled} →`);
              add(` ${tabs.join("")}`);
              lines.push("");
            }

            // ── Content by mode ───────────────────────────────────────

            if (currentTab === questions.length) {
              // ── Confirm tab ──────────────────────────────────────────
              add(theme.fg("accent", theme.bold(" Review and confirm")));
              lines.push("");

              for (const question of questions) {
                const answer = answers.get(question.id);
                const answered = !!answer && answer.values.length > 0;

                add(
                  `${theme.fg(answered ? "success" : "dim", answered ? "■" : "□")} ${theme.fg("accent", question.label)}`,
                );

                if (answered && answer) {
                  if (answer.type === "input") {
                    const text =
                      answer.values[0].length > 50
                        ? answer.values[0].slice(0, 47) + "..."
                        : answer.values[0];
                    add(`   ${theme.fg("muted", "(wrote) ")}${theme.fg("text", text)}`);
                  } else if (answer.type === "select") {
                    const hasCustom = answer.customValues.length > 0;
                    const prefix = hasCustom ? "(wrote) " : "";
                    add(`   ${theme.fg("text", prefix + answer.labels.join(", "))}`);
                  } else if (answer.type === "multi_select") {
                    const displayLabels: string[] = [];
                    for (const label of answer.labels) {
                      if (answer.customValues.includes(label)) {
                        displayLabels.push(`(wrote) ${label}`);
                      } else {
                        displayLabels.push(label);
                      }
                    }
                    add(`   ${theme.fg("text", displayLabels.join(", "))}`);
                  }
                } else {
                  add(`   ${theme.fg("dim", "Not answered")}`);
                }
              }

              lines.push("");
              if (allAnswered()) {
                add(theme.fg("success", " Press Enter to submit"));
              } else {
                const missing = questions
                  .filter((q) => !answers.has(q.id) || answers.get(q.id)!.values.length === 0)
                  .map((q) => q.label)
                  .join(", ");
                add(theme.fg("warning", ` Unanswered: ${missing}`));
                add(theme.fg("dim", " Press Enter to submit anyway"));
              }
            } else if (inputMode && q) {
              // ── Editor mode (input type or "Type something") ─────────
              add(theme.fg("text", ` ${q.prompt}`));
              lines.push("");

              // Show options for reference when in select/multi_select custom
              if (q.type === "select" || q.type === "multi_select") {
                add(theme.fg("muted", " Options for reference:"));
                for (let i = 0; i < q.options.length; i++) {
                  add(`   ${theme.fg("dim", `${i + 1}. ${q.options[i].label}`)}`);
                }
                lines.push("");
              }

              add(theme.fg("muted", " Your answer:"));
              for (const line of editor.render(width - 2)) {
                add(` ${line}`);
              }

              lines.push("");
              if (isMulti) {
                add(
                  theme.fg(
                    "dim",
                    " Enter to submit • Tab to navigate • Esc to cancel",
                  ),
                );
              } else {
                add(
                  theme.fg("dim", " Enter to submit • Esc to cancel"),
                );
              }
            } else if (q && q.type === "input") {
              // ── Input type (pre-editor) ─────────────────────────────
              add(theme.fg("text", ` ${q.prompt}`));
              lines.push("");

              // Show current answer if exists
              const existing = answers.get(q.id);
              if (existing && existing.values.length > 0) {
                add(
                  `${theme.fg("success", "✓")} ${theme.fg("text", existing.values[0])}`,
                );
                lines.push("");
              }

              add(
                theme.fg(
                  "accent",
                  ` ${theme.bold("Click Enter to type your answer")} ✎`,
                ),
              );
              lines.push("");
              if (isMulti) {
                add(
                  theme.fg(
                    "dim",
                    " Enter to type • Tab/←→ to navigate • Esc to cancel",
                  ),
                );
              } else {
                add(
                  theme.fg(
                    "dim",
                    " Enter to type • Esc to cancel",
                  ),
                );
              }
            } else if (q && (q.type === "select" || q.type === "multi_select")) {
              // ── Options list ─────────────────────────────────────────
              const isMultiSelect = q.type === "multi_select";

              add(theme.fg("text", ` ${q.prompt}`));
              lines.push("");

              for (let i = 0; i < opts.length; i++) {
                const opt = opts[i];
                const selected = i === optionIndex;
                const isOther = opt.isOther === true;

                // Determine prefix/indicator
                let indicator = "";
                if (isMultiSelect) {
                  const sel =
                    multiSelected.get(q.id) || new Set<string>();
                  const isChecked = sel.has(opt.value);
                  indicator = selected
                    ? theme.fg("accent", isChecked ? "▣" : "▢")
                    : isChecked
                      ? theme.fg("success", "☑")
                      : theme.fg("dim", "☐");
                } else {
                  indicator = selected
                    ? theme.fg("accent", ">")
                    : " ";
                }

                const numPrefix = theme.fg(
                  selected ? "accent" : "dim",
                  `${i + 1}.`,
                );

                // Mark "Type something" differently
                if (isOther) {
                  if (selected) {
                    add(
                      `${indicator} ${numPrefix} ${theme.fg("accent", `${opt.label} ✎`)}`,
                    );
                  } else {
                    add(
                      `${indicator} ${numPrefix} ${theme.fg("muted", opt.label)}`,
                    );
                  }
                } else if (selected) {
                  add(
                    `${indicator} ${numPrefix} ${theme.fg("accent", opt.label)}`,
                  );
                } else {
                  add(
                    `${indicator} ${numPrefix} ${theme.fg("text", opt.label)}`,
                  );
                }

                // Show description if present
                if (opt.description) {
                  add(
                    `      ${theme.fg("muted", opt.description)}`,
                  );
                }
              }

              // Show "checked" list for multi_select
              if (isMultiSelect) {
                const sel =
                  multiSelected.get(q.id) || new Set<string>();
                const checkedOpts = q.options.filter((o) =>
                  sel.has(o.value),
                );
                const customCount = Array.from(sel).filter((k) =>
                  k.startsWith("__custom__"),
                ).length;

                if (checkedOpts.length > 0 || customCount > 0) {
                  lines.push("");
                  const parts: string[] = [];
                  for (const o of checkedOpts) {
                    parts.push(
                      theme.fg("success", o.label),
                    );
                  }
                  for (let i = 0; i < customCount; i++) {
                    parts.push(
                      theme.fg("muted", "(custom)"),
                    );
                  }
                  add(` ${theme.fg("dim", "Selected:")} ${parts.join(", ")}`);
                }
              }

              lines.push("");
              if (isMultiSelect) {
                if (isMulti) {
                  add(
                    theme.fg(
                      "dim",
                      " Space/Enter to toggle • Tab/←→ to navigate • Esc to cancel",
                    ),
                  );
                } else {
                  add(
                    theme.fg(
                      "dim",
                      " Space to toggle • Enter to submit • Esc to cancel",
                    ),
                  );
                }
              } else {
                if (isMulti) {
                  add(
                    theme.fg(
                      "dim",
                      " ↑↓ navigate • Enter to select • Tab/←→ to navigate • Esc to cancel",
                    ),
                  );
                } else {
                  add(
                    theme.fg(
                      "dim",
                      " ↑↓ navigate • Enter to select • Esc to cancel",
                    ),
                  );
                }
              }
            }

            // ── Bottom border ──────────────────────────────────────────
            add(theme.fg("accent", "─".repeat(width)));

            cachedLines = lines;
            return lines;
          }

          return {
            render,
            invalidate: () => {
              cachedLines = undefined;
              editor.invalidate();
            },
            handleInput,
          };
        },
      );

      // ── Build result ────────────────────────────────────────────────

      if (result.cancelled) {
        return {
          content: [
            { type: "text", text: "User cancelled the question(s)" },
          ],
          details: result,
        };
      }

      // Format answer text
      const answerLines = result.answers.map((a) => {
        const qLabel = a.label || a.id;
        if (a.type === "input") {
          return `${qLabel}: ${a.values[0] || "(no response)"}`;
        }
        if (a.customValues.length === a.values.length) {
          // All custom
          return `${qLabel}: wrote: ${a.labels.join(", ")}`;
        }
        if (a.customValues.length > 0) {
          const selected = a.labels
            .filter((l) => !a.customValues.includes(l))
            .join(", ");
          const custom = a.customValues.join(", ");
          return `${qLabel}: ${selected} + wrote: ${custom}`;
        }
        return `${qLabel}: ${a.labels.join(", ")}`;
      });

      return {
        content: [{ type: "text", text: answerLines.join("\n") }],
        details: result,
      };
    },

    // ── Custom rendering ──────────────────────────────────────────────

    renderCall(args, theme, _context) {
      const qs = (args.questions as QuestionDefinition[]) || [];
      const count = qs.length;
      const labels = qs.map((q) => q.label || q.id).join(", ");
      let text =
        theme.fg("toolTitle", theme.bold("question ")) +
        theme.fg("muted", `${count} question${count !== 1 ? "s" : ""}`);
      if (labels) {
        text +=
          theme.fg("dim", ` (${truncateToWidth(labels, 40)})`);
      }
      return new Text(text, 0, 0);
    },

    renderResult(result, _options, theme, _context) {
      const details = result.details as QuestionResult | undefined;
      if (!details) {
        const text = result.content[0];
        return new Text(
          text?.type === "text" ? text.text : "",
          0,
          0,
        );
      }
      if (details.cancelled) {
        return new Text(theme.fg("warning", "Cancelled"), 0, 0);
      }
      const lines = details.answers.map((a) => {
        const qLabel = a.label || a.id;
        const prefix = theme.fg("success", "✓ ") + theme.fg("accent", qLabel) + ": ";

        if (a.type === "input") {
          return prefix + theme.fg("text", a.values[0] || "(no response)");
        }
        if (a.customValues.length === a.values.length) {
          return prefix + theme.fg("muted", "(wrote) ") + theme.fg("text", a.labels.join(", "));
        }
        if (a.customValues.length > 0) {
          const selected = a.labels
            .filter((l) => !a.customValues.includes(l))
            .join(", ");
          const custom = a.customValues.join(", ");
          return (
            prefix +
            theme.fg("text", selected) +
            " + " +
            theme.fg("muted", "(wrote) ") +
            theme.fg("text", custom)
          );
        }
        return prefix + theme.fg("text", a.labels.join(", "));
      });
      return new Text(lines.join("\n"), 0, 0);
    },
  });
}
