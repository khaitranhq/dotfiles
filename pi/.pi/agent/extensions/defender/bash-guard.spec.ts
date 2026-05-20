import { describe, it, expect } from "vitest";
import * as path from "node:path";
import { checkBashCommand, findDangerousPattern } from "./bash-guard";

const HOME_DIR = process.env.HOME || "/home/" + (process.env.USER || "user");
const ALLOWED_PREFIXES = [HOME_DIR, "/tmp"];

// ── findDangerousPattern ──────────────────────────────────────────────

describe("findDangerousPattern", () => {
  it("returns null for safe commands", () => {
    expect(findDangerousPattern("ls -la")).toBeNull();
    expect(findDangerousPattern("echo hello")).toBeNull();
    expect(findDangerousPattern("git status")).toBeNull();
  });

  it("matches sudo", () => {
    const result = findDangerousPattern("sudo rm /tmp/file");
    expect(result).not.toBeNull();
    expect(result!.source).toContain("sudo");
  });

  it("matches fork bomb", () => {
    expect(findDangerousPattern(":(){ :|:& };:")).not.toBeNull();
  });

  it("matches find -delete workaround", () => {
    expect(findDangerousPattern("find . -name '*.bak' -delete")).not.toBeNull();
  });

  it("matches python os.remove workaround", () => {
    expect(findDangerousPattern("python -c 'import os; os.remove(\"x\")'")).not.toBeNull();
  });
});

// ── checkBashCommand ──────────────────────────────────────────────────

describe("checkBashCommand", () => {
  it("allows safe commands", () => {
    const result = checkBashCommand("ls -la", HOME_DIR, ALLOWED_PREFIXES);
    expect(result.blocked).toBe(false);
  });

  it("allows rm inside HOME_DIR", () => {
    const insideHome = path.join(HOME_DIR, "temp-file");
    const result = checkBashCommand(`rm ${insideHome}`, HOME_DIR, ALLOWED_PREFIXES);
    expect(result.blocked).toBe(false);
  });

  it("allows rm inside /tmp", () => {
    const result = checkBashCommand("rm /tmp/foo", HOME_DIR, ALLOWED_PREFIXES);
    expect(result.blocked).toBe(false);
  });

  it("allows rm with relative path inside cwd", () => {
    const result = checkBashCommand("rm temp.log", HOME_DIR, ALLOWED_PREFIXES);
    expect(result.blocked).toBe(false);
  });

  it("blocks rm outside allowed prefixes", () => {
    const result = checkBashCommand("rm /etc/passwd", HOME_DIR, ALLOWED_PREFIXES);
    expect(result.blocked).toBe(true);
    expect(result.reason).toContain("rm blocked");
  });

  it("blocks sudo command", () => {
    const result = checkBashCommand("sudo ls", HOME_DIR, ALLOWED_PREFIXES);
    expect(result.blocked).toBe(true);
    expect(result.reason).toContain("Dangerous command");
  });

  it("blocks fork bomb", () => {
    const result = checkBashCommand(":(){ :|:& };:", HOME_DIR, ALLOWED_PREFIXES);
    expect(result.blocked).toBe(true);
  });

  it("blocks dangerous commands even when rm paths are safe", () => {
    const insideHome = path.join(HOME_DIR, "temp");
    const result = checkBashCommand(`sudo rm ${insideHome}`, HOME_DIR, ALLOWED_PREFIXES);
    expect(result.blocked).toBe(true);
  });

  it("blocks when some rm targets are outside and some inside", () => {
    const insideHome = path.join(HOME_DIR, "safe-file");
    const result = checkBashCommand(`rm ${insideHome} /etc/hosts`, HOME_DIR, ALLOWED_PREFIXES);
    expect(result.blocked).toBe(true);
    expect(result.reason).toContain("/etc/hosts");
  });

  it("does not double-block: rm outside check comes before patterns", () => {
    const result = checkBashCommand("rm /etc/hosts", HOME_DIR, ALLOWED_PREFIXES);
    expect(result.blocked).toBe(true);
    expect(result.reason).toContain("rm blocked");
  });

  it("allows command with no rm component", () => {
    const result = checkBashCommand("echo 'rm everything'", HOME_DIR, ALLOWED_PREFIXES);
    expect(result.blocked).toBe(false);
  });
});
