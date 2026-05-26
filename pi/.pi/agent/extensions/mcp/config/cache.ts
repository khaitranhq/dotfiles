// config/cache.ts - Persistent MCP metadata cache
import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createHash } from "node:crypto";
import { getAgentPath } from "../../shared/config";
import type { McpTool, McpResource, ServerEntry, ToolMetadata } from "../core/types";
import { formatToolName, isToolExcluded } from "../core/types";
import { resourceNameToToolName } from "../tools/resources";
import { interpolateEnvRecord, resolveConfigPath } from "../../shared/env-utils";
import { resolveBearerToken } from "../core/utils";

const CACHE_VERSION = 1;
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// ── Types ────────────────────────────────────────────────────────────

interface CachedTool {
  name: string;
  description?: string;
  inputSchema?: unknown;
}

interface CachedResource {
  uri: string;
  name: string;
  description?: string;
}

export interface ServerCacheEntry {
  configHash: string;
  tools: CachedTool[];
  resources: CachedResource[];
  cachedAt: number;
}

export interface MetadataCache {
  version: number;
  servers: Record<string, ServerCacheEntry>;
}

// ── CacheManager class ───────────────────────────────────────────────

export class MetadataCacheManager {
  constructor(private cachePath: string = getAgentPath("mcp-cache.json")) {}

  /** Reconstruct tool metadata from cache. */
  buildMetadata(
    serverName: string,
    entry: ServerCacheEntry,
    prefix: "server" | "none" | "short",
    definition: Pick<ServerEntry, "exposeResources" | "excludeTools">,
  ): ToolMetadata[] {
    const result: ToolMetadata[] = [];

    for (const tool of entry.tools ?? []) {
      if (!tool?.name) continue;
      if (isToolExcluded(tool.name, serverName, prefix, definition.excludeTools)) continue;
      result.push({
        name: formatToolName(tool.name, serverName, prefix),
        originalName: tool.name,
        description: tool.description ?? "",
        inputSchema: tool.inputSchema,
      });
    }

    if (definition.exposeResources !== false) {
      for (const resource of entry.resources ?? []) {
        if (!resource?.name || !resource?.uri) continue;
        const baseName = `get_${resourceNameToToolName(resource.name)}`;
        if (isToolExcluded(baseName, serverName, prefix, definition.excludeTools)) continue;
        result.push({
          name: formatToolName(baseName, serverName, prefix),
          originalName: baseName,
          description: resource.description ?? `Read resource: ${resource.uri}`,
          resourceUri: resource.uri,
        });
      }
    }

    return result;
  }

  /** Compute config hash for a server definition. */
  hash(definition: ServerEntry): string {
    const identity: Record<string, unknown> = {
      command: definition.command,
      args: definition.args,
      env: interpolateEnvRecord(definition.env),
      cwd: resolveConfigPath(definition.cwd),
      url: definition.url,
      headers: interpolateEnvRecord(definition.headers),
      bearerToken: resolveBearerToken(definition),
      bearerTokenEnv: definition.bearerTokenEnv,
      exposeResources: definition.exposeResources,
      excludeTools: definition.excludeTools,
    };
    return createHash("sha256").update(stableStringify(identity)).digest("hex");
  }

  /** Check if cached entry is still valid. */
  isValid(entry: ServerCacheEntry, definition: ServerEntry, maxAgeMs = CACHE_MAX_AGE_MS): boolean {
    if (!entry || entry.configHash !== this.hash(definition)) return false;
    if (!entry.cachedAt || typeof entry.cachedAt !== "number") return false;
    if (maxAgeMs > 0 && Date.now() - entry.cachedAt > maxAgeMs) return false;
    return true;
  }

  load(): MetadataCache | null {
    if (!existsSync(this.cachePath)) return null;
    try {
      const raw = JSON.parse(readFileSync(this.cachePath, "utf-8"));
      if (!raw || typeof raw !== "object") return null;
      if (raw.version !== CACHE_VERSION) return null;
      if (!raw.servers || typeof raw.servers !== "object") return null;
      return raw as MetadataCache;
    } catch {
      return null;
    }
  }

  save(cache: MetadataCache): void {
    const dir = dirname(this.cachePath);
    mkdirSync(dir, { recursive: true });

    let merged: MetadataCache = { version: CACHE_VERSION, servers: {} };
    try {
      if (existsSync(this.cachePath)) {
        const existing = JSON.parse(readFileSync(this.cachePath, "utf-8")) as MetadataCache;
        if (existing?.version === CACHE_VERSION && existing.servers) {
          merged.servers = { ...existing.servers };
        }
      }
    } catch {
      /* proceed with empty merged */
    }

    merged.version = CACHE_VERSION;
    merged.servers = { ...merged.servers, ...cache.servers };

    const tmp = `${this.cachePath}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(merged, null, 2), "utf-8");
    renameSync(tmp, this.cachePath);
  }

  /** Serialize resources for cache storage. */
  serializeResources(resources: McpResource[]): CachedResource[] {
    return resources
      .filter((r) => r?.name && r?.uri)
      .map((r) => ({
        uri: r.uri,
        name: r.name,
        description: r.description,
      }));
  }

  /** Serialize tools for cache storage. */
  serializeTools(tools: McpTool[]): CachedTool[] {
    return tools
      .filter((t) => t?.name)
      .map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      }));
  }
}

// ── Legacy function API (backward-compatible) ────────────────────────

const defaultCache = new MetadataCacheManager();

export function computeServerHash(definition: ServerEntry): string {
  return defaultCache.hash(definition);
}

export function getMetadataCachePath(): string {
  return getAgentPath("mcp-cache.json");
}

export function isServerCacheValid(
  entry: ServerCacheEntry,
  definition: ServerEntry,
  maxAgeMs?: number,
): boolean {
  return defaultCache.isValid(entry, definition, maxAgeMs);
}

export function loadMetadataCache(): MetadataCache | null {
  return defaultCache.load();
}

export function reconstructToolMetadata(
  serverName: string,
  entry: ServerCacheEntry,
  prefix: "server" | "none" | "short",
  definition: Pick<ServerEntry, "exposeResources" | "excludeTools">,
): ToolMetadata[] {
  return defaultCache.buildMetadata(serverName, entry, prefix, definition);
}

export function saveMetadataCache(cache: MetadataCache): void {
  defaultCache.save(cache);
}

export function serializeResources(resources: McpResource[]): CachedResource[] {
  return defaultCache.serializeResources(resources);
}

export function serializeTools(tools: McpTool[]): CachedTool[] {
  return defaultCache.serializeTools(tools);
}

// ── Internal ─────────────────────────────────────────────────────────

function stableStringify(value: unknown): string {
  if (value === null || value === undefined || typeof value !== "object") {
    const s = JSON.stringify(value);
    return s === undefined ? "undefined" : s;
  }
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(",")}}`;
}
