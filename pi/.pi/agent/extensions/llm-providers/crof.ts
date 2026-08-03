import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getApiKeyFromAuthJson } from "./utils";

interface CrofModelListResponse {
  data?: CrofModel[];
}

interface CrofModel {
  context_length?: number;
  custom_reasoning?: boolean;
  id: string;
  max_completion_tokens?: number;
  name?: string;
  pricing?: CrofPricing;
  reasoning_effort?: boolean;
}

interface CrofPricing {
  cache_prompt?: string;
  completion?: string;
  prompt?: string;
}

const CROF_BASE_URL = "https://crof.ai/v1";
const CROF_MODELS_URL = `${CROF_BASE_URL}/models`;

export async function setupCrofProvider(pi: ExtensionAPI): Promise<void> {
  const apiKey = getApiKeyFromAuthJson("crof") ?? process.env.CROFAI_API_KEY;
  if (!apiKey) {
    console.warn("No Crof API key found in auth.json or env, skipping provider registration");
    return;
  }

  try {
    const models = await fetchCrofModels();
    if (models.length === 0) {
      console.warn("No Crof models found, skipping provider registration");
      return;
    }

    pi.registerProvider("crof", {
      name: "CrofAI",
      baseUrl: CROF_BASE_URL,
      apiKey,
      api: "openai-completions",
      models,
    });
  } catch (error) {
    console.warn(
      `Failed to register Crof provider: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function fetchCrofModels() {
  const response = await fetch(CROF_MODELS_URL);
  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `Failed to fetch Crof models (${response.status}): ${errorText || response.statusText}`,
    );
  }

  const payload = (await response.json()) as CrofModelListResponse;
  return (payload.data ?? []).map(mapCrofModel);
}

function mapCrofModel(model: CrofModel) {
  return {
    id: model.id,
    name: model.name ?? model.id,
    reasoning: Boolean(model.custom_reasoning ?? model.reasoning_effort),
    input: ["text"] as ("text" | "image")[],
    cost: {
      input: parsePricing(model.pricing?.prompt),
      output: parsePricing(model.pricing?.completion),
      cacheRead: parsePricing(model.pricing?.cache_prompt),
      cacheWrite: 0,
    },
    contextWindow: model.context_length ?? 128000,
    maxTokens: model.max_completion_tokens ?? 16384,
    compat: model.reasoning_effort ? { supportsReasoningEffort: true } : undefined,
  };
}

function parsePricing(value: string | undefined): number {
  if (!value) {
    return 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
