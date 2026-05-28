import * as fs from "node:fs";
import * as path from "node:path";
import { INPUT_HISTORY_FILE, INPUT_HISTORY_LIMIT, type PersistedInputHistoryFile } from "./types";
import { defaultConfig } from "../shared";

export class InputHistoryManager {
  private runtimeHistories: Record<string, string[]> | null = null;

  getForCwd(cwd: string): string[] {
    const histories = this.getRuntime();
    const normalizedCwd = path.resolve(cwd);
    if (!histories[normalizedCwd]) {
      histories[normalizedCwd] = [];
    }
    return histories[normalizedCwd];
  }

  remember(cwd: string, text: string): void {
    const normalizedText = text.replace(/\r\n?/g, "\n").trim();
    if (!normalizedText) return;

    const normalizedCwd = path.resolve(cwd);
    const histories = this.getRuntime();
    const existingHistory = histories[normalizedCwd] ?? [];
    histories[normalizedCwd] = [
      normalizedText,
      ...existingHistory.filter((entry) => entry !== normalizedText),
    ].slice(0, INPUT_HISTORY_LIMIT);

    this.persist(histories);
  }

  private getRuntime(): Record<string, string[]> {
    if (this.runtimeHistories === null) {
      this.runtimeHistories = loadPersistedInputHistories();
    }
    return this.runtimeHistories;
  }

  private persist(histories: Record<string, string[]>): void {
    const historyFilePath = getHistoryFilePath();
    const tempFilePath = `${historyFilePath}.${process.pid}.${Date.now()}.tmp`;

    try {
      fs.mkdirSync(path.dirname(historyFilePath), { recursive: true });
      const payload: PersistedInputHistoryFile = { version: 1, histories };
      fs.writeFileSync(tempFilePath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
      fs.renameSync(tempFilePath, historyFilePath);
    } catch (error) {
      console.error(`[input-ux] Failed to save persisted input history: ${error}`);
      try {
        fs.rmSync(tempFilePath, { force: true });
      } catch {
        // Ignore temp cleanup failures.
      }
    }
  }
}

function getHistoryFilePath(): string {
  return path.join(defaultConfig.getAgentDir(), INPUT_HISTORY_FILE);
}

function loadPersistedInputHistories(): Record<string, string[]> {
  const historyFilePath = getHistoryFilePath();

  try {
    if (!fs.existsSync(historyFilePath)) return {};

    const raw = fs.readFileSync(historyFilePath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<PersistedInputHistoryFile>;
    if (!parsed || typeof parsed !== "object" || typeof parsed.histories !== "object") {
      return {};
    }

    const histories: Record<string, string[]> = {};
    for (const [cwd, entries] of Object.entries(parsed.histories)) {
      if (!Array.isArray(entries)) continue;

      const normalizedEntries = entries
        .map((entry) => (typeof entry === "string" ? entry.replace(/\r\n?/g, "\n").trim() : ""))
        .filter(Boolean)
        .slice(0, INPUT_HISTORY_LIMIT);

      if (normalizedEntries.length > 0) {
        histories[cwd] = normalizedEntries;
      }
    }
    return histories;
  } catch (error) {
    console.error(`[input-ux] Failed to load persisted input history: ${error}`);
    return {};
  }
}
