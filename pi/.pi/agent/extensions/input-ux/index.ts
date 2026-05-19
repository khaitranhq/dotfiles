/**
 * Input UX Extension
 *
 * Unified input experience for:
 * - agent mentions (`@coder ...`)
 * - fuzzy file search
 * - fuzzy folder search
 * - per-directory prompt history on ↑/↓
 *
 * This replaces the migrated `fuzzy-search` autocomplete/input handling and the
 * `@agent` autocomplete/input handling that previously lived in `subagent`.
 */

import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  CustomEditor,
  type ExtensionAPI,
  type KeybindingsManager,
  getAgentDir,
} from "@earendil-works/pi-coding-agent";
import {
  fuzzyMatch,
  type AutocompleteItem,
  type AutocompleteProvider,
  type AutocompleteSuggestions,
} from "@earendil-works/pi-tui";
import { type AgentConfig, discoverAgents } from "../subagent/agents";

const FILE_CACHE_TTL = 60_000;
const AGENT_CACHE_TTL = 30_000;
const PATH_LIST_LIMIT = 10_000;
const MAX_AUTOCOMPLETE_RESULTS = 100;
const AUTOCOMPLETE_MAX_VISIBLE = 20;
const MIN_FUZZY_RESOLUTION_SCORE = 520;
const INPUT_HISTORY_FILE = "input-history.json";
const INPUT_HISTORY_LIMIT = 100;

const FIND_PRUNE = String.raw`\( \
  -path './node_modules' -o -path '*/node_modules' -o -path '*/node_modules/*' -o \
  -path './.git' -o -path '*/.git' -o -path '*/.git/*' -o \
  -path './dist' -o -path '*/dist' -o -path '*/dist/*' -o \
  -path './.next' -o -path '*/.next' -o -path '*/.next/*' -o \
  -path './build' -o -path '*/build' -o -path '*/build/*' -o \
  -path './target' -o -path '*/target' -o -path '*/target/*' -o \
  -path './__pycache__' -o -path '*/__pycache__' -o -path '*/__pycache__/*' -o \
  -path './vendor' -o -path '*/vendor' -o -path '*/vendor/*' -o \
  -path './.venv' -o -path '*/.venv' -o -path '*/.venv/*' -o \
  -path './.cache' -o -path '*/.cache' -o -path '*/.cache/*' \
\) -prune -o`;

interface ProjectPathCache {
  cwd: string;
  files: string[];
  directories: string[];
  timestamp: number;
}

interface AgentCache {
  cwd: string;
  agents: AgentConfig[];
  timestamp: number;
}

interface MentionContext {
  prefix: string;
}

interface PersistedInputHistoryFile {
  version: 1;
  histories: Record<string, string[]>;
}

type CandidateKind = "agent" | "file" | "directory";

interface BaseCandidate {
  kind: CandidateKind;
  key: string;
}

interface AgentCandidate extends BaseCandidate {
  kind: "agent";
  agent: AgentConfig;
}

interface FileCandidate extends BaseCandidate {
  kind: "file";
}

interface DirectoryCandidate extends BaseCandidate {
  kind: "directory";
}

type Candidate = AgentCandidate | FileCandidate | DirectoryCandidate;

interface RankedCandidate {
  candidate: Candidate;
  score: number;
}

interface EditorHistoryAdapter {
  handleInput(data: string): void;
  setText(text: string): void;
  getText(): string;
  getLines(): string[];
  getCursor(): { line: number; col: number };
  addToHistory?: (value: string) => void;
  __inputUxHistoryPatched?: boolean;
}

let projectPathCache: ProjectPathCache | null = null;
let agentCache: AgentCache | null = null;
let runtimeInputHistories: Record<string, string[]> | null = null;

function isGitRepo(cwd: string): boolean {
  try {
    const result = execSync("git rev-parse --is-inside-work-tree", {
      cwd,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5_000,
    });
    return result.trim() === "true";
  } catch {
    return false;
  }
}

