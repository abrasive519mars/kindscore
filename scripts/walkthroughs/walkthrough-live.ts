/**
 * Live acceptance: docs/TESTING.md against the deployed site, with the seeded accounts, in order.
 *   LIVE_URL=https://kindscore.vercel.app pnpm tsx scripts/walkthroughs/walkthrough-live.ts
 * Mutates the demo world (a signup + real test-mode checkout, a simulated September draft, Priya's
 * claim) — re-seed the cloud afterwards: pnpm seed --env .env.cloud.local --yes
 * Prints one line per check; exits 1 if any check failed. Paste the summary into TESTING.md.
 */
import { chromium, type Browser, type Page } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE = (
  process.env.LIVE_URL ??
  process.env.WALKTHROUGH_BASE ??
  "http://localhost:3000"
).replace(/\/$/, "");
const OUT = process.env.WALKTHROUGH_OUT ?? "docs/evidence/live";
const PASSWORD = process.env.SEED_PASSWORD ?? "Kindscore!2026";
const STAMP = Date.now().toString(36);
const NEW_MEMBER = `walkthrough-${STAMP}@kindscore.app`;
const failures: string[] = [];

function log(step: string, detail = "") {
  console.log(`${step.padEnd(44)} ${detail}`);
}

function check(step: string, ok: boolean, detail = "") {
  log(`${ok ? "✓" : "✗"} ${step}`, detail);
  if (!ok) failures.push(step);
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
}

async function login(page: Page, email: string) {
  await page.goto(`${BASE}/login`);
  await page.fill("#email", email);
  await page.fill("#password", PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/\/(app|admin)/);
}

async function logout(page: Page) {
  await page.goto(`${BASE}/app/settings`).catch(() => undefined);
  const button = page.getByRole("button", { name: "Log out" });
  if (await button.count()) {
    await button.click();
    await page.waitForURL(`${BASE}/`);
  }
}

async function overflow(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
}

async function text(page: Page, pattern: RegExp | string): Promise<string> {
  return (
    (
      await page
        .getByText(pattern)
        .first()
        .textContent()
        .catch(() => "")
    )?.trim() ?? ""
  );
}

/** Stripe's hosted Checkout with the documented test card and an Indian address. */
async function payOnStripe(page: Page) {
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 45_000 });
  await page.fill("#cardNumber", "4242 4242 4242 4242");
  await page.fill("#cardExpiry", "12 / 34");
  await page.fill("#cardCvc", "123");
  await page.fill("#billingName", "Live Walkthrough");
  await page.selectOption("#billingCountry", "IN");
  await page.getByText("Enter address manually").click();
  await page.fill("#billingAddressLine1", "12 Banjara Hills");
  await page.fill("#billingLocality", "Hyderabad");
  await page.fill("#billingPostalCode", "500034");
  await page.selectOption("#billingAdministrativeArea", { label: "Telangana" });
  await page.locator("button[type=submit]").first().click();
}

async function publicPages(page: Page) {
  await page.goto(BASE);
  await page.waitForTimeout(1500);
  check("landing renders live figures", (await text(page, /given to charit/i)).length > 0);
  await shot(page, "01-landing");
  for (const path of ["/charities", "/charities/neer-jal", "/draws", "/how-it-works", "/pricing"]) {
    const response = await page.goto(`${BASE}${path}`);
    check(`public ${path}`, response?.status() === 200);
  }
  await page.goto(`${BASE}/charities?q=water`);
  check("charity search", (await page.locator("a[href^='/charities/']").count()) > 0);
}

async function signupAndSubscribe(page: Page) {
  await page.goto(`${BASE}/signup`);
  await page.fill("#fullName", "Live Walkthrough");
  await page.fill("#email", NEW_MEMBER);
  await page.fill("#password", PASSWORD);
  await page.locator('input[name="charityBps"]').fill("2500");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(`${BASE}/app/subscription`);
  check("step 1 → lands on step 2 (plans)", true, page.url());
  await page.goto(`${BASE}/app`);
  check("not-subscribed banner", (await text(page, /not subscribed yet/)).length > 0);
  await shot(page, "02-locked-dashboard");
  await page.goto(`${BASE}/app/subscription`);
  await page.getByRole("button", { name: /Subscribe monthly/ }).click();
  await payOnStripe(page);
  await page.waitForURL(`${BASE}/app/subscription?activated=1`, { timeout: 120_000 });
  check("step 2 → real checkout → active", (await text(page, /Renews .* · monthly/)).length > 0);
  await shot(page, "03-subscribed");
}

