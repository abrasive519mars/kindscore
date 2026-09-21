import { CHARITY_MEDIA } from "@/config/constants";
import { clientEnv } from "@/config/env";
import { resolveCharityImageUrl } from "@/lib/charityImagePath";

/** Seed files → `/seed/…`; admin uploads → the public bucket URL. See charityImagePath.ts. */
export function charityImageUrl(path: string | null | undefined): string | null {
  return resolveCharityImageUrl(path, clientEnv.NEXT_PUBLIC_SUPABASE_URL, CHARITY_MEDIA.BUCKET);
}
