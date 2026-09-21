import {
  ConflictError,
  ExternalServiceError,
  ForbiddenError,
  NotFoundError,
  RuleViolationError,
} from "@/engine/errors";
import type { SubscriberCounts } from "@/engine/prizes/pool";
import type { IsoDate } from "@/engine/time/dates";
import type {
  DrawCandidate,
  DrawRecord,
  DrawRepository,
  DrawResultRow,
  DrawSummary,
  MemberDrawOutcome,
  SimulationWrite,
} from "@/repositories/interfaces/DrawRepository";
import { fetchAllRows, PG_UNIQUE_VIOLATION, type Db } from "@/repositories/supabase/db";
import type { Database } from "@/types/database.types";

type DrawRow = Database["public"]["Tables"]["draws"]["Row"];
type SummaryRow = Database["public"]["Views"]["draw_statistics"]["Row"];

/** Errors the RPCs raise on purpose (migration 6), translated into app errors here and nowhere else. */
const PG_RAISE_EXCEPTION = "P0001";
const PG_NO_DATA_FOUND = "P0002";
const PG_INSUFFICIENT_PRIVILEGE = "42501";

/** Members per scores query: 150 × 5 rounds stays well under the API row cap and URL length. */
const CANDIDATE_CHUNK = 150;

function mapRpcError(error: { code?: string; message: string }): Error {
  if (error.code === PG_RAISE_EXCEPTION) return new RuleViolationError(capitalise(error.message));
  if (error.code === PG_NO_DATA_FOUND) return new NotFoundError("That draw doesn't exist.");
  if (error.code === PG_INSUFFICIENT_PRIVILEGE) return new ForbiddenError();
  return new ExternalServiceError("Draws", error);
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1) + ".";
}

function toRecord(row: DrawRow): DrawRecord {
  return {
    id: row.id,
    drawMonth: row.draw_month,
    mode: row.mode,
    status: row.status,
    numbers: row.numbers,
    activeSubscriberCount: row.active_subscriber_count,
    poolPaise: row.pool_paise,
    rolloverInPaise: row.rollover_in_paise,
    tierPools: { 5: row.jackpot_pool_paise, 4: row.four_pool_paise, 3: row.three_pool_paise },
    rolloverOutPaise: row.rollover_out_paise,
    unclaimedRetainedPaise: row.unclaimed_retained_paise,
    entriesHash: row.entries_hash,
    simulatedAt: row.simulated_at,
    publishedAt: row.published_at,
  };
}

/** The view's columns are all nullable in the generated types (aggregates); a published draw has them all. */
function toSummary(row: SummaryRow): DrawSummary {
  return {
    drawId: row.draw_id!,
    drawMonth: row.draw_month!,
    mode: row.mode!,
    numbers: row.numbers ?? [],
    activeSubscriberCount: row.active_subscriber_count ?? 0,
    poolPaise: row.pool_paise ?? 0,
    rolloverInPaise: row.rollover_in_paise ?? 0,
    tierPools: {
      5: row.jackpot_pool_paise ?? 0,
      4: row.four_pool_paise ?? 0,
      3: row.three_pool_paise ?? 0,
    },
    rolloverOutPaise: row.rollover_out_paise ?? 0,
    unclaimedRetainedPaise: row.unclaimed_retained_paise ?? 0,
    publishedAt: row.published_at!,
    winners: {
      5: row.five_match_winners ?? 0,
      4: row.four_match_winners ?? 0,
      3: row.three_match_winners ?? 0,
    },
    prizesPaise: row.prizes_paise ?? 0,
  };
}

export class SupabaseDrawRepository implements DrawRepository {
  constructor(private readonly db: Db) {}

  /**
   * Active-in-period subscribers joined to their kept scores (newest first, as the ticket reads).
   * Scores are fetched in chunks of members: a single `.in()` with hundreds of ids overflows the
   * URL, and one unchunked select would hit PostgREST's row cap and silently drop tickets.
   */
  async listCandidates(): Promise<DrawCandidate[]> {
    const now = new Date().toISOString();
    const subs = await fetchAllRows((from, to) =>
      this.db
        .from("subscriptions")
        .select("user_id, plan_interval")
        .eq("status", "active")
        .gt("current_period_end", now)
        .order("user_id")
        .range(from, to),
    ).catch((error) => {
      throw new ExternalServiceError("Draws", error);
    });
    if (subs.length === 0) return [];

    const byUser = new Map<string, number[]>();
    for (let i = 0; i < subs.length; i += CANDIDATE_CHUNK) {
      const ids = subs.slice(i, i + CANDIDATE_CHUNK).map((s) => s.user_id);
      const { data: scores, error: scoresError } = await this.db
        .from("scores")
        .select("user_id, score, played_on, created_at")
        .in("user_id", ids)
        .order("played_on", { ascending: false })
        .order("created_at", { ascending: false });
      if (scoresError) throw new ExternalServiceError("Draws", scoresError);
      for (const row of scores)
        byUser.set(row.user_id, [...(byUser.get(row.user_id) ?? []), row.score]);
    }
    return subs.map((s) => ({
      userId: s.user_id,
      interval: s.plan_interval,
      scores: byUser.get(s.user_id) ?? [],
    }));
  }

  async findOpen(): Promise<DrawRecord | null> {
    const { data, error } = await this.db
      .from("draws")
      .select("*")
      .neq("status", "published")
      .maybeSingle();
    if (error) throw new ExternalServiceError("Draws", error);
    return data ? toRecord(data) : null;
  }

