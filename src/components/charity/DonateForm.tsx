"use client";

import { useActionState, useState } from "react";
import { DONATION } from "@/config/constants";
import { formatInr } from "@/engine/money/paise";
import { startDonation } from "@/app/(marketing)/charities/actions";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

interface DonateFormProps {
  readonly charityId: string;
  readonly charityName: string;
  /** Where Stripe brings the member back (app-relative, without query). */
  readonly returnTo: string;
}

const RUPEE = 100;

/**
 * PRD §08.1 one-off donation: presets or a custom amount, then Stripe Checkout. Not tied to the
 * game — no subscription needed, only an account so the ledger knows who gave.
 */
export function DonateForm({ charityId, charityName, returnTo }: DonateFormProps) {
  const [state, action, pending] = useActionState(startDonation, null);
  const [rupees, setRupees] = useState<string>(String(DONATION.PRESET_PAISE[1] / RUPEE));
  const error = state && !state.ok ? state.error.message : null;

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="charityId" value={charityId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <div className="flex flex-wrap gap-2" role="group" aria-label="Amount">
        {DONATION.PRESET_PAISE.map((paise) => {
          const value = String(paise / RUPEE);
          return (
            <button
              key={paise}
              type="button"
              onClick={() => setRupees(value)}
              className={cn(
                "num rounded-full border px-4 py-2 text-sm transition-colors",
                rupees === value ? "border-ink bg-ink text-bg" : "border-line hover:bg-surface-2",
              )}
            >
              {formatInr(paise)}
            </button>
          );
        })}
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Or any amount (₹)</span>
        <input
          name="rupees"
          type="number"
          inputMode="numeric"
          min={DONATION.MIN_PAISE / RUPEE}
          max={DONATION.MAX_PAISE / RUPEE}
          step={1}
          value={rupees}
          onChange={(event) => setRupees(event.target.value)}
          className="num h-11 w-40 rounded-md border border-line bg-surface px-3 text-[16px] focus:border-saffron focus:outline-none"
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="saffron" pending={pending}>
          Donate {rupees ? formatInr(Math.round(Number(rupees) * RUPEE) || 0) : ""} to {charityName}
        </Button>
        <span className="text-sm text-ink-2">100% goes to the charity. Paid through Stripe.</span>
      </div>
    </form>
  );
}
