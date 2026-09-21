import { ConflictError, ExternalServiceError, NotFoundError } from "@/engine/errors";
import type {
  Charity,
  CharityEvent,
  CharityMedia,
  CharityRepository,
  CharityTotals,
  CharityWrite,
  EventWrite,
} from "@/repositories/interfaces/CharityRepository";
import { PG_UNIQUE_VIOLATION, type Db } from "@/repositories/supabase/db";
import type { Database } from "@/types/database.types";

type Row = Database["public"]["Tables"]["charities"]["Row"];
type MediaRow = Database["public"]["Tables"]["charity_media"]["Row"];
type EventRow = Database["public"]["Tables"]["charity_events"]["Row"];

function toCharity(row: Row): Charity {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    description: row.description,
    category: row.category,
    city: row.city,
    outcomeLine: row.outcome_line,
    coverPath: row.cover_path,
    websiteUrl: row.website_url,
    featuredRank: row.featured_rank,
    isActive: row.is_active,
  };
}

function toMedia(row: MediaRow): CharityMedia {
  return {
    id: row.id,
    charityId: row.charity_id,
    storagePath: row.storage_path,
    alt: row.alt,
    sortOrder: row.sort_order,
  };
}

function toEvent(row: EventRow): CharityEvent {
  return {
    id: row.id,
    charityId: row.charity_id,
    title: row.title,
    description: row.description,
    startsAt: row.starts_at,
    location: row.location,
  };
}

function toColumns(write: CharityWrite) {
  return {
    name: write.name,
    slug: write.slug,
    tagline: write.tagline,
    description: write.description,
    category: write.category,
    city: write.city,
    outcome_line: write.outcomeLine,
    website_url: write.websiteUrl,
  };
}

export class SupabaseCharityRepository implements CharityRepository {
  constructor(private readonly db: Db) {}

  async listActive(): Promise<Charity[]> {
    const { data, error } = await this.db
      .from("charities")
      .select("*")
      .eq("is_active", true)
      .order("name");
    if (error) throw new ExternalServiceError("Charities", error);
    return data.map(toCharity);
  }

  async listAll(): Promise<Charity[]> {
    const { data, error } = await this.db.from("charities").select("*").order("name");
    if (error) throw new ExternalServiceError("Charities", error);
    return data.map(toCharity);
  }

  async findBySlug(slug: string): Promise<Charity | null> {
    const { data, error } = await this.db
      .from("charities")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw new ExternalServiceError("Charities", error);
    return data ? toCharity(data) : null;
  }

  async findById(id: string): Promise<Charity | null> {
    const { data, error } = await this.db.from("charities").select("*").eq("id", id).maybeSingle();
    if (error) throw new ExternalServiceError("Charities", error);
    return data ? toCharity(data) : null;
  }

  async listMedia(charityId: string): Promise<CharityMedia[]> {
    const { data, error } = await this.db
      .from("charity_media")
      .select("*")
      .eq("charity_id", charityId)
      .order("sort_order");
    if (error) throw new ExternalServiceError("Charities", error);
    return data.map(toMedia);
  }

  async listUpcomingEvents(charityId: string, now: Date): Promise<CharityEvent[]> {
    const { data, error } = await this.db
      .from("charity_events")
      .select("*")
      .eq("charity_id", charityId)
      .gte("starts_at", now.toISOString())
      .order("starts_at");
    if (error) throw new ExternalServiceError("Charities", error);
    return data.map(toEvent);
  }

  async listTotals(): Promise<CharityTotals[]> {
    const { data, error } = await this.db
      .from("charity_totals")
      .select("charity_id, total_paise, contributor_count");
    if (error) throw new ExternalServiceError("Charities", error);
    return data.map((row) => ({
      charityId: row.charity_id!,
      totalPaise: row.total_paise ?? 0,
      contributorCount: row.contributor_count ?? 0,
    }));
  }

  async subscriberCount(charityId: string): Promise<number> {
    const { count, error } = await this.db
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("charity_id", charityId);
    if (error) throw new ExternalServiceError("Charities", error);
    return count ?? 0;
  }

  async create(write: CharityWrite): Promise<Charity> {
    const { data, error } = await this.db
      .from("charities")
      .insert(toColumns(write))
      .select("*")
      .single();
    if (error?.code === PG_UNIQUE_VIOLATION)
      throw new ConflictError("A charity with that name already exists.");
    if (error) throw new ExternalServiceError("Charities", error);
    return toCharity(data);
  }

  async update(id: string, write: CharityWrite): Promise<Charity> {
    const { data, error } = await this.db
      .from("charities")
      .update(toColumns(write))
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error?.code === PG_UNIQUE_VIOLATION)
      throw new ConflictError("A charity with that name already exists.");
    if (error) throw new ExternalServiceError("Charities", error);
    if (!data) throw new NotFoundError("That charity doesn't exist.");
    return toCharity(data);
  }

  async setCoverPath(id: string, path: string | null): Promise<void> {
    const { error } = await this.db.from("charities").update({ cover_path: path }).eq("id", id);
    if (error) throw new ExternalServiceError("Charities", error);
  }

  async setActive(id: string, active: boolean): Promise<void> {
    const { error } = await this.db.from("charities").update({ is_active: active }).eq("id", id);
    if (error) throw new ExternalServiceError("Charities", error);
  }

  /** Two statements, no transaction: a brief moment with zero featured charities is harmless. */
  async setFeatured(id: string): Promise<void> {
    const clear = await this.db
      .from("charities")
      .update({ featured_rank: null })
      .not("featured_rank", "is", null);
    if (clear.error) throw new ExternalServiceError("Charities", clear.error);
    const set = await this.db.from("charities").update({ featured_rank: 1 }).eq("id", id);
    if (set.error) throw new ExternalServiceError("Charities", set.error);
  }

  async addMedia(charityId: string, storagePath: string, alt: string): Promise<CharityMedia> {
    const existing = await this.listMedia(charityId);
    const sortOrder = (existing.at(-1)?.sortOrder ?? -1) + 1;
    const { data, error } = await this.db
      .from("charity_media")
      .insert({ charity_id: charityId, storage_path: storagePath, alt, sort_order: sortOrder })
      .select("*")
      .single();
    if (error) throw new ExternalServiceError("Charities", error);
    return toMedia(data);
  }

  async removeMedia(mediaId: string): Promise<void> {
    const { error } = await this.db.from("charity_media").delete().eq("id", mediaId);
    if (error) throw new ExternalServiceError("Charities", error);
  }

  async upsertEvent(write: EventWrite): Promise<CharityEvent> {
    const columns = {
      charity_id: write.charityId,
      title: write.title,
      description: write.description,
      starts_at: write.startsAt,
      location: write.location,
    };
    const query = write.id
      ? this.db.from("charity_events").update(columns).eq("id", write.id).select("*").single()
      : this.db.from("charity_events").insert(columns).select("*").single();
    const { data, error } = await query;
    if (error) throw new ExternalServiceError("Charities", error);
    return toEvent(data);
  }

  async deleteEvent(eventId: string): Promise<void> {
    const { error } = await this.db.from("charity_events").delete().eq("id", eventId);
    if (error) throw new ExternalServiceError("Charities", error);
  }
}
