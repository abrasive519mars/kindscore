import type { Metadata } from "next";
import Link from "next/link";
import { formatInr } from "@/engine/money/paise";
import { formatMonth } from "@/engine/time/dates";
import { getAccess, type SignedInAccess } from "@/lib/auth/access";
import { createWinnerService } from "@/lib/winners";
import type { WinningRecord } from "@/repositories/interfaces/WinnerRepository";
import { summariseWinnings } from "@/services/WinnerService";
import { Button } from "@/components/ui/Button";
import { Badge, Card, EmptyState, Figure } from "@/components/ui/primitives";
import { Stepper } from "@/components/ui/Stepper";
import {
  canClaimPayout,
  canSubmitProof,
  claimStatus,
  claimSteps,
} from "@/components/winners/claimSteps";

export const metadata: Metadata = { title: "Winnings" };

/** PRD §10 winnings overview: total won and payment status, then every win and where its claim stands. */
export default async function WinningsPage() {
  const access = (await getAccess()) as SignedInAccess;
  const records = await (await createWinnerService()).listWinnings(access.userId);
  const summary = summariseWinnings(records);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-4xl">Winnings</h1>
        <p className="text-ink-2">
          Three matches is all it takes. Winners prove their scores with one screenshot.
        </p>
      </header>

      <section className="grid gap-6 md:grid-cols-3" aria-label="Totals">
        <Card>
          <Figure
            label="Total won"
            value={formatInr(summary.totalWonPaise)}
            hint="Approved prizes"
            accent
          />
        </Card>
        <Card>
          <Figure label="Paid" value={formatInr(summary.paidPaise)} />
        </Card>
        <Card>
          <Figure
            label="Ready to claim"
            value={formatInr(summary.awaitingPayoutPaise)}
            hint={summary.unverifiedCount ? `${summary.unverifiedCount} more to verify` : undefined}
          />
        </Card>
      </section>

      <section className="flex flex-col gap-4" aria-label="Your wins">
        {records.length === 0 ? (
          <EmptyState
            title="No winnings yet"
            body="Match three of the five drawn numbers with your five scores and your prize appears here."
          />
        ) : (
          records.map((record) => <WinCard key={record.verificationId} record={record} />)
        )}
      </section>
    </div>
  );
}

function WinCard({ record }: { record: WinningRecord }) {
  const status = claimStatus(record);
  const href = `/app/winnings/${record.verificationId}`;
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-2xl">
          <Link href={href} className="hover:text-saffron">
            {formatMonth(record.drawMonth)} · {record.matchCount} matches
          </Link>
        </h2>
        <span className="num font-display text-3xl">{formatInr(record.prizePaise)}</span>
      </div>
      <Stepper steps={claimSteps(record)} />
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone={status.tone}>{status.label}</Badge>
        {canSubmitProof(record) && (
          <Link href={href}>
            <Button size="sm" variant="saffron">
              {record.review === "rejected" ? "Upload again" : "Upload proof"}
            </Button>
          </Link>
        )}
        {canClaimPayout(record) && (
          <Link href={href}>
            <Button size="sm" variant="saffron">
              Claim payout
            </Button>
          </Link>
        )}
        {record.reviewNote && record.review === "rejected" && (
          <span className="text-sm text-danger">“{record.reviewNote}”</span>
        )}
      </div>
    </Card>
  );
}
