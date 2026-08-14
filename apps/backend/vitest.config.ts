import { defineConfig } from "vitest/config";

// Backend unit tests. Vitest runs TypeScript natively (esbuild), so no ts-jest
// setup is needed. reflect-metadata is loaded first so NestJS decorators
// (@Injectable, @Cron, …) can attach metadata when service files are imported.
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.spec.ts"],
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "text"],
      include: ["src/**/*.ts"],
      // DI wiring, DTOs, entrypoint — тестийн зорилготой биш файлууд.
      exclude: [
        "src/**/*.spec.ts",
        "src/**/*.module.ts",
        "src/**/dto/**",
        "src/main.ts",
      ],
    },
  },
});
