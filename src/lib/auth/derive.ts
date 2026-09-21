import { hasActiveAccess, type SubscriptionStatus } from "@/engine/subscription/status";
import type { Database } from "@/types/database.types";

/**
 * The pure half of access resolution: given what the database returned, decide what the caller
 * may do. No I/O, no framework imports — unit-tested without a database or env.
 */
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type SubscriptionRow = Database["public"]["Tables"]["subscriptions"]["Row"];

export interface SubscriptionState {
  /** `none` when the member has never subscribed. */
  readonly status: SubscriptionStatus | "none";
  readonly interval: SubscriptionRow["plan_interval"] | null;
  readonly currentPeriodEnd: string | null;
  readonly cancelAtPeriodEnd: boolean;
  /** The §04 gate: active AND inside the paid period. */
  readonly hasAccess: boolean;
}

export type Access =
  | { readonly kind: "anonymous" }
  | { readonly kind: "member" | "admin"; readonly userId: string; readonly profile: ProfileRow; readonly subscription: SubscriptionState };

export type SignedInAccess = Extract<Access, { kind: "member" | "admin" }>;

const NO_SUBSCRIPTION: SubscriptionState = {
  status: "none",
  interval: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  hasAccess: false,
};

/** Pure: given what the DB returned, decide the access state. Unit-tested without a database. */
export function deriveAccess(
  userId: string | null,
  profile: ProfileRow | null,
  subscription: SubscriptionRow | null,
  now: Date,
): Access {
  if (!userId || !profile) return { kind: "anonymous" };
  const state = subscription ? toSubscriptionState(subscription, now) : NO_SUBSCRIPTION;
  return { kind: profile.role === "admin" ? "admin" : "member", userId, profile, subscription: state };
}

function toSubscriptionState(row: SubscriptionRow, now: Date): SubscriptionState {
  return {
    status: row.status,
    interval: row.plan_interval,
    currentPeriodEnd: row.current_period_end,
    cancelAtPeriodEnd: row.cancel_at_period_end,
    hasAccess: hasActiveAccess({ status: row.status, currentPeriodEnd: row.current_period_end }, now),
  };
}

