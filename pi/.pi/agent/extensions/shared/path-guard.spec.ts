import { describe, it, expect } from "vitest";
import * as path from "node:path";
import { expandPath, normalizePath, isPathAllowed, isEnvFile, HOME_DIR } from "./path-guard";

// ── expandPath ────────────────────────────────────────────────────────

describe("expandPath", () => {
  it("returns empty string for falsy input", () => {
    expect(expandPath("")).toBe("");
    expect(expandPath(undefined as unknown as string)).toBeUndefined();
  });

  it("expands bare ~ to HOME_DIR", () => {
    expect(expandPath("~")).toBe(HOME_DIR);
  });

  it("expands ~/foo to HOME_DIR/foo", () => {
    expect(expandPath("~/foo")).toBe(path.join(HOME_DIR, "foo"));
    expect(expandPath("~/foo/bar")).toBe(path.join(HOME_DIR, "foo/bar"));
  });

  it("expands $HOME and ${HOME}", () => {
    expect(expandPath("$HOME/foo")).toBe(path.join(HOME_DIR, "foo"));
    expect(expandPath("${HOME}/bar")).toBe(path.join(HOME_DIR, "bar"));
  });

  it("leaves absolute paths unchanged", () => {
    expect(expandPath("/usr/bin")).toBe("/usr/bin");
  });

  it("leaves relative paths unchanged", () => {
    expect(expandPath("foo/bar")).toBe("foo/bar");
  });
});

// ── normalizePath ─────────────────────────────────────────────────────

describe("normalizePath", () => {
  it("returns empty string for falsy input", () => {
    expect(normalizePath("")).toBe("");
  });

  it("resolves relative path against given cwd", () => {
    const cwd = "/home/user/project";
    expect(normalizePath("foo/bar", cwd)).toBe(path.resolve(cwd, "foo/bar"));
  });

  it("expands ~ before resolving", () => {
    const cwd = "/tmp";
    const result = normalizePath("~/documents", cwd);
    expect(result).toBe(path.join(HOME_DIR, "documents"));
  });

  it("resolves absolute paths as-is (relative to root)", () => {
    expect(normalizePath("/etc/passwd")).toBe(path.resolve("/etc/passwd"));
  });
});

// ── isPathAllowed ─────────────────────────────────────────────────────

describe("isPathAllowed", () => {
  const allowed = [HOME_DIR, "/tmp"];

  it("returns true for falsy path", () => {
    expect(isPathAllowed("")).toBe(true);
  });

  it("returns true for paths inside HOME_DIR", () => {
    expect(isPathAllowed(path.join(HOME_DIR, "project"), undefined, allowed)).toBe(true);
    expect(isPathAllowed("~/project", undefined, allowed)).toBe(true);
  });

  it("returns true for paths inside /tmp", () => {
    expect(isPathAllowed("/tmp/foo", undefined, allowed)).toBe(true);
    expect(isPathAllowed("/tmp", undefined, allowed)).toBe(true);
  });

  it("returns false for paths outside allowed prefixes", () => {
    expect(isPathAllowed("/etc/passwd", undefined, allowed)).toBe(false);
    expect(isPathAllowed("/usr/bin", undefined, allowed)).toBe(false);
  });

  it("resolves relative paths against cwd", () => {
    expect(isPathAllowed("project", HOME_DIR, allowed)).toBe(true);
    expect(isPathAllowed("foo", "/etc", allowed)).toBe(false);
  });
});

// ── isEnvFile ─────────────────────────────────────────────────────────

describe("isEnvFile", () => {
  it("matches .env", () => {
    expect(isEnvFile(".env")).toBe(true);
  });

  it("matches .env.local, .env.production", () => {
    expect(isEnvFile(".env.local")).toBe(true);
    expect(isEnvFile(".env.production")).toBe(true);
  });

  it("matches full paths with .env", () => {
    expect(isEnvFile("/home/user/project/.env")).toBe(true);
    expect(isEnvFile("project/.env.local")).toBe(true);
  });

  it("matches dot-prefixed env variants like .app.env", () => {
    expect(isEnvFile(".app.env")).toBe(true);
  });

  it("does not match regular files", () => {
    expect(isEnvFile("config.ts")).toBe(false);
    expect(isEnvFile(".gitignore")).toBe(false);
    expect(isEnvFile("env.ts")).toBe(false);
  });

  it("does not match files containing 'env' in their name", () => {
    expect(isEnvFile("environment.ts")).toBe(false);
    expect(isEnvFile("myenvfile")).toBe(false);
  });
});
