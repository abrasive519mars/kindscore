/**
 * Seeds the demo world — accounts, subscriptions, scores, four months of payments and three
 * published draws — using the app's own services, so every figure is internally consistent.
 *
 *   pnpm seed                               local stack (.env.test)
 *   pnpm seed --env .env.cloud.local --yes  the linked cloud project (asks for --yes)
 *
 * Idempotent: every @kindscore.app account and every draw is removed first. Charities come from
 * supabase/seed.sql and are left alone. The three draws (Jun random, Jul weighted, Aug random) run
 * through DrawService with a *steered* random source: the engine's own sampler is handed the `r`
 * that selects each chosen number, so the numbers are chosen but the maths is the app's. No month
 * has a five-match, so the jackpot climbs Jun → Jul → Aug → Sep; September is left for the
 * evaluator to run.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import sharp from "sharp";
import { LOCALE, PLANS, SPLIT, type PlanInterval } from "../src/config/constants";
import { splitPayment } from "../src/engine/charity/splitPayment";
import { selectEligibleEntries } from "../src/engine/draw/eligibility";
import { buildFrequencyMap } from "../src/engine/draw/frequency";
import { buildWeights, type DrawMode } from "../src/engine/draw/generateNumbers";
import { matchEntries } from "../src/engine/draw/match";
import type { Rng } from "../src/engine/draw/rng";
import { todayInTimezone } from "../src/engine/time/dates";
import { SupabaseDrawRepository } from "../src/repositories/supabase/SupabaseDrawRepository";
import { SupabaseProofStorage } from "../src/lib/storage/SupabaseProofStorage";
import { SupabaseWinnerRepository } from "../src/repositories/supabase/SupabaseWinnerRepository";
import { DrawService } from "../src/services/DrawService";
import { WinnerService } from "../src/services/WinnerService";
import type { Database } from "../src/types/database.types";

// ── Arguments and environment ────────────────────────────────────────────────

const args = process.argv.slice(2);
const envFile = args.includes("--env") ? args[args.indexOf("--env") + 1] : ".env.test";
loadEnv({ path: envFile });

const URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD = process.env.SEED_PASSWORD ?? "Kindscore!2026";
if (!URL || !ANON || !SERVICE) throw new Error(`Missing Supabase variables in ${envFile}`);
const isLocal = /127\.0\.0\.1|localhost/.test(URL);
if (!isLocal && !args.includes("--yes")) {
  console.error(
    `Refusing to seed ${URL} without --yes (this wipes every @kindscore.app account and every draw).`,
  );
  process.exit(1);
}

type Db = SupabaseClient<Database>;
const admin: Db = createClient<Database>(URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ── Demo design ──────────────────────────────────────────────────────────────

const DOMAIN = "kindscore.app";
const FILLERS = 300;
const CHARITY = {
  sahaj: "c0000000-0000-4000-8000-000000000001",
  neer: "c0000000-0000-4000-8000-000000000002",
  hara: "c0000000-0000-4000-8000-000000000003",
  roshni: "c0000000-0000-4000-8000-000000000004",
  ashray: "c0000000-0000-4000-8000-000000000005",
  sanjeevani: "c0000000-0000-4000-8000-000000000006",
  udaan: "c0000000-0000-4000-8000-000000000007",
};
const CHARITY_IDS = Object.values(CHARITY);
const PAYMENT_MONTHS = ["2026-06", "2026-07", "2026-08", "2026-09"];

/** The three published months. Numbers are steered; see steeredRng(). */
const DRAWS: ReadonlyArray<{ month: string; mode: DrawMode; numbers: number[] }> = [
  { month: "2026-06-01", mode: "random", numbers: [7, 19, 24, 30, 38] },
  { month: "2026-07-01", mode: "algorithmic", numbers: [11, 22, 27, 34, 40] },
  { month: "2026-08-01", mode: "random", numbers: [12, 29, 33, 36, 41] }, // Priya's three, as on the landing page
];

