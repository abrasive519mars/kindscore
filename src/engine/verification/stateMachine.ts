import { RuleViolationError } from "@/engine/errors";

/**
 * PRD §09: a winner uploads proof; admin approves or rejects; payout goes Pending → Paid.
 * Modelled as an explicit state machine so every illegal move is a rule violation, not a bug.
 */
export type ReviewStatus = "awaiting_proof" | "submitted" | "approved" | "rejected";
export type PayoutStatus = "pending" | "paid";
export type VerificationEvent = "submit_proof" | "approve" | "reject" | "mark_paid";

export interface VerificationState {
  readonly review: ReviewStatus;
  readonly payout: PayoutStatus;
  readonly resubmissions: number;
}

/** A rejected winner gets one more attempt (QA §1 decision). */
const MAX_RESUBMISSIONS = 1;

export function initialVerificationState(): VerificationState {
  return { review: "awaiting_proof", payout: "pending", resubmissions: 0 };
}

type Transition = (state: VerificationState) => VerificationState;

const submitProof: Transition = (state) => {
  if (state.review === "awaiting_proof") return { ...state, review: "submitted" };
  if (state.review === "rejected" && state.resubmissions < MAX_RESUBMISSIONS) {
    return { ...state, review: "submitted", resubmissions: state.resubmissions + 1 };
  }
  throw illegal(state, "submit_proof");
};

const approve: Transition = (state) => {
  if (state.review !== "submitted") throw illegal(state, "approve");
  return { ...state, review: "approved" };
};

const reject: Transition = (state) => {
  if (state.review !== "submitted") throw illegal(state, "reject");
  return { ...state, review: "rejected" };
};

const markPaid: Transition = (state) => {
  if (state.review !== "approved" || state.payout !== "pending") throw illegal(state, "mark_paid");
  return { ...state, payout: "paid" };
};

const TRANSITIONS: Readonly<Record<VerificationEvent, Transition>> = {
  submit_proof: submitProof,
  approve,
  reject,
  mark_paid: markPaid,
};

function illegal(state: VerificationState, event: VerificationEvent): RuleViolationError {
  return new RuleViolationError(
    `Cannot ${event.replace("_", " ")} while review is "${state.review}" and payout is "${state.payout}"`,
  );
}

/** Returns a new state; never mutates the input. */
export function transition(state: VerificationState, event: VerificationEvent): VerificationState {
  return TRANSITIONS[event](state);
}
