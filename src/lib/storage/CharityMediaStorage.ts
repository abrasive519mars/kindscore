/**
 * Where charity covers and gallery photos live: a public bucket the admin writes to. The stored
 * path is what `charityImageUrl` turns into a URL; nothing else needs to know about buckets.
 */
export interface CharityMediaStorage {
  /** Upsert at the given path; returns the same path for storing on the row. */
  upload(path: string, file: File): Promise<string>;
  remove(path: string): Promise<void>;
}
