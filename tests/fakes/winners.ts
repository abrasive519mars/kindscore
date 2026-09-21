import { NotFoundError } from "@/engine/errors";
import { transition, type VerificationState } from "@/engine/verification/stateMachine";
import type { ProofStorage } from "@/lib/storage/ProofStorage";
import type { ClaimRow, WinnerRepository, WinningRecord } from "@/repositories/interfaces/WinnerRepository";

/** In-memory claims that apply the same state machine the RPCs do. */
export class FakeWinnerRepository implements WinnerRepository {
  rows: ClaimRow[] = [];

  async listForUser(userId: string) {
    return this.rows.filter((r) => r.userId === userId);
  }
  async findForUser(userId: string, id: string) {
    return this.rows.find((r) => r.userId === userId && r.verificationId === id) ?? null;
  }
  async listQueue() {
    return [...this.rows];
  }
  async findClaim(id: string) {
    return this.rows.find((r) => r.verificationId === id) ?? null;
  }
  async submitProof(id: string, proofPath: string) {
    return this.apply(id, "submit_proof", { proofPath });
  }
  async review(id: string, approve: boolean, note: string | null) {
    return this.apply(id, approve ? "approve" : "reject", { reviewNote: note, reviewedAt: "2026-09-22T09:00:00Z" });
  }
  async markPaid(id: string) {
    return this.apply(id, "mark_paid", { paidAt: "2026-09-23T09:00:00Z" });
  }

  private apply(id: string, event: Parameters<typeof transition>[1], patch: Partial<ClaimRow>): ClaimRow {
    const index = this.rows.findIndex((r) => r.verificationId === id);
    if (index === -1) throw new NotFoundError("That claim doesn't exist.");
    const row = this.rows[index];
    const state: VerificationState = { review: row.review, payout: row.payout, resubmissions: row.resubmissions };
    const next = transition(state, event);
    const updated = { ...row, ...patch, review: next.review, payout: next.payout, resubmissions: next.resubmissions };
    this.rows[index] = updated;
    return updated;
  }
}

export class FakeProofStorage implements ProofStorage {
  uploads: Array<{ path: string; size: number; type: string }> = [];
  async upload(path: string, file: File) {
    this.uploads.push({ path, size: file.size, type: file.type });
  }
  async signedUrl(path: string) {
    return `https://signed.test/${path}`;
  }
}

export function claim(overrides: Partial<ClaimRow> = {}): ClaimRow {
  return {
    verificationId: "ver-1",
    userId: "user-1",
    drawId: "draw-1",
    drawMonth: "2026-08-01",
    numbers: [28, 33, 31, 12, 40],
    scores: [28, 33, 31, 36, 29],
    matchCount: 3,
    prizePaise: 250_000,
    review: "awaiting_proof",
    payout: "pending",
    resubmissions: 0,
    proofPath: null,
    reviewNote: null,
    reviewedAt: null,
    paidAt: null,
    createdAt: "2026-09-01T10:00:00Z",
    fullName: "Priya Test",
    email: "priya@kindscore.test",
    ...overrides,
  };
}

export function pngFile(bytes = 1024, type = "image/png"): File {
  return new File([new Uint8Array(bytes)], "proof.png", { type });
}

export type { WinningRecord };
