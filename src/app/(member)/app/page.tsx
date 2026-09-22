import type { Metadata } from "next";
import Link from "next/link";
import { LOCALE, PLANS, SCORE, SPLIT } from "@/config/constants";
import { applyBps, formatInr } from "@/engine/money/paise";
import { formatMonth, nextDrawMonth, todayInTimezone } from "@/engine/time/dates";
import { getAccess, type SignedInAccess } from "@/lib/auth/access";
import { createDrawRepository, createDrawService } from "@/lib/draws";
import { createWinnerService } from "@/lib/winners";
import { summariseWinnings } from "@/services/WinnerService";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MemberDrawOutcome } from "@/repositories/interfaces/DrawRepository";
import { SupabaseScoreRepository } from "@/repositories/supabase/SupabaseScoreRepository";
import { ScoreService } from "@/services/ScoreService";
import { DrawNumbers } from "@/components/draw/DrawNumbers";
import { JackpotOdometer } from "@/components/draw/JackpotOdometer";
import { Button } from "@/components/ui/Button";
import { Badge, Card, EmptyState, Figure, Rule } from "@/components/ui/primitives";
import { SplitBar } from "@/components/ui/Split";
import { LockedCard } from "@/components/app/LockedCard";
import { ScoreRow } from "@/components/app/ScoreRow";

export const metadata: Metadata = { title: "Dashboard" };

const MIN_CHARITY_MONTHLY = applyBps(PLANS.month.pricePaise, SPLIT.CHARITY_MIN_BPS);

interface CharityChoice {
  readonly name: string;
  readonly city: string;
  readonly outcome_line: string;
}

/** PRD §10 — every module the dashboard must include, wired to real data where it exists yet. */
export default async function DashboardPage() {
  const access = (await getAccess()) as SignedInAccess;
  const supabase = await createSupabaseServerClient();
  const scoreService = new ScoreService(new SupabaseScoreRepository(supabase));
  const [drawRepo, drawService, winnerService] = await Promise.all([
    createDrawRepository(),
    createDrawService(),
    createWinnerService(),
  ]);
  const [scores, { data: charity }, jackpot, outcomes, lastMonth, winnings] = await Promise.all([
    scoreService.list(access.userId),
    access.profile.charity_id
      ? supabase
          .from("charities")
          .select("name, outcome_line, city")
          .eq("id", access.profile.charity_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    drawService.projectedJackpot(),
    drawRepo.listMemberOutcomes(access.userId),
    drawRepo.lastPublishedMonth(),
    winnerService.listWinnings(access.userId),
  ]);
  const won = summariseWinnings(winnings);
  const upcoming = nextDrawMonth(lastMonth, todayInTimezone(new Date(), LOCALE.TIMEZONE));

  const kept = scores.map((entry) => entry.score);
  const remaining = SCORE.WINDOW_SIZE - kept.length;
  const unlocked = access.kind === "admin" || access.subscription.hasAccess;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <p className="text-sm text-ink-2">
          Hello, {access.profile.full_name.split(" ")[0] || "there"}.
        </p>
        <h1 className="text-4xl">Your month at a glance.</h1>
      </header>

      <section className="grid gap-6 md:grid-cols-3" aria-label="Status">
        <Card>
          <Figure
            label="Subscription"
            value={<SubscriptionValue access={access} />}
            hint={renewalHint(access)}
          />
        </Card>
        <Card>
          <Figure
            label={`${formatMonth(upcoming).split(" ")[0]} jackpot · estimate`}
            value={<JackpotOdometer paise={jackpot} />}
            hint="40% of this month's pool plus what rolled over"
            accent
          />
        </Card>
        <Card>
          <Figure
            label="Total won"
            value={formatInr(won.totalWonPaise)}
            hint={
              won.unverifiedCount > 0
                ? `${won.unverifiedCount} ${won.unverifiedCount === 1 ? "win" : "wins"} awaiting verification`
                : won.awaitingPayoutPaise > 0
                  ? `${formatInr(won.paidPaise)} paid · ${formatInr(won.awaitingPayoutPaise)} on its way`
                  : won.totalWonPaise > 0
                    ? "All paid"
                    : "Winnings appear here after a draw"
            }
          />
        </Card>
      </section>

      <Rule />

      <section aria-label="Scores" className="flex flex-col gap-4">
        {unlocked ? (
          <Card className="flex flex-col gap-5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-2xl">Your last five rounds</h2>
              <Link href="/app/scores" className="text-sm text-ink-2 hover:text-ink">
                Manage →
              </Link>
            </div>
            <ScoreRow scores={kept} />
            {remaining > 0 ? (
              <EmptyState
                title={`Enter ${remaining} more ${remaining === 1 ? "round" : "rounds"} to be in the next draw`}
                body="Five scores are your ticket. A sixth replaces the oldest."
                action={
                  <Link href="/app/scores">
                    <Button size="sm">Add a score</Button>
                  </Link>
                }
              />
            ) : (
              <p className="text-sm text-ink-2">
                You&apos;re in the next draw. <Badge tone="success">Eligible</Badge>
              </p>
            )}
          </Card>
        ) : (
          <LockedCard
            title="Your five scores go here"
            body="Subscribe to log your Stableford rounds — they become your numbers in the monthly draw."
          >
            <ScoreRow scores={[28, 33, 31, 36, 29]} />
          </LockedCard>
        )}
      </section>

      <section className="grid gap-6 md:grid-cols-2" aria-label="Charity and draws">
        <Card className="flex flex-col gap-4">
          <h2 className="text-2xl">Your charity</h2>
          <CharityModule charity={charity} access={access} />
        </Card>
        <Card className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-2xl">Draws</h2>
            <Link href="/app/draws" className="text-sm text-ink-2 hover:text-ink">
              All draws →
            </Link>
          </div>
          <DrawsModule
            outcomes={outcomes}
            upcoming={upcoming}
            inNextDraw={unlocked && remaining === 0}
          />
        </Card>
      </section>
    </div>
  );
}

