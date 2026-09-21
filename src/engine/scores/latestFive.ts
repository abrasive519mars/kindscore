import { SCORE } from "@/config/constants";
import { ConflictError, RuleViolationError } from "@/engine/errors";
import { compareIsoDates, formatShortDate, type IsoDate } from "@/engine/time/dates";

/**
 *"Only the latest 5 scores are retained at any time. A new score replaces the
 * oldest stored score automatically." Latest means by the date the round was played.
 *
 * One score per date means two of a member's rounds never share a playedOn, so the createdAt
 * comparison below is not a business rule — it only makes the sort deterministic for any input.
 */
export interface ScoreEntry {
  readonly id: string;
  readonly score: number;
  readonly playedOn: IsoDate;
  readonly createdAt: string;
}

export interface RetainedScores {
  readonly retained: readonly ScoreEntry[];
  readonly evicted: readonly ScoreEntry[];
}

export function sortNewestFirst(entries: readonly ScoreEntry[]): ScoreEntry[] {
  return [...entries].sort(
    (a, b) => compareIsoDates(b.playedOn, a.playedOn) || b.createdAt.localeCompare(a.createdAt),
  );
}

export function selectRetainedScores(entries: readonly ScoreEntry[]): RetainedScores {
  const ordered = sortNewestFirst(entries);
  return {
    retained: ordered.slice(0, SCORE.WINDOW_SIZE),
    evicted: ordered.slice(SCORE.WINDOW_SIZE),
  };
}

export function findEntryOnDate(entries: readonly ScoreEntry[], playedOn: IsoDate): ScoreEntry | undefined {
  return entries.find((entry) => entry.playedOn === playedOn);
}

/** True when the window is full and `playedOn` is older than every kept round — it would be added and instantly evicted. */
export function isBackdatedBeyondWindow(playedOn: IsoDate, entries: readonly ScoreEntry[]): boolean {
  const { retained } = selectRetainedScores(entries);
  if (retained.length < SCORE.WINDOW_SIZE) return false;
  return retained.every((entry) => compareIsoDates(playedOn, entry.playedOn) === -1);
}

/** What the window would look like after adding `candidate`, or why it can't be added. */
export function previewAddScore(entries: readonly ScoreEntry[], candidate: ScoreEntry): RetainedScores {
  if (findEntryOnDate(entries, candidate.playedOn)) {
    throw new ConflictError(
      `You already logged a round on ${formatShortDate(candidate.playedOn)} — edit it instead`,
    );
  }
  if (isBackdatedBeyondWindow(candidate.playedOn, entries)) {
    throw new RuleViolationError("That round is older than your five kept rounds");
  }
  return selectRetainedScores([...entries, candidate]);
}
