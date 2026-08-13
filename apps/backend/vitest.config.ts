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
  },
});
