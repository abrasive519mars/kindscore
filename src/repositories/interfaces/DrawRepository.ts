import type { PlanInterval } from "@/config/constants";
import type { DrawMode } from "@/engine/draw/generateNumbers";
import type { WinningTier } from "@/engine/draw/match";
import type { Paise } from "@/engine/money/paise";
import type { SubscriberCounts } from "@/engine/prizes/pool";
import type { IsoDate } from "@/engine/time/dates";

export type DrawStatus = "draft" | "simulated" | "published";

/** An active member as the draw sees them: what they pay and the scores they currently keep. */
export interface DrawCandidate {
  readonly userId: string;
  readonly interval: PlanInterval;
  readonly scores: readonly number[];
}

/** The `draws` row. Every money figure is what the engine computed at simulation time. */
export interface DrawRecord {
  readonly id: string;
  readonly drawMonth: IsoDate;
  readonly mode: DrawMode;
  /** How strongly algorithmic mode followed the scores (bps); ignored in random mode. */
  readonly weightStrengthBps: number;
  readonly status: DrawStatus;
  readonly numbers: readonly number[] | null;
  readonly activeSubscriberCount: number;
  readonly poolPaise: Paise;
  readonly rolloverInPaise: Paise;
  readonly tierPools: Readonly<Record<WinningTier, Paise>>;
  readonly rolloverOutPaise: Paise;
  readonly unclaimedRetainedPaise: Paise;
  readonly entriesHash: string | null;
  readonly simulatedAt: string | null;
  readonly publishedAt: string | null;
}

/** What the engine produced; persisted in one transaction by the save_simulation RPC. */
export interface SimulationWrite {
  readonly drawId: string;
  readonly mode: DrawMode;
  readonly weightStrengthBps: number;
  readonly numbers: readonly number[];
  readonly activeSubscriberCount: number;
  readonly poolPaise: Paise;
  readonly rolloverInPaise: Paise;
  readonly tierPools: Readonly<Record<WinningTier, Paise>>;
  readonly rolloverOutPaise: Paise;
  readonly unclaimedRetainedPaise: Paise;
  readonly entriesHash: string;
  readonly entries: readonly { userId: string; scores: readonly number[]; matchCount: number }[];
  readonly results: readonly { userId: string; matchCount: number; prizePaise: Paise }[];
}

/** One winner as the admin sees them. */
export interface DrawResultRow {
  readonly userId: string;
  readonly fullName: string;
  readonly email: string;
  readonly scores: readonly number[];
  readonly matchCount: number;
  readonly prizePaise: Paise;
}

/** A published draw as everyone may see it (the draw_statistics view). */
export interface DrawSummary {
  readonly drawId: string;
  readonly drawMonth: IsoDate;
  readonly mode: DrawMode;
  readonly weightStrengthBps: number;
  readonly numbers: readonly number[];
  readonly activeSubscriberCount: number;
  readonly poolPaise: Paise;
  readonly rolloverInPaise: Paise;
  readonly tierPools: Readonly<Record<WinningTier, Paise>>;
  readonly rolloverOutPaise: Paise;
  readonly unclaimedRetainedPaise: Paise;
  readonly publishedAt: string;
  readonly winners: Readonly<Record<WinningTier, number>>;
  readonly prizesPaise: Paise;
}

/** A published draw from one member's point of view. */
export interface MemberDrawOutcome {
  readonly draw: DrawSummary;
  readonly entry: { readonly scores: readonly number[]; readonly matchCount: number } | null;
  readonly prizePaise: Paise | null;
  /** The winner verification opened for this member when they won — the way to the claim. */
  readonly claim: { readonly verificationId: string; readonly paid: boolean } | null;
}

export interface DrawRepository {
  listCandidates(): Promise<DrawCandidate[]>;
  findOpen(): Promise<DrawRecord | null>;
  findById(id: string): Promise<DrawRecord | null>;
  lastPublishedMonth(): Promise<IsoDate | null>;
  create(drawMonth: IsoDate): Promise<DrawRecord>;
  nextRolloverIn(): Promise<Paise>;
  activeSubscriberCounts(): Promise<SubscriberCounts>;
  saveSimulation(write: SimulationWrite): Promise<DrawRecord>;
  publish(id: string): Promise<DrawRecord>;
  listResults(drawId: string): Promise<DrawResultRow[]>;
  listSummaries(): Promise<DrawSummary[]>;
  findSummary(drawId: string): Promise<DrawSummary | null>;
  listMemberOutcomes(userId: string): Promise<MemberDrawOutcome[]>;
}