interface Persona {
  key: string;
  email: string;
  name: string;
  role: "member" | "admin";
  charity: string;
  bps: number;
  interval: PlanInterval;
  scores: number[];
}

const PERSONAS: Persona[] = [
  {
    key: "admin",
    email: `admin@${DOMAIN}`,
    name: "Kindscore Admin",
    role: "admin",
    charity: CHARITY.udaan,
    bps: 1000,
    interval: "month",
    scores: [],
  },
  {
    key: "priya",
    email: `priya@${DOMAIN}`,
    name: "Priya Sharma",
    role: "member",
    charity: CHARITY.udaan,
    bps: 1500,
    interval: "year",
    scores: [28, 33, 31, 36, 29],
  },
  {
    key: "raj",
    email: `raj@${DOMAIN}`,
    name: "Raj Mehta",
    role: "member",
    charity: CHARITY.neer,
    bps: 1000,
    interval: "month",
    scores: [30, 34, 27],
  },
  {
    key: "anita",
    email: `anita@${DOMAIN}`,
    name: "Anita Rao",
    role: "member",
    charity: CHARITY.roshni,
    bps: 2000,
    interval: "month",
    scores: [19, 24, 30, 44, 10],
  }, // three of June's
  {
    key: "member012",
    email: `member012@${DOMAIN}`,
    name: "Kabir Nair",
    role: "member",
    charity: CHARITY.hara,
    bps: 1000,
    interval: "month",
    scores: [33, 29, 36, 5, 8],
  }, // three of August's
  {
    key: "member017",
    email: `member017@${DOMAIN}`,
    name: "Deepa Iyer",
    role: "member",
    charity: CHARITY.sahaj,
    bps: 2500,
    interval: "year",
    scores: [33, 12, 29, 36, 20],
  }, // four of August's
];

// ── Deterministic randomness for the filler members ──────────────────────────

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260921);

/** A Stableford score around 30 (σ ≈ 5), clamped to 1–45. */
function bellScore(): number {
  const u = 1 - rand();
  const v = rand();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return Math.min(45, Math.max(1, Math.round(30 + z * 5)));
}

const FIRST = [
  "Aarav",
  "Vihaan",
  "Ishaan",
  "Rohan",
  "Kabir",
  "Arjun",
  "Dev",
  "Nikhil",
  "Sameer",
  "Yash",
  "Ananya",
  "Diya",
  "Isha",
  "Meera",
  "Nisha",
  "Pooja",
  "Riya",
  "Sneha",
  "Tara",
  "Zoya",
];
const LAST = [
  "Reddy",
  "Sharma",
  "Iyer",
  "Nair",
  "Menon",
  "Patel",
  "Khan",
  "Rao",
  "Das",
  "Joshi",
  "Bose",
  "Kapoor",
  "Verma",
  "Gupta",
  "Pillai",
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function log(step: string, detail = "") {
  console.log(`${step.padEnd(40)} ${detail}`);
}

async function wipe() {
  let removed = 0;
  for (let page = 1; ; page++) {
    // Checked and retried like every other auth call: a silent empty page here would leave the
    // old accounts in place and make every create below fail with "already registered".
    const { data } = await retryAuthCall(
      () => admin.auth.admin.listUsers({ page, perPage: 1000 }),
      `list users page ${page}`,
    );
    const mine = data.users.filter((u) => u.email?.endsWith(`@${DOMAIN}`));
    for (const u of mine) {
      await retryAuthCall(() => admin.auth.admin.deleteUser(u.id), `delete ${u.email}`);
      removed++;
    }
    if (data.users.length < 1000) break;
  }
  await admin.from("draws").delete().gte("created_at", "1970-01-01");
  log("wiped", `${removed} accounts, all draws`);
}

async function createAccount(
  email: string,
  name: string,
  role: "member" | "admin",
  charity: string,
  bps: number,
): Promise<string> {
  const { data } = await retryAuthCall(
    () =>
      admin.auth.admin.createUser({
        email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: name, charity_id: charity, charity_bps: bps },
      }),
    `create ${email}`,
  );
  if (!data.user) throw new Error(`could not create ${email}`);
  if (role === "admin")
    await admin.from("profiles").update({ role: "admin" }).eq("id", data.user.id);
  return data.user.id;
}

