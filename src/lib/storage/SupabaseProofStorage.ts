import { PROOF_UPLOAD } from "@/config/constants";
import { ExternalServiceError } from "@/engine/errors";
import type { ProofStorage } from "@/lib/storage/ProofStorage";
import type { Db } from "@/repositories/supabase/db";

/** Signed URLs live ten minutes — long enough to look at a screenshot, too short to share. */
const SIGNED_URL_SECONDS = 600;

/**
 * Runs on the caller's own client: a member can only write inside their folder and read their
 * own files, an admin can read every proof (storage policies, migration 8).
 */
export class SupabaseProofStorage implements ProofStorage {
  constructor(private readonly db: Db) {}

  async upload(path: string, file: File): Promise<void> {
    const { error } = await this.db.storage
      .from(PROOF_UPLOAD.BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type });
    if (error) throw new ExternalServiceError("Proof storage", error);
  }

  async signedUrl(path: string): Promise<string> {
    const { data, error } = await this.db.storage
      .from(PROOF_UPLOAD.BUCKET)
      .createSignedUrl(path, SIGNED_URL_SECONDS);
    if (error || !data) throw new ExternalServiceError("Proof storage", error);
    return data.signedUrl;
  }
}
