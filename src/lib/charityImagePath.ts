const SEED_PREFIX = "seed/";

/**
 * A charity image path is one of two things: a seed file shipped in `public/seed/…` (the demo
 * charities) or an object the admin uploaded to the public bucket. Pure so it can be unit-tested
 * without environment; `charityImages.ts` binds the real storage origin.
 */
export function resolveCharityImageUrl(
  path: string | null | undefined,
  storageOrigin: string,
  bucket: string,
): string | null {
  if (!path) return null;
  if (path.startsWith(SEED_PREFIX)) return `/${path}`;
  return `${storageOrigin}/storage/v1/object/public/${bucket}/${path}`;
}
