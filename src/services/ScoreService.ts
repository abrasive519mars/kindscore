import { ConflictError, NotFoundError } from "@/engine/errors";
import { findEntryOnDate, previewAddScore, selectRetainedScores, type ScoreEntry } from "@/engine/scores/latestFive";
import { formatShortDate } from "@/engine/time/dates";
import type { ScoreRepository, ScoreWrite } from "@/repositories/interfaces/ScoreRepository";

export interface AddScoreResult {
  readonly entry: ScoreEntry;
  /** The round the new one pushed out, if the window was full — so the UI can name it. */
  readonly evicted: ScoreEntry | null;
}

/**
 * Orchestrates PRD §05 over a repository. The engine decides (and names what gets evicted);
 * the database trigger enforces; this class is the only place that knows both exist.
 */
export class ScoreService {
  constructor(private readonly scores: ScoreRepository) {}

  /** The member's kept rounds, newest first. Trims defensively even if storage held more. */
  async list(userId: string): Promise<ScoreEntry[]> {
    const all = await this.scores.listForUser(userId);
    return [...selectRetainedScores(all).retained];
  }

  async add(userId: string, input: ScoreWrite): Promise<AddScoreResult> {
    const current = await this.scores.listForUser(userId);
    const candidate: ScoreEntry = { id: "pending", score: input.score, playedOn: input.playedOn, createdAt: new Date().toISOString() };
    const preview = previewAddScore(current, candidate); // throws ConflictError / RuleViolationError
    const entry = await this.scores.insert(userId, input);
    return { entry, evicted: preview.evicted[0] ?? null };
  }

  async update(userId: string, id: string, input: ScoreWrite): Promise<ScoreEntry> {
    const current = await this.scores.listForUser(userId);
    const existing = current.find((entry) => entry.id === id);
    if (!existing) throw new NotFoundError("That round is no longer here");

    const others = current.filter((entry) => entry.id !== id);
    if (findEntryOnDate(others, input.playedOn)) {
      throw new ConflictError(`You already logged a round on ${formatShortDate(input.playedOn)} — edit it instead`);
    }
    return this.scores.update(userId, id, input);
  }

  async remove(userId: string, id: string): Promise<void> {
    const current = await this.scores.listForUser(userId);
    if (!current.some((entry) => entry.id === id)) throw new NotFoundError("That round is no longer here");
    await this.scores.delete(userId, id);
  }
}
