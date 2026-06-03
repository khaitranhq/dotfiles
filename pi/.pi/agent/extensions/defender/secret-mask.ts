/**
 * SecretMask — scans text for secrets using secretlint and masks them.
 *
 * Uses the @secretlint/secretlint-rule-preset-recommend rules to detect:
 *  - GitHub/GitLab tokens
 *  - Slack tokens
 *  - Stripe keys
 *  - AWS/GCP credentials
 *  - Private keys (RSA, etc.)
 *  - OpenAI, Anthropic, Groq, HuggingFace API keys
 *  - SendGrid, Shopify, Notion, Linear, Figma, Cloudflare keys
 *  - 1Password secrets, database connection strings
 *  - Basic auth credentials
 *  - Docker, Vercel, Databricks, Grafana, Tailscale, HashiCorp Vault tokens
 *
 * Each detected secret is replaced with "***".
 */

import { lintSource } from "@secretlint/core";
import { creator as recommendedPreset } from "@secretlint/secretlint-rule-preset-recommend";
import type { SecretLintCoreResultMessage } from "@secretlint/types";

// ── Constants ─────────────────────────────────────────────────────────

const RECOMMENDED_RULES = recommendedPreset.rules.map((rule) => ({
  id: rule.meta.id,
  rule,
}));

const CONFIG = { rules: RECOMMENDED_RULES };

// ── SecretMask ────────────────────────────────────────────────────────

export class SecretMask {
  /**
   * Scan `text` for secrets and replace each match with "***".
   *
   * @param text     The text to scan.
   * @param filePath Virtual file path for extension-sensitive rules.
   *                 Defaults to "output.txt".
   * @returns The masked text and the number of secrets found.
   */
  static async mask(
    text: string,
    filePath = "output.txt",
  ): Promise<{ masked: string; count: number }> {
    if (!text) return { masked: text, count: 0 };

    try {
      const result = await lintSource({
        source: {
          content: text,
          filePath,
          ext: filePath.includes(".") ? "." + filePath.split(".").pop()! : ".txt",
          contentType: "text",
        },
        options: { config: CONFIG },
      });

      if (result.messages.length === 0) {
        return { masked: text, count: 0 };
      }

      return SecretMask._applyMasks(text, result.messages);
    } catch {
      // Silently return original text on any scanning error
      return { masked: text, count: 0 };
    }
  }

  // ── Private ──────────────────────────────────────────────────────

  /**
   * Apply masks from end to start to preserve character offsets.
   */
  private static _applyMasks(
    text: string,
    messages: SecretLintCoreResultMessage[],
  ): { masked: string; count: number } {
    const sorted = [...messages].sort((a, b) => a.range[0] - b.range[0]);

    let masked = text;
    let offset = 0;

    for (const msg of sorted) {
      const start = msg.range[0] + offset;
      const end = msg.range[1] + offset;
      const secretLen = msg.range[1] - msg.range[0];
      const replacement = "***";

      masked = masked.slice(0, start) + replacement + masked.slice(end);
      offset += replacement.length - secretLen;
    }

    return { masked, count: sorted.length };
  }
}
