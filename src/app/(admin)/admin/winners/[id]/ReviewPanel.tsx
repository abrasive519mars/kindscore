"use client";

import { useActionState, useState } from "react";
import type { PayoutStatus, ReviewStatus } from "@/engine/verification/stateMachine";
import { recordManualPayout, reviewClaim } from "@/app/(admin)/admin/winners/actions";
import type { ActionResult } from "@/lib/errors/action-result";
import { REVIEW_NOTE_MAX } from "@/services/WinnerService";
import { Button } from "@/components/ui/Button";

interface ReviewPanelProps {
  readonly verificationId: string;
  readonly review: ReviewStatus;
  readonly payout: PayoutStatus;
  /** "Paid · ₹… credited … · Stripe ref …" once the member has claimed. */
  readonly payoutLine: string;
}

/**
 * Only the legal moves are offered (PRD §09): Approve / Reject while submitted. The payout is the
 * member's own move, so once approved there is nothing left for the admin but to read the record.
 * Reject reveals a reason field inline — the member reads it verbatim.
 */
export function ReviewPanel({ verificationId, review, payout, payoutLine }: ReviewPanelProps) {
  const [reviewState, reviewAction, reviewing] = useActionState(reviewClaim, null);
  const [payoutState, payoutAction, recording] = useActionState(recordManualPayout, null);
  const [rejecting, setRejecting] = useState(false);
  const error = [reviewState, payoutState].find((s) => s && !s.ok) ?? null;

  if (review === "submitted") {
    return (
      <form action={reviewAction} className="flex flex-col gap-3 border-t border-line pt-4">
        <input type="hidden" name="verificationId" value={verificationId} />
        {rejecting && (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Why? The member will see this.</span>
            <textarea
              name="note"
              maxLength={REVIEW_NOTE_MAX}
              rows={2}
              required
              className="rounded-md border border-line bg-surface px-3 py-2 text-sm focus:border-saffron focus:outline-none"
              placeholder="e.g. The screenshot doesn't show the dates of the rounds."
            />
          </label>
        )}
        <div className="flex flex-wrap gap-3">
          {rejecting ? (
            <>
              <Button
                type="submit"
                name="decision"
                value="reject"
                variant="danger"
                pending={reviewing}
              >
                Confirm rejection
              </Button>
              <Button type="button" variant="ghost" onClick={() => setRejecting(false)}>
                Back
              </Button>
            </>
          ) : (
            <>
              <Button
                type="submit"
                name="decision"
                value="approve"
                variant="saffron"
                pending={reviewing}
              >
                Approve
              </Button>
              <Button type="button" variant="danger" onClick={() => setRejecting(true)}>
                Reject…
              </Button>
            </>
          )}
        </div>
        <ActionError error={error} />
      </form>
    );
  }

  if (review === "approved" && payout === "pending") {
    return (
      <div className="flex flex-col gap-3 border-t border-line pt-4 text-sm text-ink-2">
        <p>
          Approved. The member claims the payout from their Winnings page — it is credited to their
          subscription through Stripe and recorded here.
        </p>
        <details className="rounded-md border border-line p-3">
          <summary className="cursor-pointer font-medium text-ink">
            Paid outside Stripe? Record it
          </summary>
          <form action={payoutAction} className="mt-3 flex flex-wrap items-end gap-3">
            <input type="hidden" name="verificationId" value={verificationId} />
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink">Payment reference (UTR)</span>
              <input
                name="reference"
                required
                maxLength={REVIEW_NOTE_MAX}
                className="h-10 rounded-md border border-line bg-surface px-3 text-sm text-ink focus:border-ink focus:outline-none"
                placeholder="e.g. UTR 427118"
              />
            </label>
            <Button type="submit" size="sm" pending={recording}>
              Record as paid
            </Button>
          </form>
          <ActionError error={error} />
        </details>
      </div>
    );
  }

  return (
    <p className="border-t border-line pt-4 text-sm text-ink-2">
      {payout === "paid"
        ? payoutLine
        : review === "rejected"
          ? "Rejected. The member may upload once more if they haven't already."
          : "Waiting for the member's screenshot."}
    </p>
  );
}

function ActionError({ error }: { error: ActionResult | null | undefined }) {
  if (!error || error.ok) return null;
  return (
    <p role="alert" className="text-sm text-danger">
      {error.error.message}
    </p>
  );
}
