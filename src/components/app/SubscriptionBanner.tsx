import Link from "next/link";
import type { SubscriptionState } from "@/lib/auth/access";
import { Banner } from "@/components/ui/primitives";

function formatDay(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

/** The §04 lifecycle states, in one line each (copy from QA.md §2). Nothing for a healthy active member. */
export function SubscriptionBanner({ subscription }: { subscription: SubscriptionState }) {
  const { status, currentPeriodEnd, cancelAtPeriodEnd } = subscription;
  const link = (
    <Link href="/app/subscription" className="font-medium underline underline-offset-4">
      Subscription
    </Link>
  );

  if (status === "active" && cancelAtPeriodEnd && currentPeriodEnd) {
    return (
      <Banner tone="warn">
        Active until {formatDay(currentPeriodEnd)} · won&apos;t renew. {link}
      </Banner>
    );
  }
  if (status === "past_due") {
    return (
      <Banner tone="danger">
        Your last payment didn&apos;t go through. Update your card to stay in the draw. {link}
      </Banner>
    );
  }
  if (status === "lapsed" || status === "cancelled") {
    return (
      <Banner tone="warn">
        Your subscription has {status === "lapsed" ? "lapsed" : "ended"}. Your scores are safe —
        renew to enter the next draw. {link}
      </Banner>
    );
  }
  if (status === "none") {
    return (
      <Banner tone="saffron">
        You&apos;re not subscribed yet. Subscribe to log scores and enter the monthly draw. {link}
      </Banner>
    );
  }
  return null;
}
