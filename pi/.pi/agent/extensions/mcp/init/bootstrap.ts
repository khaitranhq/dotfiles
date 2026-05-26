// init/bootstrap.ts - MCP extension initialization
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { McpExtensionState } from "../core/state";
import type { ToolMetadata } from "../core/types";
import { existsSync } from "node:fs";
import { loadMcpConfig } from "../config/loader";
import { McpLifecycleManager } from "../client/lifecycle";
import { McpServerManager } from "../client/manager";
import { buildToolMetadata } from "../tools/metadata";
import { parallelLimit } from "../core/utils";
import { logger } from "../core/logger";
import { getMissingConfiguredToolServers } from "../proxy/direct";
import { OAuthFlow, supportsOAuth } from "../client/oauth-flow";
import {
  computeServerHash,
  getMetadataCachePath,
  isServerCacheValid,
  loadMetadataCache,
  reconstructToolMetadata,
  saveMetadataCache,
  serializeResources,
  serializeTools,
  type ServerCacheEntry,
} from "../config/cache";

const FAILURE_BACKOFF_MS = 60 * 1000;

// ── Exported ──────────────────────────────────────────────────────────

/** Flush tool/resource metadata for all connected servers to persistent cache. */
export function flushMetadataCache(state: McpExtensionState): void {
  for (const [name, connection] of state.manager.getAllConnections()) {
    if (connection.status === "connected") {
      updateMetadataCache(state, name);
    }
  }
}

/** Get seconds since a server's last connection failure (null if beyond backoff window). */
export function getFailureAgeSeconds(state: McpExtensionState, serverName: string): number | null {
  const failedAt = state.failureTracker.get(serverName);
  if (!failedAt) return null;
  const ageMs = Date.now() - failedAt;
  if (ageMs > FAILURE_BACKOFF_MS) return null;
  return Math.round(ageMs / 1000);
}

