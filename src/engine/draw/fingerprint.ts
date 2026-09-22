import type { EligibleEntry } from "@/engine/draw/eligibility";

/**
 * A change detector for the stale-draft guard (GAME.md §7): the same set of entries with the
 * same scores always gives the same string; any edit, addition or removal changes it.
 * FNV-1a over a canonical text — not a security hash, so no crypto dependency, synchronous,
 * and identical in Node and the browser.
 */

// BigInt() calls rather than literals: the build targets ES2017 syntax while the runtime has BigInt.
const FNV_OFFSET = BigInt("0xcbf29ce484222325");
const FNV_PRIME = BigInt("0x100000001b3");
const MASK_64 = BigInt("0xffffffffffffffff");

function fnv1a64(text: string): string {
  let hash = FNV_OFFSET;
  for (const char of new TextEncoder().encode(text)) {
    hash ^= BigInt(char);
    hash = (hash * FNV_PRIME) & MASK_64;
  }
  return hash.toString(16).padStart(16, "0");
}

/** Order-independent: entries are sorted by userId, scores kept in the order they were given. */
export function canonicalEntries(entries: readonly EligibleEntry[]): string {
  return [...entries]
    .sort((a, b) => (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0))
    .map((entry) => `${entry.userId}:${entry.scores.join(",")}`)
    .join("|");
}

/** What funds the pool at simulate time — a funder joining or lapsing must also stale the draft. */
export interface FundingBase {
  readonly activeSubscriberCount: number;
  readonly poolPaise: number;
}

export function entriesFingerprint(
  entries: readonly EligibleEntry[],
  funding?: FundingBase,
): string {
  const base = funding ? `#${funding.activeSubscriberCount}:${funding.poolPaise}` : "";
  return fnv1a64(canonicalEntries(entries) + base);
}
