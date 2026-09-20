import { defineConfig } from "vitest/config";
import path from "node:path";

const srcAlias = { "@": path.resolve(__dirname, "src") };

/**
 * Two projects, deliberately separate:
 *  - unit:        pure engine logic, no I/O, runs in milliseconds, runs on every save.
 *  - integration: talks to the seeded Supabase project via env vars; opt-in via `pnpm test:int`.
 */
export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      {
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          environment: "node",
          alias: srcAlias,
        },
      },
      {
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          alias: srcAlias,
          setupFiles: ["tests/integration/setup.ts"],
          testTimeout: 30_000,
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["src/engine/**/*.ts"],
      thresholds: { lines: 100, functions: 100, branches: 95, statements: 100 },
    },
  },
});
