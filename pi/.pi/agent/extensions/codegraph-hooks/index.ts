/**
 * CodeGraph Hooks Extension
 *
 * Runs `codegraph init` on session_start and `codegraph sync` on
 * session_shutdown, fire-and-forget. Skipped when the cwd is already
 * initialised (start) or uninitialised (shutdown).
 */

import { execFile } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { Logger } from "../shared/logger";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const logger = new Logger(
  path.join(process.env.HOME ?? "/tmp", ".pi", "agent", "codegraph-hooks.log"),
);

const CODEGRAPH_BIN = "codegraph";
const CODEGRAPH_DIR = ".codegraph";

function run(args: readonly string[], cwd: string, label: string): void {
  execFile(CODEGRAPH_BIN, [...args, cwd], { cwd }, (err) => {
    if (err) logger.log(`${label}: ${err.message}`);
  });
}

export default function codegraphHooksExtension(pi: ExtensionAPI): void {
  pi.on("session_start", (event, ctx) => {
    if (event.reason === "startup" || event.reason === "reload") return;
    if (fs.existsSync(path.join(ctx.cwd, CODEGRAPH_DIR))) return;
    logger.log(`init: ${ctx.cwd} (reason=${event.reason})`);
    run(["init"], ctx.cwd, "init");
  });

  pi.on("session_shutdown", (event, ctx) => {
    if (!fs.existsSync(path.join(ctx.cwd, CODEGRAPH_DIR))) return;
    logger.log(`sync: ${ctx.cwd} (reason=${event.reason})`);
    run(["sync", "-q"], ctx.cwd, "sync");
  });
}
