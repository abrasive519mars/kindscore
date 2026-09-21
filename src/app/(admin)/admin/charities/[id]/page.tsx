import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatInr } from "@/engine/money/paise";
import { createCharityService } from "@/lib/charities";
import { CharityForm } from "@/app/(admin)/admin/charities/[id]/CharityForm";
import { EventsPanel } from "@/app/(admin)/admin/charities/[id]/EventsPanel";
import { MediaPanel } from "@/app/(admin)/admin/charities/[id]/MediaPanel";
import { VisibilityPanel } from "@/app/(admin)/admin/charities/[id]/VisibilityPanel";
import { Badge, Card, Figure } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Edit charity" };

/** One charity, everything the admin can change about it (PRD §11.03). */
export default async function AdminCharityPage({ params }: PageProps<"/admin/charities/[id]">) {
  const { id } = await params;
  const service = await createCharityService();
  const profile = await service.profileById(id).catch(() => null);
  if (!profile) notFound();
  const { charity, media, events, totals } = profile;
  const allEvents = await service.profileById(id, new Date(0)).then((p) => p.events);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <p className="text-sm text-ink-2">
          <Link href="/admin/charities" className="hover:text-ink">
            Charities
          </Link>{" "}
          / {charity.name}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-4xl">{charity.name}</h1>
          <span className="flex gap-2">
            {charity.featuredRank === 1 && <Badge tone="saffron">Spotlight</Badge>}
            <Badge tone={charity.isActive ? "success" : "neutral"}>
              {charity.isActive ? "Listed" : "Hidden"}
            </Badge>
          </span>
        </div>
        <p className="text-ink-2">
          <Link
            href={`/charities/${charity.slug}`}
            className="underline underline-offset-4 hover:text-ink"
          >
            See the public page ↗
          </Link>
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3" aria-label="Figures">
        <Card>
          <Figure label="Given" value={formatInr(totals.totalPaise)} accent />
        </Card>
        <Card>
          <Figure label="Contributors" value={totals.contributorCount} />
        </Card>
        <Card>
          <Figure label="Upcoming events" value={events.length} />
        </Card>
      </section>

      <Card className="flex flex-col gap-4">
        <h2 className="text-2xl">Details</h2>
        <CharityForm charity={charity} />
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-2xl">Photos</h2>
        <MediaPanel charityId={charity.id} coverPath={charity.coverPath} media={media} />
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-2xl">Events</h2>
        <EventsPanel charityId={charity.id} events={allEvents} />
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-2xl">Visibility</h2>
        <VisibilityPanel
          charityId={charity.id}
          isActive={charity.isActive}
          isFeatured={charity.featuredRank === 1}
        />
      </Card>
    </div>
  );
}
