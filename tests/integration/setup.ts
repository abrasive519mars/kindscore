/**
 * Integration-test harness. Talks to the local Supabase stack (`supabase start`) through the real
 * client library, so RLS, triggers and RPCs are exercised exactly as the app will exercise them.
 *
 * Three kinds of client:
 *  - admin:        service-role key, bypasses RLS — used only to arrange fixtures and clean up
 *  - anon:         the anon key, no session — what a logged-out visitor gets
 *  - clientAs():   the anon key + a real signed-in session — what a member or admin user gets
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Database } from "@/types/database.types";

const here = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(here, "../../.env.test") });

const url = requireEnv("SUPABASE_URL");
const anonKey = requireEnv("SUPABASE_ANON_KEY");
const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set — copy .env.test or run supabase start`);
  return value;
}

export type Db = SupabaseClient<Database>;

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

export const admin: Db = createClient<Database>(url, serviceKey, noSession);
export const anon: Db = createClient<Database>(url, anonKey, noSession);

export interface TestUser {
  readonly id: string;
  readonly email: string;
  readonly password: string;
}

const PASSWORD = "Kindscore!2026";

/** Creates a confirmed auth user (the profile trigger fires) and optionally promotes it. */
export async function createUser(role: "member" | "admin" = "member", charityId?: string): Promise<TestUser> {
  const email = `${role}-${crypto.randomUUID().slice(0, 8)}@kindscore.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: `Test ${role}`, charity_id: charityId ?? null, charity_bps: 1000 },
  });
  if (error || !data.user) throw error ?? new Error("createUser returned no user");
  if (role === "admin") {
    const { error: promote } = await admin.from("profiles").update({ role: "admin" }).eq("id", data.user.id);
    if (promote) throw promote;
  }
  return { id: data.user.id, email, password: PASSWORD };
}

/** A client whose requests carry this user's session, so RLS applies as it would in the app. */
export async function clientAs(user: TestUser): Promise<Db> {
  const client = createClient<Database>(url, anonKey, noSession);
  const { error } = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw error;
  return client;
}

export async function deleteUser(user: TestUser): Promise<void> {
  await admin.auth.admin.deleteUser(user.id);
}

/** Gives a member an active subscription without Stripe, the same way scripts/seed.ts will. */
export async function grantActiveSubscription(userId: string, interval: "month" | "year" = "month"): Promise<void> {
  const start = new Date();
  const end = new Date(start);
  end.setMonth(end.getMonth() + (interval === "month" ? 1 : 12));
  const { error } = await admin.from("subscriptions").insert({
    user_id: userId,
    stripe_subscription_id: `seed_sub_${userId}`,
    stripe_price_id: "price_seed",
    plan_interval: interval,
    status: "active",
    current_period_start: start.toISOString(),
    current_period_end: end.toISOString(),
    source: "seed",
  });
  if (error) throw error;
}

export const CHARITY = {
  sahajShiksha: "c0000000-0000-4000-8000-000000000001",
  udaan: "c0000000-0000-4000-8000-000000000007",
} as const;

/** Postgres error codes surfaced by PostgREST. */
export const PG = {
  uniqueViolation: "23505",
  checkViolation: "23514",
  insufficientPrivilege: "42501",
  raiseException: "P0001",
  noDataFound: "P0002",
} as const;
