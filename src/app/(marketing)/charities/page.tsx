import type { Metadata } from "next";
import Link from "next/link";
import { createCharityService } from "@/lib/charities";
import { cn } from "@/lib/cn";
import { CharityCard } from "@/components/charity/CharityCard";
import { CharitySpotlight } from "@/components/charity/CharitySpotlight";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Charities",
  description:
    "Seven charities across Telangana and Andhra. Pick the one your Kindscore subscription supports, or give once.",
};

type Search = { q?: string; category?: string; city?: string };

function href(search: Search, patch: Partial<Search>): string {
  const params = new URLSearchParams();
  const next = { ...search, ...patch };
  for (const [key, value] of Object.entries(next)) if (value) params.set(key, value);
  const query = params.toString();
  return query ? `/charities?${query}` : "/charities";
}

/** PRD §08.2 — the directory: search, filter by cause and city, the spotlight on top. */
export default async function CharitiesPage({ searchParams }: PageProps<"/charities">) {
  const search = (await searchParams) as Search;
  const service = await createCharityService();
  const filter = { query: search.q, category: search.category, city: search.city };
  const [{ charities, categories, cities }, featured] = await Promise.all([
    service.directory(filter),
    service.featured(),
  ]);
  const filtering = Boolean(search.q || search.category || search.city);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-12">
      <header className="flex flex-col gap-3">
        <h1 className="text-5xl">Where the saffron goes.</h1>
        <p className="max-w-prose text-lg text-ink-2">
          At least 10% of every subscription — up to 70% if you choose — goes to one of these. Every
          rupee shown here is from the ledger.
        </p>
      </header>

      {!filtering && featured && <CharitySpotlight charity={featured} />}

      <form action="/charities" method="get" className="flex flex-col gap-4" role="search">
        <div className="flex flex-wrap gap-3">
          <input
            type="search"
            name="q"
            defaultValue={search.q ?? ""}
            placeholder="Search by name, cause or city"
            aria-label="Search charities"
            className="h-11 w-full max-w-md rounded-md border border-line bg-surface px-3 text-[16px] focus:border-saffron focus:outline-none"
          />
          {search.category && <input type="hidden" name="category" value={search.category} />}
          {search.city && <input type="hidden" name="city" value={search.city} />}
          <Button type="submit" variant="ink">
            Search
          </Button>
        </div>
        <Chips
          label="Cause"
          values={categories}
          active={search.category}
          hrefFor={(v) => href(search, { category: v })}
        />
        <Chips
          label="City"
          values={cities}
          active={search.city}
          hrefFor={(v) => href(search, { city: v })}
        />
      </form>

      {charities.length === 0 ? (
        <EmptyState
          title="Nothing matches"
          body="Try another word, or clear the filters."
          action={
            <Link href="/charities">
              <Button size="sm">Clear filters</Button>
            </Link>
          }
        />
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-label="Charities">
          {charities.map((charity) => (
            <li key={charity.id}>
              <CharityCard charity={charity} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Chips({
  label,
  values,
  active,
  hrefFor,
}: {
  label: string;
  values: string[];
  active?: string;
  hrefFor: (value?: string) => string;
}) {
  if (values.length === 0) return null;
  return (
    <nav
      className="flex flex-wrap items-center gap-2"
      aria-label={`Filter by ${label.toLowerCase()}`}
    >
      <span className="text-xs font-medium uppercase tracking-[0.06em] text-ink-2">{label}</span>
      <Link
        href={hrefFor(undefined)}
        className={cn(
          "rounded-full border px-3 py-1 text-sm",
          !active ? "border-ink bg-ink text-bg" : "border-line hover:bg-surface-2",
        )}
      >
        All
      </Link>
      {values.map((value) => (
        <Link
          key={value}
          href={hrefFor(value)}
          className={cn(
            "rounded-full border px-3 py-1 text-sm",
            active === value ? "border-ink bg-ink text-bg" : "border-line hover:bg-surface-2",
          )}
        >
          {value}
        </Link>
      ))}
    </nav>
  );
}
