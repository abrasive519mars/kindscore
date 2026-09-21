import { ConflictError, ExternalServiceError, NotFoundError } from "@/engine/errors";
import type { ScoreEntry } from "@/engine/scores/latestFive";
import { formatShortDate } from "@/engine/time/dates";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import type { ScoreRepository, ScoreWrite } from "@/repositories/interfaces/ScoreRepository";
import type { Database } from "@/types/database.types";

type ScoreRow = Database["public"]["Tables"]["scores"]["Row"];

const UNIQUE_VIOLATION = "23505";

/** Postgres row → engine entry. The only place snake_case column names are known. */
function toEntry(row: ScoreRow): ScoreEntry {
  return { id: row.id, score: row.score, playedOn: row.played_on, createdAt: row.created_at };
}

/**
 * Runs as the signed-in user, so RLS limits every query to their own rows; the explicit
 * user_id filters are belt-and-braces and make intent obvious.
 */
export class SupabaseScoreRepository implements ScoreRepository {
  constructor(private readonly db: SupabaseServerClient) {}

  async listForUser(userId: string): Promise<ScoreEntry[]> {
    const { data, error } = await this.db
      .from("scores")
      .select("*")
      .eq("user_id", userId)
      .order("played_on", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new ExternalServiceError("Scores", error);
    return data.map(toEntry);
  }

  async insert(userId: string, write: ScoreWrite): Promise<ScoreEntry> {
    const { data, error } = await this.db
      .from("scores")
      .insert({ user_id: userId, score: write.score, played_on: write.playedOn })
      .select("*")
      .single();
    if (error) throw mapWriteError(error, write);
    return toEntry(data);
  }

  async update(userId: string, id: string, write: ScoreWrite): Promise<ScoreEntry> {
    const { data, error } = await this.db
      .from("scores")
      .update({ score: write.score, played_on: write.playedOn })
      .eq("id", id)
      .eq("user_id", userId)
      .select("*")
      .maybeSingle();
    if (error) throw mapWriteError(error, write);
    if (!data) throw new NotFoundError("That round is no longer here");
    return toEntry(data);
  }

  async delete(userId: string, id: string): Promise<void> {
    const { error } = await this.db.from("scores").delete().eq("id", id).eq("user_id", userId);
    if (error) throw new ExternalServiceError("Scores", error);
  }
}

/** The service checks for a duplicate date first; this catches the race between two tabs. */
function mapWriteError(error: { code?: string; message: string }, write: ScoreWrite) {
  if (error.code === UNIQUE_VIOLATION) {
    return new ConflictError(
      `You already logged a round on ${formatShortDate(write.playedOn)} — edit it instead`,
    );
  }
  return new ExternalServiceError("Scores", error);
}
