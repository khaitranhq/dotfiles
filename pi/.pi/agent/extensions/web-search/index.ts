/**
 * Web Search & Fetch Extension — Tavily-powered web tools for pi.
 *
 * Provides two tools:
 *   - web_search: Search the web via Tavily Search API
 *   - web_fetch: Extract clean content from URLs via Tavily Extract API
 *     (falls back to direct HTML fetch with tag-stripping)
 *
 * **Security:**
 *   - HTTPS enforced for all URLs
 *   - Content-Type whitelisting (text/html, text/plain, application/json, xml)
 *   - Internal/private network URLs blocked (localhost, 10.x, 192.168.x, etc.)
 *   - Input sanitization: control char stripping, query length limits
 *   - Timeout & size caps on all operations
 *
 * **Token efficiency:**
 *   - Strips <script>, <style>, <nav>, <footer>, <header>, <aside> before cleaning
 *   - HTML tag removal + entity decoding for clean text
 *   - Large content (>50KB) written to temp file; LLM told to use grep/read
 *   - Search results capped at maxResults (default 5, max 10)
 *   - All outputs truncated to maxContentBytes
 *
 * **API Key:** Set the TAVILY_API_KEY environment variable.
 *   Get a free key at https://tavily.com
 *
 * **Configuration:** ~/.pi/agent/custom-settings.yaml → "web_search" section
 *   maxResults: 5             # default max search results
 *   searchTimeout: 30000      # search timeout (ms)
 *   fetchTimeout: 30000       # fetch timeout (ms)
 *   maxContentBytes: 50000    # max output bytes before temp-file fallback
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { formatSize } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { loadCustomSettings } from "../shared/config";

// ── Types ──────────────────────────────────────────────────────────────

interface WebSearchConfig {
  maxResults?: number;
  searchTimeout?: number;
  fetchTimeout?: number;
  maxContentBytes?: number;
  tempDir?: string;
}

// ── Constants ──────────────────────────────────────────────────────────

const DEFAULTS: Required<WebSearchConfig> = {
  maxResults: 5,
  searchTimeout: 30000,
  fetchTimeout: 30000,
  maxContentBytes: 50000, // 50 KB
  tempDir: path.join(os.tmpdir(), "pi-web-content"),
};

const TAVILY_BASE = "https://api.tavily.com";

/** Content-Types allowed for direct HTML fetching. */
const ALLOWED_CONTENT_TYPES = [
  "text/html",
  "text/plain",
  "application/json",
  "application/xml",
  "text/xml",
];

/** Hostnames/prefixes blocked for security (internal/private networks). */
const BLOCKED_HOSTS = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "[::1]",
  "169.254.",
  "10.",
  "172.16.",
  "172.17.",
  "172.18.",
  "172.19.",
  "172.20.",
  "172.21.",
  "172.22.",
  "172.23.",
  "172.24.",
  "172.25.",
  "172.26.",
  "172.27.",
  "172.28.",
  "172.29.",
  "172.30.",
  "172.31.",
  "192.168.",
];

/** HTML tags stripped before text extraction (both tag and inner content). */
const STRIP_TAGS = ["script", "style", "nav", "footer", "header", "aside", "iframe", "noscript"];

// ── API Key ────────────────────────────────────────────────────────────

function getApiKey(): string {
  return process.env.TAVILY_API_KEY ?? "";
}

// ── Config ─────────────────────────────────────────────────────────────

