import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * The engine is pure: it may import only from src/config and from itself.
 * Anything that talks to a framework, a database, a payment provider or the OS is banned here,
 * which is what keeps every engine function unit-testable without I/O.
 */
const engineImportGuard = {
  files: ["src/engine/**/*.ts"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          { group: ["next", "next/*"], message: "Engine code must not depend on Next.js." },
          {
            group: ["react", "react/*", "react-dom", "react-dom/*"],
            message: "Engine code must not depend on React.",
          },
          { group: ["@supabase/*"], message: "Engine code must not talk to the database." },
          { group: ["stripe", "stripe/*"], message: "Engine code must not talk to Stripe." },
          {
            group: ["node:*"],
            message: "Engine code must not use Node built-ins; pass values in.",
          },
          {
            group: ["@/lib/*", "@/services/*", "@/repositories/*", "@/app/*", "@/components/*"],
            message: "Engine code sits below every other layer.",
          },
        ],
      },
    ],
  },
};

/** The service-role client bypasses RLS; only the webhook and scripts may hold it. */
const adminClientGuard = {
  files: [
    "src/app/**/*.{ts,tsx}",
    "src/components/**/*.{ts,tsx}",
    "src/services/**/*.ts",
    "src/repositories/**/*.ts",
  ],
  ignores: ["src/app/api/stripe/**", "src/app/api/cron/**"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        paths: [
          {
            name: "@/lib/supabase/admin",
            message: "Service-role client is for the Stripe webhook, cron and scripts only.",
          },
        ],
      },
    ],
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  engineImportGuard,
  adminClientGuard,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
  ]),
]);

export default eslintConfig;
