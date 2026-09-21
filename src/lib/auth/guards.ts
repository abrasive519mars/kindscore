import { AuthenticationError, ForbiddenError, SubscriptionRequiredError } from "@/engine/errors";
import { getAccess, type SignedInAccess } from "@/lib/auth/access";

/**
 * Guards for server actions and route handlers. Layouts decide what to *show*; these decide what
 * may *happen*. Every mutating action calls one of them first, so a hand-crafted request against
 * an action is refused before any repository is touched (and RLS refuses again after).
 */

export async function requireUser(): Promise<SignedInAccess> {
  const access = await getAccess();
  if (access.kind === "anonymous") throw new AuthenticationError();
  return access;
}

export async function requireAdmin(): Promise<SignedInAccess> {
  const access = await requireUser();
  if (access.kind !== "admin") throw new ForbiddenError();
  return access;
}

/** PRD §04: gameplay actions need an active subscription inside its paid period. Admins are exempt. */
export async function requireActiveSubscriber(): Promise<SignedInAccess> {
  const access = await requireUser();
  if (access.kind === "admin" || access.subscription.hasAccess) return access;
  throw new SubscriptionRequiredError();
}
