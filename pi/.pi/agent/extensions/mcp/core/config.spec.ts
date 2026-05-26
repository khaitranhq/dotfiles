import { describe, it, expect } from "vitest";
import { convertYamlMcpToConfig } from "./config";

describe("convertYamlMcpToConfig", () => {
  it("converts array of HTTP servers to mcpServers object", () => {
    const servers = [
      {
        name: "atlassian",
        transport: "http" as const,
        url: "https://mcp.atlassian.com/v1/mcp/authv2",
      },
      {
        name: "obsidian",
        transport: "http" as const,
        url: "http://127.0.0.1:27123/mcp/",
        headers: { Authorization: "Bearer token" },
      },
    ];
    const result = convertYamlMcpToConfig(servers);
    expect(result.mcpServers).toEqual({
      atlassian: { url: "https://mcp.atlassian.com/v1/mcp/authv2" },
      obsidian: { url: "http://127.0.0.1:27123/mcp/", headers: { Authorization: "Bearer token" } },
    });
  });

  it("converts stdio server entry", () => {
    const servers = [
      {
        name: "local-tool",
        transport: "stdio" as const,
        command: "node",
        args: ["server.js"],
        env: { NODE_ENV: "production" },
      },
    ];
    const result = convertYamlMcpToConfig(servers);
    expect(result.mcpServers).toEqual({
      "local-tool": { command: "node", args: ["server.js"], env: { NODE_ENV: "production" } },
    });
  });

  it("strips name and transport from output entries", () => {
    const servers = [{ name: "test", transport: "http" as const, url: "https://example.com" }];
    const result = convertYamlMcpToConfig(servers);
    const entry = result.mcpServers["test"];
    expect(entry).toBeDefined();
    expect(entry).not.toHaveProperty("name");
    expect(entry).not.toHaveProperty("transport");
    expect(entry).toEqual({ url: "https://example.com" });
  });

  it("passes through optional fields", () => {
    const servers = [
      {
        name: "full",
        transport: "http" as const,
        url: "https://example.com",
        lifecycle: "eager" as const,
        idleTimeout: 5,
        exposeResources: true,
        directTools: ["tool_a"],
        excludeTools: ["tool_b"],
        debug: true,
      },
    ];
    const result = convertYamlMcpToConfig(servers);
    expect(result.mcpServers["full"]).toEqual({
      url: "https://example.com",
      lifecycle: "eager",
      idleTimeout: 5,
      exposeResources: true,
      directTools: ["tool_a"],
      excludeTools: ["tool_b"],
      debug: true,
    });
  });

  it("returns empty mcpServers for undefined", () => {
    expect(convertYamlMcpToConfig(undefined)).toEqual({ mcpServers: {} });
  });

  it("returns empty mcpServers for empty array", () => {
    expect(convertYamlMcpToConfig([])).toEqual({ mcpServers: {} });
  });

  it("preserves headers with env var patterns for later interpolation", () => {
    const servers = [
      {
        name: "api-server",
        transport: "http" as const,
        url: "https://api.example.com/mcp",
        headers: {
          Authorization: "Bearer ${GITHUB_TOKEN}",
          "X-Api-Key": "$env:API_SECRET",
          "X-Static": "static-value",
        },
        bearerToken: "${FALLBACK_TOKEN}",
      },
    ];
    const result = convertYamlMcpToConfig(servers);
    expect(result.mcpServers["api-server"]).toEqual({
      url: "https://api.example.com/mcp",
      headers: {
        Authorization: "Bearer ${GITHUB_TOKEN}",
        "X-Api-Key": "$env:API_SECRET",
        "X-Static": "static-value",
      },
      bearerToken: "${FALLBACK_TOKEN}",
    });
  });
});
