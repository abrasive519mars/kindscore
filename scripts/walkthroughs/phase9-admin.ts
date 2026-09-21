/**
 * Drives the admin users + reports pages in a real browser against the running app + local
 * Supabase and saves screenshots. Not a test suite — a repeatable manual check with evidence.
 *   pnpm build && pnpm start -p 3000   then   pnpm tsx scripts/walkthrough-phase9.ts
 */
import { chromium, type Page } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdir } from "node:fs/promises";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.test" });

const BASE = process.env.WALKTHROUGH_BASE ?? "http://localhost:3000";
const OUT = process.env.WALKTHROUGH_OUT ?? "docs/evidence/phase-9";
const RUN = Date.now();
const PASSWORD = "Kindscore!2026";
const CHARITY_SAHAJ = "c0000000-0000-4000-8000-000000000001";
const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

function log(step: string, detail = "") {
  console.log(`${step.padEnd(44)} ${detail}`);
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
}

async function createUser(role: "member" | "admin", name: string) {
  const email = `walk9-${name.toLowerCase().replace(/\s+/g, "-")}-${RUN}@kindscore.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: name, charity_id: CHARITY_SAHAJ, charity_bps: 1000 },
  });
  if (error || !data.user) throw error ?? new Error("no user");
  if (role === "admin")
    await admin.from("profiles").update({ role: "admin" }).eq("id", data.user.id);
  return { id: data.user.id, email, name };
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
  const adminUser = await createUser("admin", "Admin Nine");
  const target = await createUser("member", "Rohan Walkthrough");
  const others = await Promise.all(
    ["Asha Filler", "Dev Filler", "Meera Filler"].map((n) => createUser("member", n)),
  );
  const browser = await chromium.launch();
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await desktop.newPage();

  // 1. Users list + search
  await login(page, adminUser.email);
  await page.goto(`${BASE}/admin/users`);
  log("users listed", String(await page.locator("tbody tr").count()));
  await shot(page, "01-admin-users");
  await page.fill('input[name="q"]', "rohan");
  await page.getByRole("button", { name: "Search" }).click();
  await page.waitForURL(/q=rohan/);
  log("search rohan", String(await page.locator("tbody tr").count()));
  await page.getByRole("link", { name: "Rohan Walkthrough" }).click();
  await page.waitForURL(/\/admin\/users\/[0-9a-f-]+$/);
  await shot(page, "02-admin-member");

  // 2. Profile edit
  await page.fill("#fullName", "Rohan Renamed");
  await page.selectOption("#charityId", { label: "Neer Jal Trust" });
  await page.locator('input[name="charityBps"]').fill("2000");
  await page.getByRole("button", { name: "Save profile" }).click();
  await page.getByText("Saved and audited.").waitFor();
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, charity_bps")
    .eq("id", target.id)
    .single();
  log("profile edited", JSON.stringify(profile));

  // 3. Scores: add six (sixth evicts), duplicate refused, edit, delete
  for (let d = 1; d <= 6; d++) {
    // React resets the form after each action; fill after the reset has landed.
    await page.waitForTimeout(400);
    await page.fill("#new-score", String(30 + d));
    await page.fill("#new-date", `2026-08-0${d}`);
    await page
      .locator("#new-score")
      .evaluate((el, v) => ((el as HTMLInputElement).value = String(v)), 30 + d);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await page
      .locator('ul[aria-label="Rounds, newest first"] li')
      .nth(Math.min(d, 5) - 1)
      .waitFor();
    await page.waitForTimeout(400);
  }
  log(
    "scores after six adds",
    (await page.locator('ul[aria-label="Rounds, newest first"] span.num').allTextContents()).join(
      " ",
    ),
  );
  await page.fill("#new-score", "20");
  await page.fill("#new-date", "2026-08-06");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  log(
    "duplicate date",
    (await page.locator('[role="alert"]').filter({ hasText: "already" }).textContent())?.trim(),
  );
  await shot(page, "03-admin-scores");
  const firstRow = page.locator('ul[aria-label="Rounds, newest first"] li').first();
  await firstRow.getByRole("button", { name: "Edit" }).click();
  await firstRow.locator('input[name="score"]').fill("44");
  await firstRow.getByRole("button", { name: "Save" }).click();
  await page.locator('ul[aria-label="Rounds, newest first"] li').first().getByText("44").waitFor();
  await page
    .locator('ul[aria-label="Rounds, newest first"] li')
    .last()
    .getByRole("button", { name: "Delete" })
    .click();
  await page.waitForTimeout(800);
  log(
    "after edit + delete",
    (await page.locator('ul[aria-label="Rounds, newest first"] span.num').allTextContents()).join(
      " ",
    ),
  );

  // 4. Subscription grant → member is Active; end → member locked on the next request
  await page.getByRole("button", { name: "Grant one month" }).click();
  await page.getByText("admin-granted").waitFor();
  log("granted", (await page.getByText(/renews .* via admin/).textContent())?.trim());
  await shot(page, "04-admin-subscription-granted");
  const memberPage = await (
    await browser.newContext({ viewport: { width: 1280, height: 900 } })
  ).newPage();
  await login(memberPage, target.email);
  log(
    "member sees",
    (await memberPage.getByText("Active", { exact: true }).first().textContent())?.trim(),
  );
  await page.getByRole("button", { name: "End now" }).click();
  await page
    .getByText(/lapsed/)
    .first()
    .waitFor();
  await memberPage.goto(`${BASE}/app/scores`);
  log(
    "member after end",
    (await memberPage.getByText("Your five scores go here").textContent())?.trim(),
  );
  await memberPage.screenshot({ path: `${OUT}/05-member-locked-after-end.png`, fullPage: true });
  log("audit rows", String(await page.locator("text=subscription.").count()));
  await shot(page, "06-admin-member-audit");

  // 5. Reports + CSV
  await page.goto(`${BASE}/admin/reports`);
  log("reports h1", (await page.locator("h1").textContent())?.trim());
  await shot(page, "07-admin-reports");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "CSV · Members" }).click(),
  ]);
  log("csv download", download.suggestedFilename());
  const stream = await download.createReadStream();
  let csv = "";
  for await (const chunk of stream) csv += chunk.toString();
  log("csv header", csv.split("\r\n")[0]);

  // 6. Member cannot open admin pages
  await memberPage.goto(`${BASE}/admin/users`);
  log("member at /admin/users", (await memberPage.locator("h1").textContent())?.trim());
  const res = await memberPage.request.get(`${BASE}/admin/reports/export?report=members`);
  log("member CSV export", String(res.status()));

  // 7. Phone
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  await phone.addCookies(await desktop.cookies());
  const mobile = await phone.newPage();
  await mobile.goto(`${BASE}/admin/users/${target.id}`);
  await mobile.screenshot({ path: `${OUT}/08-admin-member-mobile.png`, fullPage: true });
  const overflow = await mobile.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  log("390px horizontal overflow", String(overflow));

  await logout(page);
  for (const u of [adminUser, target, ...others]) await admin.auth.admin.deleteUser(u.id);
  await browser.close();
  log("done", `screenshots in ${OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
