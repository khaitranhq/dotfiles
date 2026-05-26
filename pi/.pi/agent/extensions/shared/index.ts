/** Shared utilities barrel — no extension to register. */
export {
  loadCustomSettings,
  saveCustomSettings,
  updateCustomSettings,
  loadAlwaysApprove,
  loadSubagentConfig,
  loadToolsConfig,
  loadToolPermissions,
  configPath,
  getAgentDir,
  getAgentPath,
} from "./config";
export type {
  AlwaysApproveConfig,
  SubagentConfig,
  AgentToolOverride,
  ToolsConfig,
  CustomSettings,
  ToolPermission,
  BashPermissions,
  ToolPermissions,
  McpYamlServer,
  McpYamlConfig,
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
  extractAllCommandSegments,
  extractCommandBasis,
  isCommandApproved,
  findRmIndex,
  extractRmPaths,
  wildcardToRegex,
  matchesToolPattern,
} from "./command-utils";

export { interpolateEnvVars, interpolateEnvRecord, resolveConfigPath } from "./env-utils";

export { parallelLimit } from "./async-utils";

export { truncateAtWord } from "./text-utils";

export default function () {
  /* intentionally empty — shared module, not an extension */
}
