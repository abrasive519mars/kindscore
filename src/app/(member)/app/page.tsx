import type { Metadata } from "next";
import Link from "next/link";
import { PLANS, SCORE } from "@/config/constants";
import { formatInr } from "@/engine/money/paise";
import { getAccess, type SignedInAccess } from "@/lib/auth/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SupabaseScoreRepository } from "@/repositories/supabase/SupabaseScoreRepository";
import { ScoreService } from "@/services/ScoreService";
import { Button } from "@/components/ui/Button";
import { Badge, Card, EmptyState, Figure, Rule } from "@/components/ui/primitives";
import { SplitBar } from "@/components/ui/Split";
import { LockedCard } from "@/components/app/LockedCard";
import { ScoreRow } from "@/components/app/ScoreRow";

export const metadata: Metadata = { title: "Dashboard" };

/** PRD §10 — every module the dashboard must include, wired to real data where it exists yet. */
export default async function DashboardPage() {
  const access = (await getAccess()) as SignedInAccess;
  const supabase = await createSupabaseServerClient();
  const scoreService = new ScoreService(new SupabaseScoreRepository(supabase));
  const [scores, { data: charity }, { data: rollover }] = await Promise.all([
    scoreService.list(access.userId),
    access.profile.charity_id
      ? supabase.from("charities").select("name, outcome_line, city").eq("id", access.profile.charity_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.rpc("next_rollover_in"),
  ]);

  const kept = scores.map((entry) => entry.score);
  const remaining = SCORE.WINDOW_SIZE - kept.length;
  const unlocked = access.kind === "admin" || access.subscription.hasAccess;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <p className="text-sm text-ink-2">Hello, {access.profile.full_name.split(" ")[0] || "there"}.</p>
        <h1 className="text-4xl">Your month at a glance.</h1>
      </header>

      <section className="grid gap-6 md:grid-cols-3" aria-label="Status">
        <Card>
          <Figure label="Subscription" value={<SubscriptionValue access={access} />} hint={renewalHint(access)} />
        </Card>
        <Card>
          <Figure label="Jackpot carried" value={formatInr(rollover ?? 0)} hint="Rolls over until someone matches all five" accent />
        </Card>
        <Card>
          <Figure label="Total won" value={formatInr(0)} hint="Winnings appear here after a draw" />
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
              <p className="text-sm text-ink-2">You&apos;re in the next draw. <Badge tone="success">Eligible</Badge></p>
            )}
          </Card>
        ) : (
          <LockedCard title="Your five scores go here" body="Subscribe to log your Stableford rounds — they become your numbers in the monthly draw.">
            <ScoreRow scores={[28, 33, 31, 36, 29]} />
          </LockedCard>
        )}
      </section>

      <section className="grid gap-6 md:grid-cols-2" aria-label="Charity and draws">
        <Card className="flex flex-col gap-4">
          <h2 className="text-2xl">Your charity</h2>
          {charity ? (
            <>
              <p className="font-medium">
                {charity.name} <span className="text-ink-2">· {charity.city}</span>
              </p>
              <SplitBar amountPaise={PLANS.month.pricePaise} charityBps={access.profile.charity_bps} />
              <p className="text-sm text-ink-2">{charity.outcome_line}</p>
            </>
          ) : (
            <EmptyState title="Choose a charity" body="Part of every payment goes to a cause you pick." />
          )}
        </Card>
        <Card className="flex flex-col gap-4">
          <h2 className="text-2xl">Draws</h2>
          <EmptyState title="No draws yet" body="Draws entered and results will appear here once the first monthly draw is published." />
        </Card>
      </section>
    </div>
  );
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
  const day = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(
    new Date(currentPeriodEnd),
  );
  return `${cancelAtPeriodEnd ? "Ends" : "Renews"} ${day} · ${interval === "year" ? "yearly" : "monthly"}`;
}
