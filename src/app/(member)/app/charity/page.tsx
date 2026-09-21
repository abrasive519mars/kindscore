import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PLANS } from "@/config/constants";
import { formatInr } from "@/engine/money/paise";
import { getAccess, type SignedInAccess } from "@/lib/auth/access";
import { createCharityService, createMemberCharityService } from "@/lib/charities";
import { charityImageUrl } from "@/lib/charityImages";
import { createDonationSyncService } from "@/lib/donations";
import { CharityChoiceForm } from "@/app/(member)/app/charity/CharityChoiceForm";
import { DonateForm } from "@/components/charity/DonateForm";
import { SplitBar } from "@/components/ui/Split";
import { Badge, Banner, Card, EmptyState, Figure } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Your charity" };

type Search = { session_id?: string; donated?: string; canceled?: string };

function formatDay(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

/** PRD §08.1 — the member's charity, their share of every payment, a one-off gift, and everything given so far. */
export default async function MemberCharityPage({ searchParams }: PageProps<"/app/charity">) {
  const search = (await searchParams) as Search;
  if (search.session_id) {
    const outcome = await createDonationSyncService().syncFromCheckout(search.session_id);
    redirect(`/app/charity?donated=${outcome === "not_complete" ? "pending" : "1"}`);
  }

  const access = (await getAccess()) as SignedInAccess;
  const [state, { charities }] = await Promise.all([
    (await createMemberCharityService()).current(access.userId),
    (await createCharityService()).directory({}),
  ]);
  const { charity, profile, contributions, totalGivenPaise } = state;
  const cover = charityImageUrl(charity?.coverPath);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-4xl">Your charity</h1>
        <p className="text-ink-2">
          The saffron part of every payment. Raise it any time; the pool and the platform adjust
          around it.
        </p>
      </header>

      {search.donated === "1" && (
        <Banner tone="success">Thank you — your donation is in the ledger.</Banner>
      )}
      {search.donated === "pending" && (
        <Banner tone="warn">
          Payment received — recording your donation. Refresh in a moment.
        </Banner>
      )}
      {search.canceled === "1" && <Banner tone="neutral">No charge was made.</Banner>}

      <section className="grid gap-6 md:grid-cols-[1fr_1fr]" aria-label="Current charity">
        <Card className="flex flex-col gap-4">
          {charity ? (
            <>
              {cover && (
                <div className="relative aspect-[16/9] overflow-hidden rounded-md bg-surface-2">
                  <Image
                    src={cover}
                    alt=""
                    fill
                    sizes="(min-width: 768px) 40rem, 100vw"
                    className="object-cover"
                  />
                </div>
              )}
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-2xl">
                  <Link href={`/charities/${charity.slug}`} className="hover:text-saffron">
                    {charity.name}
                  </Link>
                </h2>
                <Badge tone="saffron">{profile.charityBps / 100}% of every payment</Badge>
              </div>
              <p className="font-display text-xl text-saffron">{charity.outcomeLine}</p>
              <SplitBar amountPaise={PLANS.month.pricePaise} charityBps={profile.charityBps} />
            </>
          ) : (
            <EmptyState
              title="Choose a charity"
              body="Part of every payment goes to a cause you pick."
            />
          )}
        </Card>
        <Card className="flex flex-col gap-4">
          <h2 className="text-2xl">Change it</h2>
          <CharityChoiceForm
            charities={charities.map((c) => ({
              id: c.id,
              name: c.name,
              city: c.city,
              outcomeLine: c.outcomeLine,
            }))}
            currentCharityId={profile.charityId}
            currentBps={profile.charityBps}
          />
        </Card>
      </section>

      <section className="grid gap-6 md:grid-cols-[1fr_1fr]" aria-label="Giving">
        <Card className="flex flex-col gap-4">
          <h2 className="text-2xl">Donate once</h2>
          <p className="text-sm text-ink-2">
            Not tied to the draw. Goes straight to your charity, in full.
          </p>
          {charity ? (
            <DonateForm charityId={charity.id} charityName={charity.name} returnTo="/app/charity" />
          ) : (
            <EmptyState
              title="Pick a charity first"
              body="Then you can give once, any amount from ₹10."
            />
          )}
        </Card>
        <Card className="flex flex-col gap-4">
          <Figure
            label="Given so far"
            value={formatInr(totalGivenPaise)}
            hint={`${contributions.length} ${contributions.length === 1 ? "contribution" : "contributions"}`}
            accent
          />
          {contributions.length > 0 && (
            <ul className="flex flex-col divide-y divide-line text-sm">
              {contributions.slice(0, 8).map((c) => (
                <li key={c.id} className="flex items-baseline justify-between gap-3 py-2">
                  <span>
                    {c.source === "donation" ? "Donation" : "Subscription share"} · {c.charityName}
                    <span className="block text-xs text-ink-2">{formatDay(c.createdAt)}</span>
                  </span>
                  <span className="num font-medium">{formatInr(c.amountPaise)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}
