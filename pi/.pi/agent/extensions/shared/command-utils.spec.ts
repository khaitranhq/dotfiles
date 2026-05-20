import { describe, it, expect } from "vitest";
import {
  COMMAND_SEPARATORS,
  extractBaseCommand,
  findRmIndex,
  extractRmPaths,
} from "./command-utils";

// ── COMMAND_SEPARATORS ────────────────────────────────────────────────

describe("COMMAND_SEPARATORS", () => {
  it("includes common shell separators", () => {
    expect(COMMAND_SEPARATORS.has("&&")).toBe(true);
    expect(COMMAND_SEPARATORS.has("||")).toBe(true);
    expect(COMMAND_SEPARATORS.has(";")).toBe(true);
    expect(COMMAND_SEPARATORS.has("|")).toBe(true);
    expect(COMMAND_SEPARATORS.has("&")).toBe(true);
  });
});

// ── extractBaseCommand ────────────────────────────────────────────────

describe("extractBaseCommand", () => {
  it("extracts simple command", () => {
    expect(extractBaseCommand("ls -la")).toBe("ls");
  });

  it("extracts command before &&", () => {
    expect(extractBaseCommand("cd /tmp && rm -rf *")).toBe("cd");
  });

  it("extracts command before ;", () => {
    expect(extractBaseCommand("echo hello; ls")).toBe("echo");
  });

  it("extracts command before |", () => {
    expect(extractBaseCommand("cat file | grep foo")).toBe("cat");
  });

  it("skips leading env assignments", () => {
    expect(extractBaseCommand("FOO=bar ls -la")).toBe("ls");
    expect(extractBaseCommand("A=1 B=2 echo hi")).toBe("echo");
  });

  it("returns empty string for empty input", () => {
    expect(extractBaseCommand("")).toBe("");
    expect(extractBaseCommand("   ")).toBe("");
  });

  it("returns basename for full-path commands", () => {
    expect(extractBaseCommand("/usr/bin/git status")).toBe("git");
    expect(extractBaseCommand("/usr/local/bin/node server.js")).toBe("node");
  });
});

// ── findRmIndex ───────────────────────────────────────────────────────

describe("findRmIndex", () => {
  it("finds rm as the primary command", () => {
    expect(findRmIndex(["rm", "-rf", "/tmp/foo"])).toBe(0);
  });

  it("finds rm after sudo", () => {
    expect(findRmIndex(["sudo", "rm", "-rf", "/foo"])).toBe(1);
  });

  it("finds rm after env", () => {
    expect(findRmIndex(["env", "VAR=1", "rm", "file"])).toBe(2);
  });

  it("finds rm after a shell separator (new command)", () => {
    expect(findRmIndex(["ls", "&&", "rm", "file"])).toBe(2);
  });

  it("returns -1 when rm is not present", () => {
    expect(findRmIndex(["ls", "-la"])).toBe(-1);
    expect(findRmIndex(["echo", "hello"])).toBe(-1);
  });

  it("returns -1 when rm is an argument to another command", () => {
    // "echo rm" — echo is the command, rm is just an argument string
    expect(findRmIndex(["echo", "rm"])).toBe(-1);
    // "git rm" — git is the command
    expect(findRmIndex(["git", "rm", "file"])).toBe(-1);
  });

  it("handles prefixes like nohup, nice, ionice", () => {
    expect(findRmIndex(["nohup", "rm", "-rf", "/tmp/x"])).toBe(1);
    expect(findRmIndex(["nice", "rm", "file"])).toBe(1);
    expect(findRmIndex(["ionice", "rm", "file"])).toBe(1);
  });

  it("finds rm after a separator even with non-rm args before", () => {
    // "echo hello && rm file"
    expect(findRmIndex(["echo", "hello", "&&", "rm", "file"])).toBe(3);
  });
});

// ── extractRmPaths ────────────────────────────────────────────────────

describe("extractRmPaths", () => {
  it("extracts target paths from a simple rm command", () => {
    const paths = extractRmPaths("rm file1 file2");
    expect(paths).toEqual(["file1", "file2"]);
  });

  it("skips flag arguments", () => {
    const paths = extractRmPaths("rm -rf --preserve-root file1 file2");
    expect(paths).toEqual(["file1", "file2"]);
  });

  it("respects -- as end-of-options", () => {
    const paths = extractRmPaths("rm -- -rf -f file1");
    expect(paths).toEqual(["-rf", "-f", "file1"]);
  });

  it("stops at shell command separators", () => {
    const paths = extractRmPaths("rm file1 && rm file2");
    expect(paths).toEqual(["file1"]);
  });

  it("handles rm after sudo", () => {
    const paths = extractRmPaths("sudo rm -rf /etc/foo /var/bar");
    expect(paths).toEqual(["/etc/foo", "/var/bar"]);
  });

  it("strips surrounding quotes from each token", () => {
    // Note: match(/\S+/g) splits on whitespace, so "file with spaces"
    // is tokenised as separate tokens. Quote stripping is per-token.
    const paths = extractRmPaths('rm "file1" \'file2\'');
    expect(paths).toEqual(["file1", "file2"]);
  });

  it("returns empty array when rm is not the command", () => {
    expect(extractRmPaths("ls -la")).toEqual([]);
    expect(extractRmPaths("echo rm file")).toEqual([]);
  });

  it("handles empty or whitespace-only commands", () => {
    expect(extractRmPaths("")).toEqual([]);
    expect(extractRmPaths("   ")).toEqual([]);
  });
});
