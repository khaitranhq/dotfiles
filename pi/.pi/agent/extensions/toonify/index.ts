/**
 * Toonify — Intercept tool results, detect JSON, encode as TOON.
 *
 * Hooks `tool_result` and converts any JSON-structured text content
 * to TOON format. Reduces token count for the LLM while preserving
 * all data losslessly. Non-JSON text passes through unchanged.
 */

import { encode } from "@toon-format/toon";
import type { ImageContent, TextContent } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

function tryParseStructured(text: string): unknown | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed !== null && typeof parsed === "object") return parsed;
    return null;
  } catch {
    return null;
  }
}

type ContentBlock = TextContent | ImageContent;

function toonifyContent(content: ContentBlock[]): ContentBlock[] {
  let changed = false;
  const mapped = content.map((block) => {
    if (block.type !== "text") return block;
    const data = tryParseStructured(block.text);
    if (!data) return block;
    changed = true;
    return { type: "text", text: encode(data) } satisfies TextContent;
  });
  return changed ? mapped : content;
}

export default function (pi: ExtensionAPI) {
  pi.on("tool_result", async (event, _ctx) => {
    const newContent = toonifyContent(event.content);
    if (newContent === event.content) return;
    return { content: newContent };
  });
}
