/**
 * Logger — simple file logger with dynamic log file path.
 *
 * Creates parent directories automatically. Each log line is
 * timestamped and appended.
 */

import * as fs from "node:fs";
import * as path from "node:path";

export class Logger {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  /** Change the log file path dynamically. */
  setPath(filePath: string): void {
    this.filePath = filePath;
  }

  /** Append a timestamped message to the log file. */
  log(message: string): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${message}\n`;

    fs.appendFileSync(this.filePath, line, "utf-8");
  }
}
