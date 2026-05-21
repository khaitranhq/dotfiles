/**
 * Tests for web-search extension helpers.
 *
 * Covers: URL validation, HTML tag stripping, query sanitization,
 * content-type validation, content truncation, and temp-file writing.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// ── Re-implement helpers here for isolated testing ────────────────────

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

const ALLOWED_CONTENT_TYPES = [
  "text/html",
  "text/plain",
  "application/json",
  "application/xml",
  "text/xml",
];

const STRIP_TAGS = ["script", "style", "nav", "footer", "header", "aside", "iframe", "noscript"];

// ── Helpers (copied from index.ts for unit testing) ────────────────────

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

function sanitizeQuery(query: string): string {
  return (
    query
      // eslint-disable-next-line no-control-regex -- intentionally strip control characters
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .trim()
      .slice(0, 400)
  );
}

function stripHtmlTags(html: string): string {
  let result = html;

  for (const tag of STRIP_TAGS) {
    const re = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi");
    result = result.replace(re, "");
  }

  result = result.replace(/<[^>]*>/g, " ");

  result = result
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));

  result = result
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return result;
}

function isAllowedContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  const lower = contentType.toLowerCase();
  return ALLOWED_CONTENT_TYPES.some((allowed) => lower.includes(allowed));
}

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

// ── Tests: URL validation ─────────────────────────────────────────────

describe("validateUrl", () => {
  it("accepts valid HTTPS URLs", () => {
    expect(validateUrl("https://example.com")).toBeNull();
    expect(validateUrl("https://docs.github.com/en/actions")).toBeNull();
    expect(validateUrl("https://api.tavily.com/search")).toBeNull();
  });

  it("rejects HTTP URLs", () => {
    const err = validateUrl("http://example.com");
    expect(err).toContain("Only HTTPS");
    expect(err).toContain("http:");
  });

  it("rejects non-URL strings", () => {
    const err = validateUrl("not-a-url");
    expect(err).toContain("Invalid URL");
  });

  it("rejects empty strings", () => {
    const err = validateUrl("");
    expect(err).toContain("Invalid URL");
  });

  it("rejects localhost", () => {
    const err = validateUrl("https://localhost:3000/api");
    expect(err).toContain("Blocked URL");
    expect(err).toContain("internal/private network");
  });

  it("rejects 127.0.0.1", () => {
    const err = validateUrl("https://127.0.0.1/admin");
    expect(err).toContain("Blocked URL");
  });

  it("rejects 192.168.x.x private network", () => {
    expect(validateUrl("https://192.168.1.1")).toContain("Blocked URL");
    expect(validateUrl("https://192.168.0.100")).toContain("Blocked URL");
  });

  it("rejects 10.x.x.x private network", () => {
    expect(validateUrl("https://10.0.0.1")).toContain("Blocked URL");
    expect(validateUrl("https://10.255.255.255")).toContain("Blocked URL");
  });

  it("rejects 172.16-31.x.x private network", () => {
    expect(validateUrl("https://172.16.0.1")).toContain("Blocked URL");
    expect(validateUrl("https://172.31.255.255")).toContain("Blocked URL");
  });

  it("rejects 0.0.0.0", () => {
    expect(validateUrl("https://0.0.0.0")).toContain("Blocked URL");
  });

  it("accepts public IPs", () => {
    expect(validateUrl("https://8.8.8.8")).toBeNull();
    expect(validateUrl("https://1.1.1.1")).toBeNull();
  });
});

// ── Tests: Query sanitization ─────────────────────────────────────────

describe("sanitizeQuery", () => {
  it("returns trimmed normal queries unchanged", () => {
    expect(sanitizeQuery("hello world")).toBe("hello world");
    expect(sanitizeQuery("  typescript best practices  ")).toBe("typescript best practices");
  });

  it("removes control characters", () => {
    expect(sanitizeQuery("hello\x00world")).toBe("helloworld");
    expect(sanitizeQuery("test\x1fquery")).toBe("testquery");
    expect(sanitizeQuery("line1\nline2")).toBe("line1line2");
  });

  it("truncates queries over 400 chars", () => {
    const long = "a".repeat(500);
    expect(sanitizeQuery(long)).toHaveLength(400);
  });

  it("returns empty string for whitespace-only input", () => {
    expect(sanitizeQuery("   ")).toBe("");
  });
});

// ── Tests: HTML tag stripping ─────────────────────────────────────────

describe("stripHtmlTags", () => {
  it("removes script tags and their content", () => {
    const input = "<div>Hello</div><script>alert('xss')</script><p>World</p>";
    const result = stripHtmlTags(input);
    expect(result).toContain("Hello");
    expect(result).toContain("World");
    expect(result).not.toContain("alert");
    expect(result).not.toContain("xss");
    expect(result).not.toContain("script");
  });

  it("removes style tags and their content", () => {
    const input = "<style>.red{color:red}</style><p>Text</p>";
    const result = stripHtmlTags(input);
    expect(result).toContain("Text");
    expect(result).not.toContain(".red");
  });

  it("removes nav, footer, header, aside tags", () => {
    const input =
      "<nav>Menu</nav><main>Content</main><footer>Copyright</footer><aside>Sidebar</aside>";
    const result = stripHtmlTags(input);
    expect(result).toContain("Content");
    expect(result).not.toContain("Menu");
    expect(result).not.toContain("Copyright");
    expect(result).not.toContain("Sidebar");
  });

  it("removes all remaining HTML tags", () => {
    const input = '<div class="main"><p>Hello <b>World</b></p></div>';
    const result = stripHtmlTags(input);
    expect(result).toBe("Hello World");
  });

  it("decodes HTML entities", () => {
    const input = "<p>&amp; &lt; &gt; &quot; &#39;</p>";
    const result = stripHtmlTags(input);
    expect(result).toBe("& < > \" '");
  });

  it("collapses multiple spaces", () => {
    const input = "<div>Hello     World</div>";
    const result = stripHtmlTags(input);
    expect(result).toBe("Hello World");
  });

  it("collapses excessive newlines", () => {
    const input = "<div>Line1\n\n\n\nLine2</div>";
    const result = stripHtmlTags(input);
    // Should reduce 4 newlines to 2
    expect(result).not.toMatch(/\n{3,}/);
    expect(result).toContain("Line1");
    expect(result).toContain("Line2");
  });

  it("handles empty input", () => {
    expect(stripHtmlTags("")).toBe("");
  });

  it("handles plain text with no HTML", () => {
    expect(stripHtmlTags("Just plain text.")).toBe("Just plain text.");
  });
});

// ── Tests: Content-Type validation ────────────────────────────────────

describe("isAllowedContentType", () => {
  it("accepts text/html", () => {
    expect(isAllowedContentType("text/html")).toBe(true);
    expect(isAllowedContentType("text/html; charset=utf-8")).toBe(true);
  });

  it("accepts text/plain", () => {
    expect(isAllowedContentType("text/plain")).toBe(true);
  });

  it("accepts application/json", () => {
    expect(isAllowedContentType("application/json")).toBe(true);
    expect(isAllowedContentType("application/json; charset=utf-8")).toBe(true);
  });

  it("accepts application/xml and text/xml", () => {
    expect(isAllowedContentType("application/xml")).toBe(true);
    expect(isAllowedContentType("text/xml")).toBe(true);
  });

  it("rejects binary types", () => {
    expect(isAllowedContentType("application/octet-stream")).toBe(false);
    expect(isAllowedContentType("image/png")).toBe(false);
    expect(isAllowedContentType("video/mp4")).toBe(false);
    expect(isAllowedContentType("application/pdf")).toBe(false);
  });

  it("rejects null/undefined", () => {
    expect(isAllowedContentType(null)).toBe(false);
  });
});

// ── Tests: Content truncation ─────────────────────────────────────────

describe("truncateContent", () => {
  it("returns content unchanged when under limit", () => {
    const content = "short content";
    expect(truncateContent(content, 1000)).toBe(content);
  });

  it("truncates content that exceeds maxBytes", () => {
    const content = "A".repeat(100);
    const result = truncateContent(content, 50);
    expect(Buffer.byteLength(result, "utf-8")).toBeLessThanOrEqual(50);
  });

  it("breaks at newline when possible", () => {
    const firstLine = "First line here.\n";
    const filler = "A".repeat(100);
    const content = firstLine + filler;
    const result = truncateContent(content, firstLine.length + 10);
    // Should break at the first newline since it's past half
    expect(result).toBe("First line here.");
  });
});

// ── Tests: Temp file writing ──────────────────────────────────────────

describe("writeContentToFile (inline test)", () => {
  const testDir = path.join(os.tmpdir(), "pi-web-content-test");

  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  function writeContentToFile(
    content: string,
    prefix: string,
    dir: string,
  ): { filePath: string; summary: string } {
    const crypto = require("node:crypto");
    fs.mkdirSync(dir, { recursive: true });

    const hash = crypto.createHash("sha256").update(content).digest("hex").slice(0, 12);
    const fileName = `${prefix}_${hash}_${Date.now()}.txt`;
    const filePath = path.join(dir, fileName);

    fs.writeFileSync(filePath, content, "utf-8");

    const byteLen = Buffer.byteLength(content, "utf-8");
    const lineCount = content.split("\n").length;

    const formatSize = (bytes: number): string => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const summary =
      `[Content saved to ${filePath}]\n` +
      `Lines: ${lineCount}, Size: ${formatSize(byteLen)}\n` +
      `Use 'rg <pattern> ${filePath}' or 'read ${filePath}' to search this file for specific information.`;

    return { filePath, summary };
  }

  it("writes content to a temp file and returns path + summary", () => {
    const content = "Hello world\nThis is test content.\nLine 3";
    const { filePath, summary } = writeContentToFile(content, "test", testDir);

    expect(fs.existsSync(filePath)).toBe(true);
    expect(fs.readFileSync(filePath, "utf-8")).toBe(content);

    expect(summary).toContain("[Content saved to");
    expect(summary).toContain(filePath);
    expect(summary).toContain("Lines: 3");
    expect(summary).toContain("rg");
    expect(summary).toContain("read");
  });

  it("creates unique filenames for different content", () => {
    const { filePath: fp1 } = writeContentToFile("content A", "test", testDir);
    const { filePath: fp2 } = writeContentToFile("content B", "test", testDir);
    expect(fp1).not.toBe(fp2);
  });
});
