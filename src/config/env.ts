import { z } from "zod";

/**
 * Environment variables, validated once at first import.
 * A missing or malformed variable fails loudly at boot instead of as a 500 in production.
 *
 * `server` keys must never reach the browser. `client` keys are the only NEXT_PUBLIC_ ones.
 */

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_"),
  STRIPE_PRICE_MONTHLY: z.string().startsWith("price_"),
  STRIPE_PRICE_YEARLY: z.string().startsWith("price_"),
  CRON_SECRET: z.string().min(8),
  SEED_PASSWORD: z.string().min(8).optional(),
});

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().startsWith("pk_"),
  NEXT_PUBLIC_APP_URL: z.url(),
});

type ServerEnv = z.infer<typeof serverSchema>;
type ClientEnv = z.infer<typeof clientSchema>;

function formatIssues(error: z.ZodError): string {
  return error.issues.map((issue) => `  ${issue.path.join(".")}: ${issue.message}`).join("\n");
}

function parseOrThrow<T>(schema: z.ZodType<T>, source: Record<string, unknown>, scope: string): T {
  const result = schema.safeParse(source);
  if (result.success) return result.data;
  throw new Error(`Invalid ${scope} environment variables:\n${formatIssues(result.error)}`);
}

/**
 * Next.js inlines NEXT_PUBLIC_ variables at build time only when referenced by full name,
 * so they are listed explicitly rather than read through process.env dynamically.
 */
const clientSource = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
};

export const clientEnv: ClientEnv = parseOrThrow(clientSchema, clientSource, "client");

let cachedServerEnv: ServerEnv | undefined;

/** Lazily parsed so importing client-safe modules never touches server secrets. */
export function serverEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv() was called in the browser");
  }
  cachedServerEnv ??= parseOrThrow(serverSchema, process.env, "server");
  return cachedServerEnv;
}
