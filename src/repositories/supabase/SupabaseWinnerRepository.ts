import {
  ExternalServiceError,
  ForbiddenError,
  NotFoundError,
  RuleViolationError,
} from "@/engine/errors";
import type {
  ClaimRow,
  WinnerRepository,
  WinningRecord,
} from "@/repositories/interfaces/WinnerRepository";
import type { Db } from "@/repositories/supabase/db";
import type { Database } from "@/types/database.types";

type VerificationRow = Database["public"]["Tables"]["winner_verifications"]["Row"];

/** One select shape for every read: the claim, what was won, and the draw it came from. */
const CLAIM_SELECT = `
  id, user_id, proof_path, review_status, payout_status, resubmissions, review_note, reviewed_at, paid_at, created_at,
  draw_results!inner ( draw_id, match_count, prize_paise, draw_entries!inner ( scores ), draws!inner ( draw_month, numbers ) ),
  profiles!winner_verifications_user_id_fkey!inner ( full_name, email )
`;

interface JoinedRow {
  id: string;
  user_id: string;
  proof_path: string | null;
  review_status: VerificationRow["review_status"];
  payout_status: VerificationRow["payout_status"];
  resubmissions: number;
  review_note: string | null;
  reviewed_at: string | null;
  paid_at: string | null;
  created_at: string;
  draw_results: {
    draw_id: string;
    match_count: number;
    prize_paise: number;
    draw_entries: { scores: number[] };
    draws: { draw_month: string; numbers: number[] | null };
  };
  profiles: { full_name: string; email: string };
}

const PG_RAISE_EXCEPTION = "P0001";
const PG_NO_DATA_FOUND = "P0002";
const PG_INSUFFICIENT_PRIVILEGE = "42501";

function mapRpcError(error: { code?: string; message: string }): Error {
  if (error.code === PG_RAISE_EXCEPTION) return new RuleViolationError(capitalise(error.message));
  if (error.code === PG_NO_DATA_FOUND) return new NotFoundError("That claim doesn't exist.");
  if (error.code === PG_INSUFFICIENT_PRIVILEGE) return new ForbiddenError();
  return new ExternalServiceError("Winners", error);
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1) + ".";
}

function toClaim(row: JoinedRow): ClaimRow {
  const result = row.draw_results;
  return {
    verificationId: row.id,
    userId: row.user_id,
    drawId: result.draw_id,
    drawMonth: result.draws.draw_month,
    numbers: result.draws.numbers ?? [],
    scores: result.draw_entries.scores,
    matchCount: result.match_count,
    prizePaise: result.prize_paise,
    review: row.review_status,
    payout: row.payout_status,
    resubmissions: row.resubmissions,
    proofPath: row.proof_path,
    reviewNote: row.review_note,
    reviewedAt: row.reviewed_at,
    paidAt: row.paid_at,
    createdAt: row.created_at,
    fullName: row.profiles.full_name,
    email: row.profiles.email,
  };
}

export class SupabaseWinnerRepository implements WinnerRepository {
  constructor(private readonly db: Db) {}

  async listForUser(userId: string): Promise<WinningRecord[]> {
    const { data, error } = await this.db
      .from("winner_verifications")
      .select(CLAIM_SELECT)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new ExternalServiceError("Winners", error);
    return (data as unknown as JoinedRow[]).map(toClaim);
  }

  async findForUser(userId: string, verificationId: string): Promise<WinningRecord | null> {
    const { data, error } = await this.db
      .from("winner_verifications")
      .select(CLAIM_SELECT)
      .eq("user_id", userId)
      .eq("id", verificationId)
      .maybeSingle();
    if (error) throw new ExternalServiceError("Winners", error);
    return data ? toClaim(data as unknown as JoinedRow) : null;
  }

  async listQueue(): Promise<ClaimRow[]> {
    const { data, error } = await this.db
      .from("winner_verifications")
      .select(CLAIM_SELECT)
      .order("created_at", { ascending: false });
    if (error) throw new ExternalServiceError("Winners", error);
    return (data as unknown as JoinedRow[]).map(toClaim);
  }

  async findClaim(verificationId: string): Promise<ClaimRow | null> {
    const { data, error } = await this.db
      .from("winner_verifications")
      .select(CLAIM_SELECT)
      .eq("id", verificationId)
      .maybeSingle();
    if (error) throw new ExternalServiceError("Winners", error);
    return data ? toClaim(data as unknown as JoinedRow) : null;
  }

  async submitProof(verificationId: string, proofPath: string): Promise<WinningRecord> {
    const { error } = await this.db.rpc("submit_winner_proof", {
      p_verification_id: verificationId,
      p_proof_path: proofPath,
    });
    if (error) throw mapRpcError(error);
    return this.requireClaim(verificationId);
  }

  async review(
    verificationId: string,
    approve: boolean,
    note: string | null,
  ): Promise<WinningRecord> {
    const { error } = await this.db.rpc("review_winner", {
      p_verification_id: verificationId,
      p_approve: approve,
      p_note: note ?? undefined,
    });
    if (error) throw mapRpcError(error);
    return this.requireClaim(verificationId);
  }

  async markPaid(verificationId: string): Promise<WinningRecord> {
    const { error } = await this.db.rpc("mark_winner_paid", { p_verification_id: verificationId });
    if (error) throw mapRpcError(error);
    return this.requireClaim(verificationId);
  }

  /** The RPCs return the bare row; callers want the joined record, so re-read it. */
  private async requireClaim(verificationId: string): Promise<WinningRecord> {
    const claim = await this.findClaim(verificationId);
    if (!claim) throw new NotFoundError("That claim doesn't exist.");
    return claim;
  }
}
