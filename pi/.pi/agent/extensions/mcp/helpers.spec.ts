/**
 * Tests for MCP helpers — env variable expansion.
 */
import { describe, it, expect, afterEach } from "vitest";
import { expandEnv, expandEnvInRecord } from "./helpers";

// ── Tests ─────────────────────────────────────────────────────────────

describe("expandEnv", () => {
  afterEach(() => {
    delete process.env.TEST_VAR;
    delete process.env.API_KEY;
    delete process.env.EMPTY_VAR;
  });

  it("returns the original string when no env vars are present", () => {
    expect(expandEnv("hello world")).toBe("hello world");
  });

  it("replaces ${VAR} with the env variable value", () => {
    process.env.TEST_VAR = "myvalue";
    expect(expandEnv("prefix_${TEST_VAR}_suffix")).toBe("prefix_myvalue_suffix");
  });

  it("replaces multiple env vars in the same string", () => {
    process.env.A = "alpha";
    process.env.B = "beta";
    expect(expandEnv("${A}_${B}")).toBe("alpha_beta");
  });

  it("replaces env var with empty string when not set", () => {
    expect(expandEnv("hello_${MISSING_VAR}_world")).toBe("hello__world");
  });

  it("uses default value when env var is not set (${VAR:-default})", () => {
    expect(expandEnv("hello_${MISSING_VAR:-default}_world")).toBe("hello_default_world");
  });

  it("uses default value even when default is empty string", () => {
    expect(expandEnv("${MISSING_VAR:-}")).toBe("");
  });

  it("ignores default when env var IS set", () => {
    process.env.TEST_VAR = "actual";
    expect(expandEnv("${TEST_VAR:-default}")).toBe("actual");
  });

  it("returns empty string for unset var with no default (bare ${VAR})", () => {
    expect(expandEnv("${MISSING_VAR}")).toBe("");
  });

  it("preserves text that looks like but isn't an env var (unclosed brace)", () => {
    expect(expandEnv("${INCOMPLETE")).toBe("${INCOMPLETE");
  });

  it("replaces var at the start of the string", () => {
    process.env.API_KEY = "sk-123";
    expect(expandEnv("${API_KEY} rest")).toBe("sk-123 rest");
  });

  it("replaces var at the end of the string", () => {
    process.env.API_KEY = "sk-123";
    expect(expandEnv("Bearer ${API_KEY}")).toBe("Bearer sk-123");
  });

  it("handles numeric env var names", () => {
    process.env.V2 = "v2value";
    expect(expandEnv("${V2}")).toBe("v2value");
  });

  it("handles env var with underscores in name", () => {
    process.env.MY_LONG_VAR = "long";
    expect(expandEnv("${MY_LONG_VAR}")).toBe("long");
  });

  it("returns empty string when env var exists but is empty string", () => {
    process.env.EMPTY_VAR = "";
    expect(expandEnv("${EMPTY_VAR:-fallback}")).toBe("");
  });
});

describe("expandEnvInRecord", () => {
  afterEach(() => {
    delete process.env.TOKEN;
    delete process.env.HOST;
  });

  it("expands env vars in all values", () => {
    process.env.TOKEN = "sk-abc";
    process.env.HOST = "api.example.com";
    const input = {
      Authorization: "Bearer ${TOKEN}",
      "X-Host": "${HOST}",
    };
    expect(expandEnvInRecord(input)).toEqual({
      Authorization: "Bearer sk-abc",
      "X-Host": "api.example.com",
    });
  });

  it("preserves keys unchanged", () => {
    process.env.TOKEN = "val";
    const input = { Authorization: "${TOKEN}" };
    const result = expandEnvInRecord(input);
    expect(Object.keys(result)).toEqual(["Authorization"]);
  });

  it("returns empty object for empty input", () => {
    expect(expandEnvInRecord({})).toEqual({});
  });
});
