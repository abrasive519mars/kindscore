/**
 * Drives the public pages in a real browser against the running build and saves screenshots;
 * then runs Lighthouse on "/" (desktop + mobile). Not a test suite — a repeatable manual check.
 *   pnpm build && pnpm start -p 3000   then   pnpm tsx scripts/walkthrough-phase10.ts
 */
import { chromium, type Page } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";

const BASE = process.env.WALKTHROUGH_BASE ?? "http://localhost:3000";
const OUT = process.env.WALKTHROUGH_OUT ?? "docs/evidence/phase-10";

function log(step: string, detail = "") {
  console.log(`${step.padEnd(44)} ${detail}`);
}

async function overflow(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
}

async function lighthouse(preset: "desktop" | "mobile"): Promise<string> {
  const out = `${OUT}/lighthouse-${preset}.json`;
  const args = [
    BASE,
    "--quiet",
    `--output-path=${out}`,
    "--output=json",
    "--only-categories=performance,accessibility,best-practices,seo",
    "--chrome-flags=--headless=new --no-sandbox",
  ];
  if (preset === "desktop") args.push("--preset=desktop");
  try {
    execFileSync("npx", ["--yes", "lighthouse@12", ...args], {
      stdio: "ignore",
      shell: true,
      env: { ...process.env, CHROME_PATH: chromium.executablePath() },
      timeout: 240_000,
    });
    const report = JSON.parse(await readFile(out, "utf8"));
    const c = report.categories;
    return `perf ${Math.round(c.performance.score * 100)} · a11y ${Math.round(c.accessibility.score * 100)} · best ${Math.round(c["best-practices"].score * 100)} · seo ${Math.round(c.seo.score * 100)} · LCP ${Math.round(report.audits["largest-contentful-paint"].numericValue)}ms`;
  } catch (error) {
    return `lighthouse failed: ${(error as Error).message.slice(0, 80)}`;
  }
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await desktop.newPage();

  // 1. Landing sections
  await page.goto(BASE);
  await page.waitForTimeout(800);
  log("h1", (await page.locator("h1").textContent())?.replace(/\s+/g, " ").trim());
  for (const label of ["Introduction", "Kindscore so far"])
    log(`section: ${label}`, String(await page.locator(`section[aria-label="${label}"]`).count()));
  for (const id of [
    "how-heading",
    "impact-heading",
    "draw-heading",
    "jackpot-heading",
    "pricing-heading",
    "closing-heading",
  ])
    log(`heading #${id}`, (await page.locator(`#${id}`).textContent())?.trim());
  await page.screenshot({ path: `${OUT}/01-landing-desktop.png`, fullPage: true });

  // 2. Practice draw
  await page.locator("#draw").scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Pull a practice draw" }).click();
  await page.waitForTimeout(900);
  log(
    "practice numbers",
    (await page.locator('ol[aria-label="Practice draw numbers"] li').allTextContents()).join(" "),
  );
  log(
    "practice outcome",
    (await page.locator("#draw [aria-live]").textContent())?.trim().slice(0, 70),
  );
  await page.getByText("Weighted by scores", { exact: true }).click();
  await page.getByRole("button", { name: "Pull again" }).click();
  await page.waitForTimeout(900);
  log(
    "weighted numbers",
    (await page.locator('ol[aria-label="Practice draw numbers"] li').allTextContents()).join(" "),
  );
  await page.locator("#draw").screenshot({ path: `${OUT}/02-practice-draw.png` });

  // 3. Static pages, 404, demo panel
  await page.goto(`${BASE}/how-it-works`);
  log("how-it-works", (await page.locator("h1").textContent())?.trim());
  await page.screenshot({ path: `${OUT}/03-how-it-works.png`, fullPage: true });
  await page.goto(`${BASE}/pricing`);
  log("pricing", (await page.locator("h1").textContent())?.trim());
  await page.screenshot({ path: `${OUT}/04-pricing.png`, fullPage: true });
  const missing = await page.goto(`${BASE}/no-such-page`);
  log("404", `${missing?.status()} · ${(await page.locator("h1").textContent())?.trim()}`);
  await page.screenshot({ path: `${OUT}/05-not-found.png`, fullPage: true });
  await page.goto(`${BASE}/login?demo=1`);
  log("demo panel (flag off locally)", String(await page.getByText("Demo accounts").count()));
  const og = await page.request.get(`${BASE}/opengraph-image`);
  log("og image", `${og.status()} ${og.headers()["content-type"]}`);

  // 4. Phone: overflow, pill after hero, menu
  for (const width of [360, 390]) {
    const phone = await browser.newContext({
      viewport: { width, height: 800 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const mobile = await phone.newPage();
    await mobile.goto(BASE);
    await mobile.waitForTimeout(500);
    log(`${width}px overflow /`, String(await overflow(mobile)));
    log(
      `${width}px pill before scroll`,
      String(await mobile.getByRole("link", { name: /Subscribe · ₹499\/mo/ }).count()),
    );
    await mobile.evaluate(() => window.scrollTo(0, 1800));
    await mobile.waitForTimeout(500);
    log(`${width}px pill after scroll`, String((await mobile.locator("div.fixed a").count()) > 0));
    if (width === 390) {
      await mobile.screenshot({ path: `${OUT}/06-landing-mobile.png`, fullPage: true });
      await mobile.evaluate(() => window.scrollTo(0, 0));
      await mobile.getByRole("button", { name: "Open menu" }).click();
      log("mobile menu links", String(await mobile.locator('nav[aria-label="Menu"] a').count()));
      await mobile.screenshot({ path: `${OUT}/07-mobile-menu.png` });
      await mobile.keyboard.press("Escape");
      log(
        "menu closes on Escape",
        String((await mobile.locator('nav[aria-label="Menu"]').count()) === 0),
      );
    }
    for (const path of ["/how-it-works", "/pricing", "/charities", "/draws"]) {
      await mobile.goto(`${BASE}${path}`);
      log(`${width}px overflow ${path}`, String(await overflow(mobile)));
    }
    await phone.close();
  }

  // 5. Skip link + focus ring
  await page.goto(BASE);
  await page.keyboard.press("Tab");
  log(
    "first tab focuses",
    (await page.evaluate(() => document.activeElement?.textContent?.trim())) ?? "",
  );

  await browser.close();

  // 6. Lighthouse
  log("lighthouse desktop", await lighthouse("desktop"));
  log("lighthouse mobile", await lighthouse("mobile"));
  log("done", `screenshots in ${OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
