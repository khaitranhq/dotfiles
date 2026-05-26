import { describe, it, expect } from "vitest";
import { supportsOAuth } from "./oauth-flow";
import type { ServerEntry } from "../core/types";

describe("supportsOAuth", () => {
  // ── URL required ──────────────────────────────────────────────────

  it("returns false when no url", () => {
    expect(supportsOAuth({ command: "node" })).toBe(false);
  });

  // ── Explicit disable ──────────────────────────────────────────────

  it("returns false when auth is false", () => {
    expect(supportsOAuth({ url: "http://localhost:3000", auth: false })).toBe(false);
  });

  it("returns false when oauth is false", () => {
    expect(supportsOAuth({ url: "http://localhost:3000", oauth: false })).toBe(false);
  });

  // ── Auto-detect (no auth config) ──────────────────────────────────

  it("returns true when url is present and no auth config (auto-detect)", () => {
    expect(supportsOAuth({ url: "http://localhost:3000" })).toBe(true);
  });

  it("returns true when auth is 'oauth'", () => {
    expect(supportsOAuth({ url: "http://localhost:3000", auth: "oauth" })).toBe(true);
  });

  // ── Headers with Authorization → skip OAuth ───────────────────────

  it("returns false when headers contain Authorization (static API key)", () => {
    const definition: ServerEntry = {
      url: "http://127.0.0.1:27123/mcp/",
      headers: { Authorization: "Bearer ${OBSIDIAN_MCP_TOKEN}" },
    };
    expect(supportsOAuth(definition)).toBe(false);
  });

  it("returns false when headers contain authorization (lowercase)", () => {
    const definition: ServerEntry = {
      url: "http://127.0.0.1:27123/mcp/",
      headers: { authorization: "Bearer token-123" },
    };
    expect(supportsOAuth(definition)).toBe(false);
  });

  it("returns false when headers contain AUTHORIZATION (mixed case)", () => {
    const definition: ServerEntry = {
      url: "http://127.0.0.1:27123/mcp/",
      headers: { AUTHORIZATION: "Bearer token-abc" },
    };
    expect(supportsOAuth(definition)).toBe(false);
  });

  it("returns true when headers have other keys but no Authorization", () => {
    const definition: ServerEntry = {
      url: "http://127.0.0.1:27123/mcp/",
      headers: { "Content-Type": "application/json", "X-Custom": "value" },
    };
    expect(supportsOAuth(definition)).toBe(true);
  });

  it("returns true with empty headers object", () => {
    const definition: ServerEntry = {
      url: "http://127.0.0.1:27123/mcp/",
      headers: {},
    };
    expect(supportsOAuth(definition)).toBe(true);
  });

  // ── Obsidian real-world case ──────────────────────────────────────

  it("returns false for Obsidian-style config (headers with Authorization)", () => {
    const definition: ServerEntry = {
      url: "http://127.0.0.1:27123/mcp/",
      headers: { Authorization: "Bearer ${OBSIDIAN_MCP_TOKEN}" },
    };
    expect(supportsOAuth(definition)).toBe(false);
  });

  // ── Explicit oauth overrides header Authorization ─────────────────

  it("returns true when auth is 'oauth' even with Authorization header", () => {
    const definition: ServerEntry = {
      url: "http://127.0.0.1:27123/mcp/",
      auth: "oauth",
      headers: { Authorization: "Bearer token" },
    };
    // auth: 'oauth' explicitly requests OAuth; header is incidental
    // supportsOAuth checks auth === 'oauth' after the header check
    expect(supportsOAuth(definition)).toBe(true);
  });
});
