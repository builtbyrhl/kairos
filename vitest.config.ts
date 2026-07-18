import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html"],
      include: ["lib/**/*.ts"],
      exclude: [
        "lib/**/*.{test,spec}.{ts,tsx}",
        "lib/**/types.ts",
        "lib/**/index.ts",
        "lib/data/**",
        "lib/context/**",
        "lib/test-utils/**",
      ],
    },
  },
});
