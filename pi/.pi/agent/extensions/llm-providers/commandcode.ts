import { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getApiKeyFromAuthJson } from "./utils";

export function setupCommandCodeProvider(pi: ExtensionAPI) {
  const apiKey = getApiKeyFromAuthJson("commandcode") ?? process.env.COMMANDCODE_API_KEY;
  if (!apiKey) {
    console.warn(
      "No CommandCode API key found in auth.json or env, skipping provider registration",
    );
    return;
  }

  pi.registerProvider("commandcode", {
    name: "CommandCode",
    baseUrl: "https://api.commandcode.ai/provider/v1/",
    apiKey,
    api: "openai-completions",
    models: [
      {
        id: "deepseek/deepseek-v4-pro",
        name: "DeepSeek V4 Pro",
        reasoning: false,
        input: ["text"],
        cost: { input: 0.435, output: 0.87, cacheRead: 0.003625, cacheWrite: 0 },
        contextWindow: 1048576,
        maxTokens: 393216,
      },
      {
        id: "deepseek/deepseek-v4-flash",
        name: "DeepSeek V4 Flash",
        reasoning: false,
        input: ["text"],
        cost: { input: 0.14, output: 0.28, cacheRead: 0.0028, cacheWrite: 0 },
        contextWindow: 1048576,
        maxTokens: 1048576,
      },
      {
        id: "MiniMaxAI/MiniMax-M3",
        name: "MiniMax M3",
        reasoning: false,
        input: ["text"],
        cost: { input: 0.3, output: 1.2, cacheRead: 0.06, cacheWrite: 0 },
        contextWindow: 2097152,
        maxTokens: 2097152,
      },
    ],
  });
}
