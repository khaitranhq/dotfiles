import { describe, expect, it } from "vitest";
import { SecretMask } from "./secret-mask";

describe("SecretMask", () => {
  describe("mask", () => {
    it("returns original text unchanged when no secrets found", async () => {
      const result = await SecretMask.mask("plain text without any secrets");
      expect(result.masked).toBe("plain text without any secrets");
      expect(result.count).toBe(0);
    });

    it("returns empty string for empty input", async () => {
      const result = await SecretMask.mask("");
      expect(result.masked).toBe("");
      expect(result.count).toBe(0);
    });

    it("masks GitHub personal access tokens", async () => {
      const result = await SecretMask.mask("GITHUB_TOKEN=ghp_1234567890abcdefghijklmnopqrstuvwxyz");
      expect(result.masked).toContain("***");
      expect(result.masked).not.toContain("ghp_1234567890abcdefghijklmnopqrstuvwxyz");
      expect(result.count).toBeGreaterThanOrEqual(1);
    });

    it("masks Slack tokens", async () => {
      const result = await SecretMask.mask(
        "export SLACK_TOKEN=xoxb-1234567890-1234567890-abcdefghijklmno",
      );
      expect(result.masked).toContain("***");
      expect(result.masked).not.toContain("xoxb-1234567890");
      expect(result.count).toBeGreaterThanOrEqual(1);
    });

    it("masks Stripe keys", async () => {
      const result = await SecretMask.mask("STRIPE_KEY=sk_live_abcdefghijklmnopqrstuvwxyz");
      expect(result.masked).toContain("***");
      expect(result.masked).not.toContain("sk_live_abcdefghijklmnopqrstuvwxyz");
      expect(result.count).toBeGreaterThanOrEqual(1);
    });

    it("masks multiple secrets in one text", async () => {
      const text = [
        "Normal output",
        "GITHUB_TOKEN=ghp_1234567890abcdefghijklmnopqrstuvwxyz",
        "More text",
        "SLACK_TOKEN=xoxb-1234567890-1234567890-abcdefghijklmno",
        "End",
      ].join("\n");

      const result = await SecretMask.mask(text);
      expect(result.count).toBeGreaterThanOrEqual(2);
      expect(result.masked).not.toContain("ghp_");
      expect(result.masked).not.toContain("xoxb-");
      expect(result.masked).toContain("***");
    });

    it("preserves surrounding text when masking", async () => {
      const result = await SecretMask.mask('{"token":"ghp_1234567890abcdefghijklmnopqrstuvwxyz"}');
      expect(result.masked).toContain("{");
      expect(result.masked).toContain("}");
      expect(result.masked).not.toContain("ghp_");
    });

    it("handles text with ANSI escape codes", async () => {
      const result = await SecretMask.mask(
        "\x1b[32mGITHUB_TOKEN=ghp_1234567890abcdefghijklmnopqrstuvwxyz\x1b[0m",
      );
      expect(result.count).toBeGreaterThanOrEqual(1);
      expect(result.masked).not.toContain("ghp_");
    });
  });
});