async function scores(page: Page) {
  await page.goto(`${BASE}/app/scores`);
  const today = new Date();
  const iso = (daysAgo: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().slice(0, 10);
  };
  for (const [score, days] of [
    [31, 6],
    [28, 9],
    [36, 2],
    [33, 4],
    [29, 8],
  ] as const) {
    await page.fill("#score", String(score));
    await page.fill("#playedOn", iso(days));
    await page.getByRole("button", { name: "Add round" }).click();
    await page.locator("button[type=submit][aria-busy]").waitFor({ state: "hidden" });
  }
  await page.fill("#score", "40");
  await page.fill("#playedOn", iso(1));
  await page.getByRole("button", { name: "Add round" }).click();
  await page.locator("button[type=submit][aria-busy]").waitFor({ state: "hidden" });
  check("sixth round evicts the oldest", (await text(page, /Replaced your/)).length > 0);
  await page.fill("#score", "22");
  await page.fill("#playedOn", iso(2));
  await page.getByRole("button", { name: "Add round" }).click();
  await page.locator("button[type=submit][aria-busy]").waitFor({ state: "hidden" });
  check("duplicate date refused", (await text(page, /already logged a round/)).length > 0);
  await shot(page, "04-scores");
  await page.goto(`${BASE}/app`);
  check("dashboard says Eligible", (await text(page, "Eligible")).length > 0);
}

async function priya(page: Page) {
  await login(page, "priya@kindscore.app");
  await page.goto(`${BASE}/app`);
  check("priya · yearly active", (await text(page, /Renews .* · yearly/)).length > 0);
  check("priya · 3 draws entered", (await text(page, /3 draws entered/)).length > 0);
  check("priya · win awaiting", (await text(page, /awaiting verification/)).length > 0);
  await shot(page, "05-priya-dashboard");
  await page.goto(`${BASE}/app/draws`);
  await page.getByRole("link", { name: "August 2026" }).first().click();
  await page.waitForURL(/\/app\/draws\/[0-9a-f-]+$/);
  await page.getByText(/you win|No match|matches —/).waitFor({ timeout: 15_000 });
  check("august reveal · 3 matches", (await text(page, /3 matches/)).length > 0);
  check(
    "claim CTA on the reveal",
    (await page.getByRole("button", { name: /Claim your prize/ }).count()) > 0,
  );
  await shot(page, "06-priya-reveal");
}

async function raj(page: Page) {
  await login(page, "raj@kindscore.app");
  await page.goto(`${BASE}/app`);
  check("raj · enter 2 more rounds", (await text(page, /Enter 2 more rounds/)).length > 0);
}

async function anita(page: Page) {
  await login(page, "anita@kindscore.app");
  await page.goto(`${BASE}/app`);
  check("anita · lapsed banner", (await text(page, /subscription has lapsed/)).length > 0);
  await page.goto(`${BASE}/app/scores`);
  check(
    "anita · scores locked",
    (await page.getByRole("button", { name: "Subscribe to unlock" }).count()) > 0,
  );
  await page.goto(`${BASE}/app/winnings`);
  check("anita · june win paid", (await text(page, "Paid")).length > 0);
  await shot(page, "07-anita-lapsed");
}

