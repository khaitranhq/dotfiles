import { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getApiKeyFromAuthJson } from "./utils";

export function setupDeepInfraProvider(pi: ExtensionAPI) {
  const apiKey = getApiKeyFromAuthJson("deepinfra") ?? process.env.DEEPINFRA_API_KEY;
  if (!apiKey) {
    console.warn("No DeepInfra API key found in auth.json or env, skipping provider registration");
    return;
  }

  pi.registerProvider("deepinfra", {
    name: "DeepInfra",
    baseUrl: "https://api.deepinfra.com/v1/openai",
    apiKey,
    api: "openai-completions",
    authHeader: true,
    models: [
      {
        id: "deepseek-ai/DeepSeek-V4-Pro",
        name: "DeepSeek V4 Pro",
        reasoning: false,
        input: ["text"],
        cost: { input: 1.3, output: 2.6, cacheRead: 0.1, cacheWrite: 0.1 },
        contextWindow: 1048576,
        maxTokens: 1048576,
      },
      {
        id: "deepseek-ai/DeepSeek-V4-Flash",
        name: "DeepSeek V4 Flash",
        reasoning: false,
        input: ["text"],
        cost: { input: 0.1, output: 0.2, cacheRead: 0.02, cacheWrite: 0.02 },
        contextWindow: 1048576,
        maxTokens: 1048576,
      },
      {
        id: "Qwen/Qwen3.6-35B-A3B",
        name: "Qwen 3.6 35B A3B",
        reasoning: false,
        input: ["text"],
        cost: { input: 0.15, output: 0.95, cacheRead: 0.01, cacheWrite: 0.01 },
        contextWindow: 262144,
        maxTokens: 262144,
      },
    ],
  });
}
