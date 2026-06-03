import { readFileSync } from "fs";
import { join } from "path";

function getAgentDir(): string {
  return join(process.env.HOME ?? ".", ".pi", "agent");
}

export function getApiKeyFromAuthJson(provider: string): string | undefined {
  const authPath = join(getAgentDir(), "auth.json");
  try {
    const data = JSON.parse(readFileSync(authPath, "utf-8"));
    const cred = data[provider];
    if (cred?.type === "api_key" && cred?.key) {
      return cred.key;
    }
  } catch {
    // auth.json may not exist or be invalid — fall through to env fallback
  }
  return undefined;
}
