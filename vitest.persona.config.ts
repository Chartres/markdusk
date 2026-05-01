import { defineConfig } from "vitest/config";

// Dedicated config for the Sam-the-Switcher persona acceptance test.
// This test launches the *real* macOS bundle, so it is excluded from the
// default `pnpm test` run (see vite.config.ts) and only invoked via
// `pnpm test:persona`.
export default defineConfig({
  test: {
    include: ["tests/persona/**/*.test.ts"],
    environment: "node",
    globals: true,
    testTimeout: 20_000,
  },
});
