import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    // Playwright specs live in tests/ui and are driven by `pnpm playwright`,
    // not by Vitest. Skip them when running the unit/integration suite.
    exclude: [
      "node_modules/**",
      "tests/ui/**",
      ".opencode/**",
      "reference/**",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@tests": path.resolve(__dirname, "./tests"),
    },
  },
});
