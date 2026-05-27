import type { MentionContext } from "./types";

export function extractMentionContext(beforeCursor: string): MentionContext | null {
  const match = beforeCursor.match(/(?:^|[\s([{])@([^\s@]*)$/);
  if (!match) return null;
  return { prefix: match[1] ?? "" };
}
