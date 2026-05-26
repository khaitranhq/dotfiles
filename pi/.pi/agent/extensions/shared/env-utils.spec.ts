import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { interpolateEnvVars, interpolateEnvRecord } from "./env-utils";

const ENV_KEY = "SHARED_TEST_TOKEN";
const ENV_KEY2 = "SHARED_TEST_SECRET";
const ENV_VALUE = "secret-abc-123";
const ENV_VALUE2 = "xyz-789";

function setEnv(key: string, value: string) {
  process.env[key] = value;
}

function unsetEnv(key: string) {
  delete process.env[key];
}

describe("interpolateEnvVars", () => {
  beforeEach(() => {
    setEnv(ENV_KEY, ENV_VALUE);
    setEnv(ENV_KEY2, ENV_VALUE2);
  });

  afterEach(() => {
    unsetEnv(ENV_KEY);
    unsetEnv(ENV_KEY2);
  });

  // ── Basic ${VAR} pattern ──────────────────────────────────────────

  it("replaces ${VAR_NAME} with env variable value", () => {
    expect(interpolateEnvVars(`Bearer \${${ENV_KEY}}`)).toBe(`Bearer ${ENV_VALUE}`);
  });

  it("replaces entire value when it's just a variable", () => {
    expect(interpolateEnvVars(`\${${ENV_KEY}}`)).toBe(ENV_VALUE);
  });

  it("replaces multiple ${VAR} patterns in one string", () => {
    expect(interpolateEnvVars(`\${${ENV_KEY}}-\${${ENV_KEY2}}`)).toBe(`${ENV_VALUE}-${ENV_VALUE2}`);
  });

  it("replaces same ${VAR} pattern appearing multiple times", () => {
    expect(interpolateEnvVars(`\${${ENV_KEY}} \${${ENV_KEY}}`)).toBe(`${ENV_VALUE} ${ENV_VALUE}`);
  });

  // ── $env:VAR pattern ──────────────────────────────────────────────

  it("replaces $env:VAR_NAME with env variable value", () => {
    expect(interpolateEnvVars(`Bearer $env:${ENV_KEY}`)).toBe(`Bearer ${ENV_VALUE}`);
  });

  it("replaces multiple $env:VAR patterns in one string", () => {
    expect(interpolateEnvVars(`$env:${ENV_KEY}:$env:${ENV_KEY2}`)).toBe(
      `${ENV_VALUE}:${ENV_VALUE2}`,
    );
  });

  // ── Mixed patterns ────────────────────────────────────────────────

  it("replaces both ${VAR} and $env:VAR in the same string", () => {
    expect(interpolateEnvVars(`\${${ENV_KEY}} $env:${ENV_KEY2}`)).toBe(
      `${ENV_VALUE} ${ENV_VALUE2}`,
    );
  });

  // ── Missing / undefined env vars ──────────────────────────────────

  it("replaces undefined env var with empty string (${VAR})", () => {
    expect(interpolateEnvVars("prefix_${NONEXISTENT_VAR_XYZ}_suffix")).toBe("prefix__suffix");
  });

  it("replaces undefined env var with empty string ($env:VAR)", () => {
    expect(interpolateEnvVars("prefix_$env:NONEXISTENT_VAR_XYZ suffix")).toBe("prefix_ suffix");
  });

  // ── No replacement cases ──────────────────────────────────────────

  it("returns string unchanged when no patterns present", () => {
    expect(interpolateEnvVars("Bearer static-token")).toBe("Bearer static-token");
  });

  it("returns empty string unchanged", () => {
    expect(interpolateEnvVars("")).toBe("");
  });

  it("does NOT replace bare $VAR without braces", () => {
    setEnv("TOKEN", "secret");
    expect(interpolateEnvVars("Bearer $TOKEN")).toBe("Bearer $TOKEN");
  });

  it("does NOT replace $ENV:VAR (case-sensitive, wrong prefix)", () => {
    setEnv("TOKEN", "secret");
    expect(interpolateEnvVars("Bearer $ENV:TOKEN")).toBe("Bearer $ENV:TOKEN");
  });

  // ── ${VAR:-default} syntax ───────────────────────────────────────

  it("uses default value when env var is not set (${VAR:-default})", () => {
    expect(interpolateEnvVars("${MISSING_VAR_XYZ:-fallback}")).toBe("fallback");
  });

  it("uses default value even when default is empty string (${VAR:-})", () => {
    expect(interpolateEnvVars("${MISSING_VAR_XYZ:-}")).toBe("");
  });

  it("ignores default when env var IS set", () => {
    expect(interpolateEnvVars(`\${${ENV_KEY}:-fallback}`)).toBe(ENV_VALUE);
  });

  it("handles default value with spaces", () => {
    expect(interpolateEnvVars("${MISSING_VAR_XYZ:-default value with spaces}")).toBe(
      "default value with spaces",
    );
  });

  it("handles default value with special characters", () => {
    expect(interpolateEnvVars("${MISSING_VAR_XYZ:-https://api.example.com?key=val}")).toBe(
      "https://api.example.com?key=val",
    );
  });

  it("handles ${VAR:-default} combined with static text", () => {
    expect(interpolateEnvVars("prefix_${MISSING_VAR_XYZ:-default}_suffix")).toBe(
      "prefix_default_suffix",
    );
  });

  it("returns actual env value even when it is empty string (ignores default)", () => {
    setEnv("EMPTY_VAR_TEST", "");
    expect(interpolateEnvVars("${EMPTY_VAR_TEST:-fallback}")).toBe("");
    unsetEnv("EMPTY_VAR_TEST");
  });

  // ── Underscore and digit in var names ─────────────────────────────

  it("handles underscores in variable names (${VAR})", () => {
    setEnv("MY_API_KEY", "key-123");
    expect(interpolateEnvVars("${MY_API_KEY}")).toBe("key-123");
  });

  it("handles digits in variable names (${VAR})", () => {
    setEnv("KEY_123", "val456");
    expect(interpolateEnvVars("${KEY_123}")).toBe("val456");
  });

  it("handles underscores in variable names ($env:VAR)", () => {
    setEnv("MY_API_TOKEN", "tok-abc");
    expect(interpolateEnvVars("$env:MY_API_TOKEN")).toBe("tok-abc");
  });

  // ── Edge cases ────────────────────────────────────────────────────

  it("handles adjacent ${VAR} patterns", () => {
    setEnv("A", "1");
    setEnv("B", "2");
    expect(interpolateEnvVars("${A}${B}")).toBe("12");
  });

  it("handles ${} with empty name (no match)", () => {
    expect(interpolateEnvVars("prefix_${}_suffix")).toBe("prefix_${}_suffix");
  });

  it("handles incomplete ${ without closing brace", () => {
    setEnv("VAR", "val");
    expect(interpolateEnvVars("${VAR unfinished")).toBe("${VAR unfinished");
  });

  it("preserves whitespace around replacements", () => {
    expect(interpolateEnvVars(`  \${${ENV_KEY}}  `)).toBe(`  ${ENV_VALUE}  `);
  });
});

