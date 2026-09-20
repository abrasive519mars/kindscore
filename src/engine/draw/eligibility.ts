import { SCORE } from "@/config/constants";

/** One member's entry into a draw: their kept scores at the moment of simulation. */
export interface EligibleEntry {
  readonly userId: string;
  readonly scores: readonly number[];
}

/**
 * A member needs exactly five kept scores to be in the draw (GAME.md §4 decision).
 * Subscription status is the service layer's concern; the engine only sees scores.
 */
export function isEligibleTicket(scores: readonly number[]): boolean {
  return scores.length === SCORE.WINDOW_SIZE;
}

export function selectEligibleEntries(
  candidates: readonly EligibleEntry[],
): readonly EligibleEntry[] {
  return candidates.filter((entry) => isEligibleTicket(entry.scores));
}
