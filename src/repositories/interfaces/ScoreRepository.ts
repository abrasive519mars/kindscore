import type { ScoreEntry } from "@/engine/scores/latestFive";
import type { IsoDate } from "@/engine/time/dates";

export interface ScoreWrite {
  readonly score: number;
  readonly playedOn: IsoDate;
}

/**
 * What the service needs from storage, and nothing about how storage works. Rows come back as
 * the engine's ScoreEntry, newest first. Implemented by SupabaseScoreRepository in production
 * and by an in-memory fake in tests.
 */
export interface ScoreRepository {
  listForUser(userId: string): Promise<ScoreEntry[]>;
  insert(userId: string, write: ScoreWrite): Promise<ScoreEntry>;
  update(userId: string, id: string, write: ScoreWrite): Promise<ScoreEntry>;
  delete(userId: string, id: string): Promise<void>;
}