async function admin(page: Page) {
  await login(page, "admin@kindscore.app");
  check("admin lands on /admin", page.url().startsWith(`${BASE}/admin`), page.url());
  await page.goto(`${BASE}/admin/users`);
  await page.fill('input[name="q"]', "priya");
  await page.getByRole("button", { name: "Search" }).click();
  check("admin · user search", (await page.getByRole("link", { name: /Priya/ }).count()) > 0);
  await page.goto(`${BASE}/admin/draws`);
  const open = page.getByRole("button", { name: /Open .*'s draw/ });
  if (await open.count()) {
    await open.click();
    await page.waitForURL(/\/admin\/draws\/[0-9a-f-]+$/);
  } else {
    await page
      .getByRole("link", { name: /Simulate|Review and publish/ })
      .first()
      .click();
    await page.waitForURL(/\/admin\/draws\/[0-9a-f-]+$/);
  }
  await page.getByRole("button", { name: /Simulate the draw|Re-simulate/ }).click();
  await page.getByText("Draft result").waitFor({ timeout: 30_000 });
  check("admin · random simulation", (await text(page, /Draft result/)).length > 0);
  await page.getByText("Weighted by scores", { exact: true }).click();
  await page.getByRole("button", { name: "Re-simulate with fresh numbers" }).click();
  await page.getByText(/Simulated .* · algorithmic/).waitFor({ timeout: 30_000 });
  check("admin · weighted re-simulation", true);
  check("admin · rollover shown", (await text(page, /rolled in/)).length > 0);
  await shot(page, "08-admin-simulated");
  await page.goto(`${BASE}/admin/winners`);
  check("admin · winners queue", (await page.locator("a[href^='/admin/winners/']").count()) > 0);
  await page.goto(`${BASE}/admin/reports`);
  check("admin · reports", (await text(page, /Given to charities/)).length > 0);
  await shot(page, "09-admin-reports");
}

async function claimFlow(page: Page) {
  // Priya uploads proof → admin approves → Priya claims → Stripe credit → Paid.
  await login(page, "priya@kindscore.app");
  await page.goto(`${BASE}/app/winnings`);
  await page.getByRole("button", { name: "Upload proof" }).first().click();
  await page.waitForURL(/\/app\/winnings\/[0-9a-f-]+$/);
  const claimUrl = page.url();
  await page.setInputFiles('input[name="proof"]', {
    name: "proof.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64",
    ),
  });
  await page.getByRole("button", { name: "Upload proof" }).click();
  await page.getByText("Under review").first().waitFor({ timeout: 30_000 });
  check("priya · proof under review", true);
  await logout(page);

  await login(page, "admin@kindscore.app");
  await page.goto(claimUrl.replace("/app/winnings/", "/admin/winners/"));
  await page.getByRole("button", { name: "Approve" }).click();
  await page.getByText(/Approved\. The member claims/).waitFor({ timeout: 30_000 });
  check("admin · approved, nothing else to do", true);
  await logout(page);

  await login(page, "priya@kindscore.app");
  await page.goto(claimUrl);
  await page.getByRole("button", { name: "Claim as subscription credit" }).click();
  await page.getByRole("button", { name: "Confirm claim" }).click();
  await page.getByText(/Stripe ref cbtxn_/).waitFor({ timeout: 60_000 });
  check("priya · paid via Stripe credit", true, (await text(page, /Stripe ref/)).slice(0, 80));
  await shot(page, "10-priya-paid");
}

async function mobile(browser: Browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto(BASE);
  await page.waitForTimeout(800);
  check("mobile · landing no overflow", !(await overflow(page)));
  await login(page, "priya@kindscore.app");
  await page.goto(`${BASE}/app`);
  check("mobile · dashboard no overflow", !(await overflow(page)));
  await shot(page, "11-mobile-dashboard");
  await context.close();
}

async function main() {
  await mkdir(OUT, { recursive: true });
  log("target", BASE);
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  await publicPages(page);
  await signupAndSubscribe(page);
  await scores(page);
  await logout(page);
  await priya(page);
  await logout(page);
  await raj(page);
  await logout(page);
  await anita(page);
  await logout(page);
  await admin(page);
  await logout(page);
  await claimFlow(page);
  await logout(page);
  await context.close();
  await mobile(browser);
  await browser.close();

  const stamp = new Date().toISOString().replace("T", " ").slice(0, 16);
  log(
    "summary",
    `${failures.length === 0 ? "all checks passed" : `${failures.length} failed`} · ${stamp} UTC · ${BASE}`,
  );
  if (failures.length) {
    for (const f of failures) log("  failed", f);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
