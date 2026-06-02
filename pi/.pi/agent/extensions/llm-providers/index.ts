import { ExtensionAPI } from "@earendil-works/pi-coding-agent";

interface DeepInfraModel {
  model_name: string;
  type: string;
  max_tokens: number;
  deprecated: boolean;
  private: number; // 0 or 1
  tags: string[];
  pricing: {
    cents_per_input_token: number;
    cents_per_output_token: number;
    rate_per_input_token_cached?: number;
    rate_per_input_token_cache_write?: number;
  };
}

export default async function (pi: ExtensionAPI) {
  const apiKey = process.env.DEEPINFRA_API_KEY;
  if (!apiKey) {
    console.warn("DEEPINFRA_API_KEY not set, skipping DeepInfra provider registration");
    return;
  }

  const response = await fetch("https://api.deepinfra.com/models/list");

  if (!response.ok) {
    throw new Error(`Failed to fetch DeepInfra models: ${response.status} ${response.statusText}`);
  }

  const models = (await response.json()) as DeepInfraModel[];

  // Filter to only text-generation models
  const textModels = models.filter(
    (m) => m.type === "text-generation" && !m.deprecated && m.private === 0,
  );

  pi.registerProvider("deepinfra", {
    name: "DeepInfra",
    baseUrl: "https://api.deepinfra.com/v1/openai",
    apiKey,
    api: "openai-completions",
    authHeader: true,
    models: textModels.map((model) => ({
      id: model.model_name,
      name: model.model_name.split("/").pop() || model.model_name,
      reasoning: false,
      input: ["text"],
      cost: mapCost(model.pricing),
      contextWindow: model.max_tokens,
      maxTokens: model.max_tokens,
    })),
  });
}

function mapCost(pricing: DeepInfraModel["pricing"]) {
  return {
    input: pricing.cents_per_input_token * 100, // convert cents to dollars per million
    output: pricing.cents_per_output_token * 100,
    cacheRead: pricing.rate_per_input_token_cached ? pricing.rate_per_input_token_cached * 100 : 0,
    cacheWrite: pricing.rate_per_input_token_cache_write
      ? pricing.rate_per_input_token_cache_write * 100
      : 0,
  };
}
