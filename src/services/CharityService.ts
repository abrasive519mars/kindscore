import { CHARITY_MEDIA } from "@/config/constants";
import {
  distinctValues,
  filterCharities,
  slugify,
  type DirectoryFilter,
} from "@/engine/charity/directory";
import { NotFoundError, ValidationError } from "@/engine/errors";
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

/** A charity with its ledger totals — what the directory card shows. */
export interface CharityListing extends Charity {
  readonly totals: CharityTotals;
}

export interface Directory {
  readonly charities: CharityListing[];
  readonly categories: string[];
  readonly cities: string[];
}

export interface CharityProfile {
  readonly charity: Charity;
  readonly media: CharityMedia[];
  readonly events: CharityEvent[];
  readonly totals: CharityTotals;
}

export type CharityInput = Omit<CharityWrite, "slug">;
export type MediaRole = "cover" | "gallery";

const MEDIA_MESSAGE = `Max ${CHARITY_MEDIA.MAX_BYTES / (1024 * 1024)} MB, PNG/JPG/WebP only`;
const EXTENSION: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

function zeroTotals(charityId: string): CharityTotals {
  return { charityId, totalPaise: 0, contributorCount: 0 };
}

/**
 * The public directory and the admin's management of it (PRD §08.2, §11.03). Reads run on
 * whichever client the caller has (RLS hides inactive charities from the public); writes are
 * only reachable through admin actions and are refused by RLS for anyone else.
 */
export class CharityService {
  constructor(
    private readonly charities: CharityRepository,
    private readonly media: CharityMediaStorage,
  ) {}

  async directory(filter: DirectoryFilter, includeHidden = false): Promise<Directory> {
    const [all, totals] = await Promise.all([
      includeHidden ? this.charities.listAll() : this.charities.listActive(),
      this.charities.listTotals(),
    ]);
    const byId = new Map(totals.map((t) => [t.charityId, t]));
    const listings = all.map((c) => ({ ...c, totals: byId.get(c.id) ?? zeroTotals(c.id) }));
    return {
      charities: filterCharities(listings, filter),
      categories: distinctValues(all, (c) => c.category),
      cities: distinctValues(all, (c) => c.city),
    };
  }

  async featured(): Promise<CharityListing | null> {
    const { charities } = await this.directory({});
    return charities.find((c) => c.featuredRank === 1) ?? charities[0] ?? null;
  }

  async profile(slug: string, now = new Date()): Promise<CharityProfile> {
    const charity = await this.charities.findBySlug(slug);
    if (!charity) throw new NotFoundError("That charity isn't listed.");
    return this.assemble(charity, now);
  }

  async profileById(id: string, now = new Date()): Promise<CharityProfile> {
    const charity = await this.charities.findById(id);
    if (!charity) throw new NotFoundError("That charity isn't listed.");
    return this.assemble(charity, now);
  }

  async saveCharity(input: CharityInput, id?: string): Promise<Charity> {
    const slug = slugify(input.name);
    if (!slug) throw new ValidationError("Give the charity a name.", "name");
    const write: CharityWrite = { ...input, slug };
    return id ? this.charities.update(id, write) : this.charities.create(write);
  }

  setFeatured(id: string): Promise<void> {
    return this.charities.setFeatured(id);
  }

  /** Soft-delete. Returns how many members still direct their subscription here, for the message. */
  async deactivate(id: string): Promise<number> {
    await this.charities.setActive(id, false);
    return this.charities.subscriberCount(id);
  }

  reactivate(id: string): Promise<void> {
    return this.charities.setActive(id, true);
  }

  async uploadMedia(charityId: string, role: MediaRole, file: File, alt: string): Promise<void> {
    const extension = EXTENSION[file.type];
    if (!extension || file.size <= 0 || file.size > CHARITY_MEDIA.MAX_BYTES) {
      throw new ValidationError(MEDIA_MESSAGE, "file");
    }
    const stamp = Date.now();
    const path = await this.media.upload(`${charityId}/${role}-${stamp}.${extension}`, file);
    if (role === "cover") await this.charities.setCoverPath(charityId, path);
    else await this.charities.addMedia(charityId, path, alt);
  }

  async removeMedia(charityId: string, mediaId: string): Promise<void> {
    const item = (await this.charities.listMedia(charityId)).find((m) => m.id === mediaId);
    if (!item) throw new NotFoundError("That photo is already gone.");
    await this.charities.removeMedia(mediaId);
    if (!item.storagePath.startsWith("seed/")) await this.media.remove(item.storagePath);
  }

  async saveEvent(write: EventWrite): Promise<CharityEvent> {
    if (!write.title.trim()) throw new ValidationError("Give the event a title.", "title");
    return this.charities.upsertEvent(write);
  }

  async deleteEvent(eventId: string): Promise<void> {
    await this.charities.deleteEvent(eventId);
  }

  private async assemble(charity: Charity, now: Date): Promise<CharityProfile> {
    const [media, events, totals] = await Promise.all([
      this.charities.listMedia(charity.id),
      this.charities.listUpcomingEvents(charity.id, now),
      this.charities.listTotals(),
    ]);
    return {
      charity,
      media,
      events,
      totals: totals.find((t) => t.charityId === charity.id) ?? zeroTotals(charity.id),
    };
  }
}
