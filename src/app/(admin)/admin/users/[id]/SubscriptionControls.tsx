"use client";

import { useActionState } from "react";
import { endMemberSubscription, grantMemberSubscription } from "@/app/(admin)/admin/users/actions";
import type { MemberSubscription } from "@/repositories/interfaces/AdminUserRepository";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/primitives";

interface SubscriptionControlsProps {
  readonly userId: string;
  readonly subscription: MemberSubscription | null;
}

function formatDay(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

/**
 * PRD §11.01 "manage subscriptions". Grant never touches Stripe (source = admin); End lapses
 * the mirror at once — the member's next request is restricted (§04 real-time check).
 */
export function SubscriptionControls({ userId, subscription }: SubscriptionControlsProps) {
  const [grantState, grant, granting] = useActionState(grantMemberSubscription, null);
  const [endState, end, ending] = useActionState(endMemberSubscription, null);
  const error = [grantState, endState].find((s) => s && !s.ok);
  const live = subscription?.hasAccess === true;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {subscription ? (
          <>
            <Badge tone={live ? "success" : "warn"}>
              {live ? "Active" : subscription.status.replace("_", " ")}
            </Badge>
            <span className="text-ink-2">
              {subscription.interval === "year" ? "Yearly" : "Monthly"} ·{" "}
              {live ? "renews" : "ended"} {formatDay(subscription.currentPeriodEnd)} · via{" "}
              {subscription.source}
            </span>
            {subscription.source === "admin" && <Badge tone="pool">admin-granted</Badge>}
          </>
        ) : (
          <Badge tone="neutral">Never subscribed</Badge>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <form action={grant}>
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="interval" value="month" />
          <Button type="submit" size="sm" pending={granting}>
            {live ? "Extend one month" : "Grant one month"}
          </Button>
        </form>
        <form action={grant}>
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="interval" value="year" />
          <Button type="submit" size="sm" variant="ghost" pending={granting}>
            {live ? "Extend one year" : "Grant one year"}
          </Button>
        </form>
        {live && (
          <form action={end}>
            <input type="hidden" name="userId" value={userId} />
            <Button type="submit" size="sm" variant="danger" pending={ending}>
              End now
            </Button>
          </form>
        )}
      </div>
      <p className="text-xs text-ink-2">
        Grants are for support and demos — nothing is charged and Stripe is not involved. Ending
        takes effect on the member&apos;s next request.
        {subscription?.source === "stripe" &&
          live &&
          " This one is billed by Stripe: ending it here stops access, but cancel it in Stripe too to stop the billing."}
      </p>
      {error && !error.ok && (
        <p role="alert" className="text-sm text-danger">
          {error.error.message}
        </p>
      )}
    </div>
  );
}