/** PRD §10 participation summary: draws entered, the latest result, and whether you're in the next one. */
function DrawsModule({
  outcomes,
  upcoming,
  inNextDraw,
}: {
  outcomes: readonly MemberDrawOutcome[];
  upcoming: string;
  inNextDraw: boolean;
}) {
  const entered = outcomes.filter((o) => o.entry).length;
  const latest = outcomes[0];
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p>
        <span className="num font-medium">{entered}</span> {entered === 1 ? "draw" : "draws"}{" "}
        entered · {formatMonth(upcoming)}:{" "}
        {inNextDraw ? (
          <Badge tone="success">You&apos;re in</Badge>
        ) : (
          <Badge tone="warn">Not yet in</Badge>
        )}
      </p>
      {latest ? (
        <div className="flex flex-col gap-2">
          <p className="text-ink-2">Latest · {formatMonth(latest.draw.drawMonth)}</p>
          <DrawNumbers
            numbers={latest.draw.numbers}
            size="sm"
            matched={
              latest.entry
                ? new Set(latest.entry.scores.filter((s) => latest.draw.numbers.includes(s)))
                : undefined
            }
          />
          <p>
            {!latest.entry
              ? "You weren't in this one."
              : latest.prizePaise
                ? `${latest.entry.matchCount} matches — you won ${formatInr(latest.prizePaise)}.`
                : `${latest.entry.matchCount} ${latest.entry.matchCount === 1 ? "match" : "matches"} — no prize this time.`}{" "}
            <Link
              href={`/app/draws/${latest.draw.drawId}`}
              className="underline underline-offset-4"
            >
              See the draw
            </Link>
          </p>
        </div>
      ) : (
        <p className="text-ink-2">No draw has been published yet. The first one lands here.</p>
      )}
    </div>
  );
}

/**
 * PRD §10 "selected charity + percentage". Rupee figures appear only for money that is actually
 * being paid — a member who has not subscribed sees their share, not a split of a fee they owe.
 */
function CharityModule({
  charity,
  access,
}: {
  charity: CharityChoice | null;
  access: SignedInAccess;
}) {
  if (!charity) {
    return (
      <EmptyState title="Choose a charity" body="Part of every payment goes to a cause you pick." />
    );
  }
  const { hasAccess, interval } = access.subscription;
  const paying = access.kind !== "admin" && hasAccess && interval !== null;
  const plan = PLANS[interval ?? "month"];
  return (
    <>
      <p className="font-medium">
        {charity.name} <span className="text-ink-2">· {charity.city}</span>
      </p>
      <SplitBar
        amountPaise={plan.pricePaise}
        charityBps={access.profile.charity_bps}
        compact={!paying}
      />
      <p className="text-sm text-ink-2">{charityCaption(access, paying)}</p>
      {!paying && access.kind !== "admin" && (
        <Link href="/app/subscription" className="text-sm underline underline-offset-4">
          Choose a plan →
        </Link>
      )}
      <p className="text-sm text-ink-2">{charity.outcome_line}</p>
    </>
  );
}

function charityCaption(access: SignedInAccess, paying: boolean): string {
  const share = `${access.profile.charity_bps / 100}%`;
  if (access.kind === "admin") return `${share} share`;
  if (!paying) {
    return `${share} of every payment will go here once you subscribe — at least ${formatInr(MIN_CHARITY_MONTHLY)} a month.`;
  }
  const plan = PLANS[access.subscription.interval ?? "month"];
  const cadence = access.subscription.interval === "year" ? "yearly" : "monthly";
  return `${share} of every ${formatInr(plan.pricePaise)} ${cadence} payment`;
}

function SubscriptionValue({ access }: { access: SignedInAccess }) {
  const { status, hasAccess } = access.subscription;
  if (access.kind === "admin") return <span className="text-2xl">Admin</span>;
  if (hasAccess) return <span className="text-2xl text-success">Active</span>;
  if (status === "none") return <span className="text-2xl text-ink-2">Not yet</span>;
  return <span className="text-2xl capitalize text-warn">{status.replace("_", " ")}</span>;
}

function renewalHint(access: SignedInAccess): string {
  const { currentPeriodEnd, cancelAtPeriodEnd, interval } = access.subscription;
  if (!currentPeriodEnd) return "Monthly or yearly — cancel anytime";
  const day = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(currentPeriodEnd));
  return `${cancelAtPeriodEnd ? "Ends" : "Renews"} ${day} · ${interval === "year" ? "yearly" : "monthly"}`;
}
