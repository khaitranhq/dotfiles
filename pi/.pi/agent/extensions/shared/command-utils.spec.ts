import { describe, it, expect } from "vitest";
import {
  COMMAND_SEPARATORS,
  extractBaseCommand,
  extractAllBaseCommands,
  extractAllCommandSegments,
  isCommandApproved,
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

// ── extractAllBaseCommands ─────────────────────────────────────────

describe("extractAllBaseCommands", () => {
  it("returns single base command for simple commands", () => {
    expect(extractAllBaseCommands("ls -la")).toEqual(["ls"]);
    expect(extractAllBaseCommands("echo hello")).toEqual(["echo"]);
    expect(extractAllBaseCommands("pnpm install")).toEqual(["pnpm"]);
  });

  it("extracts all base commands from && chain", () => {
    expect(extractAllBaseCommands("cd /tmp && pnpm install")).toEqual(["cd", "pnpm"]);
    expect(extractAllBaseCommands("cd /tmp && ls -la && pnpm install")).toEqual([
      "cd",
      "ls",
      "pnpm",
    ]);
  });

  it("extracts all base commands from ; chain", () => {
    expect(extractAllBaseCommands("echo hello; cat file.txt")).toEqual(["echo", "cat"]);
  });

  it("extracts all base commands from | pipe", () => {
    expect(extractAllBaseCommands("cat file | grep foo")).toEqual(["cat", "grep"]);
  });

  it("handles || separator", () => {
    expect(extractAllBaseCommands("ls || echo fail")).toEqual(["ls", "echo"]);
  });

  it("handles & separator", () => {
    expect(extractAllBaseCommands("sleep 1 & ls")).toEqual(["sleep", "ls"]);
  });

  it("handles mixed separators", () => {
    expect(extractAllBaseCommands("echo hello; cat file | grep foo && ls")).toEqual([
      "echo",
      "cat",
      "grep",
      "ls",
    ]);
  });

  it("skips leading env assignments in each segment", () => {
    expect(extractAllBaseCommands("FOO=bar ls -la && BAZ=qux pnpm install")).toEqual([
      "ls",
      "pnpm",
    ]);
  });

  it("returns basename for full-path commands", () => {
    expect(extractAllBaseCommands("/usr/bin/git status && /usr/local/bin/node -v")).toEqual([
      "git",
      "node",
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(extractAllBaseCommands("")).toEqual([]);
    expect(extractAllBaseCommands("   ")).toEqual([]);
  });

  it("does not confuse || with single |", () => {
    // || should split into two separate segments, not three
    expect(extractAllBaseCommands("cmd1 || cmd2")).toEqual(["cmd1", "cmd2"]);
  });

  it("does not confuse && with single &", () => {
    expect(extractAllBaseCommands("cmd1 && cmd2")).toEqual(["cmd1", "cmd2"]);
  });
});

// ── extractAllCommandSegments ──────────────────────────────────────

describe("extractAllCommandSegments", () => {
  it("returns full command text for simple commands", () => {
    expect(extractAllCommandSegments("ls -la")).toEqual(["ls -la"]);
    expect(extractAllCommandSegments("git diff --cached")).toEqual(["git diff --cached"]);
    expect(extractAllCommandSegments("npx tsc --noEmit")).toEqual(["npx tsc --noEmit"]);
  });

  it("splits compound commands into segments", () => {
    expect(extractAllCommandSegments("cd /tmp && pnpm install")).toEqual([
      "cd /tmp",
      "pnpm install",
    ]);
    expect(extractAllCommandSegments("git diff | cat")).toEqual(["git diff", "cat"]);
  });

  it("strips leading env assignments from each segment", () => {
    expect(extractAllCommandSegments("FOO=bar ls -la")).toEqual(["ls -la"]);
    expect(extractAllCommandSegments("A=1 B=2 echo hi && C=3 git log")).toEqual([
      "echo hi",
      "git log",
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(extractAllCommandSegments("")).toEqual([]);
    expect(extractAllCommandSegments("   ")).toEqual([]);
  });

  it("preserves full path commands", () => {
    expect(extractAllCommandSegments("/usr/bin/git status")).toEqual(["/usr/bin/git status"]);
  });
});

// ── isCommandApproved ──────────────────────────────────────────────

describe("isCommandApproved", () => {
  const approved = new Set(["ls", "git diff", "npx tsc", "go test"]);

  it("matches single-word entry against any args", () => {
    expect(isCommandApproved("ls -la", approved)).toBe(true);
    expect(isCommandApproved("ls", approved)).toBe(true);
  });

  it("matches multi-word entry against segment with same prefix", () => {
    expect(isCommandApproved("git diff --cached", approved)).toBe(true);
    expect(isCommandApproved("git diff", approved)).toBe(true);
    expect(isCommandApproved("git diff HEAD", approved)).toBe(true);
  });

  it("rejects segment whose words differ from entry", () => {
    expect(isCommandApproved("git log", approved)).toBe(false);
    expect(isCommandApproved("git push", approved)).toBe(false);
    expect(isCommandApproved("git", approved)).toBe(false);
  });

  it("rejects when segment is shorter than entry", () => {
    // "git diff" entry has 2 words, "git" has 1 → no match
    expect(isCommandApproved("git", new Set(["git diff"]))).toBe(false);
  });

  it("matches npx subcommands", () => {
    expect(isCommandApproved("npx tsc --noEmit", approved)).toBe(true);
    expect(isCommandApproved("npx vitest", approved)).toBe(false);
  });

  it("handles empty approved set", () => {
    expect(isCommandApproved("ls -la", new Set())).toBe(false);
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
    const paths = extractRmPaths("rm \"file1\" 'file2'");
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
