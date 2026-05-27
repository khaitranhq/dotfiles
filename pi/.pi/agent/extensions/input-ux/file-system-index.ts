import { execSync } from "node:child_process";
import * as path from "node:path";
import { FILE_CACHE_TTL, FIND_PRUNE, PATH_LIST_LIMIT, type ProjectPathCache } from "./types";

export class FileSystemIndex {
  private cache: ProjectPathCache | null = null;

  invalidate(): void {
    this.cache = null;
  }

  getProjectPaths(cwd: string): { files: string[]; directories: string[] } {
    const now = Date.now();
    if (this.cache && this.cache.cwd === cwd && now - this.cache.timestamp < FILE_CACHE_TTL) {
      return { files: this.cache.files, directories: this.cache.directories };
    }

    let files: string[] = [];
    let directories: string[] = [];

    if (isGitRepo(cwd)) {
      files = listGitFiles(cwd);
      directories = files.length > 0 ? buildDirectoriesFromFiles(files) : listFindDirectories(cwd);
    } else {
      files = listFindFiles(cwd);
      directories = listFindDirectories(cwd);
    }

    this.cache = {
      cwd,
      files: sortPaths(files),
      directories: sortPaths(Array.from(new Set(directories))),
      timestamp: now,
    };

    return { files: this.cache.files, directories: this.cache.directories };
  }
}

function isGitRepo(cwd: string): boolean {
  try {
    const result = execSync("git rev-parse --is-inside-work-tree", {
      cwd,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5_000,
    });
    return result.trim() === "true";
  } catch {
    return false;
  }
}

function listGitFiles(cwd: string): string[] {
  try {
    const output = execSync("git ls-files --cached --others --exclude-standard -z", {
      cwd,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 10 * 1024 * 1024,
      timeout: 10_000,
    });
    return output
      .split("\0")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .slice(0, PATH_LIST_LIMIT);
  } catch {
    return [];
  }
}

function listFindFiles(cwd: string): string[] {
  try {
    const output = execSync(
      `rg --files -g '!node_modules/**' -g '!.git/**' -g '!dist/**' -g '!build/**' -g '!target/**' -g '!__pycache__/**' -g '!vendor/**' -g '!.venv/**' -g '!.cache/**' -g '!.next/**' 2>/dev/null | head -n ${PATH_LIST_LIMIT}`,
      {
        cwd,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],
        maxBuffer: 10 * 1024 * 1024,
        timeout: 10_000,
      },
    );
    return output
      .split("\n")
      .map((entry) => entry.trim())
      .filter(Boolean);
  } catch {
    // rg not available, fall back to find
  }

  try {
    const output = execSync(`find . ${FIND_PRUNE} -type f -print | head -n ${PATH_LIST_LIMIT}`, {
      cwd,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 10 * 1024 * 1024,
      timeout: 10_000,
    });
    return output
      .split("\n")
      .map((entry) => entry.replace(/^\.\//, "").trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function listFindDirectories(cwd: string): string[] {
  try {
    const output = execSync(
      `rg --files -g '!node_modules/**' -g '!.git/**' -g '!dist/**' -g '!build/**' -g '!target/**' -g '!__pycache__/**' -g '!vendor/**' -g '!.venv/**' -g '!.cache/**' -g '!.next/**' 2>/dev/null`,
      {
        cwd,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],
        maxBuffer: 10 * 1024 * 1024,
        timeout: 10_000,
      },
    );
    const files = output
      .split("\n")
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (files.length > 0) return buildDirectoriesFromFiles(files);
  } catch {
    // fall back to find
  }

  try {
    const output = execSync(`find . ${FIND_PRUNE} -type d -print | head -n ${PATH_LIST_LIMIT}`, {
      cwd,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 10 * 1024 * 1024,
      timeout: 10_000,
    });
    return output
      .split("\n")
      .map((entry) => entry.replace(/^\.\//, "").trim())
      .filter((entry) => entry.length > 0 && entry !== ".");
  } catch {
    return [];
  }
}

export function buildDirectoriesFromFiles(files: string[]): string[] {
  const directories = new Set<string>();
  for (const file of files) {
    let current = path.posix.dirname(file.replace(/\\/g, "/"));
    while (current && current !== "." && current !== "/") {
      directories.add(current);
      const next = path.posix.dirname(current);
      if (next === current) break;
      current = next;
    }
  }
  return Array.from(directories);
}

function sortPaths(paths: string[]): string[] {
  return paths.sort((a, b) => {
    const depthDiff = getPathDepth(a) - getPathDepth(b);
    if (depthDiff !== 0) return depthDiff;
    return a.localeCompare(b);
  });
}

export function getPathDepth(value: string): number {
  return value.split("/").filter(Boolean).length - 1;
}

export function basenameWithoutExtension(filePath: string): string {
  const base = path.posix.basename(filePath.replace(/\\/g, "/"));
  const ext = path.posix.extname(base);
  return ext ? base.slice(0, -ext.length) : base;
}
