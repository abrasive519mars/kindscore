/**
 * Drives a real Stripe (test mode) subscription in a browser against the running app + local
 * Supabase and saves screenshots. Not a test suite — a repeatable manual check with evidence.
 *   pnpm build && pnpm start -p 3000   then   pnpm tsx scripts/walkthrough-phase5.ts
 * NEXT_PUBLIC_APP_URL in .env.local must match the port (Stripe redirects back to it).
 * No webhook is needed locally: the success page syncs the subscription and first invoice itself.
 */
import { chromium, type Page } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdir } from "node:fs/promises";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.test" });

const BASE = process.env.WALKTHROUGH_BASE ?? "http://localhost:3000";
const OUT = process.env.WALKTHROUGH_OUT ?? "docs/evidence/phase-5";
const email = `walk5-${Date.now()}@kindscore.test`;
const password = "Kindscore!2026";
const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const TEST_CARD = { number: "4242 4242 4242 4242", expiry: "12 / 34", cvc: "123" };

function log(step: string, detail = "") {
  console.log(`${step.padEnd(44)} ${detail}`);
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
}

/** Stripe's hosted Checkout: card, name, and a manually entered Indian billing address. */
async function payOnStripeCheckout(page: Page) {
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30_000 });
  await page.fill("#cardNumber", TEST_CARD.number);
  await page.fill("#cardExpiry", TEST_CARD.expiry);
  await page.fill("#cardCvc", TEST_CARD.cvc);
  await page.fill("#billingName", "Walkthrough Member");
  await page.selectOption("#billingCountry", "IN");
  await page.getByText("Enter address manually").click();
  await page.fill("#billingAddressLine1", "12 Banjara Hills");
  await page.fill("#billingLocality", "Hyderabad");
  await page.fill("#billingPostalCode", "500034");
  await page.selectOption("#billingAdministrativeArea", { label: "Telangana" });
  await shot(page, "02-stripe-checkout");
  await page.locator("button[type=submit]").first().click();
}

async function subscriptionRow(userId: string) {
  const { data } = await admin
    .from("subscriptions")
    .select("status, plan_interval, cancel_at_period_end, current_period_end, source")
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await desktop.newPage();

  // 1. Sign up → subscription page shows "Not subscribed" and two plans
  await page.goto(`${BASE}/signup`);
  await page.fill("#fullName", "Walkthrough Member");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.selectOption("#charityId", { label: "Udaan Girls' Sports Collective · featured" });
  await page.locator('input[name="charityBps"]').fill("1500");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(`${BASE}/app`);
  await page.goto(`${BASE}/app/subscription`);
  log(
    "status before",
    (await page.getByText("Not subscribed", { exact: true }).textContent())?.trim(),
  );
  await shot(page, "01-subscription-plans");

  // 2. Abandon checkout → "No charge was made."
  await page.getByRole("button", { name: /Subscribe monthly/ }).click();
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30_000 });
  await page.goto(`${BASE}/app/subscription?canceled=1`);
  log("abandoned checkout", (await page.getByText("No charge was made").textContent())?.trim());

  // 3. Pay for real (test mode) → back with session_id → synced → activated banner
  await page.getByRole("button", { name: /Subscribe monthly/ }).click();
  await payOnStripeCheckout(page);
  await page.waitForURL(`${BASE}/app/subscription?activated=1`, { timeout: 90_000 });
  log("after payment", (await page.getByText("Payment received").textContent())?.trim());
  log("status after", (await page.getByText(/Renews .* · monthly/).textContent())?.trim());
  await shot(page, "03-subscription-active");

  // 4. Database mirror + first payment split (written by the success-page sync, no webhook needed)
  const { data: user } = await admin
    .from("profiles")
    .select("id, stripe_customer_id")
    .eq("email", email)
    .single();
  log("subscription row", JSON.stringify(await subscriptionRow(user!.id)));
  log("stripe customer stored", String(Boolean(user!.stripe_customer_id)));
  const { data: payment } = await admin
    .from("payments")
    .select("amount_paise, charity_bps, charity_paise, pool_paise, platform_paise")
    .eq("user_id", user!.id)
    .maybeSingle();
  log("payment row", JSON.stringify(payment));
  const { data: ledger } = await admin
    .from("charity_contributions")
    .select("amount_paise")
    .eq("user_id", user!.id);
  log("ledger", JSON.stringify(ledger));

  // 5. Dashboard shows Active + renewal date; scores page is unlocked
  await page.goto(`${BASE}/app`);
  log(
    "dashboard status",
    (
      await page
        .getByText(/Renews /)
        .first()
        .textContent()
    )?.trim(),
  );
  await shot(page, "04-dashboard-active");
  await page.goto(`${BASE}/app/scores`);
  log("scores unlocked", String(await page.getByRole("button", { name: "Add round" }).isVisible()));

  // 6. Cancel at period end → banner "won't renew" → Resume
  await page.goto(`${BASE}/app/subscription`);
  await page.getByRole("button", { name: /Cancel · stays active until/ }).click();
  await page
    .getByText(/won't renew/)
    .first()
    .waitFor();
  log("after cancel", (await page.getByText(/Ends .* · won't renew/).textContent())?.trim());
  log("db cancel flag", String((await subscriptionRow(user!.id))?.cancel_at_period_end));
  await shot(page, "05-subscription-cancelled");
  await page.getByRole("button", { name: /Resume/ }).click();
  await page.getByText(/Renews .* · monthly/).waitFor();
  log("after resume", (await page.getByText(/Renews .* · monthly/).textContent())?.trim());

  // 7. Billing portal opens on Stripe
  await page.getByRole("button", { name: "Update payment method" }).click();
  await page.waitForURL(/billing\.stripe\.com/, { timeout: 30_000 });
  log("portal", page.url().split("/session")[0]);
  await shot(page, "06-stripe-portal");

  // 8. Phone viewport
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  await phone.addCookies(await desktop.cookies());
  const mobile = await phone.newPage();
  await mobile.goto(`${BASE}/app/subscription`);
  await mobile.screenshot({ path: `${OUT}/07-subscription-mobile.png`, fullPage: true });
  const overflow = await mobile.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  log("390px horizontal overflow", String(overflow));

  // cleanup (the Stripe test customer/subscription stay in the sandbox as evidence)
  await admin.auth.admin.deleteUser(user!.id);
  await browser.close();
  log("done", `screenshots in ${OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
