/**
 * Subagent Extension
 *
 * Spawns separate `pi` processes for subagent invocation with isolated
 * context. Primary agents can be switched via `/agent <name>`.
 *
 * Agent definitions in `~/.pi/agent/custom-settings.yaml` under the `agents` key.
 */

import { type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { SubagentExtension } from "./extension";

export default function (pi: ExtensionAPI) {
  new SubagentExtension(pi);
}