function listGitFiles(cwd: string): string[] {
  try {
    const output = execSync("git ls-files --cached --others --exclude-standard -z", {
      cwd,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 10 * 1024 * 1024,
      timeout: 10_000,
    });

    return output
      .split("\0")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .slice(0, PATH_LIST_LIMIT);
  } catch {
    return [];
  }
}

function listFindFiles(cwd: string): string[] {
  try {
    const output = execSync(
      `find . ${FIND_PRUNE} -type f -print | head -n ${PATH_LIST_LIMIT}`,
      {
        cwd,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],
        maxBuffer: 10 * 1024 * 1024,
        timeout: 10_000,
      },
    );

    return output
      .split("\n")
      .map((entry) => entry.replace(/^\.\//, "").trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function listFindDirectories(cwd: string): string[] {
  try {
    const output = execSync(
      `find . ${FIND_PRUNE} -type d -print | head -n ${PATH_LIST_LIMIT}`,
      {
        cwd,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],
        maxBuffer: 10 * 1024 * 1024,
        timeout: 10_000,
      },
    );

    return output
      .split("\n")
      .map((entry) => entry.replace(/^\.\//, "").trim())
      .filter((entry) => entry.length > 0 && entry !== ".");
  } catch {
    return [];
  }
}

function buildDirectoriesFromFiles(files: string[]): string[] {
  const directories = new Set<string>();

  for (const file of files) {
    let current = path.posix.dirname(file.replace(/\\/g, "/"));
    while (current && current !== "." && current !== "/") {
      directories.add(current);
      const next = path.posix.dirname(current);
      if (next === current) break;
      current = next;
    }
  }

  return Array.from(directories);
}

function sortPaths(paths: string[]): string[] {
  return paths.sort((a, b) => {
    const depthDiff = getPathDepth(a) - getPathDepth(b);
    if (depthDiff !== 0) return depthDiff;
    return a.localeCompare(b);
  });
}

function getProjectPaths(cwd: string): { files: string[]; directories: string[] } {
  const now = Date.now();
  if (projectPathCache && projectPathCache.cwd === cwd && now - projectPathCache.timestamp < FILE_CACHE_TTL) {
    return {
      files: projectPathCache.files,
      directories: projectPathCache.directories,
    };
  }

  let files: string[] = [];
  let directories: string[] = [];

  if (isGitRepo(cwd)) {
    files = listGitFiles(cwd);
    if (files.length > 0) {
      directories = buildDirectoriesFromFiles(files);
    } else {
      files = listFindFiles(cwd);
      directories = listFindDirectories(cwd);
    }
  } else {
    files = listFindFiles(cwd);
    directories = listFindDirectories(cwd);
  }

  projectPathCache = {
    cwd,
    files: sortPaths(files),
    directories: sortPaths(Array.from(new Set(directories))),
    timestamp: now,
  };

  return {
    files: projectPathCache.files,
    directories: projectPathCache.directories,
  };
}

function invalidateProjectPathCache() {
  projectPathCache = null;
}

function getAgents(cwd: string): AgentConfig[] {
  const now = Date.now();
  if (agentCache && agentCache.cwd === cwd && now - agentCache.timestamp < AGENT_CACHE_TTL) {
    return agentCache.agents;
  }

  const discovery = discoverAgents(cwd, "both");
  const agents = [...discovery.subagents, ...discovery.primaryAgents];
  agentCache = {
    cwd,
    agents,
    timestamp: now,
  };

  return agents;
}

function extractMentionContext(beforeCursor: string): MentionContext | null {
  const match = beforeCursor.match(/(?:^|[\s([{])@([^\s@]*)$/);
  if (!match) return null;

  return {
    prefix: match[1] ?? "",
  };
}

function getPathDepth(value: string): number {
  return value.split("/").filter(Boolean).length - 1;
}

function basenameWithoutExtension(filePath: string): string {
  const base = path.posix.basename(filePath.replace(/\\/g, "/"));
  const ext = path.posix.extname(base);
  return ext ? base.slice(0, -ext.length) : base;
}

function getCandidateAliases(candidate: Candidate): string[] {
  switch (candidate.kind) {
    case "agent":
      return [candidate.agent.name];
    case "directory": {
      const basename = path.posix.basename(candidate.key);
      return basename === candidate.key ? [candidate.key] : [candidate.key, basename];
    }
    case "file": {
      const basename = path.posix.basename(candidate.key);
      const noExt = basenameWithoutExtension(candidate.key);
      return Array.from(new Set([candidate.key, basename, noExt]));
    }
  }
}

function scoreText(query: string, rawText: string): number {
  const normalizedQuery = query.trim().toLowerCase();
  const normalizedText = rawText.trim().toLowerCase();
  if (!normalizedQuery || !normalizedText) return Number.NEGATIVE_INFINITY;

  const extraLength = Math.max(0, normalizedText.length - normalizedQuery.length);
  const segments = normalizedText.split("/").filter(Boolean);

  if (normalizedText === normalizedQuery) return 1200;
  if (segments.includes(normalizedQuery)) return 1150 - extraLength;
  if (normalizedText.startsWith(normalizedQuery)) return 1000 - extraLength * 2;
  if (segments.some((segment) => segment.startsWith(normalizedQuery))) {
    return 950 - extraLength * 2;
  }

  const includesIndex = normalizedText.indexOf(normalizedQuery);
  if (includesIndex >= 0) return 800 - includesIndex - extraLength;

  if (normalizedQuery.length < 3) return Number.NEGATIVE_INFINITY;

  const match = fuzzyMatch(normalizedQuery, normalizedText);
  if (!match.matches) return Number.NEGATIVE_INFINITY;

  return 600 - Math.round(match.score) - extraLength * 2;
}

function scoreCandidate(query: string, candidate: Candidate): number {
  let best = Number.NEGATIVE_INFINITY;
  for (const alias of getCandidateAliases(candidate)) {
    best = Math.max(best, scoreText(query, alias));
  }
  return best;
}

function getDefaultCandidateScore(candidate: Candidate): number {
  const depth = candidate.kind === "agent" ? 0 : getPathDepth(candidate.key);
  return 1000 - depth * 40 - candidate.key.length;
}

function compareRankedCandidates(a: RankedCandidate, b: RankedCandidate): number {
  if (a.score !== b.score) return b.score - a.score;

  const defaultScoreDiff = getDefaultCandidateScore(b.candidate) - getDefaultCandidateScore(a.candidate);
  if (defaultScoreDiff !== 0) return defaultScoreDiff;

  return a.candidate.key.localeCompare(b.candidate.key);
}

function buildCandidates(cwd: string): Candidate[] {
  const agents = getAgents(cwd).map<AgentCandidate>((agent) => ({
    kind: "agent",
    key: agent.name,
    agent,
  }));

  const { files, directories } = getProjectPaths(cwd);
  const directoryCandidates = directories.map<DirectoryCandidate>((directory) => ({
    kind: "directory",
    key: directory,
  }));
  const fileCandidates = files.map<FileCandidate>((file) => ({
    kind: "file",
    key: file,
  }));

  return [...agents, ...directoryCandidates, ...fileCandidates];
}

function rankCandidates(cwd: string, query: string): RankedCandidate[] {
  const candidates = buildCandidates(cwd);

  if (!query.trim()) {
    return candidates
      .map((candidate) => ({
        candidate,
        score: getDefaultCandidateScore(candidate),
      }))
      .sort(compareRankedCandidates)
      .slice(0, MAX_AUTOCOMPLETE_RESULTS);
  }

  return candidates
    .map((candidate) => ({
      candidate,
      score: scoreCandidate(query, candidate),
    }))
    .filter((ranked) => ranked.score > Number.NEGATIVE_INFINITY)
    .sort(compareRankedCandidates)
    .slice(0, MAX_AUTOCOMPLETE_RESULTS);
}

function candidateToAutocompleteItem(candidate: Candidate): AutocompleteItem {
  switch (candidate.kind) {
    case "agent":
      return {
        value: `@${candidate.agent.name} `,
        label: `🤖 @${candidate.agent.name}`,
        description: `${candidate.agent.description} (${candidate.agent.source}, ${candidate.agent.mode})`,
      };
    case "directory": {
      const dirBasename = path.posix.basename(candidate.key);
      const dirParent = path.posix.dirname(candidate.key);
      const hasParent = dirParent !== "." && dirParent !== candidate.key;
      return {
        value: `@${candidate.key} `,
        label: `📁 ${hasParent ? dirBasename : candidate.key}`,
        description: hasParent ? dirParent : "Directory",
      };
    }
    case "file": {
      const fileBasename = path.posix.basename(candidate.key);
      const fileDir = path.posix.dirname(candidate.key);
      const hasDir = fileDir !== "." && fileDir !== candidate.key;
      return {
        value: `@${candidate.key} `,
        label: `📄 ${fileBasename}`,
        description: hasDir ? fileDir : "File",
      };
    }
  }
}

function formatCandidateReference(candidate: Candidate): string {
  switch (candidate.kind) {
    case "agent":
      return `@${candidate.agent.name}`;
    case "directory":
      return `${candidate.key}/`;
    case "file":
      return candidate.key;
  }
}

function buildPathInstruction(kind: "file" | "directory", target: string, trailing: string): string {
  if (kind === "file") {
    return trailing
      ? `Please read the file at ${target} and then ${trailing}`
      : `Please read the file at ${target}`;
  }

  return trailing
    ? `Please inspect the directory at ${target} and then ${trailing}`
    : `Please inspect the directory at ${target}`;
}

function buildAgentInstruction(agentName: string, task: string): string {
  return `Use the subagent tool to delegate the following task to the "${agentName}" agent: ${task}`;
}

function maybeNotifyMatch(
  query: string,
  ranked: RankedCandidate[],
  notify: (message: string, type?: "info" | "warning" | "error") => void,
) {
  const best = ranked[0];
  if (!best) return;

  const aliases = getCandidateAliases(best.candidate).map((alias) => alias.toLowerCase());
  if (aliases.includes(query.toLowerCase())) return;

  const alternatives = ranked
    .slice(1, 4)
    .map((entry) => formatCandidateReference(entry.candidate));

  notify(
    `Matched @${query} → ${formatCandidateReference(best.candidate)}${alternatives.length > 0 ? ` (also: ${alternatives.join(", ")})` : ""}`,
    "info",
  );
}

function getInputHistoryFilePath(): string {
  return path.join(getAgentDir(), INPUT_HISTORY_FILE);
}

function normalizeHistoryText(text: string): string {
  return text.replace(/\r\n?/g, "\n").trim();
}

function loadPersistedInputHistories(): Record<string, string[]> {
  const historyFilePath = getInputHistoryFilePath();

  try {
    if (!fs.existsSync(historyFilePath)) {
      return {};
    }

    const raw = fs.readFileSync(historyFilePath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<PersistedInputHistoryFile>;
    if (!parsed || typeof parsed !== "object" || typeof parsed.histories !== "object") {
      return {};
    }

    const histories: Record<string, string[]> = {};
    for (const [cwd, entries] of Object.entries(parsed.histories)) {
      if (!Array.isArray(entries)) continue;

      const normalizedEntries = entries
        .map((entry) => (typeof entry === "string" ? normalizeHistoryText(entry) : ""))
        .filter(Boolean)
        .slice(0, INPUT_HISTORY_LIMIT);

      if (normalizedEntries.length > 0) {
        histories[cwd] = normalizedEntries;
      }
    }

    return histories;
  } catch (error) {
    console.error(`[input-ux] Failed to load persisted input history: ${error}`);
    return {};
  }
}

function getRuntimeInputHistories(): Record<string, string[]> {
  if (runtimeInputHistories === null) {
    runtimeInputHistories = loadPersistedInputHistories();
  }

  return runtimeInputHistories;
}

function savePersistedInputHistories(histories: Record<string, string[]>) {
  const historyFilePath = getInputHistoryFilePath();
  const tempFilePath = `${historyFilePath}.${process.pid}.${Date.now()}.tmp`;

  try {
    fs.mkdirSync(path.dirname(historyFilePath), { recursive: true });
    const payload: PersistedInputHistoryFile = {
      version: 1,
      histories,
    };
    fs.writeFileSync(tempFilePath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
    fs.renameSync(tempFilePath, historyFilePath);
  } catch (error) {
    console.error(`[input-ux] Failed to save persisted input history: ${error}`);
    try {
      fs.rmSync(tempFilePath, { force: true });
    } catch {
      // Ignore temp cleanup failures.
    }
  }
}

function getPersistedInputHistory(cwd: string): string[] {
  const histories = getRuntimeInputHistories();
  const normalizedCwd = path.resolve(cwd);
  if (!histories[normalizedCwd]) {
    histories[normalizedCwd] = [];
  }
  return histories[normalizedCwd];
}

function rememberSubmittedInput(cwd: string, text: string) {
  const normalizedText = normalizeHistoryText(text);
  if (!normalizedText) return;

  const normalizedCwd = path.resolve(cwd);
  const histories = getRuntimeInputHistories();
  const existingHistory = histories[normalizedCwd] ?? [];
  const nextHistory = [normalizedText, ...existingHistory.filter((entry) => entry !== normalizedText)]
    .slice(0, INPUT_HISTORY_LIMIT);

  histories[normalizedCwd] = nextHistory;
  savePersistedInputHistories(histories);
}

function applyAutocompleteSize(editor: unknown) {
  if (!editor || typeof editor !== "object") return;

  const maybeEditor = editor as { setAutocompleteMaxVisible?: (value: number) => void };
  if (typeof maybeEditor.setAutocompleteMaxVisible === "function") {
    maybeEditor.setAutocompleteMaxVisible(AUTOCOMPLETE_MAX_VISIBLE);
  }
}

function canPatchEditorHistory(editor: unknown): editor is EditorHistoryAdapter {
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

function attachScopedInputHistory(
  editor: unknown,
  cwd: string,
  keybindings: KeybindingsManager,
) {
  if (!canPatchEditorHistory(editor) || editor.__inputUxHistoryPatched) {
    return;
  }

  const historyEditor: EditorHistoryAdapter = editor;
  const historyEntries = getPersistedInputHistory(cwd);
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
      if (navigateHistory(-1)) {
        return;
      }
    }

    if (keybindings.matches(data, "tui.editor.cursorDown") && isOnLastInputLine()) {
      if (navigateHistory(1)) {
        return;
      }
    }

    if (browseIndex !== -1) {
      browseIndex = -1;
      draftText = "";
    }

    originalHandleInput(data);
  };

  historyEditor.addToHistory = () => {
    // Ignore pi's session-populated editor history. We use cwd-scoped history instead.
  };
  historyEditor.__inputUxHistoryPatched = true;
}

export default function (pi: ExtensionAPI) {
  pi.on("tool_result", async (event) => {
    if (
      event.toolName === "write" ||
      event.toolName === "edit" ||
      (event.toolName === "bash" &&
        event.input &&
        typeof event.input.command === "string" &&
        /\b(?:mkdir|touch|rm|mv|cp)\b/.test(event.input.command))
    ) {
      invalidateProjectPathCache();
    }
  });

  pi.on("session_start", async (_event, ctx) => {
    const currentEditorFactory = ctx.ui.getEditorComponent();
    ctx.ui.setEditorComponent((tui, theme, keybindings) => {
      const editor = currentEditorFactory
        ? currentEditorFactory(tui, theme, keybindings)
        : new CustomEditor(tui, theme, keybindings);
      applyAutocompleteSize(editor);
      attachScopedInputHistory(editor, ctx.cwd, keybindings);
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

          const ranked = rankCandidates(ctx.cwd, mention.prefix);
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

    rememberSubmittedInput(ctx.cwd, event.text);

    const match = event.text.match(/^@(\S+)(?:\s+(.*))?$/);
    if (!match) return;

    const [, rawName, rawRest] = match;
    const name = rawName.trim();
    const trailing = rawRest?.trim() ?? "";
    if (name.length < 2 && trailing === "") {
      return { action: "continue" };
    }

    const agents = getAgents(ctx.cwd);
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

    const ranked = rankCandidates(ctx.cwd, name).filter(
      (entry) => entry.score >= MIN_FUZZY_RESOLUTION_SCORE,
    );
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
