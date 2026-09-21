import type { Metadata } from "next";
import Link from "next/link";
import { LOCALE, SCORE } from "@/config/constants";
import { formatInr } from "@/engine/money/paise";
import { formatMonth, nextDrawMonth, todayInTimezone } from "@/engine/time/dates";
import { getAccess, type SignedInAccess } from "@/lib/auth/access";
import { createDrawRepository } from "@/lib/draws";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MemberDrawOutcome } from "@/repositories/interfaces/DrawRepository";
import { DrawCard } from "@/components/draw/DrawCard";
import { Button } from "@/components/ui/Button";
import { Badge, Card, EmptyState } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Draws" };

/** PRD §10 participation summary: the next draw and whether you're in it; every past draw and how you did. */
export default async function MemberDrawsPage() {
  const access = (await getAccess()) as SignedInAccess;
  const repo = await createDrawRepository();
  const supabase = await createSupabaseServerClient();
  const [outcomes, lastMonth, { count: scoreCount }] = await Promise.all([
    repo.listMemberOutcomes(access.userId),
    repo.lastPublishedMonth(),
    supabase
      .from("scores")
      .select("id", { count: "exact", head: true })
      .eq("user_id", access.userId),
  ]);
  const upcoming = nextDrawMonth(lastMonth, todayInTimezone(new Date(), LOCALE.TIMEZONE));
  const unlocked = access.kind === "admin" || access.subscription.hasAccess;
  const missing = SCORE.WINDOW_SIZE - (scoreCount ?? 0);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-4xl">Draws</h1>
        <p className="text-ink-2">Five numbers a month. Your five scores are your ticket.</p>
      </header>

      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-2xl">Next draw · {formatMonth(upcoming)}</h2>
          <NextDrawStatus unlocked={unlocked} missing={missing} />
        </div>
        {!unlocked ? (
          <Link href="/app/subscription">
            <Button size="sm" variant="saffron">
              Subscribe to be in it
            </Button>
          </Link>
        ) : missing > 0 ? (
          <Link href="/app/scores">
            <Button size="sm">
              Enter {missing} more {missing === 1 ? "round" : "rounds"}
            </Button>
          </Link>
        ) : (
          <p className="text-sm text-ink-2">
            Your latest five scores at draw time are what count. Keep them current.
          </p>
        )}
      </Card>

      <section className="flex flex-col gap-4" aria-label="Past draws">
        <h2 className="text-2xl">Past draws</h2>
        {outcomes.length === 0 ? (
          <EmptyState
            title="No draw has been published yet"
            body="When the first one is, it appears here with your numbers against it."
          />
        ) : (
          outcomes.map((outcome) => <OutcomeCard key={outcome.draw.drawId} outcome={outcome} />)
        )}
      </section>
    </div>
  );
}

function NextDrawStatus({ unlocked, missing }: { unlocked: boolean; missing: number }) {
  if (!unlocked) return <Badge tone="warn">Not entered</Badge>;
  if (missing > 0)
    return (
      <Badge tone="warn">
        {missing} more {missing === 1 ? "score" : "scores"} needed
      </Badge>
    );
  return <Badge tone="success">You&apos;re in</Badge>;
}

function OutcomeCard({ outcome }: { outcome: MemberDrawOutcome }) {
  const { draw, entry, prizePaise } = outcome;
  const matched = entry ? new Set(entry.scores.filter((s) => draw.numbers.includes(s))) : undefined;
  return (
    <DrawCard
      draw={draw}
      href={`/app/draws/${draw.drawId}`}
      matched={matched}
      footer={
        <p className="flex flex-wrap items-center gap-2 text-sm">
          {!entry ? (
            <Badge tone="neutral">Not entered</Badge>
          ) : prizePaise ? (
            <>
              <Badge tone="saffron">{entry.matchCount} matches</Badge>
              <span className="num font-medium">{formatInr(prizePaise)}</span>
            </>
          ) : (
            <Badge tone="neutral">
              {entry.matchCount === 0
                ? "No match"
                : `${entry.matchCount} ${entry.matchCount === 1 ? "match" : "matches"} · no prize`}
            </Badge>
          )}
          <Link
            href={`/app/draws/${draw.drawId}`}
            className="ml-auto text-ink-2 underline-offset-4 hover:text-ink hover:underline"
          >
            See the draw →
          </Link>
        </p>
      }
    />
  );
}
