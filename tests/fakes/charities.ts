import { NotFoundError } from "@/engine/errors";
import type { CharityMediaStorage } from "@/lib/storage/CharityMediaStorage";
import type {
  Charity,
  CharityEvent,
  CharityMedia,
  CharityRepository,
  CharityTotals,
  CharityWrite,
  EventWrite,
} from "@/repositories/interfaces/CharityRepository";
import type {
  ContributionRecord,
  DonationRecord,
  DonationRepository,
  DonationWrite,
  MarkPaidOutcome,
} from "@/repositories/interfaces/DonationRepository";

export function charity(overrides: Partial<Charity> = {}): Charity {
  return {
    id: "c-1",
    slug: "neer-jal",
    name: "Neer Jal Trust",
    tagline: "Clean water within a ten-minute walk.",
    description: "Pumps and tanks.",
    category: "Water",
    city: "Anantapur",
    outcomeLine: "₹50 a month = clean water for one family for a fortnight",
    coverPath: "seed/neer-jal/cover.webp",
    websiteUrl: null,
    featuredRank: null,
    isActive: true,
    ...overrides,
  };
}

/** In-memory charities with the same invariants the database keeps (unique slug, one featured). */
export class FakeCharityRepository implements CharityRepository {
  charities: Charity[] = [];
  media: CharityMedia[] = [];
  events: CharityEvent[] = [];
  totals: CharityTotals[] = [];
  subscribers = new Map<string, number>();
  private seq = 0;

  async listActive() {
    return this.charities.filter((c) => c.isActive);
  }
  async listAll() {
    return [...this.charities];
  }
  async findBySlug(slug: string) {
    return this.charities.find((c) => c.slug === slug) ?? null;
  }
  async findById(id: string) {
    return this.charities.find((c) => c.id === id) ?? null;
  }
  async listMedia(charityId: string) {
    return this.media.filter((m) => m.charityId === charityId);
  }
  async listUpcomingEvents(charityId: string, now: Date) {
    return this.events.filter((e) => e.charityId === charityId && new Date(e.startsAt) >= now);
  }
  async listTotals() {
    return [...this.totals];
  }
  async subscriberCount(charityId: string) {
    return this.subscribers.get(charityId) ?? 0;
  }
  async create(write: CharityWrite): Promise<Charity> {
    if (this.charities.some((c) => c.slug === write.slug)) {
      const { ConflictError } = await import("@/engine/errors");
      throw new ConflictError("A charity with that name already exists.");
    }
    const created = charity({
      ...write,
      id: `c-${++this.seq}`,
      coverPath: null,
      featuredRank: null,
      isActive: true,
    });
    this.charities.push(created);
    return created;
  }
  async update(id: string, write: CharityWrite): Promise<Charity> {
    const index = this.charities.findIndex((c) => c.id === id);
    if (index === -1) throw new NotFoundError("That charity doesn't exist.");
    this.charities[index] = { ...this.charities[index], ...write };
    return this.charities[index];
  }
  async setCoverPath(id: string, path: string | null) {
    this.patch(id, { coverPath: path });
  }
  async setActive(id: string, active: boolean) {
    this.patch(id, { isActive: active });
  }
  async setFeatured(id: string) {
    this.charities = this.charities.map((c) => ({ ...c, featuredRank: c.id === id ? 1 : null }));
  }
  async addMedia(charityId: string, storagePath: string, alt: string): Promise<CharityMedia> {
    const item = {
      id: `m-${++this.seq}`,
      charityId,
      storagePath,
      alt,
      sortOrder: this.media.length,
    };
    this.media.push(item);
    return item;
  }
  async removeMedia(mediaId: string) {
    this.media = this.media.filter((m) => m.id !== mediaId);
  }
  async upsertEvent(write: EventWrite): Promise<CharityEvent> {
    const event = { ...write, id: write.id ?? `e-${++this.seq}` };
    this.events = [...this.events.filter((e) => e.id !== event.id), event];
    return event;
  }
  async deleteEvent(eventId: string) {
    this.events = this.events.filter((e) => e.id !== eventId);
  }
  private patch(id: string, patch: Partial<Charity>) {
    this.charities = this.charities.map((c) => (c.id === id ? { ...c, ...patch } : c));
  }
}

export class FakeDonationRepository implements DonationRepository {
  rows: DonationRecord[] = [];
  contributions: ContributionRecord[] = [];

  async create(write: DonationWrite): Promise<DonationRecord> {
    const row = { ...write, paid: false, createdAt: "2026-09-22T09:00:00Z" };
    this.rows.push(row);
    return row;
  }
  async markPaid(id: string): Promise<MarkPaidOutcome> {
    const row = this.rows.find((r) => r.id === id);
    if (!row) return "not_found";
    if (row.paid) return "already_paid";
    this.rows = this.rows.map((r) => (r.id === id ? { ...r, paid: true } : r));
    return "paid";
  }
  async findById(id: string) {
    return this.rows.find((r) => r.id === id) ?? null;
  }
  async listForUser(userId: string) {
    return this.rows.filter((r) => r.userId === userId);
  }
  async listContributionsForUser() {
    return [...this.contributions];
  }
}

export class FakeCharityMediaStorage implements CharityMediaStorage {
  uploads: string[] = [];
  removed: string[] = [];
  async upload(path: string) {
    this.uploads.push(path);
    return path;
  }
  async remove(path: string) {
    this.removed.push(path);
  }
}

export function imageFile(type = "image/webp", bytes = 2048): File {
  return new File([new Uint8Array(bytes)], "cover.webp", { type });
}
