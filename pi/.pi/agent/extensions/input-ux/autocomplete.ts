import * as path from "node:path";
import type { AutocompleteItem } from "@earendil-works/pi-tui";
import type { Candidate, RankedCandidate } from "./types";
import { MIN_FUZZY_RESOLUTION_SCORE } from "./types";
import { getCandidateAliases } from "./candidate-ranker";

export function candidateToAutocompleteItem(candidate: Candidate): AutocompleteItem {
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

export function formatCandidateReference(candidate: Candidate): string {
  switch (candidate.kind) {
    case "agent":
      return `@${candidate.agent.name}`;
    case "directory":
      return `${candidate.key}/`;
    case "file":
      return candidate.key;
  }
}

export function buildPathInstruction(
  kind: "file" | "directory",
  target: string,
  trailing: string,
): string {
  if (kind === "file") {
    return trailing
      ? `Please read the file at ${target} and then ${trailing}`
      : `Please read the file at ${target}`;
  }
  return trailing
    ? `Please inspect the directory at ${target} and then ${trailing}`
    : `Please inspect the directory at ${target}`;
}

export function buildAgentInstruction(agentName: string, task: string): string {
  return `Use the subagent tool to delegate the following task to the "${agentName}" agent: ${task}`;
}

export function maybeNotifyMatch(
  query: string,
  ranked: RankedCandidate[],
  notify: (message: string, type?: "info" | "warning" | "error") => void,
): void {
  const best = ranked[0];
  if (!best) return;

  const aliases = getCandidateAliases(best.candidate).map((alias) => alias.toLowerCase());
  if (aliases.includes(query.toLowerCase())) return;

  const alternatives = ranked.slice(1, 4).map((entry) => formatCandidateReference(entry.candidate));

  notify(
    `Matched @${query} → ${formatCandidateReference(best.candidate)}${alternatives.length > 0 ? ` (also: ${alternatives.join(", ")})` : ""}`,
    "info",
  );
}

/** Filter ranked candidates to those with at least MIN_FUZZY_RESOLUTION_SCORE */
export function filterByMinScore(ranked: RankedCandidate[]): RankedCandidate[] {
  return ranked.filter((entry) => entry.score >= MIN_FUZZY_RESOLUTION_SCORE);
}
