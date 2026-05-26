import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["extensions/**/*.spec.ts"],
    globals: true,
  },
});
