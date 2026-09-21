/**
 * Drives the Phase 3 flows in a real browser against the running app + local Supabase and
 * saves screenshots. Not a test suite — a repeatable manual check with evidence.
 *   pnpm start -p 3111   (or pnpm dev)   then   pnpm tsx scripts/walkthrough-phase3.ts
 */
import { chromium, type Page } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdir } from "node:fs/promises";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.test" });

const BASE = process.env.WALKTHROUGH_BASE ?? "http://localhost:3111";
const OUT = process.env.WALKTHROUGH_OUT ?? "docs/screenshots/phase-3";
const email = `walk-${Date.now()}@kindscore.test`;
const password = "Kindscore!2026";
const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

function log(step: string, detail = "") {
  console.log(`${step.padEnd(44)} ${detail}`);
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await desktop.newPage();

  // 1. Sign up
  await page.goto(`${BASE}/signup`);
  await shot(page, "01-signup");
  await page.fill("#fullName", "Walkthrough User");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.selectOption("#charityId", { label: "Udaan Girls' Sports Collective · featured" });
  await page.locator('input[name="charityBps"]').fill("2500");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(`${BASE}/app`);
  log("signup → /app", page.url());
  await shot(page, "02-dashboard-locked");

  const banner = await page.locator('[role="status"]').first().textContent();
  log("locked banner", banner?.trim().slice(0, 60));
  log(
    "Subscribe to unlock visible",
    String(await page.getByRole("button", { name: "Subscribe to unlock" }).isVisible()),
  );

  // 2. Profile trigger stored the metadata
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, charity_bps, role")
    .eq("email", email)
    .single();
  log("profile row", JSON.stringify(profile));

  // 3. Subscription + settings pages
  await page.goto(`${BASE}/app/subscription`);
  await shot(page, "03-subscription");
  await page.goto(`${BASE}/app/settings`);
  await page.fill("#fullName", "Walkthrough Renamed");
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByText("Saved").waitFor();
  log("settings save", "Saved confirmation shown");

  // 4. Member at /admin → 403
  await page.goto(`${BASE}/admin`);
  log("/admin as member", (await page.locator("h1").textContent())?.trim());
  await shot(page, "04-admin-403");

  // 5. Log out → /app redirects to login
  await page.goto(`${BASE}/app/settings`);
  await page.getByRole("button", { name: "Log out" }).click();
  await page.waitForURL(`${BASE}/`);
  await page.goto(`${BASE}/app`);
  log("after logout, /app →", page.url());

  // 6. Wrong password, then correct login with ?next
  await page.goto(`${BASE}/login?next=/app/settings`);
  await page.fill("#email", email);
  await page.fill("#password", "wrong-password");
  await page.getByRole("button", { name: "Log in" }).click();
  // getByRole("alert") alone also matches Next's route announcer; wait for our message.
  const loginError = page.getByText("Email or password is incorrect");
  await loginError.waitFor();
  log("wrong password", (await loginError.textContent())?.trim());
  await shot(page, "05-login-error");
  await page.fill("#password", password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(`${BASE}/app/settings`);
  log("login honours ?next", page.url());

  // 7. Promote to admin (service role) → /admin overview renders
  await admin.from("profiles").update({ role: "admin" }).eq("email", email);
  await page.goto(`${BASE}/admin`);
  log("/admin as admin", (await page.locator("h1").textContent())?.trim());
  await shot(page, "06-admin-overview");

  // 8. Phone viewport
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const cookies = await desktop.cookies();
  await phone.addCookies(cookies);
  const mobile = await phone.newPage();
  await mobile.goto(`${BASE}/app`);
  await mobile.screenshot({ path: `${OUT}/07-dashboard-mobile.png`, fullPage: true });
  const overflow = await mobile.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  log("390px horizontal overflow", String(overflow));
  await mobile.goto(`${BASE}/signup`);
  await mobile.screenshot({ path: `${OUT}/08-signup-mobile.png`, fullPage: true });

  // cleanup
  const { data: user } = await admin.from("profiles").select("id").eq("email", email).single();
  if (user) await admin.auth.admin.deleteUser(user.id);
  await browser.close();
  log("done", `screenshots in ${OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
