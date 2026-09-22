import { NotFoundError, ValidationError } from "@/engine/errors";
import type { Paise } from "@/engine/money/paise";
import { proofPath, validateProofFile } from "@/engine/verification/proofFile";
import { transition } from "@/engine/verification/stateMachine";
import type { ProofStorage } from "@/lib/storage/ProofStorage";
import type {
  ClaimRow,
  WinnerRepository,
  WinningRecord,
} from "@/repositories/interfaces/WinnerRepository";

export const REVIEW_NOTE_MAX = 200;

export interface WinningsSummary {
  /** Approved wins — paid or not yet. A win only counts once the proof is approved (PRD §10). */
  readonly totalWonPaise: Paise;
  readonly paidPaise: Paise;
  readonly awaitingPayoutPaise: Paise;
  /** Wins still needing the member's proof or the admin's review. */
  readonly unverifiedCount: number;
}

/** Pure: what the dashboard says about a member's wins. */
export function summariseWinnings(records: readonly WinningRecord[]): WinningsSummary {
  const approved = records.filter((r) => r.review === "approved");
  const paid = approved.filter((r) => r.payout === "paid");
  const sum = (rows: readonly WinningRecord[]) =>
    rows.reduce((total, r) => total + r.prizePaise, 0);
  return {
    totalWonPaise: sum(approved),
    paidPaise: sum(paid),
    awaitingPayoutPaise: sum(approved) - sum(paid),
    unverifiedCount: records.filter(
      (r) => r.review === "awaiting_proof" || r.review === "submitted",
    ).length,
  };
}

/**
 * Member and admin sides of PRD §09 up to approval; the payout itself is ClaimPayoutService.
 * Every state change is the engine's state machine, checked here first (for a friendly message,
 * before any upload) and again inside the RPC (for safety).
 */
export class WinnerService {
  constructor(
    private readonly winners: WinnerRepository,
    private readonly proofs: ProofStorage,
  ) {}

  listWinnings(userId: string): Promise<WinningRecord[]> {
    return this.winners.listForUser(userId);
  }

  async getWinning(userId: string, verificationId: string): Promise<WinningRecord> {
    const record = await this.winners.findForUser(userId, verificationId);
    if (!record) throw new NotFoundError("That win isn't yours to claim.");
    return record;
  }

  async submitProof(userId: string, verificationId: string, file: File): Promise<WinningRecord> {
    const record = await this.getWinning(userId, verificationId);
    const type = validateProofFile({ type: file.type, size: file.size });
    // Same rule as the RPC, surfaced before the upload so a wrong click costs nothing.
    transition(
      { review: record.review, payout: record.payout, resubmissions: record.resubmissions },
      "submit_proof",
    );
    const path = proofPath(userId, verificationId, type);
    await this.proofs.upload(path, file);
    return this.winners.submitProof(verificationId, path);
  }

  async review(verificationId: string, approve: boolean, note: string): Promise<WinningRecord> {
    const trimmed = note.trim();
    if (!approve && trimmed.length === 0) throw new ValidationError("Tell the member why.", "note");
    if (trimmed.length > REVIEW_NOTE_MAX) {
      throw new ValidationError(`Keep the note under ${REVIEW_NOTE_MAX} characters.`, "note");
    }
    return this.winners.review(verificationId, approve, trimmed.length ? trimmed : null);
  }

  /** §11.04 escape hatch: a prize settled outside Stripe. The reference is the audit trail. */
  async recordPayout(verificationId: string, reference: string): Promise<WinningRecord> {
    const trimmed = reference.trim();
    if (trimmed.length === 0)
      throw new ValidationError("Enter the payment reference.", "reference");
    if (trimmed.length > REVIEW_NOTE_MAX) {
      throw new ValidationError(
        `Keep the reference under ${REVIEW_NOTE_MAX} characters.`,
        "reference",
      );
    }
    return this.winners.recordPayout(verificationId, trimmed);
  }

  listQueue(): Promise<ClaimRow[]> {
    return this.winners.listQueue();
  }

  async getClaim(verificationId: string): Promise<ClaimRow> {
    const claim = await this.winners.findClaim(verificationId);
    if (!claim) throw new NotFoundError("That claim doesn't exist.");
    return claim;
  }

  proofUrl(path: string): Promise<string> {
    return this.proofs.signedUrl(path);
  }
}
