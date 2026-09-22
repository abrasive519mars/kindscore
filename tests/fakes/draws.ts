import { DRAW } from "@/config/constants";
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

/** In-memory draws: mirrors what the RPCs guarantee (one open draw, replace-on-simulate, idempotent publish). */
export class FakeDrawRepository implements DrawRepository {
  candidates: DrawCandidate[] = [];
  draws: DrawRecord[] = [];
  simulations: SimulationWrite[] = [];
  rolloverIn = 0;
  counts: SubscriberCounts = { month: 0, year: 0 };
  private seq = 0;

  async listCandidates() {
    return this.candidates.map((c) => ({ ...c, scores: [...c.scores] }));
  }
  async findOpen() {
    return this.draws.find((d) => d.status !== "published") ?? null;
  }
  async findById(id: string) {
    return this.draws.find((d) => d.id === id) ?? null;
  }
  async lastPublishedMonth(): Promise<IsoDate | null> {
    const months = this.draws.filter((d) => d.status === "published").map((d) => d.drawMonth);
    return months.sort().at(-1) ?? null;
  }
  async create(drawMonth: IsoDate): Promise<DrawRecord> {
    const draw: DrawRecord = {
      id: `draw-${++this.seq}`,
      drawMonth,
      mode: "random",
      weightStrengthBps: DRAW.WEIGHT_STRENGTH_DEFAULT_BPS,
      status: "draft",
      numbers: null,
      activeSubscriberCount: 0,
      poolPaise: 0,
      rolloverInPaise: 0,
      tierPools: { 5: 0, 4: 0, 3: 0 },
      rolloverOutPaise: 0,
      unclaimedRetainedPaise: 0,
      entriesHash: null,
      simulatedAt: null,
      publishedAt: null,
    };
    this.draws.push(draw);
    return draw;
  }
  async nextRolloverIn() {
    return this.rolloverIn;
  }
  async activeSubscriberCounts() {
    return this.counts;
  }
  async saveSimulation(write: SimulationWrite): Promise<DrawRecord> {
    this.simulations.push(write);
    return this.update(write.drawId, {
      mode: write.mode,
      weightStrengthBps: write.weightStrengthBps,
      status: "simulated",
      numbers: write.numbers,
      activeSubscriberCount: write.activeSubscriberCount,
      poolPaise: write.poolPaise,
      rolloverInPaise: write.rolloverInPaise,
      tierPools: write.tierPools,
      rolloverOutPaise: write.rolloverOutPaise,
      unclaimedRetainedPaise: write.unclaimedRetainedPaise,
      entriesHash: write.entriesHash,
      simulatedAt: "2026-09-21T12:00:00Z",
    });
  }
  async publish(id: string): Promise<DrawRecord> {
    return this.update(id, { status: "published", publishedAt: "2026-09-21T12:30:00Z" });
  }
  async listResults(): Promise<DrawResultRow[]> {
    return [];
  }
  async listSummaries(): Promise<DrawSummary[]> {
    return [];
  }
  async findSummary(): Promise<DrawSummary | null> {
    return null;
  }
  async listMemberOutcomes(): Promise<MemberDrawOutcome[]> {
    return [];
  }

  private update(id: string, patch: Partial<DrawRecord>): DrawRecord {
    const index = this.draws.findIndex((d) => d.id === id);
    const next = { ...this.draws[index], ...patch };
    this.draws[index] = next;
    return next;
  }
}

/** A candidate with five scores unless told otherwise. */
export function candidate(
  userId: string,
  scores: number[],
  interval: "month" | "year" = "month",
): DrawCandidate {
  return { userId, interval, scores };
}
