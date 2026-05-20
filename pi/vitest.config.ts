import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [".pi/**/*.spec.ts"],
    globals: true,
  },
});
