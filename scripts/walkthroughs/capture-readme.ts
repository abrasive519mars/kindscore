/**
 * Captures the curated screenshots the README and the submission PDF use, from the seeded app.
 *   pnpm seed && pnpm build && NEXT_PUBLIC_DEMO_ACCOUNTS=1 pnpm start -p 3000
 *   pnpm tsx scripts/walkthroughs/capture-readme.ts
 * Read-only against the seed except for one September *simulation* on the admin draw page, which
 * is left as a draft (never published) so the evaluator can still run the draw themselves.
 */
import { chromium, type Browser, type Page } from "playwright";
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const BASE = process.env.WALKTHROUGH_BASE ?? "http://localhost:3000";
const OUT = "docs/screenshots";
const PASSWORD = process.env.SEED_PASSWORD ?? "Kindscore!2026";

async function save(
  page: Page,
  name: string,
  options: {
    fullPage?: boolean;
    clip?: { x: number; y: number; width: number; height: number };
  } = {},
) {
  const raw = await page.screenshot({ fullPage: options.fullPage ?? false, clip: options.clip });
  await sharp(raw)
    .resize({ width: 1400, withoutEnlargement: true })
    .png({ compressionLevel: 9, palette: true })
    .toFile(`${OUT}/${name}.png`);
  console.log(`saved ${name}`);
}

async function login(page: Page, email: string) {
  await page.goto(`${BASE}/login`);
  await page.fill("#email", email);
  await page.fill("#password", PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/\/app|\/admin/);
}

async function desktop(browser: Browser) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 860 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  await page.goto(BASE);
  await page.waitForTimeout(3000); // odometer + reveals settle
  await save(page, "01-landing");
  await page.goto(`${BASE}/charities/udaan-girls-sports`);
  await page.waitForTimeout(500);
  await save(page, "02-charity-profile", { fullPage: true });

  await login(page, "priya@kindscore.app");
  await page.waitForTimeout(3000); // odometer + reveals settle
  await save(page, "03-member-dashboard", { fullPage: true });
  await page.goto(`${BASE}/app/scores`);
  await save(page, "04-scores");
  await page.goto(`${BASE}/app/draws`);
  const august = page.getByRole("link", { name: "August 2026" }).first();
  await august.click();
  await page.waitForURL(/\/app\/draws\/[0-9a-f-]+$/);
  await page.waitForTimeout(2600);
  await save(page, "05-draw-reveal");
  await page.goto(`${BASE}/app/winnings`);
  await save(page, "06-winnings");
  await page.goto(`${BASE}/app/settings`);
  await page.getByRole("button", { name: "Log out" }).click();
  await page.waitForURL(`${BASE}/`);

  await login(page, "admin@kindscore.app");
  await page.goto(`${BASE}/admin`);
  await page.waitForTimeout(500);
  await save(page, "07-admin-overview");
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
  await page.getByText("Weighted by scores", { exact: true }).click();
  const simulate = page.getByRole("button", {
    name: /Simulate the draw|Re-simulate with fresh numbers/,
  });
  await simulate.click();
  await page.getByText("Draft result").waitFor();
  await page.waitForTimeout(800);
  await save(page, "08-admin-draw-simulated", { fullPage: true });
  await page.goto(`${BASE}/admin/winners`);
  await save(page, "09-admin-winners");
  await page.goto(`${BASE}/admin/reports`);
  await save(page, "10-admin-reports", { fullPage: true });
  await context.close();
}

async function mobile(browser: Browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await login(page, "priya@kindscore.app");
  await page.waitForTimeout(3000); // odometer + reveals settle
  await save(page, "11-mobile-dashboard");
  await page.goto(`${BASE}/charities`);
  await page.waitForTimeout(500);
  await save(page, "12-mobile-charities");
  await context.close();
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  await desktop(browser);
  await mobile(browser);
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
