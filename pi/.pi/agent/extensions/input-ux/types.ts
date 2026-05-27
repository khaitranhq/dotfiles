import type { AgentConfig } from "../subagent/agents";

export const FILE_CACHE_TTL = 60_000;
export const AGENT_CACHE_TTL = 30_000;
export const PATH_LIST_LIMIT = 10_000;
export const MAX_AUTOCOMPLETE_RESULTS = 100;
export const AUTOCOMPLETE_MAX_VISIBLE = 20;
export const MIN_FUZZY_RESOLUTION_SCORE = 520;
export const INPUT_HISTORY_FILE = "input-history.json";
export const INPUT_HISTORY_LIMIT = 100;

export const FIND_PRUNE = String.raw`\( \
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

export interface ProjectPathCache {
  cwd: string;
  files: string[];
  directories: string[];
  timestamp: number;
}

export interface AgentCache {
  cwd: string;
  agents: AgentConfig[];
  timestamp: number;
}

export interface MentionContext {
  prefix: string;
}

export interface PersistedInputHistoryFile {
  version: 1;
  histories: Record<string, string[]>;
}

export type CandidateKind = "agent" | "file" | "directory";

export interface BaseCandidate {
  kind: CandidateKind;
  key: string;
}

export interface AgentCandidate extends BaseCandidate {
  kind: "agent";
  agent: AgentConfig;
}

export interface FileCandidate extends BaseCandidate {
  kind: "file";
}

export interface DirectoryCandidate extends BaseCandidate {
  kind: "directory";
}

export type Candidate = AgentCandidate | FileCandidate | DirectoryCandidate;

export interface RankedCandidate {
  candidate: Candidate;
  score: number;
}

export interface EditorHistoryAdapter {
  handleInput(data: string): void;
  setText(text: string): void;
  getText(): string;
  getLines(): string[];
  getCursor(): { line: number; col: number };
  addToHistory?: (value: string) => void;
  __inputUxHistoryPatched?: boolean;
}
