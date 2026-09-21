import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatInr } from "@/engine/money/paise";
import { formatMonth } from "@/engine/time/dates";
import { getAccess, type SignedInAccess } from "@/lib/auth/access";
import { createWinnerService } from "@/lib/winners";
import { ProofForm } from "@/app/(member)/app/winnings/[id]/ProofForm";
import { DrawNumbers } from "@/components/draw/DrawNumbers";
import { ScoreRow } from "@/components/app/ScoreRow";
import { Badge, Banner, Card, Figure, Rule } from "@/components/ui/primitives";
import { Stepper } from "@/components/ui/Stepper";
import { canSubmitProof, claimStatus, claimSteps } from "@/components/winners/claimSteps";

export const metadata: Metadata = { title: "Your win" };

/** One claim: what was won, where it stands, and the one thing the winner has to do. */
export default async function WinningPage({ params }: PageProps<"/app/winnings/[id]">) {
  const { id } = await params;
  const access = (await getAccess()) as SignedInAccess;
  const service = await createWinnerService();
  const record = await service.getWinning(access.userId, id).catch(() => null);
  if (!record) notFound();

  const status = claimStatus(record);
  const matched = new Set(record.scores.filter((s) => record.numbers.includes(s)));
  const proofUrl = record.proofPath && !canSubmitProof(record) ? await service.proofUrl(record.proofPath) : null;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <p className="text-sm text-ink-2">
          <Link href="/app/winnings" className="hover:text-ink">
            Winnings
          </Link>{" "}
          / {formatMonth(record.drawMonth)}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-4xl">
            {record.matchCount} matches · {formatInr(record.prizePaise)}
          </h1>
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
      </header>

      <Card className="flex flex-col gap-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium uppercase tracking-[0.06em] text-ink-2">Your five scores</p>
            <ScoreRow scores={record.scores} matched={matched} size="md" />
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium uppercase tracking-[0.06em] text-ink-2">{formatMonth(record.drawMonth)} draw</p>
            <DrawNumbers numbers={record.numbers} matched={matched} />
          </div>
        </div>
        <Rule />
        <Stepper steps={claimSteps(record)} />
        {record.review === "rejected" && record.reviewNote && (
          <Banner tone="danger">
            Rejected: “{record.reviewNote}”{" "}
            {canSubmitProof(record) ? "You can upload one more screenshot." : "This was the second review, so the claim is closed."}
          </Banner>
        )}
        {record.payout === "paid" && <Banner tone="success">Paid. Thank you for playing — and for giving.</Banner>}
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-2xl">Proof of your scores</h2>
        <p className="text-sm text-ink-2">
          A screenshot from the app or club system where these rounds were recorded, showing the five scores and their dates. PNG, JPG or WebP, up to 5 MB. Only you and the admin can see it.
        </p>
        {canSubmitProof(record) ? (
          <ProofForm verificationId={record.verificationId} again={record.review === "rejected"} />
        ) : proofUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed, short-lived URL; not an optimisable asset
          <img src={proofUrl} alt="Your uploaded proof" className="max-h-96 w-auto rounded-md border border-line" />
        ) : (
          <Figure label="Status" value={<span className="text-2xl">{status.label}</span>} />
        )}
      </Card>
    </div>
  );
}
