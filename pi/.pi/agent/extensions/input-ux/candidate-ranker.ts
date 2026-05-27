import * as path from "node:path";
import { fuzzyMatch } from "@earendil-works/pi-tui";
import { type AgentConfig, discoverAgents } from "../subagent/agents";
import {
  AGENT_CACHE_TTL,
  MAX_AUTOCOMPLETE_RESULTS,
  type AgentCache,
  type AgentCandidate,
  type Candidate,
  type DirectoryCandidate,
  type FileCandidate,
  type RankedCandidate,
} from "./types";
import { FileSystemIndex, basenameWithoutExtension, getPathDepth } from "./file-system-index";

export class CandidateRanker {
  private readonly fileIndex: FileSystemIndex;
  private agentCache: AgentCache | null = null;

  constructor(fileIndex: FileSystemIndex) {
    this.fileIndex = fileIndex;
  }

  getAgents(cwd?: string): AgentConfig[] {
    const cwdResolved = cwd ?? process.cwd();
    const now = Date.now();

    if (
      this.agentCache &&
      this.agentCache.cwd === cwdResolved &&
      now - this.agentCache.timestamp < AGENT_CACHE_TTL
    ) {
      return this.agentCache.agents;
    }

    const discovery = discoverAgents(cwdResolved, "both");
    const agents = [...discovery.subagents, ...discovery.primaryAgents];
    this.agentCache = { cwd: cwdResolved, agents, timestamp: now };
    return agents;
  }

  invalidateAgentCache(): void {
    this.agentCache = null;
  }

  buildCandidates(cwd: string): Candidate[] {
    const agents = this.getAgents(cwd).map<AgentCandidate>((agent) => ({
      kind: "agent",
      key: agent.name,
      agent,
    }));

    const { files, directories } = this.fileIndex.getProjectPaths(cwd);

    const directoryCandidates = directories.map<DirectoryCandidate>((dir) => ({
      kind: "directory",
      key: dir,
    }));

    const fileCandidates = files.map<FileCandidate>((file) => ({
      kind: "file",
      key: file,
    }));

    return [...agents, ...directoryCandidates, ...fileCandidates];
  }

  rankCandidates(cwd: string, query: string): RankedCandidate[] {
    const candidates = this.buildCandidates(cwd);

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
}

export function getCandidateAliases(candidate: Candidate): string[] {
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

  const defaultScoreDiff =
    getDefaultCandidateScore(b.candidate) - getDefaultCandidateScore(a.candidate);
  if (defaultScoreDiff !== 0) return defaultScoreDiff;

  return a.candidate.key.localeCompare(b.candidate.key);
}
