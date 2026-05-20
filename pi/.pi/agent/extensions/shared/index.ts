/** Shared utilities barrel — no extension to register. */
export {
  loadCustomSettings,
  saveCustomSettings,
  updateCustomSettings,
  loadAlwaysApprove,
  loadSubagentConfig,
  configPath,
} from "./config";
export type {
  AlwaysApproveConfig,
  SubagentConfig,
  CustomSettings,
} from "./config";

export {
  expandPath,
  normalizePath,
  isPathAllowed,
  isEnvFile,
  DEFAULT_ALLOWED_PREFIXES,
  ENV_FILE_RE,
  HOME_DIR,
} from "./path-guard";

export {
  COMMAND_SEPARATORS,
  extractBaseCommand,
  extractAllBaseCommands,
  findRmIndex,
  extractRmPaths,
} from "./command-utils";

export default function () {
  /* intentionally empty — shared module, not an extension */
}
