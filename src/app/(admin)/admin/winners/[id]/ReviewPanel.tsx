"use client";

import { useActionState, useState } from "react";
import type { PayoutStatus, ReviewStatus } from "@/engine/verification/stateMachine";
import { markClaimPaid, reviewClaim } from "@/app/(admin)/admin/winners/actions";
import type { ActionResult } from "@/lib/errors/action-result";
import { REVIEW_NOTE_MAX } from "@/services/WinnerService";
import { Button } from "@/components/ui/Button";

interface ReviewPanelProps {
  readonly verificationId: string;
  readonly review: ReviewStatus;
  readonly payout: PayoutStatus;
}

/**
 * Only the legal moves are offered (PRD §09): Approve / Reject while submitted, Mark paid once
 * approved, nothing once paid. Reject reveals a reason field inline — the member reads it verbatim.
 */
export function ReviewPanel({ verificationId, review, payout }: ReviewPanelProps) {
  const [reviewState, reviewAction, reviewing] = useActionState(reviewClaim, null);
  const [paidState, paidAction, paying] = useActionState(markClaimPaid, null);
  const [rejecting, setRejecting] = useState(false);
  const error = [reviewState, paidState].find((s) => s && !s.ok);

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
              <Button type="submit" name="decision" value="reject" variant="danger" pending={reviewing}>
                Confirm rejection
              </Button>
              <Button type="button" variant="ghost" onClick={() => setRejecting(false)}>
                Back
              </Button>
            </>
          ) : (
            <>
              <Button type="submit" name="decision" value="approve" variant="saffron" pending={reviewing}>
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
      <form action={paidAction} className="flex flex-col gap-3 border-t border-line pt-4">
        <input type="hidden" name="verificationId" value={verificationId} />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="saffron" pending={paying}>
            Mark as paid
          </Button>
          <span className="text-sm text-ink-2">Once the transfer has been sent. This can&apos;t be undone.</span>
        </div>
        <ActionError error={error} />
      </form>
    );
  }

  return (
    <p className="border-t border-line pt-4 text-sm text-ink-2">
      {payout === "paid" ? "Paid. Nothing more to do." : review === "rejected" ? "Rejected. The member may upload once more if they haven't already." : "Waiting for the member's screenshot."}
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
