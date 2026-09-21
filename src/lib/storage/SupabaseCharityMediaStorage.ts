import { CHARITY_MEDIA } from "@/config/constants";
import { ExternalServiceError } from "@/engine/errors";
import type { CharityMediaStorage } from "@/lib/storage/CharityMediaStorage";
import type { Db } from "@/repositories/supabase/db";

/** Runs on the admin's own client — the bucket policy allows writes for is_admin() only. */
export class SupabaseCharityMediaStorage implements CharityMediaStorage {
  constructor(private readonly db: Db) {}

  async upload(path: string, file: File): Promise<string> {
    const { error } = await this.db.storage
      .from(CHARITY_MEDIA.BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
    if (error) throw new ExternalServiceError("Charity media", error);
    return path;
  }

  async remove(path: string): Promise<void> {
    const { error } = await this.db.storage.from(CHARITY_MEDIA.BUCKET).remove([path]);
    if (error) throw new ExternalServiceError("Charity media", error);
  }
}