/** Bootstrap MCP: load config, connect servers, hydrate tool metadata. */
export async function initializeMcp(ctx: ExtensionContext): Promise<McpExtensionState> {
  const config = loadMcpConfig(undefined, ctx.cwd);

  const manager = new McpServerManager();
  const lifecycle = new McpLifecycleManager(manager);
  const toolMetadata = new Map<string, ToolMetadata[]>();
  const failureTracker = new Map<string, number>();
  const state: McpExtensionState = {
    manager,
    lifecycle,
    toolMetadata,
    config,
    failureTracker,
  };

  const serverEntries = Object.entries(config.mcpServers);
  if (serverEntries.length === 0) {
    return state;
  }

  const idleSetting =
    typeof config.settings?.idleTimeout === "number" ? config.settings.idleTimeout : 10;
  lifecycle.setGlobalIdleTimeout(idleSetting);

  const cachePath = getMetadataCachePath();
  const cacheFileExists = existsSync(cachePath);
  let cache = loadMetadataCache();
  let bootstrapAll = false;

  if (!cacheFileExists) {
    bootstrapAll = true;
    saveMetadataCache({ version: 1, servers: {} });
  } else if (!cache) {
    cache = { version: 1, servers: {} };
    saveMetadataCache(cache);
  }

  const prefix = config.settings?.toolPrefix ?? "server";

  for (const [name, definition] of serverEntries) {
    const lifecycleMode = definition.lifecycle ?? "lazy";
    const idleOverride = definition.idleTimeout ?? (lifecycleMode === "eager" ? 0 : undefined);
    lifecycle.registerServer(
      name,
      definition,
      idleOverride !== undefined ? { idleTimeout: idleOverride } : undefined,
    );
    if (lifecycleMode === "keep-alive") {
      lifecycle.markKeepAlive(name, definition);
    }

    if (cache?.servers?.[name] && isServerCacheValid(cache.servers[name], definition)) {
      const metadata = reconstructToolMetadata(name, cache.servers[name], prefix, definition);
      toolMetadata.set(name, metadata);
    }
  }

  // Check authentication for OAuth-capable HTTP servers on startup.
  const oauthServerEntries = serverEntries.filter(([, def]) => def.url && supportsOAuth(def));
  for (const [name, definition] of oauthServerEntries) {
    const serverUrl = definition.url;
    if (!serverUrl) continue;
    try {
      const flow = new OAuthFlow(name);
      const authStatus = flow.authStatus;
      if (authStatus !== "authenticated") {
        logger.info(`Authenticating OAuth server: ${name} (status: ${authStatus})`);
        try {
          const result = await flow.authenticate(serverUrl, definition);
          logger.info(`OAuth authentication complete for ${name}: ${result}`);
        } catch (authError) {
          const message = authError instanceof Error ? authError.message : String(authError);
          console.error(`MCP: OAuth authentication failed for ${name}: ${message}`);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`MCP: Auth status check failed for ${name}: ${message}`);
    }
  }

  const startupServers = bootstrapAll
    ? serverEntries
    : serverEntries.filter(([, definition]) => {
        const mode = definition.lifecycle ?? "lazy";
        return mode === "keep-alive" || mode === "eager";
      });

  const results = await parallelLimit(startupServers, 10, async ([name, definition]) => {
    try {
      const connection = await manager.connect(name, definition);
      return { name, definition, connection, error: null };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { name, definition, connection: null, error: message };
    }
  });

  for (const { name, definition, connection, error } of results) {
    if (error || !connection) {
      console.error(`MCP: Failed to connect to ${name}: ${error}`);
      continue;
    }

    const { metadata } = buildToolMetadata(
      connection.tools,
      connection.resources,
      definition,
      name,
      prefix,
    );
    toolMetadata.set(name, metadata);
    updateMetadataCache(state, name);
  }

  const envDirect = process.env.MCP_DIRECT_TOOLS;
  if (envDirect !== "__none__") {
    const currentCache = loadMetadataCache();
    const missingCacheServers = getMissingConfiguredToolServers(config, currentCache);

    if (missingCacheServers.length > 0) {
      await parallelLimit(
        missingCacheServers.filter((name) => !results.some((r) => r.name === name && r.connection)),
        10,
        async (name) => {
          const definition = config.mcpServers[name];
          try {
            const connection = await manager.connect(name, definition);
            const { metadata } = buildToolMetadata(
              connection.tools,
              connection.resources,
              definition,
              name,
              prefix,
            );
            toolMetadata.set(name, metadata);
            updateMetadataCache(state, name);
            return { name, ok: true };
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.debug(`MCP: tools bootstrap failed for ${name}: ${message}`);
            return { name, ok: false };
          }
        },
      );
    }
  }

  lifecycle.setReconnectCallback((serverName) => {
    updateServerMetadata(state, serverName);
    updateMetadataCache(state, serverName);
    state.failureTracker.delete(serverName);
  });

  lifecycle.setIdleShutdownCallback((serverName) => {
    const idleMinutes = getEffectiveIdleTimeoutMinutes(state, serverName);
    logger.debug(`${serverName} shut down (idle ${idleMinutes}m)`);
  });

  lifecycle.startHealthChecks();

  return state;
}

/** Attempt a lazy connection to a server, hydrating metadata on success. */
export async function lazyConnect(state: McpExtensionState, serverName: string): Promise<boolean> {
  const connection = state.manager.getConnection(serverName);
  if (connection?.status === "connected") {
    updateServerMetadata(state, serverName);
    return true;
  }

  const failedAgo = getFailureAgeSeconds(state, serverName);
  if (failedAgo !== null) return false;

  const definition = state.config.mcpServers[serverName];
  if (!definition) return false;

  try {
    await state.manager.connect(serverName, definition);
    state.failureTracker.delete(serverName);
    updateServerMetadata(state, serverName);
    updateMetadataCache(state, serverName);
    return true;
  } catch (error) {
    state.failureTracker.set(serverName, Date.now());
    const message = error instanceof Error ? error.message : String(error);
    logger.debug(`MCP: lazy connect failed for ${serverName}: ${message}`);
    return false;
  }
}

/** Persist tool/resource metadata for a single server to cache. */
export function updateMetadataCache(state: McpExtensionState, serverName: string): void {
  const connection = state.manager.getConnection(serverName);
  if (!connection || connection.status !== "connected") return;

  const definition = state.config.mcpServers[serverName];
  if (!definition) return;

  const configHash = computeServerHash(definition);
  const existing = loadMetadataCache();
  const existingEntry = existing?.servers?.[serverName];

  const tools = serializeTools(connection.tools);
  let resources =
    definition.exposeResources === false ? [] : serializeResources(connection.resources);

  if (
    definition.exposeResources !== false &&
    resources.length === 0 &&
    existingEntry?.resources?.length &&
    existingEntry.configHash === configHash
  ) {
    resources = existingEntry.resources;
  }

  const entry: ServerCacheEntry = {
    configHash,
    tools,
    resources,
    cachedAt: Date.now(),
  };

  saveMetadataCache({ version: 1, servers: { [serverName]: entry } });
}

// ── Internal ──────────────────────────────────────────────────────────

function getEffectiveIdleTimeoutMinutes(state: McpExtensionState, serverName: string): number {
  const definition = state.config.mcpServers[serverName];
  if (!definition) {
    return typeof state.config.settings?.idleTimeout === "number"
      ? state.config.settings.idleTimeout
      : 10;
  }
  if (typeof definition.idleTimeout === "number") return definition.idleTimeout;
  const mode = definition.lifecycle ?? "lazy";
  if (mode === "eager") return 0;
  return typeof state.config.settings?.idleTimeout === "number"
    ? state.config.settings.idleTimeout
    : 10;
}

function updateServerMetadata(state: McpExtensionState, serverName: string): void {
  const connection = state.manager.getConnection(serverName);
  if (!connection || connection.status !== "connected") return;

  const definition = state.config.mcpServers[serverName];
  if (!definition) return;

  const prefix = state.config.settings?.toolPrefix ?? "server";

  const { metadata } = buildToolMetadata(
    connection.tools,
    connection.resources,
    definition,
    serverName,
    prefix,
  );
  state.toolMetadata.set(serverName, metadata);
}
