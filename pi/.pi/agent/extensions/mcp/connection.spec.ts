/**
 * Tests for MCP connection tool filtering and client OAuth/header-auth behavior.
 *
 * Verifies that MCP tools matching "deny" patterns in custom-settings.yaml
 * are NOT registered — not just blocked at execution time.
 *
 * Also verifies that McpClient distinguishes between OAuth and pure
 * header-based authentication — PiOAuthProvider must only be created
 * when oauth is explicitly configured.
 */
import { describe, it, expect } from "vitest";
import type { ToolPermissions } from "../shared/config";
import { filterAllowedMcpTools } from "./connection";
import { McpClient, type HttpServerConfig } from "./client";

// ── Tests ─────────────────────────────────────────────────────────────

describe("filterAllowedMcpTools", () => {
  it("returns all tools when permissions are empty", () => {
    const tools = ["mcp_atlassian_getpage", "mcp_atlassian_search", "read", "write"];
    expect(filterAllowedMcpTools(tools, {})).toEqual(tools);
  });

  it("returns all tools when no deny entries exist", () => {
    const tools = ["mcp_atlassian_getpage", "mcp_atlassian_search"];
    const perms: ToolPermissions = {
      read: "allow",
      write: "allow",
    };
    expect(filterAllowedMcpTools(tools, perms)).toEqual(tools);
  });

  it("filters out tools matching exact deny pattern", () => {
    const tools = ["mcp_atlassian_getpage", "mcp_atlassian_search", "read"];
    const perms: ToolPermissions = {
      mcp_atlassian_getpage: "deny",
      read: "allow",
    };
    expect(filterAllowedMcpTools(tools, perms)).toEqual(["mcp_atlassian_search", "read"]);
  });

  it("filters out tools matching wildcard deny pattern (mcp_atlassian_*)", () => {
    const tools = [
      "mcp_atlassian_getpage",
      "mcp_atlassian_search",
      "mcp_atlassian_createissue",
      "mcp_github_getrepo",
      "read",
      "write",
    ];
    const perms: ToolPermissions = {
      "mcp_atlassian_*": "deny",
      read: "allow",
      write: "allow",
    };
    expect(filterAllowedMcpTools(tools, perms)).toEqual(["mcp_github_getrepo", "read", "write"]);
  });

  it("filters out tools matching wildcard deny pattern (mcp_*)", () => {
    const tools = ["mcp_atlassian_getpage", "mcp_github_getrepo", "read", "write"];
    const perms: ToolPermissions = {
      "mcp_*": "deny",
      read: "allow",
      write: "allow",
    };
    expect(filterAllowedMcpTools(tools, perms)).toEqual(["read", "write"]);
  });

  it("filters out everything when * is denied", () => {
    const tools = ["mcp_atlassian_getpage", "read", "write"];
    const perms: ToolPermissions = {
      "*": "deny",
    };
    expect(filterAllowedMcpTools(tools, perms)).toEqual([]);
  });

  it("does NOT filter tools that have allow entry (allow only, no deny)", () => {
    const tools = ["mcp_atlassian_getpage", "mcp_atlassian_search", "read"];
    const perms: ToolPermissions = {
      "mcp_atlassian_*": "allow",
      read: "allow",
    };
    // allow-only entries don't filter — only deny entries filter registration
    expect(filterAllowedMcpTools(tools, perms)).toEqual(tools);
  });

  it("handles mix of deny wildcards and allow entries", () => {
    const tools = [
      "mcp_atlassian_getpage",
      "mcp_atlassian_search",
      "mcp_github_getrepo",
      "read",
      "write",
    ];
    const perms: ToolPermissions = {
      "mcp_atlassian_*": "deny",
      "mcp_github_*": "allow",
      read: "allow",
      write: "allow",
    };
    expect(filterAllowedMcpTools(tools, perms)).toEqual(["mcp_github_getrepo", "read", "write"]);
  });

  it("ignores bash sub-map entries (bash is not a tool name pattern)", () => {
    const tools = ["mcp_atlassian_getpage", "bash", "read"];
    const perms: ToolPermissions = {
      "mcp_atlassian_*": "deny",
      bash: {
        ls: "allow",
        rm: "deny",
      },
      read: "allow",
    };
    expect(filterAllowedMcpTools(tools, perms)).toEqual(["bash", "read"]);
  });

  it("returns all tools when permissions only have bash sub-map", () => {
    const tools = ["mcp_atlassian_getpage", "read", "write"];
    const perms: ToolPermissions = {
      bash: {
        ls: "allow",
        rm: "deny",
      },
    };
    expect(filterAllowedMcpTools(tools, perms)).toEqual(tools);
  });

  it("handles empty tool list", () => {
    const perms: ToolPermissions = { "mcp_*": "deny" };
    expect(filterAllowedMcpTools([], perms)).toEqual([]);
  });

  // ── Integration: real custom-settings.yaml scenario ──────────────

  it("integration: mcp_atlassian_* deny filters ALL atlassian tools", () => {
    const perms: ToolPermissions = {
      "mcp_atlassian_*": "deny",
      read: "allow",
      write: "allow",
      edit: "allow",
      subagent: "allow",
      question: "allow",
      web_search: "allow",
      web_fetch: "allow",
      todowrite: "allow",
      bash: {
        ls: "allow",
        rg: "allow",
        cd: "allow",
      },
    };

    // Simulate the full set of MCP atlassian tools that would be registered
    const atlassianTools = [
      "mcp_atlassian_atlassianuserinfo",
      "mcp_atlassian_getaccessibleatlassianresources",
      "mcp_atlassian_getconfluencepage",
      "mcp_atlassian_searchconfluenceusingcql",
      "mcp_atlassian_getconfluencespaces",
      "mcp_atlassian_getpagesinconfluencespace",
      "mcp_atlassian_getconfluencepagefootercomments",
      "mcp_atlassian_getconfluencepageinlinecomments",
      "mcp_atlassian_getconfluencecommentchildren",
      "mcp_atlassian_getconfluencepagedescendants",
      "mcp_atlassian_createconfluencepage",
      "mcp_atlassian_updateconfluencepage",
      "mcp_atlassian_createconfluencefootercomment",
      "mcp_atlassian_createconfluenceinlinecomment",
      "mcp_atlassian_getjiraissue",
      "mcp_atlassian_editjiraissue",
      "mcp_atlassian_createjiraissue",
      "mcp_atlassian_gettransitionsforjiraissue",
      "mcp_atlassian_getjiraissueremoteissuelinks",
      "mcp_atlassian_getvisiblejiraprojects",
      "mcp_atlassian_getjiraprojectissuetypesmetadata",
      "mcp_atlassian_getjiraissuetypemetawithfields",
      "mcp_atlassian_addcommenttojiraissue",
      "mcp_atlassian_transitionjiraissue",
      "mcp_atlassian_searchjiraissuesusingjql",
      "mcp_atlassian_lookupjiraaccountid",
      "mcp_atlassian_addworklogtojiraissue",
      "mcp_atlassian_getissuelinktypes",
      "mcp_atlassian_createissuelink",
      "mcp_atlassian_search",
      "mcp_atlassian_fetch",
    ];

    const result = filterAllowedMcpTools(atlassianTools, perms);
    expect(result).toEqual([]);
  });
});

// ── OAuth vs header-based authentication ────────────────────────────

describe("McpClient — OAuth vs header authentication", () => {
  it("does NOT have OAuth status when oauth config is omitted (header-only auth)", () => {
    const config: HttpServerConfig = {
      name: "test-header-auth",
      url: "https://example.com/mcp",
      headers: { Authorization: "Bearer sk-test123" },
    };

    const client = new McpClient(config);
    const status = client.getOAuthStatus();

    expect(status).toBeNull();
  });

  it("HAS OAuth status when oauth config is explicitly provided", () => {
    const config: HttpServerConfig = {
      name: "test-oauth-auth",
      url: "https://example.com/mcp",
      oauth: { scopes: ["read"] },
    };

    const client = new McpClient(config);
    const status = client.getOAuthStatus();

    expect(status).not.toBeNull();
    expect(status!.configured).toBe(true);
  });

  it("does NOT have OAuth status when using stdio transport", () => {
    const client = new McpClient({
      name: "test-stdio",
      transport: "stdio",
      command: "echo",
    });

    const status = client.getOAuthStatus();

    expect(status).toBeNull();
  });
});
