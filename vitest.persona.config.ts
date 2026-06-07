import { defineConfig } from "vitest/config";

// Dedicated config for persona acceptance tests.
// These tests launch the *real* macOS bundle, so they are excluded from the
// default `pnpm test` run (see vite.config.ts) and only invoked via
// `pnpm test:persona`. Run them sequentially — parallel launches collide on
// process inspection (pgrep/pkill see each other's processes).
export default defineConfig({
  test: {
    include: ["tests/persona/**/*.test.ts"],
    environment: "node",
    globals: true,
    testTimeout: 20_000,
    fileParallelism: false,
  },
});
