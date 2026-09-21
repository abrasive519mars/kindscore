/**
 * Drives the Phase 4 score flows in a real browser against the running app + local Supabase and
 * saves screenshots. Not a test suite — a repeatable manual check with evidence.
 *   pnpm start -p 3111   (or pnpm dev)   then   pnpm tsx scripts/walkthrough-phase4.ts
 */
import { chromium, type Page } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdir } from "node:fs/promises";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.test" });

const BASE = process.env.WALKTHROUGH_BASE ?? "http://localhost:3111";
const OUT = process.env.WALKTHROUGH_OUT ?? "docs/screenshots/phase-4";
const email = `walk4-${Date.now()}@kindscore.test`;
const password = "Kindscore!2026";
const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

function log(step: string, detail = "") {
  console.log(`${step.padEnd(44)} ${detail}`);
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
}

/** YYYY-MM-DD for `daysAgo` days before today, in the walkthrough machine's local time. */
function isoDaysAgo(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

const ROWS = 'ul[aria-label="Your rounds, newest first"] li';

/** Every message the add form can show — the form's own feedback lives inside it. */
async function formFeedback(page: Page): Promise<string> {
  const form = page.locator("form", { has: page.getByRole("button", { name: "Add round" }) });
  return (await form.locator('[role="status"], [role="alert"]').allTextContents()).join(" | ");
}

/** Submits and waits until the submit round-trip has finished (the button leaves its busy state). */
async function addRound(page: Page, score: number, playedOn: string): Promise<string> {
  await page.fill("#score", String(score));
  await page.fill("#playedOn", playedOn);
  const button = page.getByRole("button", { name: "Add round" });
  await button.click();
  await page.locator("button[type=submit][aria-busy]").waitFor({ state: "hidden" });
  await button.waitFor();
  return formFeedback(page);
}

async function listedScores(page: Page): Promise<string[]> {
  return page.locator(`${ROWS} span.num`).allTextContents();
}

async function grantSubscription(userId: string) {
  const start = new Date();
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  const { error } = await admin.from("subscriptions").insert({
    user_id: userId,
    stripe_subscription_id: `seed_sub_${userId}`,
    stripe_price_id: "price_seed",
    plan_interval: "month",
    status: "active",
    current_period_start: start.toISOString(),
    current_period_end: end.toISOString(),
    source: "seed",
  });
  if (error) throw error;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await desktop.newPage();
  page.on("response", (r) => r.status() >= 400 && console.log("HTTP", r.status(), r.url()));
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));

  // 1. Sign up, see the locked scores page
  await page.goto(`${BASE}/signup`);
  await page.fill("#fullName", "Score Walker");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.selectOption("#charityId", { label: "Udaan Girls' Sports Collective · featured" });
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(`${BASE}/app`);
  await page.goto(`${BASE}/app/scores`);
  log("locked scores page", (await page.locator("h1").textContent())?.trim());
  await shot(page, "01-scores-locked");

  // 2. Grant a seeded subscription (the way seed.ts will) → page unlocks
  const { data: user } = await admin.from("profiles").select("id").eq("email", email).single();
  await grantSubscription(user!.id);
  await page.goto(`${BASE}/app/scores`);
  log("unlocked — empty state", (await page.getByText(/Enter 5 more rounds/).textContent())?.trim());
  await shot(page, "02-scores-empty");

  // 3. Add five rounds on different days (out of date order to prove ordering is by date)
  const rounds: Array<[number, number]> = [
    [31, 6],
    [28, 9],
    [36, 2],
    [33, 4],
    [29, 8],
  ];
  for (const [score, daysAgo] of rounds) await addRound(page, score, isoDaysAgo(daysAgo));
  await page.locator(ROWS).nth(4).waitFor();
  log("five rounds, newest first", (await listedScores(page)).join(" "));
  await shot(page, "03-scores-five");

  // 4. Sixth round evicts the oldest (28, 9 days ago) with an inline message
  log("6th round message", await addRound(page, 40, isoDaysAgo(1)));
  await page.locator(ROWS).filter({ hasText: "40" }).waitFor();
  await page.locator(ROWS).nth(5).waitFor({ state: "hidden" });
  log("after eviction", (await listedScores(page)).join(" "));
  await shot(page, "04-scores-evicted");

  // 5. Duplicate date → conflict with an "Edit that round" link
  log("duplicate date", await addRound(page, 22, isoDaysAgo(2)));
  await shot(page, "05-scores-duplicate");
  await page.getByRole("button", { name: "Edit that round" }).click();
  log("edit form opened", String(await page.getByRole("button", { name: "Save" }).isVisible()));

  // 6. Inline edit: change 36 → 37 on that same date
  const editForm = page.locator("form", { has: page.getByRole("button", { name: "Save" }) });
  await editForm.locator('input[name="score"]').fill("37");
  await editForm.getByRole("button", { name: "Save" }).click();
  await page.locator(ROWS).filter({ hasText: "37" }).waitFor();
  log("after edit", (await listedScores(page)).join(" "));

  // 7. Backdated beyond the window (older than the oldest kept round) → rejected
  log("backdated round", await addRound(page, 25, isoDaysAgo(30)));

  // 8. Out-of-range and future date → field errors from the schema
  log("score 46", await addRound(page, 46, isoDaysAgo(3)));
  log("future date", await addRound(page, 30, isoDaysAgo(-2)));
  await shot(page, "06-scores-errors");

  // 9. Two-click delete of the newest round
  const firstRow = page.locator(ROWS).first();
  await firstRow.getByRole("button", { name: "Delete" }).click();
  log("first click arms", (await firstRow.getByRole("button", { name: "Delete?" }).textContent())?.trim());
  await firstRow.getByRole("button", { name: "Delete?" }).click();
  await page.locator(ROWS).nth(4).waitFor({ state: "hidden" });
  log("after delete", (await listedScores(page)).join(" "));
  await shot(page, "07-scores-deleted");

  // 10. Database agrees with the screen
  const { data: rows } = await admin.from("scores").select("score, played_on").eq("user_id", user!.id).order("played_on", { ascending: false });
  log("db rows", rows?.map((r) => `${r.score}@${r.played_on}`).join(" "));

  // 11. Dashboard reflects the same list
  await page.goto(`${BASE}/app`);
  log("dashboard", (await page.getByText(/Enter 1 more round/).textContent())?.trim());

  // 12. Phone viewport
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await phone.addCookies(await desktop.cookies());
  const mobile = await phone.newPage();
  await mobile.goto(`${BASE}/app/scores`);
  await mobile.screenshot({ path: `${OUT}/08-scores-mobile.png`, fullPage: true });
  const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  log("390px horizontal overflow", String(overflow));

  // cleanup
  await admin.auth.admin.deleteUser(user!.id);
  await browser.close();
  log("done", `screenshots in ${OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

