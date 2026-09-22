import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
          testTimeout: 30_000,
          // One real database: suites share state (e.g. the one-open-draw rule), so run files one at a time.
          fileParallelism: false,
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["src/engine/**/*.ts", "src/services/**/*.ts"],
      thresholds: {
        "src/engine/**": { lines: 100, functions: 100, branches: 95, statements: 100 },
        "src/services/**": { lines: 85, functions: 85, branches: 75, statements: 85 },
      },
    },
  },
});
