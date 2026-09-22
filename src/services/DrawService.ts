import { DRAW, LOCALE } from "@/config/constants";
import { NotFoundError, RuleViolationError } from "@/engine/errors";
import { selectEligibleEntries, type EligibleEntry } from "@/engine/draw/eligibility";
import { entriesFingerprint, type FundingBase } from "@/engine/draw/fingerprint";
import { buildFrequencyMap } from "@/engine/draw/frequency";
import { generateNumbers, type DrawMode } from "@/engine/draw/generateNumbers";
import { matchEntries, type WinningTier } from "@/engine/draw/match";
import type { Paise } from "@/engine/money/paise";
import { allocatePrizes, splitTierPools, type Prize } from "@/engine/prizes/allocate";
import { computePoolPaise, computePoolPaiseFromCounts } from "@/engine/prizes/pool";
import { secureRng, type Rng } from "@/engine/draw/rng";
import { firstOfMonth, formatMonth, nextDrawMonth, todayInTimezone } from "@/engine/time/dates";
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

export const STALE_MESSAGE = "Scores changed since simulation — re-simulate before publishing";

/**
 * Orchestrates one month's draw. Every number comes from the engine; every write goes through
 * the repository's RPCs (one transaction each). Randomness is a parameter so tests are
 * deterministic and the action passes the secure generator.
 */
export class DrawService {
  constructor(private readonly draws: DrawRepository) {}

  /**
   * The open draw, or a new draft for the month after the last published one — but never a month
   * that has not begun: the cadence is calendar time (§06 "monthly"), not just order.
   */
  async openNextDraw(now = new Date()): Promise<DrawRecord> {
    const open = await this.draws.findOpen();
    if (open) return open;
    const today = todayInTimezone(now, LOCALE.TIMEZONE);
    const month = nextDrawMonth(await this.draws.lastPublishedMonth(), today);
    if (month > firstOfMonth(today)) {
      throw new RuleViolationError(`${formatMonth(month)}'s draw opens on the first of the month.`);
    }
    return this.draws.create(month);
  }

  /** `weightStrengthBps` is the admin's dial for algorithmic mode (§11); random mode ignores it. */
  async simulate(
    drawId: string,
    mode: DrawMode,
    rng: Rng = secureRng,
    weightStrengthBps: number = DRAW.WEIGHT_STRENGTH_DEFAULT_BPS,
  ): Promise<SimulationReport> {
    const draw = await this.requireDraw(drawId);
    if (draw.status === "published")
      throw new RuleViolationError("This draw is already published.");

    const candidates = await this.draws.listCandidates();
    const entries = selectEligibleEntries(candidates);
    const rolloverInPaise = await this.draws.nextRolloverIn();
    const numbers = generateNumbers(mode, buildFrequencyMap(entries), rng, weightStrengthBps);
    const matched = matchEntries(numbers, entries);
    const funding = fundingOf(candidates);
    const allocation = allocatePrizes({ poolPaise: funding.poolPaise, rolloverInPaise, matched });

    const saved = await this.draws.saveSimulation({
      drawId,
      mode,
      weightStrengthBps,
      numbers,
      activeSubscriberCount: funding.activeSubscriberCount,
      poolPaise: funding.poolPaise,
      rolloverInPaise,
      tierPools: allocation.tierPools,
      rolloverOutPaise: allocation.rolloverOutPaise,
      unclaimedRetainedPaise: allocation.unclaimedRetainedPaise,
      entriesHash: entriesFingerprint(entries, funding),
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

  /** Has any eligible ticket, or the pool that funds the prizes, changed since the simulation? */
  async checkFreshness(draw: DrawRecord): Promise<Freshness> {
    if (draw.status !== "simulated" || !draw.entriesHash) return { stale: false };
    const candidates = await this.draws.listCandidates();
    const entries = selectEligibleEntries(candidates);
    return { stale: entriesFingerprint(entries, fundingOf(candidates)) !== draw.entriesHash };
  }

  async publish(drawId: string): Promise<DrawRecord> {
    const draw = await this.requireDraw(drawId);
    if (draw.status === "published") return draw;
    if (draw.status === "draft") throw new RuleViolationError("Simulate first.");
    // Checked again here, not only on the page: two tabs or a slow click must never publish a stale draft.
    if ((await this.checkFreshness(draw)).stale) throw new RuleViolationError(STALE_MESSAGE);
    return this.draws.publish(drawId);
  }

  /** For the histograms: how many eligible members hold each number (index = the number, 0 unused). */
  describeHolders(candidates: readonly DrawCandidate[]): readonly number[] {
    const frequency = buildFrequencyMap(selectEligibleEntries(candidates));
    return Array.from({ length: DRAW.NUMBER_MAX + 1 }, (_, n) => frequency.get(n) ?? 0);
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

function fundingOf(candidates: readonly DrawCandidate[]): FundingBase {
  return { activeSubscriberCount: candidates.length, poolPaise: computePoolPaise(candidates) };
}

export type { EligibleEntry };
