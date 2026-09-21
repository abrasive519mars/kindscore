/**
 * Drives the Phase 6 draw in a real browser against the running app + local Supabase and saves
 * screenshots. Not a test suite — a repeatable manual check with evidence.
 *   pnpm build && pnpm start -p 3000   then   pnpm tsx scripts/walkthrough-phase6.ts
 *
 * 60 members, all active, five scores each from a ten-number cluster: in weighted mode the five
 * drawn numbers land almost entirely inside the cluster, so about half the tickets match 3+.
 */
import { chromium, type Page } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdir } from "node:fs/promises";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.test" });

const BASE = process.env.WALKTHROUGH_BASE ?? "http://localhost:3000";
const OUT = process.env.WALKTHROUGH_OUT ?? "docs/screenshots/phase-6";
const RUN = Date.now();
const PASSWORD = "Kindscore!2026";
const MEMBER_COUNT = 60;
const CLUSTER = [28, 29, 30, 31, 32, 33, 34, 35, 36, 37];
const CHARITY_UDAAN = "c0000000-0000-4000-8000-000000000007";
const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

function log(step: string, detail = "") {
  console.log(`${step.padEnd(44)} ${detail}`);
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
}

interface Seeded {
  id: string;
  email: string;
  scores: number[];
}

/** Five distinct cluster numbers per member, dated over the last five days. */
function pickScores(i: number): number[] {
  // A different pseudo-random key per (member, number) so the 60 tickets are genuinely varied.
  const key = (n: number) => {
    const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  return [...CLUSTER].sort((a, b) => key(a) - key(b)).slice(0, 5);
}

async function createMember(i: number, role: "member" | "admin" = "member"): Promise<Seeded> {
  const email = `walk6-${role}${i}-${RUN}@kindscore.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: `${role === "admin" ? "Admin" : "Member"} ${i}`,
      charity_id: CHARITY_UDAAN,
      charity_bps: 1000,
    },
  });
  if (error || !data.user) throw error ?? new Error("no user");
  const id = data.user.id;
  if (role === "admin") {
    await admin.from("profiles").update({ role: "admin" }).eq("id", id);
    return { id, email, scores: [] };
  }
  const start = new Date();
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  await admin.from("subscriptions").insert({
    user_id: id,
    stripe_subscription_id: `seed_sub_${id}`,
    stripe_price_id: "price_seed",
    plan_interval: i % 4 === 0 ? "year" : "month",
    status: "active",
    current_period_start: start.toISOString(),
    current_period_end: end.toISOString(),
    source: "seed",
  });
  const scores = pickScores(i);
  await admin.from("scores").insert(
    scores.map((score, d) => {
      const day = new Date();
      day.setDate(day.getDate() - d);
      return { user_id: id, score, played_on: day.toISOString().slice(0, 10) };
    }),
  );
  return { id, email, scores };
}

async function login(page: Page, email: string) {
  await page.goto(`${BASE}/login`);
  await page.fill("#email", email);
  await page.fill("#password", PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/\/app/);
}

async function logout(page: Page) {
  await page.goto(`${BASE}/app/settings`);
  await page.getByRole("button", { name: "Log out" }).click();
  await page.waitForURL(`${BASE}/`);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const adminUser = await createMember(0, "admin");
  const members: Seeded[] = [];
  for (let i = 1; i <= MEMBER_COUNT; i++) members.push(await createMember(i));
  log("seeded", `${members.length} active members with five clustered scores`);

  const browser = await chromium.launch();
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await desktop.newPage();

  // 1. Admin opens the next draw
  await login(page, adminUser.email);
  await page.goto(`${BASE}/admin/draws`);
  await shot(page, "01-admin-draws-empty");
  await page.getByRole("button", { name: /Open .*'s draw/ }).click();
  await page.waitForURL(/\/admin\/draws\/[0-9a-f-]+$/);
  const drawId = page.url().split("/").pop()!;
  log("draw opened", (await page.locator("h1").textContent())?.trim());
  await shot(page, "02-admin-draw-draft");

  // 2. Simulate (random), then weighted
  await page.getByRole("button", { name: "Simulate the draw" }).click();
  await page.getByText("Draft result").waitFor();
  log(
    "random simulated",
    (await page.locator('[aria-label="Drawn numbers"]').first().textContent())?.trim(),
  );
  await shot(page, "03-admin-simulated-random");
  await page.getByLabel("Weighted by scores").check();
  await page.getByRole("button", { name: "Re-simulate with fresh numbers" }).click();
  await page.waitForTimeout(1500);
  await page.getByText(/Simulated .* · algorithmic/).waitFor();
  const numbersText = (
    await page.locator('[aria-label="Drawn numbers"]').first().textContent()
  )?.trim();
  log("weighted simulated", numbersText);
  const { data: results } = await admin
    .from("draw_results")
    .select("user_id, match_count, prize_paise")
    .eq("draw_id", drawId);
  log(
    "winners (5/4/3)",
    `${results!.filter((r) => r.match_count === 5).length} / ${results!.filter((r) => r.match_count === 4).length} / ${results!.filter((r) => r.match_count === 3).length}`,
  );
  await shot(page, "04-admin-simulated-weighted");

  // 3. A member changes a score → stale → Publish disabled
  const editor = members[1];
  const { data: row } = await admin
    .from("scores")
    .select("id")
    .eq("user_id", editor.id)
    .limit(1)
    .single();
  await admin.from("scores").update({ score: 12 }).eq("id", row!.id);
  await page.reload();
  await page.getByText("Scores changed since this simulation").waitFor();
  log("stale banner", "shown");
  log(
    "publish disabled",
    String(await page.getByRole("button", { name: "Publish this draw" }).isDisabled()),
  );
  await shot(page, "05-admin-stale");

  // 4. Re-simulate → publish (two-step)
  await page.getByRole("button", { name: "Re-simulate with fresh numbers" }).click();
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Publish this draw" }).waitFor();
  await page.getByRole("button", { name: "Publish this draw" }).click();
  log(
    "confirm copy",
    (await page.getByText(/Publishing makes these five numbers final/).textContent())
      ?.trim()
      .slice(0, 90),
  );
  await page.getByRole("button", { name: "Confirm — publish" }).click();
  await page.getByText("Published result").waitFor();
  log("published", (await page.locator("text=Published").first().textContent())?.trim());
  await shot(page, "06-admin-published");
  await page.goto(`${BASE}/admin/draws`);
  await shot(page, "07-admin-draws-history");

  // 5. A winner logs in and watches the reveal
  const { data: finalResults } = await admin
    .from("draw_results")
    .select("user_id, match_count, prize_paise")
    .eq("draw_id", drawId)
    .order("match_count", { ascending: false });
  const winnerRow = finalResults![0];
  const winner = members.find((m) => m.id === winnerRow?.user_id);
  log(
    "top winner",
    winner
      ? `${winnerRow.match_count} matches · ${winnerRow.prize_paise} paise`
      : "none this time (random is random)",
  );
  await logout(page);
  await login(page, (winner ?? members[5]).email);
  await shot(page, "08-member-dashboard");
  await page.goto(`${BASE}/app/draws`);
  await shot(page, "09-member-draws");
  await page.goto(`${BASE}/app/draws/${drawId}`);
  await page.waitForTimeout(350);
  await shot(page, "10-member-reveal-rolling");
  await page.getByText(/you win|No match|matches —/).waitFor({ timeout: 10_000 });
  log(
    "outcome line",
    (await page.locator('[aria-live="polite"]').textContent())?.trim().slice(0, 120),
  );
  await shot(page, "11-member-reveal-done");
  await page.reload();
  log(
    "return visit shows result first",
    String(await page.getByRole("button", { name: "Watch the draw again" }).isVisible()),
  );

  // 6. Public history
  await logout(page);
  await page.goto(`${BASE}/draws`);
  log("public draws", (await page.locator("h1").textContent())?.trim());
  await shot(page, "12-public-draws");

  // 7. Phone
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const mobile = await phone.newPage();
  await login(mobile, (winner ?? members[5]).email);
  await mobile.goto(`${BASE}/app/draws/${drawId}`);
  await mobile.waitForTimeout(2500);
  await mobile.screenshot({ path: `${OUT}/13-member-reveal-mobile.png`, fullPage: true });
  const overflow = await mobile.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  log("390px horizontal overflow", String(overflow));

  // cleanup: the draw and every walkthrough user
  await admin.from("draws").delete().eq("id", drawId);
  for (const m of [adminUser, ...members]) await admin.auth.admin.deleteUser(m.id);
  await browser.close();
  log("done", `screenshots in ${OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
