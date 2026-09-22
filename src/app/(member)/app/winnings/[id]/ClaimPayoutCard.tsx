"use client";

import { useActionState, useState } from "react";
import { PLANS } from "@/config/constants";
import { formatInr } from "@/engine/money/paise";
import { describeCredit } from "@/engine/prizes/credit";
import { claimPayout } from "@/app/(member)/app/winnings/actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/primitives";

interface ClaimPayoutCardProps {
  readonly verificationId: string;
  readonly prizePaise: number;
}

/**
 * The winner's last step (PRD §09): one button, one confirmation, then Stripe credits the prize to
 * their account and the win is paid. Nothing external opens — the provider works behind the form.
 */
export function ClaimPayoutCard({ verificationId, prizePaise }: ClaimPayoutCardProps) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState(claimPayout, null);
  const error = state && !state.ok ? state.error.message : null;
  const worth = describeCredit(prizePaise, PLANS.month.pricePaise);

  return (
    <Card className="flex flex-col gap-4 border-saffron/60">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-2xl">Your prize is ready</h2>
        <span className="num font-display text-3xl text-saffron">{formatInr(prizePaise)}</span>
      </div>
      <p className="text-sm text-ink-2">
        Claim it as credit on your Kindscore account — {worth} at{" "}
        {formatInr(PLANS.month.pricePaise)}/month. Stripe applies it to your next renewals
        automatically and it shows on your invoices.
      </p>
      <form action={action} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="verificationId" value={verificationId} />
        {confirming ? (
          <>
            <Button type="submit" variant="saffron" pending={pending}>
              Confirm claim
            </Button>
            <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
              Back
            </Button>
            <span className="text-sm text-ink-2">
              Credits {formatInr(prizePaise)} now. This can&apos;t be reversed.
            </span>
          </>
        ) : (
          <Button type="button" variant="saffron" onClick={() => setConfirming(true)}>
            Claim as subscription credit
          </Button>
        )}
      </form>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </Card>
  );
}
