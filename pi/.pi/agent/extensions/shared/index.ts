/** Shared utilities barrel — no extension to register. */
export { Config, defaultConfig } from "./config";
export type {
  SubagentConfig,
  CustomSettings,
  ToolPermission,
  BashPermissions,
  ToolPermissions,
  AgentYamlDefinition,
  AgentsConfig,
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

export { Logger } from "./logger";

export { truncateAtWord } from "./text-utils";

export {
  isToolPermissions,
  lookupPermission,
  resolveBashPermission,
  addToolPermission,
  addBashPermission,
} from "./tool-permissions";

export default function () {
  /* intentionally empty — shared module, not an extension */
}
