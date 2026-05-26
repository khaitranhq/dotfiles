/**
 * Centralized logging for MCP UI operations.
 * Provides structured, contextual logs with levels.
 * Logs to console and to ~/.pi/agent/mcp/mcp.log.
 */

import { appendFileSync, existsSync, mkdirSync, renameSync, statSync } from "node:fs";
import { dirname } from "node:path";
import { getAgentPath } from "../../shared/config.ts";

const LOG_FILE_PATH = getAgentPath("mcp", "mcp.log");
const MAX_LOG_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  server?: string;
  session?: string;
  tool?: string;
  uri?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: Error;
  timestamp: Date;
}

type LogHandler = (entry: LogEntry) => void;

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LEVEL_PREFIX: Record<LogLevel, string> = {
  debug: "[MCP-UI:DEBUG]",
  info: "[MCP-UI]",
  warn: "[MCP-UI:WARN]",
  error: "[MCP-UI:ERROR]",
};

class Logger {
  private minLevel: LogLevel = "info";
  private handlers: LogHandler[] = [];
  private defaultContext: LogContext = {};

  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  setDefaultContext(context: LogContext): void {
    this.defaultContext = context;
  }

  addHandler(handler: LogHandler): void {
    this.handlers.push(handler);
  }

  clearHandlers(): void {
    this.handlers = [];
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[this.minLevel];
  }

  private emit(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      level,
      message,
      context: { ...this.defaultContext, ...context },
      error,
      timestamp: new Date(),
    };

    // Default console output
    const prefix = LEVEL_PREFIX[level];
    const contextStr = formatContext(entry.context);
    const fullMessage = contextStr ? `${prefix} ${message} ${contextStr}` : `${prefix} ${message}`;

    if (level === "error") {
      console.error(fullMessage, error ?? "");
    } else if (level === "warn") {
      console.warn(fullMessage);
    } else if (level === "debug") {
      console.debug(fullMessage);
    } else {
      console.log(fullMessage);
    }

    // Write to log file
    this.writeToFile(entry);

    // Custom handlers
    for (const handler of this.handlers) {
      try {
        handler(entry);
      } catch {
        // Ignore handler errors
      }
    }
  }

  private writeToFile(entry: LogEntry): void {
    try {
      // Ensure directory exists
      const dir = dirname(LOG_FILE_PATH);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true, mode: 0o700 });
      }

      // Rotate if file exceeds max size
      if (existsSync(LOG_FILE_PATH)) {
        let size = 0;
        try {
          size = statSync(LOG_FILE_PATH).size;
        } catch {
          // File disappeared between exists and stat — proceed
        }
        if (size > MAX_LOG_SIZE_BYTES) {
          const rotated = `${LOG_FILE_PATH}.old`;
          try {
            renameSync(LOG_FILE_PATH, rotated);
          } catch {
            // Rotation failed — append anyway
          }
        }
      }

      const ts = entry.timestamp.toISOString();
      const level = entry.level.toUpperCase().padEnd(5);
      const ctxStr = formatContext(entry.context);
      const line = ctxStr
        ? `${ts} ${level} ${entry.message} ${ctxStr}`
        : `${ts} ${level} ${entry.message}`;
      appendFileSync(LOG_FILE_PATH, line + "\n", "utf-8");

      if (entry.error) {
        const errStack = entry.error.stack ?? String(entry.error);
        appendFileSync(LOG_FILE_PATH, `  ${errStack.replace(/\n/g, "\n  ")}\n`, "utf-8");
      }
    } catch {
      // Silently ignore file write errors — don't break app for logging
    }
  }

  debug(message: string, context?: LogContext): void {
    this.emit("debug", message, context);
  }

  info(message: string, context?: LogContext): void {
    this.emit("info", message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.emit("warn", message, context);
  }

  error(message: string, error?: Error, context?: LogContext): void {
    this.emit("error", message, context, error);
  }

  /**
   * Create a child logger with additional default context.
   */
  child(context: LogContext): ChildLogger {
    return new ChildLogger(this, context);
  }
}

class ChildLogger {
  constructor(
    private parent: Logger,
    private context: LogContext,
  ) {}

  debug(message: string, context?: LogContext): void {
    this.parent.debug(message, { ...this.context, ...context });
  }

  info(message: string, context?: LogContext): void {
    this.parent.info(message, { ...this.context, ...context });
  }

  warn(message: string, context?: LogContext): void {
    this.parent.warn(message, { ...this.context, ...context });
  }

  error(message: string, error?: Error, context?: LogContext): void {
    this.parent.error(message, error, { ...this.context, ...context });
  }

  child(context: LogContext): ChildLogger {
    return new ChildLogger(this.parent, { ...this.context, ...context });
  }
}

function formatContext(context?: LogContext): string {
  if (!context || Object.keys(context).length === 0) return "";
  const parts: string[] = [];
  for (const [key, value] of Object.entries(context)) {
    if (value !== undefined && value !== null) {
      parts.push(`${key}=${typeof value === "string" ? value : JSON.stringify(value)}`);
    }
  }
  return parts.length > 0 ? `(${parts.join(", ")})` : "";
}

// Singleton instance
export const logger = new Logger();

// Enable debug mode via environment variable
if (process.env.MCP_UI_DEBUG === "1" || process.env.MCP_UI_DEBUG === "true") {
  logger.setLevel("debug");
}
