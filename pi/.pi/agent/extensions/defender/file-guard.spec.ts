import { describe, it, expect } from "vitest";
import * as path from "node:path";
import { checkReadPath, checkWritePath } from "./file-guard";

const HOME_DIR = process.env.HOME || "/home/" + (process.env.USER || "user");
const ALLOWED_PREFIXES = [HOME_DIR, "/tmp"];

// ── checkReadPath ─────────────────────────────────────────────────────

describe("checkReadPath", () => {
  it("allows reading files inside HOME_DIR", () => {
    const result = checkReadPath(
      path.join(HOME_DIR, "project", "file.ts"),
      HOME_DIR,
      ALLOWED_PREFIXES,
    );
    expect(result.blocked).toBe(false);
  });

  it("allows reading files in /tmp", () => {
    const result = checkReadPath("/tmp/log.txt", HOME_DIR, ALLOWED_PREFIXES);
    expect(result.blocked).toBe(false);
  });

  it("allows relative paths resolved inside HOME_DIR", () => {
    const result = checkReadPath("file.ts", HOME_DIR, ALLOWED_PREFIXES);
    expect(result.blocked).toBe(false);
  });

  it("blocks reading files outside allowed prefixes", () => {
    const result = checkReadPath("/etc/passwd", HOME_DIR, ALLOWED_PREFIXES);
    expect(result.blocked).toBe(true);
    expect(result.reason).toContain("blocked");
    expect(result.reason).toContain("$HOME");
  });

  it("blocks reading .env files", () => {
    const result = checkReadPath(
      path.join(HOME_DIR, "project", ".env"),
      HOME_DIR,
      ALLOWED_PREFIXES,
    );
    expect(result.blocked).toBe(true);
    expect(result.reason).toContain("env file");
  });

  it("blocks reading .env.local files", () => {
    const result = checkReadPath(".env.local", HOME_DIR, ALLOWED_PREFIXES);
    expect(result.blocked).toBe(true);
  });

  it("blocks reading files resolved outside via cwd", () => {
    const result = checkReadPath("passwd", "/etc", ALLOWED_PREFIXES);
    expect(result.blocked).toBe(true);
  });

  it("allows empty/falsy path", () => {
    const result = checkReadPath("", HOME_DIR, ALLOWED_PREFIXES);
    expect(result.blocked).toBe(false);
  });
});

// ── checkWritePath ────────────────────────────────────────────────────

describe("checkWritePath", () => {
  it("allows writing files inside HOME_DIR", () => {
    const result = checkWritePath(
      path.join(HOME_DIR, "project", "output.txt"),
      HOME_DIR,
      ALLOWED_PREFIXES,
    );
    expect(result.blocked).toBe(false);
  });

  it("allows writing files in /tmp", () => {
    const result = checkWritePath("/tmp/output.txt", HOME_DIR, ALLOWED_PREFIXES);
    expect(result.blocked).toBe(false);
  });

  it("blocks writing files outside allowed prefixes", () => {
    const result = checkWritePath("/etc/config", HOME_DIR, ALLOWED_PREFIXES);
    expect(result.blocked).toBe(true);
    expect(result.reason).toContain("blocked");
  });

  it("blocks writing .env files even inside HOME_DIR", () => {
    const result = checkWritePath(
      path.join(HOME_DIR, ".env"),
      HOME_DIR,
      ALLOWED_PREFIXES,
    );
    expect(result.blocked).toBe(true);
    expect(result.reason).toContain("env file");
  });

  it("blocks writing .env.production", () => {
    const result = checkWritePath(
      path.join(HOME_DIR, "project", ".env.production"),
      HOME_DIR,
      ALLOWED_PREFIXES,
    );
    expect(result.blocked).toBe(true);
  });
});
