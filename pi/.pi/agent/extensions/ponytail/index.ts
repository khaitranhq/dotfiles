/**
 * Ponytail Pi Extension — lazy senior-dev mode for AI agents.
 *
 * Mirrors the upstream `pi-extension/index.js` behavior:
 *   - /ponytail [lite|full|ultra|off|status|default <mode>]
 *   - Persists mode across turns via a `ponytail-mode` custom session entry.
 *   - Restores the latest persisted mode on `session_start`.
 *   - Injects the active ruleset on `before_agent_start`.
 *   - Disables itself when the user types "stop ponytail" or "normal mode".
 *   - Aliases /ponytail-review, /ponytail-audit, /ponytail-debt,
 *     /ponytail-gain, /ponytail-help to the matching SKILL.md skills.
 *
 * Pure TS port of the original JS extension; no behavior changes.
 */

import type {
  BeforeAgentStartEvent,
  BeforeAgentStartEventResult,
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
  InputEvent,
  SessionEntry,
  SessionStartEvent,
} from "@earendil-works/pi-coding-agent";
import {
  DEFAULT_MODE,
  getDefaultMode,
  normalizeMode,
  normalizeConfigMode,
  normalizePersistedMode,
  isDeactivationCommand,
  writeDefaultMode,
  type PersistedMode,
  type RuntimeMode,
  type ValidMode,
} from "./ponytail-config.js";
import { filterSkillBodyForMode, getPonytailInstructions } from "./ponytail-instructions.js";

// ── Persistence shape ─────────────────────────────────────────────────

interface PonytailModeData {
  mode: PersistedMode;
}

const MODE_ENTRY_TYPE = "ponytail-mode";

// ── Parsed command result ──────────────────────────────────────────────

export type ParseResult =
  | { type: "status" }
  | { type: "set-mode"; mode: RuntimeMode }
  | { type: "set-default"; mode: ValidMode }
  | { type: "invalid"; reason: "invalid-mode" | "invalid-default-mode"; mode?: string };

/** Parse the argument string passed to /ponytail. */
export function parsePonytailCommand(
  text: string,
  defaultMode: RuntimeMode = DEFAULT_MODE,
): ParseResult {
  const fallback: RuntimeMode = normalizeMode(defaultMode) ?? DEFAULT_MODE;
  const normalizedText = String(text || "")
    .trim()
    .toLowerCase();

  if (!normalizedText) {
    return { type: "set-mode", mode: fallback === "off" ? "full" : fallback };
  }

  const [primary, secondary] = normalizedText.split(/\s+/);

  if (primary === "status") return { type: "status" };

  if (primary === "default") {
    const mode = normalizeConfigMode(secondary);
    return mode
      ? { type: "set-default", mode }
      : { type: "invalid", reason: "invalid-default-mode" };
  }

  const mode = normalizeMode(primary);
  return mode
    ? { type: "set-mode", mode }
    : { type: "invalid", reason: "invalid-mode", mode: primary };
}

/**
 * Resolve the effective mode from the latest `ponytail-mode` entry on the
 * current branch (falls back to the full entries list).
 *
 * Returns a {@link PersistedMode} (runtime or config-only). Callers that
 * need to drive `before_agent_start` should narrow to {@link RuntimeMode}
 * via {@link normalizeMode}.
 */
export function resolveSessionMode(
  entries: readonly SessionEntry[] | null | undefined,
  fallbackMode: RuntimeMode = DEFAULT_MODE,
): PersistedMode {
  const fallback = normalizePersistedMode(fallbackMode) ?? DEFAULT_MODE;
  if (!Array.isArray(entries)) return fallback;

  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const entry = entries[i];
    if (!entry || entry.type !== "custom") continue;

    // The shape of CustomEntry is {type:"custom", customType, data?}.
    // We don't pin to a literal customType on the import side because the
    // SessionEntry union doesn't carry our extension-specific type.
    const customEntry = entry as { type: "custom"; customType?: string; data?: unknown };
    if (customEntry.customType !== MODE_ENTRY_TYPE) continue;

    const data = customEntry.data as PonytailModeData | undefined;
    const mode = normalizePersistedMode(data?.mode);
    if (mode) return mode;
  }

  return fallback;
}

// Re-export for tests and downstream consumers.
export { filterSkillBodyForMode };
export const readDefaultMode = getDefaultMode;
export { writeDefaultMode, isDeactivationCommand };