async function sessionFor(email: string): Promise<Db> {
  const anon = createClient<Database>(URL!, ANON!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await anon.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.session) throw error ?? new Error(`could not sign in ${email}`);
  return createClient<Database>(URL!, ANON!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
  });
}

const BATCH = 400;
const NETWORK_RETRIES = 3;

/** Each batch is one PostgREST request, i.e. one transaction — a dropped connection is retried whole. */
async function insertBatched<T extends "scores" | "payments" | "subscriptions">(
  table: T,
  rows: Database["public"]["Tables"][T]["Insert"][],
) {
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH) as never;
    const { error } = await retryOnNetworkError(() => admin.from(table).insert(batch));
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

/**
 * auth-js returns network failures as `{ error }` (AuthRetryableFetchError) instead of throwing;
 * a hosted project on a flaky connection drops a few of 300 calls, so those are retried and any
 * other error is fatal — a half-wiped or half-created world must never pass silently.
 */
async function retryAuthCall<R extends { error: { message: string; name: string } | null }>(
  request: () => PromiseLike<R>,
  what: string,
): Promise<R> {
  for (let attempt = 1; ; attempt++) {
    const result = await request();
    if (!result.error) return result;
    const retryable = result.error.name === "AuthRetryableFetchError";
    if (!retryable || attempt >= NETWORK_RETRIES)
      throw new Error(`${what}: ${result.error.message}`);
    await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
  }
}

