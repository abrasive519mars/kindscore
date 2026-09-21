/**
 * One-time Stripe (test mode) setup, safe to re-run:
 *   pnpm stripe:setup                      → finds or creates the two prices, prints STRIPE_PRICE_* lines
 *   pnpm stripe:setup --webhook https://x  → also creates the webhook endpoint for that origin, prints whsec_
 *
 * Reads STRIPE_SECRET_KEY from .env.local. Prices are looked up by `lookup_key`, so running twice
 * never duplicates a product; the price ids are printed for you to paste into .env.local / Vercel.
 */
import Stripe from "stripe";
import { config as loadEnv } from "dotenv";
import { BILLING, PLANS, type PlanInterval } from "../src/config/constants";

loadEnv({ path: ".env.local" });

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey?.startsWith("sk_test_")) {
  console.error("STRIPE_SECRET_KEY in .env.local must be a test-mode key (sk_test_…)");
  process.exit(1);
}
const stripe = new Stripe(secretKey);

async function findOrCreateProduct(): Promise<Stripe.Product> {
  const existing = await stripe.products.search({ query: `name:'${BILLING.PRODUCT_NAME}'` });
  if (existing.data[0]) return existing.data[0];
  return stripe.products.create({
    name: BILLING.PRODUCT_NAME,
    description: "Monthly charity draw entry. Part of every fee goes to the charity you choose.",
  });
}

async function findOrCreatePrice(
  product: Stripe.Product,
  interval: PlanInterval,
): Promise<Stripe.Price> {
  const plan = PLANS[interval];
  const existing = await stripe.prices.list({ lookup_keys: [plan.lookupKey], active: true });
  if (existing.data[0]) return existing.data[0];
  return stripe.prices.create({
    product: product.id,
    currency: BILLING.CURRENCY,
    unit_amount: plan.pricePaise,
    recurring: { interval },
    lookup_key: plan.lookupKey,
    nickname: `Kindscore ${plan.label}`,
  });
}

async function findOrCreateWebhook(origin: string): Promise<Stripe.WebhookEndpoint> {
  const url = new URL("/api/stripe/webhook", origin).toString();
  const existing = await stripe.webhookEndpoints.list({ limit: 100 });
  const match = existing.data.find((endpoint) => endpoint.url === url);
  if (match) return match;
  return stripe.webhookEndpoints.create({
    url,
    enabled_events: [...BILLING.WEBHOOK_EVENTS],
    description: "Kindscore subscription sync",
  });
}

async function main() {
  const product = await findOrCreateProduct();
  const monthly = await findOrCreatePrice(product, "month");
  const yearly = await findOrCreatePrice(product, "year");

  console.log(`\nProduct: ${product.name} (${product.id})`);
  console.log("Add to .env.local (and later to Vercel):\n");
  console.log(`STRIPE_PRICE_MONTHLY=${monthly.id}`);
  console.log(`STRIPE_PRICE_YEARLY=${yearly.id}`);

  const webhookFlag = process.argv.indexOf("--webhook");
  const origin = webhookFlag === -1 ? undefined : process.argv[webhookFlag + 1];
  if (!origin) return;

  const endpoint = await findOrCreateWebhook(origin);
  console.log(`\nWebhook: ${endpoint.url} (${endpoint.id})`);
  // Stripe reveals the signing secret only on creation; an existing endpoint shows it in the dashboard.
  console.log(
    endpoint.secret
      ? `STRIPE_WEBHOOK_SECRET=${endpoint.secret}`
      : "STRIPE_WEBHOOK_SECRET=<already created — copy from Dashboard → Developers → Webhooks>",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
