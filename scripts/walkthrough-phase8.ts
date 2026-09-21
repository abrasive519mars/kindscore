/**
 * Drives the charity side in a real browser against the running app + local Supabase and saves
 * screenshots. Not a test suite — a repeatable manual check with evidence.
 *   pnpm build && pnpm start -p 3000   then   pnpm tsx scripts/walkthrough-phase8.ts
 *
 * Visitor: directory → search → filter → profile. Member: raise share, change charity, donate ₹250
 * on real Stripe Checkout (test mode) → ledger. Admin: new charity with cover + event → spotlight → hide.
 */
import { chromium, type Page } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdir } from "node:fs/promises";
import { config as loadEnv } from "dotenv";
import sharp from "sharp";

loadEnv({ path: ".env.test" });

const BASE = process.env.WALKTHROUGH_BASE ?? "http://localhost:3000";
const OUT = process.env.WALKTHROUGH_OUT ?? "docs/screenshots/phase-8";
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

async function createUser(role: "member" | "admin") {
  const email = `walk8-${role}-${RUN}@kindscore.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: role === "admin" ? "Admin Eight" : "Giver Eight",
      charity_id: CHARITY_SAHAJ,
      charity_bps: 1000,
    },
  });
  if (error || !data.user) throw error ?? new Error("no user");
  if (role === "admin")
    await admin.from("profiles").update({ role: "admin" }).eq("id", data.user.id);
  return { id: data.user.id, email };
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

async function payOnStripe(page: Page) {
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30_000 });
  await page.fill("#cardNumber", "4242 4242 4242 4242");
  await page.fill("#cardExpiry", "12 / 34");
  await page.fill("#cardCvc", "123");
  await page.fill("#billingName", "Giver Eight");
  await page.selectOption("#billingCountry", "IN");
  await page.getByText("Enter address manually").click();
  await page.fill("#billingAddressLine1", "5 Jubilee Hills");
  await page.fill("#billingLocality", "Hyderabad");
  await page.fill("#billingPostalCode", "500033");
  await page.selectOption("#billingAdministrativeArea", { label: "Telangana" });
  await shot(page, "07-stripe-donation-checkout");
  await page.locator("button[type=submit]").first().click();
}

async function coverImage(): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900"><rect width="100%" height="100%" fill="#d9791a"/><circle cx="600" cy="450" r="260" fill="#f7f3ec"/><text x="600" y="470" text-anchor="middle" font-family="serif" font-size="72" fill="#171411">Walkthrough Trust</text></svg>`;
  return sharp(Buffer.from(svg)).webp().toBuffer();
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const adminUser = await createUser("admin");
  const member = await createUser("member");
  const browser = await chromium.launch();
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await desktop.newPage();

  // 1. Visitor: directory, search, filter, profile
  await page.goto(`${BASE}/charities`);
  log("directory cards", String(await page.locator('ul[aria-label="Charities"] li').count()));
  await shot(page, "01-directory");
  await page.fill('input[name="q"]', "water");
  await page.getByRole("button", { name: "Search" }).click();
  await page.waitForURL(/q=water/);
  log(
    "search 'water'",
    (await page.locator('ul[aria-label="Charities"] h3').allTextContents()).join(" | "),
  );
  await page.goto(`${BASE}/charities?category=Health`);
  log(
    "filter Health",
    (await page.locator('ul[aria-label="Charities"] h3').allTextContents()).join(" | "),
  );
  await shot(page, "02-directory-filtered");
  await page.goto(`${BASE}/charities/neer-jal`);
  log("profile h1", (await page.locator("h1").textContent())?.trim());
  log(
    "visitor CTA",
    (await page.getByRole("button", { name: /Subscribe and support/ }).textContent())?.trim(),
  );
  await shot(page, "03-profile-visitor");

  // 2. Member: raise share, change charity, choose from a profile
  await login(page, member.email);
  await page.goto(`${BASE}/app/charity`);
  await shot(page, "04-member-charity");
  await page.locator('input[name="charityBps"]').fill("2500");
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByText("Saved. Applies from your next payment.").waitFor();
  const { data: p1 } = await admin
    .from("profiles")
    .select("charity_bps")
    .eq("id", member.id)
    .single();
  log("share raised", `${p1!.charity_bps} bps`);
  await page.goto(`${BASE}/charities/neer-jal`);
  await page.getByRole("button", { name: /Choose Neer as my charity/ }).click();
  await page.getByText("Your charity", { exact: true }).waitFor();
  const { data: p2 } = await admin
    .from("profiles")
    .select("charity_id, charity_bps")
    .eq("id", member.id)
    .single();
  log("charity changed", `${p2!.charity_id.slice(-2)} · ${p2!.charity_bps} bps kept`);
  await shot(page, "05-profile-member-chosen");

  // 3. Member donates ₹250 on real Stripe test Checkout → back → ledger
  await page.fill('input[name="rupees"]', "250");
  await shot(page, "06-donate-form");
  await page.getByRole("button", { name: /Donate/ }).click();
  await payOnStripe(page);
  await page.waitForURL(`${BASE}/charities/neer-jal?donated=1`, { timeout: 90_000 });
  log("after donation", (await page.getByText(/Thank you/).textContent())?.trim().slice(0, 60));
  await shot(page, "08-profile-donated");
  const { data: donation } = await admin
    .from("donations")
    .select("amount_paise, paid")
    .eq("user_id", member.id)
    .single();
  const { data: ledger } = await admin
    .from("charity_contributions")
    .select("source, amount_paise")
    .eq("user_id", member.id);
  log("donation row", JSON.stringify(donation));
  log("ledger", JSON.stringify(ledger));
  await page.goto(`${BASE}/app/charity`);
  log(
    "member given so far",
    (await page.getByText("Given so far").locator("..").textContent())
      ?.replace(/\s+/g, " ")
      .trim()
      .slice(0, 40),
  );
  await shot(page, "09-member-charity-after");
  await logout(page);

  // 4. Admin: new charity with cover + event → spotlight → hide
  await login(page, adminUser.email);
  await page.goto(`${BASE}/admin/charities`);
  await shot(page, "10-admin-charities");
  await page.goto(`${BASE}/admin/charities/new`);
  await page.fill("#name", `Walkthrough Trust ${RUN}`);
  await page.fill("#category", "Education");
  await page.fill("#city", "Hyderabad");
  await page.fill("#tagline", "Books for every child.");
  await page.fill("#outcomeLine", "₹50 a month = ten library books");
  await page.fill(
    'textarea[name="description"]',
    "A small library trust.\n\nRun by volunteers since 2020.",
  );
  await page.getByRole("button", { name: "Create charity" }).click();
  await page.waitForURL(/\/admin\/charities\/[0-9a-f-]+$/);
  const charityId = page.url().split("/").pop()!;
  log("created", charityId.slice(0, 8));
  await page.setInputFiles('form:has(input[value="cover"]) input[type="file"]', {
    name: "cover.webp",
    mimeType: "image/webp",
    buffer: await coverImage(),
  });
  await page.getByRole("button", { name: "Upload cover" }).click();
  await page.getByRole("button", { name: "Replace cover" }).waitFor();
  log("cover uploaded", "yes");
  await page.fill("#event-title", "Library open day");
  await page.fill("#event-startsAt", "2027-01-10T10:00");
  await page.fill("#event-location", "Banjara Hills");
  await page.getByRole("button", { name: "Add event" }).click();
  await page.getByText("Added.").waitFor();
  log("event added", "yes");
  await shot(page, "11-admin-charity-edit");
  await page.getByRole("button", { name: "Make this the homepage spotlight" }).click();
  await page.getByRole("button", { name: "This is the spotlight" }).waitFor();
  log("spotlight", "set");
  await page.goto(`${BASE}/charities`);
  log(
    "spotlight on directory",
    (await page.locator('section[aria-label="Charity spotlight"] h2').textContent())?.trim(),
  );
  await shot(page, "12-directory-new-spotlight");
  await page.goto(`${BASE}/admin/charities/${charityId}`);
  await page.getByRole("button", { name: "Hide from directory" }).click();
  await page.getByRole("button", { name: "List again" }).waitFor();
  log(
    "hidden",
    (await page.locator("[role=status]", { hasText: "Hidden." }).textContent())
      ?.trim()
      .slice(0, 70),
  );
  await shot(page, "13-admin-hidden");
  await page.goto(`${BASE}/charities`);
  log("hidden from directory", String(!(await page.getByText(`Walkthrough Trust ${RUN}`).count())));
  // restore the seed spotlight
  await admin.from("charities").update({ featured_rank: null }).eq("id", charityId);
  await admin.from("charities").update({ featured_rank: 1 }).eq("slug", "udaan-girls-sports");

  // 5. Phone
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const mobile = await phone.newPage();
  await mobile.goto(`${BASE}/charities/neer-jal`);
  await mobile.screenshot({ path: `${OUT}/14-profile-mobile.png`, fullPage: true });
  const overflow = await mobile.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  log("390px horizontal overflow", String(overflow));

  // cleanup (the Stripe test payment stays in the sandbox as evidence)
  const { data: files } = await admin.storage.from("charity-media").list(charityId);
  if (files?.length)
    await admin.storage.from("charity-media").remove(files.map((f) => `${charityId}/${f.name}`));
  await admin.from("charities").delete().eq("id", charityId);
  for (const u of [adminUser, member]) await admin.auth.admin.deleteUser(u.id);
  await browser.close();
  log("done", `screenshots in ${OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
