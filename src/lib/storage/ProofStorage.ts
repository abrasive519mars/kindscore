/**
 * Where proof screenshots live. Two operations, nothing else: the app never lists, moves or
 * deletes proofs. Implemented on Supabase Storage; faked in tests.
 */
export interface ProofStorage {
  /** Upsert: a resubmission after rejection replaces the previous file at the same path. */
  upload(path: string, file: File): Promise<void>;
  /** A short-lived URL the winner or an admin can render; never a public link. */
  signedUrl(path: string): Promise<string>;
}
