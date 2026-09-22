import type { Paise } from "@/engine/money/paise";
import type { IsoDate } from "@/engine/time/dates";
import type { PayoutStatus, ReviewStatus } from "@/engine/verification/stateMachine";

/** How a prize was paid: Stripe customer credit today; `seed` marks demo history. */
export type PayoutMethod = "stripe_credit" | "seed";

/** One win and where its claim stands — the verification row joined to what was won. */
export interface WinningRecord {
  readonly verificationId: string;
  readonly userId: string;
  readonly drawId: string;
  readonly drawMonth: IsoDate;
  readonly numbers: readonly number[];
  readonly scores: readonly number[];
  readonly matchCount: number;
  readonly prizePaise: Paise;
  readonly review: ReviewStatus;
  readonly payout: PayoutStatus;
  readonly resubmissions: number;
  readonly proofPath: string | null;
  readonly reviewNote: string | null;
  readonly reviewedAt: string | null;
  readonly paidAt: string | null;
  readonly payoutMethod: PayoutMethod | null;
  /** The provider's transaction id — the proof the prize was paid. */
  readonly payoutReference: string | null;
  readonly createdAt: string;
}

/** The admin's view adds who the member is. */
export interface ClaimRow extends WinningRecord {
  readonly fullName: string;
  readonly email: string;
}

export interface WinnerRepository {
  listForUser(userId: string): Promise<WinningRecord[]>;
  findForUser(userId: string, verificationId: string): Promise<WinningRecord | null>;
  listQueue(): Promise<ClaimRow[]>;
  findClaim(verificationId: string): Promise<ClaimRow | null>;
  /** The three RPCs. Each re-checks the state machine and raises on an illegal move. */
  submitProof(verificationId: string, proofPath: string): Promise<WinningRecord>;
  review(verificationId: string, approve: boolean, note: string | null): Promise<WinningRecord>;
  /** The winner's own move: approved · pending → paid, with how and the provider's reference. */
  claimPayout(
    verificationId: string,
    method: PayoutMethod,
    reference: string,
  ): Promise<WinningRecord>;
}
