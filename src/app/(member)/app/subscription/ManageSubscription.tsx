"use client";

import { useActionState } from "react";
import {
  cancelSubscription,
  openBillingPortal,
  resumeSubscription,
} from "@/app/(member)/app/subscription/actions";
import { Button } from "@/components/ui/Button";

interface ManageSubscriptionProps {
  readonly cancelAtPeriodEnd: boolean;
  readonly periodEndLabel: string;
}

/**
 * The three things an active member can do: stop renewing, change their mind, or fix their card.
 * Cancel is two-step in copy, not in clicks — the button says exactly what will happen.
 */
export function ManageSubscription({ cancelAtPeriodEnd, periodEndLabel }: ManageSubscriptionProps) {
  const [cancelState, cancel, cancelling] = useActionState(cancelSubscription, null);
  const [resumeState, resume, resuming] = useActionState(resumeSubscription, null);
  const [portalState, portal, opening] = useActionState(openBillingPortal, null);
  const error = [cancelState, resumeState, portalState].find((s) => s && !s.ok);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        {cancelAtPeriodEnd ? (
          <form action={resume}>
            <Button type="submit" size="sm" pending={resuming}>
              Resume · keep renewing
            </Button>
          </form>
        ) : (
          <form action={cancel}>
            <Button type="submit" size="sm" variant="danger" pending={cancelling}>
              Cancel · stays active until {periodEndLabel}
            </Button>
          </form>
        )}
        <form action={portal}>
          <Button type="submit" size="sm" variant="ghost" pending={opening}>
            Update payment method
          </Button>
        </form>
      </div>
      {error && !error.ok && (
        <p role="alert" className="text-sm text-danger">
          {error.error.message}
        </p>
      )}
    </div>
  );
}
