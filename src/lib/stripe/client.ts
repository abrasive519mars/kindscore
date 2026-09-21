import "server-only";

import Stripe from "stripe";
import { serverEnv } from "@/config/env";

let cached: Stripe | undefined;

/**
 * One Stripe SDK instance per server process. The SDK's own pinned API version is used, so the
 * TypeScript types and the wire format always agree (see lib/stripe/snapshots.ts for the fields
 * that moved in the 2025+ API versions).
 */
export function getStripe(): Stripe {
  cached ??= new Stripe(serverEnv().STRIPE_SECRET_KEY, {
    appInfo: { name: "Kindscore", url: "https://kindscore.app" },
  });
  return cached;
}
