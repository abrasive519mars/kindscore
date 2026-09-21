/** The public face of a charity, as the directory needs it. Storage adds ids, media and money. */
export interface DirectoryCharity {
  readonly name: string;
  readonly tagline: string;
  readonly category: string;
  readonly city: string;
}

export interface DirectoryFilter {
  readonly query?: string;
  readonly category?: string;
  readonly city?: string;
}

function normalise(text: string): string {
  return text.trim().toLowerCase();
}

function matchesQuery(charity: DirectoryCharity, query: string): boolean {
  const haystack = [charity.name, charity.tagline, charity.category, charity.city].map(normalise);
  return haystack.some((field) => field.includes(query));
}

/**
 * PRD §08.2 "search / filter". Case-insensitive; the free-text query matches name, tagline,
 * category or city; the chips narrow further. Everything ANDs. Pure, so the same rule serves the
 * page, a future API and the tests.
 */
export function filterCharities<T extends DirectoryCharity>(
  charities: readonly T[],
  filter: DirectoryFilter,
): T[] {
  const query = normalise(filter.query ?? "");
  const category = normalise(filter.category ?? "");
  const city = normalise(filter.city ?? "");
  return charities.filter(
    (charity) =>
      (query === "" || matchesQuery(charity, query)) &&
      (category === "" || normalise(charity.category) === category) &&
      (city === "" || normalise(charity.city) === city),
  );
}

/** Distinct, sorted values for the filter chips. */
export function distinctValues<T>(items: readonly T[], pick: (item: T) => string): string[] {
  return [...new Set(items.map(pick).filter((v) => v.trim() !== ""))].sort((a, b) =>
    a.localeCompare(b),
  );
}

/** "Udaan Girls' Sports Collective" → "udaan-girls-sports-collective". */
export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
