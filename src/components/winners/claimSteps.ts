import type { WinningRecord } from "@/repositories/interfaces/WinnerRepository";
import type { Step } from "@/components/ui/Stepper";

function stamp(iso: string | null): string | undefined {
  if (!iso) return undefined;
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(new Date(iso));
}

/**
 * The winner state machine as stepper steps: Awaiting proof → Submitted → Approved → Paid, with a
 * rejection shown in place of "Approved". Pure, shared by the member and admin pages.
 */
export function claimSteps(record: WinningRecord): Step[] {
  const { review, payout } = record;
  const submitted = review !== "awaiting_proof";
  const approved = review === "approved";
  const rejected = review === "rejected";
  return [
    { label: "Awaiting proof", state: submitted ? "done" : "current", caption: stamp(record.createdAt) },
    { label: "Submitted", state: submitted ? (review === "submitted" ? "current" : "done") : "future" },
    rejected
      ? { label: "Rejected", state: "failed", caption: stamp(record.reviewedAt) }
      : { label: "Approved", state: approved ? (payout === "paid" ? "done" : "current") : "future", caption: approved ? stamp(record.reviewedAt) : undefined },
    { label: "Paid", state: payout === "paid" ? "done" : "future", caption: stamp(record.paidAt) },
  ];
}

export type ClaimTone = "neutral" | "warn" | "success" | "danger" | "pool";

/** One word for lists and chips. */
export function claimStatus(record: WinningRecord): { label: string; tone: ClaimTone } {
  if (record.payout === "paid") return { label: "Paid", tone: "success" };
  if (record.review === "approved") return { label: "Approved · awaiting payout", tone: "pool" };
  if (record.review === "submitted") return { label: "Under review", tone: "warn" };
  if (record.review === "rejected") {
    return record.resubmissions >= 1 ? { label: "Rejected · final", tone: "danger" } : { label: "Rejected · upload again", tone: "danger" };
  }
  return { label: "Awaiting your proof", tone: "warn" };
}

export function canSubmitProof(record: WinningRecord): boolean {
  return record.review === "awaiting_proof" || (record.review === "rejected" && record.resubmissions < 1);
}
