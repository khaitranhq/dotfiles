import { describe, it, expect } from "vitest";
import { resolveTools } from "./tools";
import { computeServerHash } from "../core/cache";
import type { McpConfig, MetadataCache, ServerEntry } from "../core/types";

// Helper: build a valid MetadataCache with tools for a server
function makeCache(
  serverName: string,
  tools: Array<{ name: string; description?: string }>,
  definition: ServerEntry,
): MetadataCache {
  return {
    version: 1,
    servers: {
      [serverName]: {
        configHash: computeServerHash(definition),
        tools: tools.map((t) => ({
          name: t.name,
          description: t.description ?? "",
        })),
        resources: [],
        cachedAt: Date.now(),
      },
    },
  };
}

// Helper: build a minimal McpConfig and matching cache for one server
function setupServer(
  serverName: string,
  tools: Array<{ name: string; description?: string }>,
  overrides: Partial<McpConfig["mcpServers"][string]> = {},
  globalSettings?: McpConfig["settings"],
): { config: McpConfig; cache: MetadataCache } {
  const definition: ServerEntry = {
    url: "http://127.0.0.1:27123/mcp/",
    ...overrides,
  };
  return {
    config: {
      mcpServers: { [serverName]: definition },
      settings: globalSettings,
    },
    cache: makeCache(serverName, tools, definition),
  };
}

describe("resolveTools", () => {
  // ── directTools: auto-load by default ─────────────────────────────

  it("registers tools for servers WITHOUT directTools set (defaults to true)", () => {
    const { config, cache } = setupServer("obsidian", [
      { name: "obsidian_list_notes", description: "List notes" },
    ]);

    const result = resolveTools(config, cache, "server");

    expect(result).toHaveLength(1);
    expect(result[0].prefixedName).toBe("obsidian_obsidian_list_notes");
    expect(result[0].originalName).toBe("obsidian_list_notes");
  });

  it("registers tools for servers with directTools: true (explicit)", () => {
    const { config, cache } = setupServer(
      "atlassian",
      [{ name: "jira_search", description: "Search Jira" }],
      { directTools: true },
    );

    const result = resolveTools(config, cache, "server");

    expect(result).toHaveLength(1);
    expect(result[0].originalName).toBe("jira_search");
  });

  // ── directTools: explicit opt-out ─────────────────────────────────

  it("skips tools when directTools: false is explicitly set", () => {
    const { config, cache } = setupServer(
      "disabled-server",
      [{ name: "secret_tool", description: "Should not appear" }],
      { directTools: false },
    );

    const result = resolveTools(config, cache, "server");

    expect(result).toHaveLength(0);
  });

  // ── directTools: filter list ──────────────────────────────────────

  it("registers only listed tools when directTools is a string array", () => {
    const { config, cache } = setupServer(
      "filtered",
      [{ name: "tool_a" }, { name: "tool_b" }, { name: "tool_c" }],
      { directTools: ["tool_a", "tool_c"] },
    );

    const result = resolveTools(config, cache, "server");

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.originalName).sort()).toEqual(["tool_a", "tool_c"]);
  });

  // ── Global directTools setting ────────────────────────────────────

  it("uses global directTools setting when server has none", () => {
    const { config, cache } = setupServer(
      "global-server",
      [{ name: "global_tool" }],
      {},
      { directTools: true },
    );

    const result = resolveTools(config, cache, "server");

    expect(result).toHaveLength(1);
    expect(result[0].originalName).toBe("global_tool");
  });

  it("per-server directTools overrides global setting", () => {
    const { config, cache } = setupServer(
      "specific-server",
      [{ name: "only_this" }, { name: "not_this" }],
      { directTools: ["only_this"] },
      { directTools: true },
    );

    const result = resolveTools(config, cache, "server");

    expect(result).toHaveLength(1);
    expect(result[0].originalName).toBe("only_this");
  });

  // ── Missing cache / invalid cache ─────────────────────────────────

  it("returns empty array when cache is null", () => {
    const { config } = setupServer("any-server", []);
    const result = resolveTools(config, null, "server");
    expect(result).toHaveLength(0);
  });

  it("skips servers without valid cache entry", () => {
    const config: McpConfig = {
      mcpServers: { "no-cache-server": { url: "https://x.example.com" } },
    };
    const { cache } = setupServer("other-server", [{ name: "other_tool" }]);

    const result = resolveTools(config, cache, "server");

    expect(result).toHaveLength(0);
  });

  // ── Multiple servers ──────────────────────────────────────────────

  it("registers tools from multiple servers", () => {
    const defA: ServerEntry = { url: "https://a.example.com/mcp" };
    const defB: ServerEntry = { url: "https://b.example.com/mcp", directTools: true };
    const config: McpConfig = {
      mcpServers: { serverA: defA, serverB: defB },
    };
    const cacheA = makeCache("serverA", [{ name: "tool_a" }], defA);
    const cacheB = makeCache("serverB", [{ name: "tool_b" }], defB);
    const cache: MetadataCache = {
      version: 1,
      servers: { ...cacheA.servers, ...cacheB.servers },
    };

    const result = resolveTools(config, cache, "server");

    expect(result).toHaveLength(2);
    const names = result.map((r) => r.prefixedName).sort();
    expect(names).toEqual(["serverA_tool_a", "serverB_tool_b"]);
  });

  // ── excludeTools ─────────────────────────────────────────────────

  it("excludes tools listed in excludeTools", () => {
    const { config, cache } = setupServer(
      "filtered",
      [{ name: "public_tool" }, { name: "secret_tool" }],
      { directTools: true, excludeTools: ["secret_tool"] },
    );

    const result = resolveTools(config, cache, "server");

    expect(result).toHaveLength(1);
    expect(result[0].originalName).toBe("public_tool");
  });

  // ── Collision with builtin names ──────────────────────────────────

  it("skips tools whose prefixed name collides with builtin names", () => {
    // With prefix "none", a tool named "read" collides with the builtin "read"
    const { config, cache } = setupServer("any-server", [{ name: "read" }], { directTools: true });

    const result = resolveTools(config, cache, "none");

    expect(result).toHaveLength(0);
  });

  // ── Duplicate tool names ──────────────────────────────────────────

  it("skips duplicate prefixed tool names across servers", () => {
    const def1: ServerEntry = { url: "https://one.example.com", directTools: true };
    const def2: ServerEntry = { url: "https://two.example.com", directTools: true };
    const config: McpConfig = {
      mcpServers: { s1: def1, s2: def2 },
    };
    const c1 = makeCache("s1", [{ name: "shared_tool" }], def1);
    const c2 = makeCache("s2", [{ name: "shared_tool" }], def2);
    const cache: MetadataCache = {
      version: 1,
      servers: { ...c1.servers, ...c2.servers },
    };

    const result = resolveTools(config, cache, "server");

    expect(result).toHaveLength(2);
  });
});
