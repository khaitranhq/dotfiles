# toonify

Intercept tool results, detect JSON-structured text content, and encode it as [TOON](https://github.com/toon-format/toon) before passing to the LLM. Non-JSON text and images pass through unchanged.

**Why:** TOON reduces token count by ~40% vs JSON while maintaining or improving LLM comprehension accuracy (76.4% vs 75.0% per benchmarks). Every tool result that returns JSON — `bash` (ls, find, grep), `read` (configs), `mcp_*` tools, custom tool output — gets automatically converted.

### How it works

Hooks `tool_result` event, parses each text content block as JSON. If it parses to an object or array, encodes it with `@toon-format/toon`'s `encode()`. Skips non-JSON text and image blocks.

### Settings

None. Zero-config.

### Commands

None.