async function retryOnNetworkError<R>(request: () => PromiseLike<R>): Promise<R> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await request();
    } catch (error) {
      if (attempt >= NETWORK_RETRIES || !(error instanceof TypeError)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return todayInTimezone(d, LOCALE.TIMEZONE);
}

/**
 * Hands the engine's sampler the r that selects each target number given the drum at that
 * moment — the same buildWeights and the same remove-after-pick the real draw uses.
 */
function steeredRng(
  mode: DrawMode,
  entries: ReturnType<typeof selectEligibleEntries>,
  targets: number[],
): Rng {
  const drum = [...buildWeights(mode, buildFrequencyMap(entries))];
  const values = targets.map((n) => {
    const total = drum.reduce((s, w) => s + w, 0);
    const before = drum.slice(0, n).reduce((s, w) => s + w, 0);
    const r = (before + drum[n] / 2) / total;
    drum[n] = 0;
    return r;
  });
  let i = 0;
  return () => values[i++];
}

async function proofPng(label: string): Promise<File> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="400"><rect width="100%" height="100%" fill="#f7f3ec"/><text x="40" y="80" font-family="sans-serif" font-size="30" fill="#171411">Club scoring app · Stableford history</text><text x="40" y="160" font-family="monospace" font-size="26" fill="#171411">${label}</text></svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return new File([png], "proof.png", { type: "image/png" });
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  log("target", `${URL} (${envFile})`);
  await wipe();

  // 1. Accounts: personas + fillers
  const ids = new Map<string, string>();
  for (const p of PERSONAS)
    ids.set(p.key, await createAccount(p.email, p.name, p.role, p.charity, p.bps));
  const fillers: Array<{
    key: string;
    id: string;
    interval: PlanInterval;
    bps: number;
    charity: string;
    scores: number[];
  }> = [];
  for (let i = 1; i <= FILLERS; i++) {
    const key = `member${String(i).padStart(3, "0")}`;
    if (ids.has(key)) continue; // member012 / member017 are personas
    const name = `${FIRST[Math.floor(rand() * FIRST.length)]} ${LAST[Math.floor(rand() * LAST.length)]}`;
    const charity = CHARITY_IDS[Math.floor(rand() * CHARITY_IDS.length)];
    const bps = SPLIT.CHARITY_MIN_BPS + SPLIT.CHARITY_STEP_BPS * Math.floor(rand() * 5); // 10–30%
    const id = await createAccount(`${key}@${DOMAIN}`, name, "member", charity, bps);
    const interval: PlanInterval = rand() < 0.2 ? "year" : "month";
    fillers.push({ key, id, interval, bps, charity, scores: Array.from({ length: 5 }, bellScore) });
    if (i % 50 === 0) log("accounts", `${i}/${FILLERS}`);
  }
  log("accounts", `${PERSONAS.length} personas + ${fillers.length} fillers`);

  // 2. Subscriptions (all active for now — anita lapses after the draws she was in)
  const everyone = [
    ...PERSONAS.filter((p) => p.role === "member").map((p) => ({
      id: ids.get(p.key)!,
      interval: p.interval,
      bps: p.bps,
      charity: p.charity,
    })),
    ...fillers,
  ];
  const now = new Date();
  await insertBatched(
    "subscriptions",
    everyone.map((m) => {
      const end = new Date(now);
      end.setMonth(end.getMonth() + (m.interval === "year" ? 12 : 1));
      return {
        user_id: m.id,
        stripe_subscription_id: `seed_sub_${m.id}`,
        stripe_price_id: `price_seed_${m.interval}`,
        plan_interval: m.interval,
        status: "active" as const,
        current_period_start: now.toISOString(),
        current_period_end: end.toISOString(),
        source: "seed",
      };
    }),
  );
  log("subscriptions", `${everyone.length} active (seed)`);

  // 3. Scores — the ticket order is by date played; personas keep their listed order newest-first
  const scoreRows: Database["public"]["Tables"]["scores"]["Insert"][] = [];
  const withScores = [
    ...PERSONAS.filter((p) => p.scores.length).map((p) => ({
      id: ids.get(p.key)!,
      scores: p.scores,
    })),
    ...fillers.map((f) => ({ id: f.id, scores: f.scores })),
  ];
  for (const m of withScores) {
    const offset = Math.floor(rand() * 20);
    m.scores.forEach((score, i) =>
      scoreRows.push({ user_id: m.id, score, played_on: isoDaysAgo(offset + i * 2 + 1) }),
    );
  }
  await insertBatched("scores", scoreRows);
  log("scores", `${scoreRows.length} rounds`);

  // 4. Payments Jun–Sep with the real split → ledger via trigger
  const paymentRows: Database["public"]["Tables"]["payments"]["Insert"][] = [];
  for (const m of everyone) {
    for (const month of PAYMENT_MONTHS) {
      const amount =
        m.interval === "year"
          ? month === PAYMENT_MONTHS[0]
            ? PLANS.year.pricePaise
            : 0
          : PLANS.month.pricePaise;
      if (amount === 0) continue; // yearly members paid once, in June
      const split = splitPayment(amount, m.bps);
      paymentRows.push({
        user_id: m.id,
        stripe_invoice_id: `seed_in_${m.id}_${month}`,
        amount_paise: amount,
        charity_id: m.charity,
        charity_bps: m.bps,
        charity_paise: split.charityPaise,
        pool_paise: split.poolPaise,
        platform_paise: split.platformPaise,
        paid_at: `${month}-03T09:00:00+05:30`,
      });
    }
  }
  await insertBatched("payments", paymentRows);
  log("payments", `${paymentRows.length} invoices, Jun–Sep`);

  // 5. Draws through the real service as the admin, numbers steered, no five-match anywhere
  const adminDb = await sessionFor(`admin@${DOMAIN}`);
  const drawRepo = new SupabaseDrawRepository(adminDb);
  const draws = new DrawService(drawRepo);
  for (const spec of DRAWS) {
    const draw = await drawRepo.create(spec.month);
    const entries = selectEligibleEntries(await drawRepo.listCandidates());
    const fiveMatch = matchEntries(spec.numbers, entries).filter((e) => e.matchCount === 5);
    if (fiveMatch.length)
      throw new Error(`${spec.month}: ${fiveMatch.length} five-match — change the numbers`);
    const report = await draws.simulate(
      draw.id,
      spec.mode,
      steeredRng(spec.mode, entries, spec.numbers),
    );
    if (report.draw.numbers?.join() !== [...spec.numbers].sort((a, b) => a - b).join())
      throw new Error(`${spec.month}: steering failed`);
    await draws.publish(draw.id);
    const byTier = (t: number) => report.prizes.filter((p) => p.tier === t).length;
    log(
      `draw ${spec.month.slice(0, 7)} (${spec.mode})`,
      `${report.draw.numbers?.join(" ")} · pool ₹${(report.draw.poolPaise / 100).toFixed(0)} · jackpot ₹${(report.draw.tierPools[5] / 100).toFixed(0)} rolls · winners 4:${byTier(4)} 3:${byTier(3)}`,
    );
  }

  // 6. Verification states through WinnerService on each member's own session
  const winnerService = (db: Db) =>
    new WinnerService(new SupabaseWinnerRepository(db), new SupabaseProofStorage(db));
  const adminWinners = winnerService(adminDb);
  async function claimOf(email: string, month: string) {
    const db = await sessionFor(email);
    const service = winnerService(db);
    const { data: auth } = await db.auth.getUser();
    const record = (await service.listWinnings(auth.user!.id)).find((w) => w.drawMonth === month);
    if (!record) throw new Error(`${email} has no win in ${month}`);
    return { service, record, userId: auth.user!.id };
  }
  for (const [email, month, label, final] of [
    [`anita@${DOMAIN}`, "2026-06-01", "Round of 14 Jun 2026 · Stableford 24", "paid"],
    [`member017@${DOMAIN}`, "2026-08-01", "Round of 21 Aug 2026 · Stableford 33", "paid"],
    [`member012@${DOMAIN}`, "2026-08-01", "Round of 19 Aug 2026 · Stableford 29", "submitted"],
  ] as const) {
    const { service, record, userId } = await claimOf(email, month);
    await service.submitProof(userId, record.verificationId, await proofPng(label));
    if (final === "paid") {
      await adminWinners.review(record.verificationId, true, "");
      // Demo history: recorded as paid without a Stripe call; a live claim goes through Stripe.
      const { error } = await admin
        .from("winner_verifications")
        .update({
          payout_status: "paid",
          paid_at: new Date().toISOString(),
          payout_method: "seed",
          payout_reference: "seeded demo payout",
        })
        .eq("id", record.verificationId);
      if (error) throw new Error(`payout: ${error.message}`);
    }
    log(
      `claim ${email.split("@")[0]} ${month.slice(0, 7)}`,
      `${record.matchCount} matches · ${final}`,
    );
  }
  // Priya's August win stays "awaiting proof" — the evaluator uploads it.

  // 7. Anita lapsed on 1 September (after the draws she was in)
  await admin
    .from("subscriptions")
    .update({
      status: "lapsed",
      current_period_end: "2026-09-01T00:00:00+05:30",
      canceled_at: "2026-09-01T00:00:00+05:30",
    })
    .eq("user_id", ids.get("anita")!);
  log("anita", "lapsed 1 Sep");

  const { data: summary } = await adminDb.from("reports_summary").select("*").single();
  log(
    "reports",
    `members ${summary?.total_members} · active ${summary?.active_subscribers} · charity ₹${((summary?.charity_total_paise ?? 0) / 100).toFixed(0)} · rollover ₹${((summary?.current_rollover_paise ?? 0) / 100).toFixed(0)}`,
  );
  console.log(`\nDemo accounts (password ${PASSWORD}):`);
  for (const p of PERSONAS)
    console.log(
      `  ${p.email.padEnd(28)} ${p.role}${p.key === "priya" ? " · August win awaiting proof" : p.key === "raj" ? " · three scores, ineligible" : p.key === "anita" ? " · lapsed, June win paid" : ""}`,
    );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
