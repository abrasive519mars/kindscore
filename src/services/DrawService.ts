import { LOCALE } from "@/config/constants";
import { NotFoundError, RuleViolationError } from "@/engine/errors";
import { selectEligibleEntries, type EligibleEntry } from "@/engine/draw/eligibility";
import { entriesFingerprint } from "@/engine/draw/fingerprint";
import { buildFrequencyMap, smoothFrequency } from "@/engine/draw/frequency";
import {
  buildWeights,
  generateNumbers,
  type DrawMode,
  type Weights,
} from "@/engine/draw/generateNumbers";
import { matchEntries, type WinningTier } from "@/engine/draw/match";
import type { Paise } from "@/engine/money/paise";
import { allocatePrizes, splitTierPools, type Prize } from "@/engine/prizes/allocate";
import { computePoolPaise, computePoolPaiseFromCounts } from "@/engine/prizes/pool";
import { secureRng, type Rng } from "@/engine/draw/rng";
import { nextDrawMonth, todayInTimezone } from "@/engine/time/dates";
import type {
  DrawCandidate,
  DrawRecord,
  DrawRepository,
} from "@/repositories/interfaces/DrawRepository";

export interface SimulationReport {
  readonly draw: DrawRecord;
  readonly eligibleCount: number;
  readonly ineligibleCount: number;
  readonly prizes: readonly Prize[];
}

export interface Freshness {
  readonly stale: boolean;
}

export interface DrawWeights {
  /** How many eligible members hold each number; index = the number (1–45), index 0 unused. */
  readonly holders: readonly number[];
  /** The draw weight per number for the chosen mode, same indexing (flat 1s in random mode). */
  readonly weights: Weights;
}

export const STALE_MESSAGE = "Scores changed since simulation — re-simulate before publishing";

/**
 * Orchestrates one month's draw. Every number comes from the engine; every write goes through
 * the repository's RPCs (one transaction each). Randomness is a parameter so tests are
 * deterministic and the action passes the secure generator.
 */
export class DrawService {
  constructor(private readonly draws: DrawRepository) {}

  /** The open draw, or a new draft for the month after the last published one. */
  async openNextDraw(now = new Date()): Promise<DrawRecord> {
    const open = await this.draws.findOpen();
    if (open) return open;
    const last = await this.draws.lastPublishedMonth();
    return this.draws.create(nextDrawMonth(last, todayInTimezone(now, LOCALE.TIMEZONE)));
  }

  async simulate(drawId: string, mode: DrawMode, rng: Rng = secureRng): Promise<SimulationReport> {
    const draw = await this.requireDraw(drawId);
    if (draw.status === "published")
      throw new RuleViolationError("This draw is already published.");

    const candidates = await this.draws.listCandidates();
    const entries = selectEligibleEntries(candidates);
    const rolloverInPaise = await this.draws.nextRolloverIn();
    const numbers = generateNumbers(mode, buildFrequencyMap(entries), rng);
    const matched = matchEntries(numbers, entries);
    const allocation = allocatePrizes({
      poolPaise: computePoolPaise(candidates),
      rolloverInPaise,
      matched,
    });

    const saved = await this.draws.saveSimulation({
      drawId,
      mode,
      numbers,
      activeSubscriberCount: candidates.length,
      poolPaise: computePoolPaise(candidates),
      rolloverInPaise,
      tierPools: allocation.tierPools,
      rolloverOutPaise: allocation.rolloverOutPaise,
      unclaimedRetainedPaise: allocation.unclaimedRetainedPaise,
      entriesHash: entriesFingerprint(entries),
      entries: matched.map((m) => ({
        userId: m.userId,
        scores: m.scores,
        matchCount: m.matchCount,
      })),
      results: allocation.prizes.map((p) => ({
        userId: p.userId,
        matchCount: p.tier,
        prizePaise: p.prizePaise,
      })),
    });
    return {
      draw: saved,
      eligibleCount: entries.length,
      ineligibleCount: candidates.length - entries.length,
      prizes: allocation.prizes,
    };
  }

  /** Has any eligible member's ticket changed since the draft was simulated? */
  async checkFreshness(draw: DrawRecord): Promise<Freshness> {
    if (draw.status !== "simulated" || !draw.entriesHash) return { stale: false };
    const entries = selectEligibleEntries(await this.draws.listCandidates());
    return { stale: entriesFingerprint(entries) !== draw.entriesHash };
  }

  async publish(drawId: string): Promise<DrawRecord> {
    const draw = await this.requireDraw(drawId);
    if (draw.status === "published") return draw;
    if (draw.status === "draft") throw new RuleViolationError("Simulate first.");
    // Checked again here, not only on the page: two tabs or a slow click must never publish a stale draft.
    if ((await this.checkFreshness(draw)).stale) throw new RuleViolationError(STALE_MESSAGE);
    return this.draws.publish(drawId);
  }

  /** For the admin's histogram: who holds what, and how the chosen mode would weight it. */
  describeWeights(candidates: readonly DrawCandidate[], mode: DrawMode): DrawWeights {
    const entries = selectEligibleEntries(candidates);
    const frequency = buildFrequencyMap(entries);
    const holders = smoothFrequency(frequency).map((_, n) => frequency.get(n) ?? 0);
    return { holders, weights: buildWeights(mode, frequency) };
  }

  /** What the jackpot would be if the draw ran now — an estimate, labelled as such in the UI. */
  async projectedJackpot(): Promise<Paise> {
    const [counts, rolloverIn] = await Promise.all([
      this.draws.activeSubscriberCounts(),
      this.draws.nextRolloverIn(),
    ]);
    return splitTierPools(computePoolPaiseFromCounts(counts), rolloverIn)[JACKPOT_TIER];
  }

  private async requireDraw(drawId: string): Promise<DrawRecord> {
    const draw = await this.draws.findById(drawId);
    if (!draw) throw new NotFoundError("That draw doesn't exist.");
    return draw;
  }
}

const JACKPOT_TIER: WinningTier = 5;

export type { EligibleEntry };
