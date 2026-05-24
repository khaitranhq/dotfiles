/**
 * MCP file logging — best-effort logging to ~/.pi/agent/mcp/mcp.log
 */
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const MCP_LOG_DIR = path.join(os.homedir(), ".pi", "agent", "mcp");
const MCP_LOG_FILE = path.join(MCP_LOG_DIR, "mcp.log");

function ensureLogDir(): void {
  try {
    if (!fs.existsSync(MCP_LOG_DIR)) {
      fs.mkdirSync(MCP_LOG_DIR, { recursive: true, mode: 0o700 });
    }
  } catch {
    // Ignore — logging is best-effort
  }
}

function writeLog(level: string, server: string, msg: string): void {
  ensureLogDir();
  try {
    const ts = new Date().toISOString();
    const line = `[${ts}] [${level}] [${server}] ${msg}\n`;
    fs.appendFileSync(MCP_LOG_FILE, line, "utf-8");
  } catch {
    // Ignore — logging is best-effort
  }
}

export function mcpLogInfo(server: string, msg: string): void {
  writeLog("INFO", server, msg);
}

export function mcpLogWarn(server: string, msg: string): void {
  writeLog("WARN", server, msg);
}

export function mcpLogError(server: string, msg: string): void {
  writeLog("ERROR", server, msg);
}
