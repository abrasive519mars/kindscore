import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatInr } from "@/engine/money/paise";
import { formatMonth } from "@/engine/time/dates";
import { createWinnerService } from "@/lib/winners";
import { ReviewPanel } from "@/app/(admin)/admin/winners/[id]/ReviewPanel";
import { DrawNumbers } from "@/components/draw/DrawNumbers";
import { ScoreRow } from "@/components/app/ScoreRow";
import { Badge, Banner, Card, Rule } from "@/components/ui/primitives";
import { Stepper } from "@/components/ui/Stepper";
import { claimStatus, claimSteps } from "@/components/winners/claimSteps";

export const metadata: Metadata = { title: "Claim" };

/** One claim for the admin: who, what they won, the screenshot, and the one decision to make. */
export default async function AdminClaimPage({ params }: PageProps<"/admin/winners/[id]">) {
  const { id } = await params;
  const service = await createWinnerService();
  const claim = await service.getClaim(id).catch(() => null);
  if (!claim) notFound();

  const status = claimStatus(claim);
  const matched = new Set(claim.scores.filter((s) => claim.numbers.includes(s)));
  const proofUrl = claim.proofPath ? await service.proofUrl(claim.proofPath) : null;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <p className="text-sm text-ink-2">
          <Link href="/admin/winners" className="hover:text-ink">
            Winners
          </Link>{" "}
          / {claim.fullName}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-4xl">
            {claim.fullName} · {formatInr(claim.prizePaise)}
          </h1>
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
        <p className="text-ink-2">
          {claim.email} · {formatMonth(claim.drawMonth)} · {claim.matchCount} matches
        </p>
      </header>

      <Card className="flex flex-col gap-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium uppercase tracking-[0.06em] text-ink-2">Member&apos;s five scores at draw time</p>
            <ScoreRow scores={claim.scores} matched={matched} size="md" />
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium uppercase tracking-[0.06em] text-ink-2">Drawn numbers</p>
            <DrawNumbers numbers={claim.numbers} matched={matched} />
          </div>
        </div>
        <Rule />
        <Stepper steps={claimSteps(claim)} />
        {claim.reviewNote && <Banner tone={claim.review === "rejected" ? "danger" : "neutral"}>Note to member: “{claim.reviewNote}”</Banner>}
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-2xl">Proof</h2>
        {proofUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed, short-lived URL; not an optimisable asset
          <img src={proofUrl} alt={`Proof uploaded by ${claim.fullName}`} className="max-h-[32rem] w-auto rounded-md border border-line" />
        ) : (
          <p className="text-sm text-ink-2">No screenshot yet — the member hasn&apos;t uploaded one.</p>
        )}
        <ReviewPanel verificationId={claim.verificationId} review={claim.review} payout={claim.payout} />
      </Card>
    </div>
  );
}
