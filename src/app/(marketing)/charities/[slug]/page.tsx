import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { formatInr } from "@/engine/money/paise";
import { getAccess } from "@/lib/auth/access";
import { createCharityService } from "@/lib/charities";
import { charityImageUrl } from "@/lib/charityImages";
import { createDonationSyncService } from "@/lib/donations";
import { ChooseCharityButton } from "@/app/(marketing)/charities/[slug]/ChooseCharityButton";
import { DonateForm } from "@/components/charity/DonateForm";
import { EventList } from "@/components/charity/EventList";
import { Button } from "@/components/ui/Button";
import { Badge, Banner, Card, Figure, Rule } from "@/components/ui/primitives";

type Search = { session_id?: string; donated?: string; canceled?: string };

export async function generateMetadata({
  params,
}: PageProps<"/charities/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const profile = await (await createCharityService()).profile(slug).catch(() => null);
  return profile
    ? { title: profile.charity.name, description: profile.charity.tagline }
    : { title: "Charity" };
}

/**
 * PRD §08.2 profile: story, photos, upcoming events, what has been given — and the two actions,
 * choose this charity (members) and donate once. Coming back from Stripe with a session id runs
 * the same idempotent sync as the webhook, then redirects clean.
 */
export default async function CharityProfilePage({
  params,
  searchParams,
}: PageProps<"/charities/[slug]">) {
  const { slug } = await params;
  const search = (await searchParams) as Search;
  const service = await createCharityService();
  const profile = await service.profile(slug).catch(() => null);
  if (!profile) notFound();

  if (search.session_id) {
    const outcome = await createDonationSyncService().syncFromCheckout(search.session_id);
    redirect(`/charities/${slug}?donated=${outcome === "not_complete" ? "pending" : "1"}`);
  }

  const access = await getAccess();
  const { charity, media, events, totals } = profile;
  const cover = charityImageUrl(charity.coverPath);
  const isMine = access.kind !== "anonymous" && access.profile.charity_id === charity.id;

  return (
    <article className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-12">
      <header className="flex flex-col gap-4">
        <p className="text-sm text-ink-2">
          <Link href="/charities" className="hover:text-ink">
            Charities
          </Link>{" "}
          / {charity.category} · {charity.city}
        </p>
        <h1 className="text-5xl">{charity.name}</h1>
        <p className="font-display text-2xl text-saffron">{charity.outcomeLine}</p>
        <p className="max-w-prose text-lg text-ink-2">{charity.tagline}</p>
      </header>

      {search.donated === "1" && (
        <Banner tone="success">
          Thank you — your donation has reached the ledger. Every rupee of it goes to {charity.name}
          .
        </Banner>
      )}
      {search.donated === "pending" && (
        <Banner tone="warn">
          Payment received — recording your donation. Refresh in a moment.
        </Banner>
      )}
      {search.canceled === "1" && <Banner tone="neutral">No charge was made.</Banner>}

      {cover && (
        <div className="relative aspect-[16/9] overflow-hidden rounded-lg bg-surface-2">
          <Image
            src={cover}
            alt={media[0]?.alt ?? ""}
            fill
            sizes="(min-width: 1024px) 60rem, 100vw"
            className="object-cover"
            priority
          />
        </div>
      )}

      <div className="grid gap-8 md:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-8">
          <section
            className="prose-kind flex flex-col gap-4 text-lg leading-relaxed"
            aria-label="Story"
          >
            {charity.description.split(/\n\s*\n/).map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </section>
          {media.length > 0 && (
            <section className="flex flex-col gap-3" aria-label="Photos">
              <h2 className="text-2xl">In pictures</h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {media.map((item) => {
                  const src = charityImageUrl(item.storagePath);
                  return (
                    src && (
                      <li
                        key={item.id}
                        className="relative aspect-[4/3] overflow-hidden rounded-md bg-surface-2"
                      >
                        <Image
                          src={src}
                          alt={item.alt}
                          fill
                          sizes="(min-width: 640px) 30rem, 100vw"
                          className="object-cover"
                        />
                      </li>
                    )
                  );
                })}
              </ul>
            </section>
          )}
          <section className="flex flex-col gap-3" aria-label="Upcoming events">
            <h2 className="text-2xl">Upcoming events</h2>
            <EventList events={events} />
          </section>
        </div>

        <aside className="flex flex-col gap-6 self-start md:sticky md:top-24">
          <Card className="flex flex-col gap-4">
            <Figure
              label="Given so far"
              value={formatInr(totals.totalPaise)}
              hint={`${totals.contributorCount} ${totals.contributorCount === 1 ? "member" : "members"}`}
              accent
            />
            <Rule />
            {access.kind === "anonymous" ? (
              <>
                <Link href={`/signup?charity=${charity.slug}`}>
                  <Button variant="saffron" className="w-full">
                    Subscribe and support {charity.name.split(" ")[0]}
                  </Button>
                </Link>
                <p className="text-sm text-ink-2">
                  Already a member?{" "}
                  <Link
                    href={`/login?next=/charities/${charity.slug}`}
                    className="underline underline-offset-4"
                  >
                    Log in
                  </Link>{" "}
                  to choose this charity or donate.
                </p>
              </>
            ) : isMine ? (
              <p className="flex items-center gap-2 text-sm">
                <Badge tone="saffron">Your charity</Badge> {access.profile.charity_bps / 100}% of
                every payment
              </p>
            ) : (
              <ChooseCharityButton charityId={charity.id} charityName={charity.name} />
            )}
            {charity.websiteUrl && (
              <a
                href={charity.websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-ink-2 underline underline-offset-4 hover:text-ink"
              >
                Their website ↗
              </a>
            )}
          </Card>
          {access.kind !== "anonymous" && (
            <Card className="flex flex-col gap-4">
              <h2 className="text-2xl">Donate once</h2>
              <DonateForm
                charityId={charity.id}
                charityName={charity.name}
                returnTo={`/charities/${charity.slug}`}
              />
            </Card>
          )}
        </aside>
      </div>
    </article>
  );
}