// ── Skill aliases ──────────────────────────────────────────────────────

const SKILL_ALIASES: ReadonlyArray<readonly [command: string, skill: string]> = [
  ["ponytail-review", "ponytail-review"],
  ["ponytail-audit", "ponytail-audit"],
  ["ponytail-debt", "ponytail-debt"],
  ["ponytail-gain", "ponytail-gain"],
  ["ponytail-help", "ponytail-help"],
];

// ── Extension entry point ──────────────────────────────────────────────

export default function ponytailExtension(pi: ExtensionAPI): void {
  let currentMode: PersistedMode = DEFAULT_MODE;
  let configuredDefaultMode: RuntimeMode = getDefaultMode();

  const setMode = (mode: RuntimeMode, ctx: ExtensionCommandContext | ExtensionContext): void => {
    const normalized = normalizePersistedMode(mode);
    if (!normalized) return;

    // Persisted entries can be config-only ("review"); runtime injection
    // also handles that mode by deferring to the matching skill.
    currentMode = normalized;
    pi.appendEntry(MODE_ENTRY_TYPE, { mode: normalized } satisfies PonytailModeData);
    ctx.ui?.notify?.(`Ponytail mode set to ${normalized}.`, "info");
  };

  const sendAlias = (skillName: string, args: string, ctx: ExtensionCommandContext): void => {
    const normalized = String(args || "").trim();
    const message = normalized ? `${skillName} ${normalized}` : skillName;

    if (ctx.isIdle?.() === false) {
      pi.sendUserMessage(message, { deliverAs: "followUp" });
      ctx.ui?.notify?.(`${skillName} queued as follow-up.`, "info");
      return;
    }

    pi.sendUserMessage(message);
  };

  // /ponytail <subcommand>
  pi.registerCommand("ponytail", {
    description: "Set or report Ponytail mode",
    handler: async (args, ctx) => {
      const parsed = parsePonytailCommand(args, configuredDefaultMode);

      if (parsed.type === "status") {
        ctx.ui?.notify?.(
          `Ponytail: current ${currentMode} • default ${configuredDefaultMode}`,
          "info",
        );
        return;
      }

      if (parsed.type === "set-default") {
        const written = writeDefaultMode(parsed.mode);
        if (written) {
          configuredDefaultMode = getDefaultMode();
          const message =
            configuredDefaultMode === written
              ? `Default Ponytail mode set to ${written}.`
              : `Saved default ${written}, but env override keeps default at ${configuredDefaultMode}.`;
          ctx.ui?.notify?.(message, "info");
        }
        return;
      }

      if (parsed.type === "set-mode") {
        setMode(parsed.mode, ctx);
        return;
      }

      ctx.ui?.notify?.("Unknown or unsupported /ponytail mode.", "warning");
    },
  });

  // Skill alias commands
  for (const [command, skill] of SKILL_ALIASES) {
    pi.registerCommand(command, {
      description: `Run /skill:${skill}`,
      handler: async (_args, ctx) => sendAlias(`/skill:${skill}`, "", ctx),
    });
  }

  // Watch for deactivation phrases in user input.
  pi.on("input", async (event: InputEvent) => {
    if (event?.source === "extension") return;

    const text = String(event?.text ?? "");
    if (currentMode !== "off" && isDeactivationCommand(text)) {
      // The input event carries no command context, so no UI notification —
      // matches the JS extension which also does not notify here. The mode
      // change still persists via appendEntry and is reflected in the next
      // before_agent_start.
      currentMode = "off";
      pi.appendEntry(MODE_ENTRY_TYPE, { mode: "off" } satisfies PonytailModeData);
    }
  });

  // Restore mode on session start.
  pi.on("session_start", async (_event: SessionStartEvent, ctx: ExtensionContext) => {
    const branchEntries =
      ctx.sessionManager.getBranch?.() ?? ctx.sessionManager.getEntries?.() ?? [];
    configuredDefaultMode = getDefaultMode();
    currentMode = resolveSessionMode(branchEntries, configuredDefaultMode);
  });

  // Inject the active ruleset before each agent turn.
  pi.on(
    "before_agent_start",
    async (event: BeforeAgentStartEvent): Promise<BeforeAgentStartEventResult | void> => {
      if (!currentMode || currentMode === "off") return;
      return { systemPrompt: `${event.systemPrompt}\n\n${getPonytailInstructions(currentMode)}` };
    },
  );
}
