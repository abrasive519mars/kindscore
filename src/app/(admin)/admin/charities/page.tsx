import type { Metadata } from "next";
import Link from "next/link";
import { formatInr } from "@/engine/money/paise";
import { createCharityService } from "@/lib/charities";
import { Button } from "@/components/ui/Button";
import { Badge, Card, EmptyState } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Charities" };

/** PRD §11.03 — every charity, hidden ones included, with what has been given to each. */
export default async function AdminCharitiesPage() {
  const { charities } = await (await createCharityService()).directory({}, true);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-4xl">Charities</h1>
          <p className="text-ink-2">
            Stories, photos and events members see. One is the homepage spotlight.
          </p>
        </div>
        <Link href="/admin/charities/new">
          <Button variant="saffron" size="sm">
            New charity
          </Button>
        </Link>
      </header>

      {charities.length === 0 ? (
        <EmptyState
          title="Add your first charity"
          body="Members pick one at signup, so add at least one before opening the doors."
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-[0.06em] text-ink-2">
              <tr>
                <th className="px-4 py-3 font-medium">Charity</th>
                <th className="px-4 py-3 font-medium">Cause · city</th>
                <th className="px-4 py-3 text-right font-medium">Given</th>
                <th className="px-4 py-3 text-right font-medium">Members</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {charities.map((c) => (
                <tr key={c.id} className={c.isActive ? undefined : "text-ink-3"}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/charities/${c.id}`}
                      className="font-medium hover:text-saffron"
                    >
                      {c.name}
                    </Link>
                    <span className="block text-xs text-ink-2">/{c.slug}</span>
                  </td>
                  <td className="px-4 py-3">
                    {c.category} · {c.city}
                  </td>
                  <td className="num px-4 py-3 text-right">{formatInr(c.totals.totalPaise)}</td>
                  <td className="num px-4 py-3 text-right">{c.totals.contributorCount}</td>
                  <td className="flex gap-2 px-4 py-3">
                    {c.featuredRank === 1 && <Badge tone="saffron">Spotlight</Badge>}
                    <Badge tone={c.isActive ? "success" : "neutral"}>
                      {c.isActive ? "Listed" : "Hidden"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
