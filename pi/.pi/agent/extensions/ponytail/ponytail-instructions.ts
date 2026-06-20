/**
 * Shared Ponytail instruction builder for the Pi extension.
 *
 * Resolves the ponytail SKILL.md across common install locations:
 *   1. $PONYTAIL_SKILL_PATH env override (explicit)
 *   2. Walk up from this file looking for `skills/ponytail/SKILL.md`
 *      (handles the original `ponytail/skills/ponytail/SKILL.md` layout)
 *   3. $HOME/.agents/skills/ponytail/SKILL.md (current pi layout)
 *   4. $XDG_CONFIG_HOME/../skills/ponytail/SKILL.md (legacy fallback)
 *
 * Falls back to a built-in ruleset when the file is unreadable.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  DEFAULT_MODE,
  normalizeMode,
  normalizePersistedMode,
  type PersistedMode,
  type RuntimeMode,
} from "./ponytail-config.js";

const INDEPENDENT_MODES: ReadonlySet<string> = new Set(["review"]);

let cachedSkillPath: string | null | undefined;

/**
 * Find the ponytail SKILL.md across known install layouts.
 *
 * Returns null when no file is found at any candidate location; the caller
 * falls back to a built-in ruleset in that case.
 */
function resolveSkillPath(): string | null {
  if (cachedSkillPath !== undefined) return cachedSkillPath;

  const envOverride = process.env.PONYTAIL_SKILL_PATH;
  if (envOverride && fs.existsSync(envOverride)) {
    cachedSkillPath = envOverride;
    return cachedSkillPath;
  }

  // Walk up from this file looking for `skills/ponytail/SKILL.md`.
  // Handles the upstream repo layout: <repo>/skills/ponytail/SKILL.md,
  // <repo>/<pkg>/skills/ponytail/SKILL.md, and dotfile-style mirrors.
  let dir = __dirname;
  for (let i = 0; i < 6; i += 1) {
    const candidate = path.join(dir, "skills", "ponytail", "SKILL.md");
    if (fs.existsSync(candidate)) {
      cachedSkillPath = candidate;
      return cachedSkillPath;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  // Current pi layout: ~/.agents/skills/ponytail/SKILL.md
  const home = os.homedir();
  const homeAgent = path.join(home, ".agents", "skills", "ponytail", "SKILL.md");
  if (fs.existsSync(homeAgent)) {
    cachedSkillPath = homeAgent;
    return cachedSkillPath;
  }

  // XDG layout: $XDG_CONFIG_HOME/../skills/ponytail/SKILL.md (rare).
  if (process.env.XDG_CONFIG_HOME) {
    const xdgCandidate = path.join(
      process.env.XDG_CONFIG_HOME,
      "..",
      "skills",
      "ponytail",
      "SKILL.md",
    );
    if (fs.existsSync(xdgCandidate)) {
      cachedSkillPath = xdgCandidate;
      return cachedSkillPath;
    }
  }

  cachedSkillPath = null;
  return cachedSkillPath;
}

/** Strip YAML frontmatter so the body filtering rules apply cleanly. */
function stripFrontmatter(body: string): string {
  return String(body ?? "").replace(/^---[\s\S]*?---\s*/, "");
}

/**
 * Filter the ponytail SKILL body down to the active intensity level.
 *
 * Only the intensity table rows and worked examples are mode-specific, and both
 * are keyed by a mode name (lite/full/ultra). A bullet whose label is not a
 * mode — e.g. "No unrequested abstractions: ..." — is a normal rule and must
 * be kept verbatim.
 */
export function filterSkillBodyForMode(body: string, mode: RuntimeMode): string {
  const effectiveMode = normalizeMode(mode) ?? DEFAULT_MODE;
  const withoutFrontmatter = stripFrontmatter(body);

  return withoutFrontmatter
    .split(/\r?\n/)
    .filter((line) => {
      const tableLabel = line.match(/^\|\s*\*\*(.+?)\*\*\s*\|/);
      if (tableLabel) {
        const labelMode = normalizeMode(tableLabel[1].trim());
        if (labelMode) return labelMode === effectiveMode;
      }

      const exampleLabel = line.match(/^-\s*([^:]+):\s*/);
      if (exampleLabel) {
        const labelMode = normalizeMode(exampleLabel[1].trim());
        if (labelMode) return labelMode === effectiveMode;
      }

      return true;
    })
    .join("\n");
}

function getFallbackInstructions(mode: RuntimeMode): string {
  return (
    `PONYTAIL MODE ACTIVE — level: ${mode}\n\n` +
    "You are a lazy senior developer. Lazy means efficient, not careless. The best code is the code never written.\n\n" +
    "## Persistence\n\n" +
    'ACTIVE EVERY RESPONSE. No drift back to over-building. Still active if unsure. Off only: "stop ponytail" / "normal mode".\n\n' +
    `Current level: **${mode}**. Switch: \`/ponytail lite|full|ultra\`.\n\n` +
    "## The ladder\n\n" +
    "Before any code, stop at the first rung that holds:\n" +
    "1. Does this need to be built at all? (YAGNI)\n" +
    "2. Does the standard library do this? Use it.\n" +
    "3. Does a native platform feature cover it? Use it.\n" +
    "4. Does an already-installed dependency solve it? Use it.\n" +
    "5. Can this be one line? Make it one line.\n" +
    "6. Only then: write the minimum code that works.\n\n" +
    "## Rules\n\n" +
    "No abstractions that were not requested. No avoidable dependencies. No boilerplate nobody asked for. " +
    "Deletion over addition. Boring over clever. Fewest files possible. " +
    "Ship the lazy version and question the complex request in the same response — never stall. " +
    "Between two same-size stdlib options, pick the one correct on edge cases. " +
    "Mark intentional simplifications with a `ponytail:` comment — a shortcut with a known ceiling names the ceiling and the upgrade path in the comment.\n\n" +
    "## Output\n\n" +
    "Code first. Then at most three short lines: what was skipped, when to add it. " +
    "If the explanation is longer than the code, delete the explanation. " +
    "Explanation the user explicitly asked for is not debt, give it in full.\n\n" +
    "## When NOT to be lazy\n\n" +
    "Never simplify away: input validation at trust boundaries, error handling that prevents data loss, " +
    "security measures, accessibility basics, the calibration real hardware needs (the platform is never the spec ideal), anything the user explicitly asked to keep. " +
    "Lazy code without its check is unfinished: non-trivial logic leaves ONE runnable check behind (assert-based demo/self-check or one small test file; no frameworks). Trivial one-liners need no test.\n\n" +
    "## Boundaries\n\n" +
    'Ponytail governs what you build, not how you talk. "stop ponytail" or "normal mode": revert. Level persists until changed or session end.'
  );
}

/**
 * Build the system-prompt injection for the active mode.
 *
 * Falls back to a built-in ruleset when SKILL.md is unreadable; this keeps
 * activation functional in environments where the skill file has not been
 * installed yet (greenfield CI, smoke tests).
 */
export function getPonytailInstructions(mode: PersistedMode): string {
  const configuredMode = normalizePersistedMode(mode) ?? DEFAULT_MODE;

  if (INDEPENDENT_MODES.has(configuredMode)) {
    return `PONYTAIL MODE ACTIVE — level: ${configuredMode}. Behavior defined by /ponytail-${configuredMode} skill.`;
  }

  const effectiveMode = normalizeMode(configuredMode) ?? DEFAULT_MODE;

  try {
    const skillPath = resolveSkillPath();
    if (!skillPath) return getFallbackInstructions(effectiveMode);
    return (
      `PONYTAIL MODE ACTIVE — level: ${effectiveMode}\n\n` +
      filterSkillBodyForMode(fs.readFileSync(skillPath, "utf8"), effectiveMode)
    );
  } catch {
    return getFallbackInstructions(effectiveMode);
  }
}

/** Test-only: clear the cached SKILL.md path so a fresh lookup is forced. */
export function _resetSkillPathCache(): void {
  cachedSkillPath = undefined;
}
