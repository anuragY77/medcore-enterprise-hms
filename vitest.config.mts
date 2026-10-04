import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    // next-auth/lib imports the bare specifier `next/server`, which Node's
    // raw ESM loader cannot resolve — vite's resolver (via inlining) can.
    server: {
      deps: {
        inline: ["next-auth"],
      },
    },
    // Integration tests all share one guarded *_test database and seed exact
    // row counts, so test files must never mutate it concurrently.
    fileParallelism: false,
    // Integration tests manage their own (longer) lifecycle via beforeAll.
    testTimeout: 30_000,
    hookTimeout: 120_000,
    coverage: {
      provider: "v8",
      // Unit tests target the lib/types layer; route handlers and components
      // are outside this suite's scope (documented in README "Testing & CI").
      include: ["src/lib/**/*.ts", "src/types/**/*.ts"],
      reporter: ["text", "json-summary", "html"],
    },
  },
});
