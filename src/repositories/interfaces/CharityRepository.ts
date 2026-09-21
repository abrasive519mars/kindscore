import type { DirectoryCharity } from "@/engine/charity/directory";
import type { Paise } from "@/engine/money/paise";

export interface Charity extends DirectoryCharity {
  readonly id: string;
  readonly slug: string;
  readonly description: string;
  readonly outcomeLine: string;
  readonly coverPath: string | null;
  readonly websiteUrl: string | null;
  readonly featuredRank: number | null;
  readonly isActive: boolean;
}

export interface CharityMedia {
  readonly id: string;
  readonly charityId: string;
  readonly storagePath: string;
  readonly alt: string;
  readonly sortOrder: number;
}

export interface CharityEvent {
  readonly id: string;
  readonly charityId: string;
  readonly title: string;
  readonly description: string;
  readonly startsAt: string;
  readonly location: string;
}

/** Row of the charity_totals view — the ledger summed per charity. */
export interface CharityTotals {
  readonly charityId: string;
  readonly totalPaise: Paise;
  readonly contributorCount: number;
}

export interface CharityWrite {
  readonly name: string;
  readonly slug: string;
  readonly tagline: string;
  readonly description: string;
  readonly category: string;
  readonly city: string;
  readonly outcomeLine: string;
  readonly websiteUrl: string | null;
}

export interface EventWrite {
  readonly id?: string;
  readonly charityId: string;
  readonly title: string;
  readonly description: string;
  readonly startsAt: string;
  readonly location: string;
}

export interface CharityRepository {
  /** What the public may see: active charities only (RLS enforces the same for anon). */
  listActive(): Promise<Charity[]>;
  /** Admin: everything, hidden ones included. */
  listAll(): Promise<Charity[]>;
  findBySlug(slug: string): Promise<Charity | null>;
  findById(id: string): Promise<Charity | null>;
  listMedia(charityId: string): Promise<CharityMedia[]>;
  listUpcomingEvents(charityId: string, now: Date): Promise<CharityEvent[]>;
  listTotals(): Promise<CharityTotals[]>;
  /** Members currently directing their subscription to this charity. */
  subscriberCount(charityId: string): Promise<number>;

  create(write: CharityWrite): Promise<Charity>;
  update(id: string, write: CharityWrite): Promise<Charity>;
  setCoverPath(id: string, path: string | null): Promise<void>;
  setActive(id: string, active: boolean): Promise<void>;
  /** Exactly one featured charity: setting one clears every other rank. */
  setFeatured(id: string): Promise<void>;
  addMedia(charityId: string, storagePath: string, alt: string): Promise<CharityMedia>;
  removeMedia(mediaId: string): Promise<void>;
  upsertEvent(write: EventWrite): Promise<CharityEvent>;
  deleteEvent(eventId: string): Promise<void>;
}
