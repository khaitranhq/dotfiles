/**
 * JSON Schema → TypeBox converter for MCP tool parameters.
 *
 * Converts JSON Schema (as returned by MCP tools/list) into TypeBox schemas
 * that pi can use for parameter validation and system-prompt generation.
 *
 * Token-efficiency: Unknown/unconvertible schemas fall back to Type.Any(),
 * which adds minimal tokens to the system prompt while still allowing the
 * LLM to pass arbitrary arguments.
 */

import { Type, type TSchema } from "typebox";

/** Upper bound on recursion depth to prevent DoS from malformed schemas. */
const MAX_DEPTH = 10;

/**
 * Convert a JSON Schema object to a TypeBox schema.
 * Returns Type.Any() for schemas that can't be cleanly converted.
 */
export function jsonSchemaToTypeBox(schema: unknown, depth = 0): TSchema {
  if (depth > MAX_DEPTH) return Type.Any();
  if (!schema || typeof schema !== "object") return Type.Any();

  const s = schema as Record<string, unknown>;

  // Handle $ref — we don't resolve cross-references, so fall back to Any.
  if ("$ref" in s) return Type.Any();

  // Handle anyOf/oneOf/allOf — flatten to Any (model will still work,
  // just won't have typed validation on the pi side).
  if ("anyOf" in s || "oneOf" in s || "allOf" in s) return Type.Any();

  const type = s.type;

  // ── String ──────────────────────────────────────────────────────────
  if (type === "string") {
    const enums = s.enum as string[] | undefined;
    if (enums && Array.isArray(enums) && enums.length > 0) {
      // Type.Union with Type.Literal works for most providers.
      return Type.Union(enums.map((v) => Type.Literal(v)));
    }
    return Type.String();
  }

  // ── Number / Integer ────────────────────────────────────────────────
  if (type === "number" || type === "integer") {
    return Type.Number();
  }

  // ── Boolean ─────────────────────────────────────────────────────────
  if (type === "boolean") {
    return Type.Boolean();
  }

  // ── Array ───────────────────────────────────────────────────────────
  if (type === "array") {
    const items = s.items;
    return Type.Array(items ? jsonSchemaToTypeBox(items, depth + 1) : Type.Any());
  }

  // ── Object ──────────────────────────────────────────────────────────
  if (type === "object") {
    const properties = s.properties as Record<string, unknown> | undefined;
    const required = new Set<string>(Array.isArray(s.required) ? (s.required as string[]) : []);

    if (!properties) return Type.Object({});

    const propSchemas: Record<string, TSchema> = {};
    for (const [key, propSchema] of Object.entries(properties)) {
      const ts = jsonSchemaToTypeBox(propSchema, depth + 1);
      propSchemas[key] = required.has(key) ? ts : Type.Optional(ts);
    }

    // additionalProperties: false by default for stricter validation
    const additional = s.additionalProperties !== true;
    return Type.Object(propSchemas, { additionalProperties: additional });
  }

  // ── Fallback ────────────────────────────────────────────────────────
  return Type.Any();
}

/**
 * Build a concise, human-readable description of a JSON Schema for use in
 * a tool description or prompt snippet. Kept short for token efficiency.
 */
export function describeSchema(schema: unknown, indent = ""): string {
  if (!schema || typeof schema !== "object") return "any";

  const s = schema as Record<string, unknown>;

  if ("$ref" in s) return String(s.$ref);
  if ("anyOf" in s || "oneOf" in s || "allOf" in s) return "(union)";

  const type = s.type;

  if (type === "string") {
    const enums = s.enum as string[] | undefined;
    if (enums) return enums.join("|");
    return "string";
  }

  if (type === "number" || type === "integer") return "number";
  if (type === "boolean") return "boolean";

  if (type === "array") {
    return `[${describeSchema(s.items, indent)}]`;
  }

  if (type === "object") {
    const props = s.properties as Record<string, unknown> | undefined;
    if (!props) return "{}";

    const required = new Set(Array.isArray(s.required) ? (s.required as string[]) : []);

    const lines = Object.entries(props).map(([k, v]) => {
      const req = required.has(k) ? "" : "?";
      return `${indent}  ${k}${req}: ${describeSchema(v, indent + "  ")}`;
    });

    return `{\n${lines.join("\n")}\n${indent}}`;
  }

  return "any";
}