function loadConfig(): Required<WebSearchConfig> {
  try {
    const settings = loadCustomSettings();
    const ws = (settings.web_search ?? {}) as WebSearchConfig;
    return {
      maxResults: ws.maxResults ?? DEFAULTS.maxResults,
      searchTimeout: ws.searchTimeout ?? DEFAULTS.searchTimeout,
      fetchTimeout: ws.fetchTimeout ?? DEFAULTS.fetchTimeout,
      maxContentBytes: ws.maxContentBytes ?? DEFAULTS.maxContentBytes,
      tempDir: ws.tempDir ?? DEFAULTS.tempDir,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

// ── Security helpers ──────────────────────────────────────────────────

/**
 * Validate a URL for security: HTTPS only, no internal/private hosts.
 * Returns an error message string on failure, null on success.
 */
function validateUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return `Invalid URL: ${url}`;
  }

  if (parsed.protocol !== "https:") {
    return `Only HTTPS URLs are allowed (got "${parsed.protocol}"): ${url}`;
  }

  const hostname = parsed.hostname.toLowerCase();
  for (const blocked of BLOCKED_HOSTS) {
    if (hostname === blocked || hostname.startsWith(blocked)) {
      return `Blocked URL (internal/private network): ${url}`;
    }
  }

  return null;
}

/** Sanitize search query: strip control characters, trim, limit length. */
function sanitizeQuery(query: string): string {
  return (
    query
      // eslint-disable-next-line no-control-regex -- intentionally strip control characters
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .trim()
      .slice(0, 400)
  );
}

// ── HTML cleaning ─────────────────────────────────────────────────────

/**
 * Strip unwanted HTML tags (with their inner content) and all remaining
 * HTML tags from a string. Decodes common HTML entities. Collapses
 * whitespace.
 */
function stripHtmlTags(html: string): string {
  let result = html;

  // Remove blocked tags and their inner content
  for (const tag of STRIP_TAGS) {
    const re = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi");
    result = result.replace(re, "");
  }

  // Remove any remaining HTML tags
  result = result.replace(/<[^>]*>/g, " ");

  // Decode common HTML entities
  result = result
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));

  // Collapse whitespace
  result = result
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return result;
}

/** Check if a Content-Type header value is in the allowed list. */
function isAllowedContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  const lower = contentType.toLowerCase();
  return ALLOWED_CONTENT_TYPES.some((allowed) => lower.includes(allowed));
}

// ── Token efficiency helpers ──────────────────────────────────────────

/**
 * Write content to a temp file. Returns the file path and a summary
 * instructing the LLM to use grep/read to access the content.
 */
function writeContentToFile(
  content: string,
  prefix: string,
  config: Required<WebSearchConfig>,
): { filePath: string; summary: string } {
  const dir = config.tempDir;
  fs.mkdirSync(dir, { recursive: true });

  const hash = crypto.createHash("sha256").update(content).digest("hex").slice(0, 12);
  const fileName = `${prefix}_${hash}_${Date.now()}.txt`;
  const filePath = path.join(dir, fileName);

  fs.writeFileSync(filePath, content, "utf-8");

  const byteLen = Buffer.byteLength(content, "utf-8");
  const lineCount = content.split("\n").length;

  const summary =
    `[Content saved to ${filePath}]\n` +
    `Lines: ${lineCount}, Size: ${formatSize(byteLen)}\n` +
    `Use 'rg <pattern> ${filePath}' or 'read ${filePath}' to search this file for specific information.`;

  return { filePath, summary };
}

/**
 * Truncate content to maxBytes. Tries to break cleanly at a newline.
 * Returns the truncated string.
 */
function truncateContent(content: string, maxBytes: number): string {
  const buf = Buffer.from(content, "utf-8");
  if (buf.length <= maxBytes) return content;

  const truncated = buf.subarray(0, maxBytes).toString("utf-8");
  const lastNewline = truncated.lastIndexOf("\n");
  if (lastNewline > maxBytes / 2) {
    return truncated.slice(0, lastNewline);
  }
  return truncated;
}

// ── Direct HTML fetch (fallback when Tavily Extract is unavailable) ────

async function directFetchAndClean(
  url: string,
  config: Required<WebSearchConfig>,
  signal?: AbortSignal,
): Promise<{
  content: Array<{ type: "text"; text: string }>;
  details: Record<string, unknown>;
}> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.fetchTimeout);

  const onAbort = (): void => controller.abort();
  signal?.addEventListener("abort", onAbort, { once: true });

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "text/html,text/plain,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Content-Type validation
    const contentType = response.headers.get("content-type");
    if (!isAllowedContentType(contentType)) {
      throw new Error(`Unsupported content type: ${contentType ?? "unknown"}`);
    }

    // Read with size cap (3x output cap for raw HTML, cleaned text is smaller)
    const readMaxBytes = config.maxContentBytes * 3;
    let rawHtml: string;

    if (response.body) {
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        total += value.length;
        if (total > readMaxBytes) {
          await reader.cancel();
          break;
        }
      }

      rawHtml = Buffer.concat(chunks).toString("utf-8");
    } else {
      rawHtml = (await response.text()).slice(0, readMaxBytes);
    }

    // Clean the HTML
    let content = stripHtmlTags(rawHtml);

    // Size check after cleaning
    const byteLen = Buffer.byteLength(content, "utf-8");

    if (byteLen > config.maxContentBytes) {
      const { filePath, summary } = writeContentToFile(content, "direct-fetch", config);
      const preview = truncateContent(content, 2000);

      const result = `${summary}\n\n--- Preview (first ~2000 bytes) ---\n${preview}\n---`;

      return {
        content: [{ type: "text" as const, text: result }],
        details: {
          url,
          extracted: false,
          directFetch: true,
          savedTo: filePath,
          truncated: true,
          byteLen,
        },
      };
    }

    return {
      content: [{ type: "text" as const, text: content }],
      details: {
        url,
        extracted: false,
        directFetch: true,
        truncated: false,
        byteLen,
      },
    };
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener("abort", onAbort);
  }
}