describe("interpolateEnvRecord", () => {
  beforeEach(() => {
    setEnv(ENV_KEY, ENV_VALUE);
  });

  afterEach(() => {
    unsetEnv(ENV_KEY);
  });

  it("interpolates all values in a record", () => {
    const input = {
      Authorization: `Bearer \${${ENV_KEY}}`,
      "X-Custom": "static-value",
    };
    const result = interpolateEnvRecord(input);
    expect(result).toEqual({
      Authorization: `Bearer ${ENV_VALUE}`,
      "X-Custom": "static-value",
    });
  });

  it("returns undefined for undefined input", () => {
    expect(interpolateEnvRecord(undefined)).toBeUndefined();
  });

  it("returns empty object for empty input", () => {
    expect(interpolateEnvRecord({})).toEqual({});
  });

  it("handles multiple keys with env var patterns", () => {
    setEnv(ENV_KEY2, ENV_VALUE2);
    const input = {
      "X-Key-1": `\${${ENV_KEY}}`,
      "X-Key-2": `\${${ENV_KEY2}}`,
    };
    expect(interpolateEnvRecord(input)).toEqual({
      "X-Key-1": ENV_VALUE,
      "X-Key-2": ENV_VALUE2,
    });
  });

  it("does not modify the original object", () => {
    const input = { key: `\${${ENV_KEY}}` };
    const original = { ...input };
    interpolateEnvRecord(input);
    expect(input).toEqual(original);
  });
});
