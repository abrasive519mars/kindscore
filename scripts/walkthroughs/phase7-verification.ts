/**
 * Drives winner verification in a real browser against the running app + local Supabase and
 * saves screenshots. Not a test suite — a repeatable manual check with evidence.
 *   pnpm build && pnpm start -p 3000   then   pnpm tsx scripts/walkthrough-phase7.ts
 *
 * A published draw with one guaranteed 3-match winner is set up through the Phase 2 RPCs, then:
 * winner uploads → admin rejects with a reason → winner uploads again → admin approves → marks paid.
 */
import { chromium, type Page } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdir } from "node:fs/promises";
import { config as loadEnv } from "dotenv";
import sharp from "sharp";

loadEnv({ path: ".env.test" });

const BASE = process.env.WALKTHROUGH_BASE ?? "http://localhost:3000";
const OUT = process.env.WALKTHROUGH_OUT ?? "docs/evidence/phase-7";
const RUN = Date.now();
const PASSWORD = "Kindscore!2026";
const CHARITY_UDAAN = "c0000000-0000-4000-8000-000000000007";
const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

function log(step: string, detail = "") {
  console.log(`${step.padEnd(44)} ${detail}`);
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
}

async function createUser(role: "member" | "admin", i = 0) {
  const email = `walk7-${role}${i}-${RUN}@kindscore.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: role === "admin" ? "Admin Seven" : `Winner ${i}`,
      charity_id: CHARITY_UDAAN,
      charity_bps: 1000,
    },
  });
  if (error || !data.user) throw error ?? new Error("no user");
  if (role === "admin")
    await admin.from("profiles").update({ role: "admin" }).eq("id", data.user.id);
  return { id: data.user.id, email };
}

/** A plausible "screenshot": a labelled image, generated so the walkthrough needs no fixture file. */
async function fakeScreenshot(label: string): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="400"><rect width="100%" height="100%" fill="#f7f3ec"/><text x="40" y="80" font-family="sans-serif" font-size="32" fill="#171411">Club scoring app</text><text x="40" y="160" font-family="monospace" font-size="28" fill="#171411">${label}</text><text x="40" y="220" font-family="monospace" font-size="28" fill="#171411">28 · 33 · 31 · 36 · 29</text></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function login(page: Page, email: string) {
  await page.goto(`${BASE}/login`);
  await page.fill("#email", email);
  await page.fill("#password", PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/\/(app|admin)/);
}

async function logout(page: Page) {
  await page.goto(`${BASE}/app/settings`);
  await page.getByRole("button", { name: "Log out" }).click();
  await page.waitForURL(`${BASE}/`);
}

async function upload(page: Page, label: string, buttonName: RegExp) {
  await page.setInputFiles('input[name="proof"]', {
    name: "screenshot.png",
    mimeType: "image/png",
    buffer: await fakeScreenshot(label),
  });
  await page.getByRole("button", { name: buttonName }).click();
  await page.getByText("Under review").first().waitFor();
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const adminUser = await createUser("admin");
  const winner = await createUser("member", 1);
  const start = new Date();
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  await admin.from("subscriptions").insert({
    user_id: winner.id,
    stripe_subscription_id: `seed_sub_${winner.id}`,
    stripe_price_id: "price_seed",
    plan_interval: "month",
    status: "active",
    current_period_start: start.toISOString(),
    current_period_end: end.toISOString(),
    source: "seed",
  });

  // A published draw where the winner matched three (through the real RPCs, as an admin session).
  const { data: session } = await admin.auth.signInWithPassword({
    email: adminUser.email,
    password: PASSWORD,
  });
  const adminDb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${session.session!.access_token}` } },
  });
  const { data: draw } = await admin
    .from("draws")
    .insert({ draw_month: "2027-06-01" })
    .select("id")
    .single();
  const drawId = draw!.id;
  const { error: simError } = await adminDb.rpc("save_simulation", {
    p_draw_id: drawId,
    p_mode: "random",
    p_numbers: [28, 33, 31, 12, 40],
    p_active_subscriber_count: 1,
    p_pool_paise: 14_970,
    p_rollover_in_paise: 0,
    // The jackpot absorbs the rounding paisa: 5,989 + 5,239 + 3,742 = 14,970 (the DB checks this).
    p_jackpot_pool_paise: 5_989,
    p_four_pool_paise: 5_239,
    p_three_pool_paise: 3_742,
    p_rollover_out_paise: 5_989,
    p_unclaimed_retained_paise: 5_239,
    p_entries_hash: "walk7",
    p_entries: [{ user_id: winner.id, scores: [28, 33, 31, 36, 29], match_count: 3 }],
    p_results: [{ user_id: winner.id, match_count: 3, prize_paise: 3_742 }],
  });
  if (simError) throw simError;
  const { error: pubError } = await adminDb.rpc("publish_draw", { p_draw_id: drawId });
  if (pubError) throw pubError;
  const { data: verification } = await admin
    .from("winner_verifications")
    .select("id")
    .eq("user_id", winner.id)
    .single();
  const claimId = verification!.id;
  log("seeded", "published draw, one 3-match winner (₹37.42)");

  const browser = await chromium.launch();
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await desktop.newPage();

  // 1. Winner: winnings page → claim → upload
  await login(page, winner.email);
  log(
    "dashboard total won",
    (await page.getByText("Total won").locator("..").textContent())?.replace(/\s+/g, " ").trim(),
  );
  await page.goto(`${BASE}/app/winnings`);
  await shot(page, "01-member-winnings-awaiting");
  await page.getByRole("button", { name: "Upload proof" }).click();
  await page.waitForURL(/\/app\/winnings\/[0-9a-f-]+$/);
  await shot(page, "02-member-claim");
  await upload(page, "Round of 21 Aug 2026 · Stableford 33", /Upload proof/);
  log("after upload", "Under review");
  await shot(page, "03-member-submitted");
  await logout(page);

  // 2. Admin: queue → claim → reject with a reason
  await login(page, adminUser.email);
  await page.goto(`${BASE}/admin/winners?filter=review`);
  log("queue: to review", (await page.locator("tbody tr").count()).toString());
  await shot(page, "04-admin-queue");
  await page.getByRole("link", { name: "Winner 1" }).click();
  await page.waitForURL(/\/admin\/winners\/[0-9a-f-]+$/);
  await page.locator("img[alt^='Proof uploaded']").waitFor();
  log("proof visible to admin", "yes (signed URL)");
  await shot(page, "05-admin-claim-proof");
  await page.getByRole("button", { name: "Reject…" }).click();
  await page.fill('textarea[name="note"]', "The screenshot doesn't show the dates of the rounds.");
  await page.getByRole("button", { name: "Confirm rejection" }).click();
  await page.getByText("Rejected · upload again").waitFor();
  log("rejected", "with reason");
  await shot(page, "06-admin-rejected");
  await logout(page);

  // 3. Winner sees the reason and uploads once more
  await login(page, winner.email);
  await page.goto(`${BASE}/app/winnings/${claimId}`);
  log(
    "member sees reason",
    (await page.getByText(/Rejected: /).textContent())?.trim().slice(0, 80),
  );
  await shot(page, "07-member-rejected");
  await upload(page, "Round of 21 Aug 2026 · Stableford 33 · dated", /Upload again/);
  log("resubmitted", "Under review");
  await logout(page);

  // 4. Admin approves — and that is the admin's last move
  await login(page, adminUser.email);
  await page.goto(`${BASE}/admin/winners/${claimId}`);
  await page.getByRole("button", { name: "Approve" }).click();
  await page.getByText(/Approved\. The member claims the payout/).waitFor();
  log("approved", "waiting for the member to claim");
  await shot(page, "08-admin-approved");
  await logout(page);

  // 5. Winner claims: Stripe credits the prize (test mode) and the win is paid
  await login(page, winner.email);
  await page.goto(`${BASE}/app/winnings/${claimId}`);
  await page.getByRole("button", { name: "Claim as subscription credit" }).click();
  await page.getByRole("button", { name: "Confirm claim" }).click();
  await page.getByText(/Stripe ref cbtxn_/).waitFor({ timeout: 45_000 });
  log("paid", (await page.getByText(/Stripe ref/).textContent())?.trim().slice(0, 90));
  await shot(page, "09-member-paid-credit");
  await page.goto(`${BASE}/app`);
  log(
    "dashboard total won",
    (await page.getByText("Total won").locator("..").textContent())?.replace(/\s+/g, " ").trim(),
  );
  await page.goto(`${BASE}/app/winnings`);
  log(
    "winnings status",
    (await page.getByText("Paid", { exact: true }).first().textContent())?.trim(),
  );
  await shot(page, "10-member-paid");

  // 6. Phone
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  await phone.addCookies(await desktop.cookies());
  const mobile = await phone.newPage();
  await mobile.goto(`${BASE}/app/winnings/${claimId}`);
  await mobile.screenshot({ path: `${OUT}/11-member-claim-mobile.png`, fullPage: true });
  const overflow = await mobile.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  log("390px horizontal overflow", String(overflow));

  // cleanup
  await admin.storage.from("proofs").remove([`${winner.id}/${claimId}.png`]);
  await admin.from("draws").delete().eq("id", drawId);
  for (const u of [adminUser, winner]) await admin.auth.admin.deleteUser(u.id);
  await browser.close();
  log("done", `screenshots in ${OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