// ── Extension ──────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  // ═══════════════════════════════════════════════════════════════════
  // web_search — Tavily Search API
  // ═══════════════════════════════════════════════════════════════════

  pi.registerTool({
    name: "web_search",
    label: "Web Search",
    description:
      "Search the web using Tavily. Returns titles, URLs, and content snippets. " +
      "Use this to find current information, documentation, or answers to questions.",
    promptSnippet: "Search the web with Tavily and return results with titles, URLs, and snippets",
    promptGuidelines: [
      "Use web_search to find current information, documentation, or answers that are not in your training data.",
      "After getting search results, use web_fetch to retrieve full content from promising URLs.",
    ],
    parameters: Type.Object({
      query: Type.String({ description: "Search query (max 400 chars)" }),
      maxResults: Type.Optional(
        Type.Number({ description: "Max results to return (1-10, default 5)" }),
      ),
    }),

    async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
      const config = loadConfig();
      const apiKey = getApiKey();

      if (!apiKey) {
        throw new Error(
          "Tavily API key not configured. " +
            "Set the TAVILY_API_KEY environment variable. " +
            "Get a free key at https://tavily.com",
        );
      }

      const query = sanitizeQuery(params.query as string);
      if (!query) {
        throw new Error("Search query is required and must not be empty.");
      }

      const maxResults = Math.min(
        Math.max(1, (params.maxResults as number) ?? config.maxResults),
        10,
      );

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.searchTimeout);
      const onAbort = (): void => controller.abort();
      signal?.addEventListener("abort", onAbort, { once: true });

      try {
        const response = await fetch(`${TAVILY_BASE}/search`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            query,
            max_results: maxResults,
            search_depth: "basic",
            include_answer: false,
            include_raw_content: false,
            include_images: false,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          let errorText: string;
          try {
            errorText = await response.text();
          } catch {
            errorText = "Unable to read error response";
          }
          throw new Error(`Tavily search failed (HTTP ${response.status}): ${errorText}`);
        }

        const data = (await response.json()) as {
          results?: Array<{
            title: string;
            url: string;
            content: string;
            score: number;
          }>;
        };

        const results = data.results ?? [];

        if (results.length === 0) {
          return {
            content: [{ type: "text" as const, text: `No results found for: "${query}"` }],
            details: { query, count: 0 },
          };
        }

        // Build formatted output
        const lines: string[] = [
          `Search results for: "${query}"`,
          `Found ${results.length} result(s):`,
          "",
        ];

        for (let i = 0; i < results.length; i++) {
          const r = results[i];
          lines.push(`${i + 1}. ${r.title}`);
          lines.push(`   URL: ${r.url}`);
          lines.push(`   ${r.content.slice(0, 300)}`);
          lines.push("");
        }

        let output = lines.join("\n");

        // Final size check
        const byteLen = Buffer.byteLength(output, "utf-8");
        if (byteLen > config.maxContentBytes) {
          output = truncateContent(output, config.maxContentBytes);
          output += `\n\n[Results truncated to ${formatSize(config.maxContentBytes)}]`;
        }

        return {
          content: [{ type: "text" as const, text: output }],
          details: { query, count: results.length, urls: results.map((r) => r.url) },
        };
      } finally {
        clearTimeout(timeoutId);
        signal?.removeEventListener("abort", onAbort);
      }
    },

    renderCall(args: unknown, theme: any, _context: any) {
      const query = String((args as any)?.query ?? "");
      const shortQuery = query.length > 50 ? query.slice(0, 47) + "..." : query;
      return new Text(
        theme.fg("toolTitle", theme.bold("Web Search")) + " " + theme.fg("dim", shortQuery),
        0,
        0,
      );
    },

    renderResult(result: any, { expanded }: { expanded?: boolean }, theme: any, _context: any) {
      const count = result?.details?.count ?? 0;
      const text: string = result?.content?.[0]?.text ?? "";
      const previewLines = expanded ? 20 : 4;
      const lines = text.split("\n").slice(0, previewLines).join("\n");
      const suffix = !expanded && text.length > 300 ? theme.fg("dim", "\n...") : "";

      return new Text(theme.fg("success", `✓ Found ${count} result(s)\n${lines}${suffix}`), 0, 0);
    },
  });

  // ═══════════════════════════════════════════════════════════════════
  // web_fetch — Tavily Extract API + direct fetch fallback
  // ═══════════════════════════════════════════════════════════════════

  pi.registerTool({
    name: "web_fetch",
    label: "Web Fetch",
    description:
      "Fetch and extract readable text content from a URL. Uses Tavily Extract for clean " +
      "content extraction, falling back to direct HTTP fetch with HTML cleaning. " +
      "Large pages are saved to temp files — use grep/read to search them.",
    promptSnippet: "Fetch and extract readable content from a URL",
    promptGuidelines: [
      "Use web_fetch to retrieve full page content from URLs found via web_search.",
      "When content is saved to a temp file, use rg or read to search for specific information.",
    ],
    parameters: Type.Object({
      url: Type.String({ description: "The HTTPS URL to fetch content from" }),
      extractDepth: Type.Optional(
        Type.String({
          description: "'basic' for fast extraction or 'advanced' for deeper content (default)",
        }),
      ),
    }),

    async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
      const config = loadConfig();
      const apiKey = getApiKey();

      if (!apiKey) {
        throw new Error(
          "Tavily API key not configured. " +
            "Set the TAVILY_API_KEY environment variable. " +
            "Get a free key at https://tavily.com",
        );
      }

      const url = (params.url as string).trim();
      if (!url) {
        throw new Error("URL is required.");
      }

      const urlError = validateUrl(url);
      if (urlError) throw new Error(urlError);

      const extractDepth = (params.extractDepth as string) === "basic" ? "basic" : "advanced";

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.fetchTimeout);
      const onAbort = (): void => controller.abort();
      signal?.addEventListener("abort", onAbort, { once: true });

      try {
        // Primary: Tavily Extract API
        const response = await fetch(`${TAVILY_BASE}/extract`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            urls: [url],
            extract_depth: extractDepth,
            include_images: false,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          // Fallback to direct fetch
          return await directFetchAndClean(url, config, signal);
        }

        const data = (await response.json()) as {
          results?: Array<{ url: string; raw_content?: string }>;
          failed_results?: Array<{ url: string; error: string }>;
        };

        // Check for explicit failures
        if (data.failed_results && data.failed_results.length > 0) {
          return await directFetchAndClean(url, config, signal);
        }

        const rawContent = data.results?.[0]?.raw_content;

        if (!rawContent || rawContent.length < 50) {
          return await directFetchAndClean(url, config, signal);
        }

        // Clean any residual HTML tags and entities
        let content = stripHtmlTags(rawContent);

        // Size management
        const byteLen = Buffer.byteLength(content, "utf-8");

        if (byteLen > config.maxContentBytes) {
          const { filePath, summary } = writeContentToFile(content, "tavily", config);
          const preview = truncateContent(content, 2000);

          const result = `${summary}\n\n--- Preview (first ~2000 bytes) ---\n${preview}\n---`;

          return {
            content: [{ type: "text" as const, text: result }],
            details: {
              url,
              extracted: true,
              savedTo: filePath,
              truncated: true,
              byteLen,
            },
          };
        }

        return {
          content: [{ type: "text" as const, text: content }],
          details: { url, extracted: true, truncated: false, byteLen },
        };
      } finally {
        clearTimeout(timeoutId);
        signal?.removeEventListener("abort", onAbort);
      }
    },

    renderCall(args: unknown, theme: any, _context: any) {
      const url = String((args as any)?.url ?? "");
      const shortUrl = url.length > 60 ? url.slice(0, 57) + "..." : url;
      return new Text(
        theme.fg("toolTitle", theme.bold("Web Fetch")) + " " + theme.fg("dim", shortUrl),
        0,
        0,
      );
    },

    renderResult(result: any, { expanded }: { expanded?: boolean }, theme: any, _context: any) {
      const text: string = result?.content?.[0]?.text ?? "";
      const preview = text.slice(0, expanded ? 500 : 150);
      const suffix = !expanded && text.length > 150 ? theme.fg("dim", "...") : "";

      if (result?.isError) {
        return new Text(theme.fg("error", `✗ ${preview}${suffix}`), 0, 0);
      }

      return new Text(theme.fg("success", `✓ ${preview}${suffix}`), 0, 0);
    },
  });
}