  async findById(id: string): Promise<DrawRecord | null> {
    const { data, error } = await this.db.from("draws").select("*").eq("id", id).maybeSingle();
    if (error) throw new ExternalServiceError("Draws", error);
    return data ? toRecord(data) : null;
  }

  async lastPublishedMonth(): Promise<IsoDate | null> {
    const { data, error } = await this.db
      .from("draws")
      .select("draw_month")
      .eq("status", "published")
      .order("draw_month", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new ExternalServiceError("Draws", error);
    return data?.draw_month ?? null;
  }

  async create(drawMonth: IsoDate): Promise<DrawRecord> {
    const { data, error } = await this.db
      .from("draws")
      .insert({ draw_month: drawMonth })
      .select("*")
      .single();
    if (error?.code === PG_UNIQUE_VIOLATION)
      throw new ConflictError("A draw for that month already exists.");
    if (error) throw new ExternalServiceError("Draws", error);
    return toRecord(data);
  }

  async nextRolloverIn(): Promise<number> {
    const { data, error } = await this.db.rpc("next_rollover_in");
    if (error) throw new ExternalServiceError("Draws", error);
    return data ?? 0;
  }

  async activeSubscriberCounts(): Promise<SubscriberCounts> {
    const { data, error } = await this.db.rpc("active_subscriber_counts");
    if (error) throw new ExternalServiceError("Draws", error);
    const counts = { month: 0, year: 0 };
    for (const row of data) counts[row.plan_interval] = row.subscribers;
    return counts;
  }

  async saveSimulation(write: SimulationWrite): Promise<DrawRecord> {
    const { data, error } = await this.db.rpc("save_simulation", {
      p_draw_id: write.drawId,
      p_mode: write.mode,
      p_numbers: [...write.numbers],
      p_active_subscriber_count: write.activeSubscriberCount,
      p_pool_paise: write.poolPaise,
      p_rollover_in_paise: write.rolloverInPaise,
      p_jackpot_pool_paise: write.tierPools[5],
      p_four_pool_paise: write.tierPools[4],
      p_three_pool_paise: write.tierPools[3],
      p_rollover_out_paise: write.rolloverOutPaise,
      p_unclaimed_retained_paise: write.unclaimedRetainedPaise,
      p_entries_hash: write.entriesHash,
      p_entries: write.entries.map((e) => ({
        user_id: e.userId,
        scores: [...e.scores],
        match_count: e.matchCount,
      })),
      p_results: write.results.map((r) => ({
        user_id: r.userId,
        match_count: r.matchCount,
        prize_paise: r.prizePaise,
      })),
    });
    if (error) throw mapRpcError(error);
    return toRecord(data);
  }

  async publish(id: string): Promise<DrawRecord> {
    const { data, error } = await this.db.rpc("publish_draw", { p_draw_id: id });
    if (error) throw mapRpcError(error);
    return toRecord(data);
  }

  async listResults(drawId: string): Promise<DrawResultRow[]> {
    const { data, error } = await this.db
      .from("draw_results")
      .select(
        "user_id, match_count, prize_paise, draw_entries!inner(scores), profiles!inner(full_name, email)",
      )
      .eq("draw_id", drawId)
      .order("match_count", { ascending: false });
    if (error) throw new ExternalServiceError("Draws", error);
    return data.map((row) => ({
      userId: row.user_id,
      fullName: row.profiles.full_name,
      email: row.profiles.email,
      scores: row.draw_entries.scores,
      matchCount: row.match_count,
      prizePaise: row.prize_paise,
    }));
  }

  async listSummaries(): Promise<DrawSummary[]> {
    const { data, error } = await this.db
      .from("draw_statistics")
      .select("*")
      .order("draw_month", { ascending: false });
    if (error) throw new ExternalServiceError("Draws", error);
    return data.map(toSummary);
  }

  async findSummary(drawId: string): Promise<DrawSummary | null> {
    const { data, error } = await this.db
      .from("draw_statistics")
      .select("*")
      .eq("draw_id", drawId)
      .maybeSingle();
    if (error) throw new ExternalServiceError("Draws", error);
    return data ? toSummary(data) : null;
  }

  /** Every published draw, with this member's own entry and result where they exist (RLS enforces "own"). */
  async listMemberOutcomes(userId: string): Promise<MemberDrawOutcome[]> {
    const [summaries, { data: entries, error: e1 }, { data: results, error: e2 }] =
      await Promise.all([
        this.listSummaries(),
        this.db.from("draw_entries").select("draw_id, scores, match_count").eq("user_id", userId),
        this.db.from("draw_results").select("draw_id, prize_paise").eq("user_id", userId),
      ]);
    if (e1) throw new ExternalServiceError("Draws", e1);
    if (e2) throw new ExternalServiceError("Draws", e2);
    const entryByDraw = new Map(
      entries.map((e) => [e.draw_id, { scores: e.scores, matchCount: e.match_count }]),
    );
    const prizeByDraw = new Map(results.map((r) => [r.draw_id, r.prize_paise]));
    return summaries.map((draw) => ({
      draw,
      entry: entryByDraw.get(draw.drawId) ?? null,
      prizePaise: prizeByDraw.get(draw.drawId) ?? null,
    }));
  }
}
