import type { Metadata } from "next";
import { LOCALE, SCORE } from "@/config/constants";
import { todayInTimezone } from "@/engine/time/dates";
import { getAccess, type SignedInAccess } from "@/lib/auth/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SupabaseScoreRepository } from "@/repositories/supabase/SupabaseScoreRepository";
import { ScoreService } from "@/services/ScoreService";
import { LockedCard } from "@/components/app/LockedCard";
import { ScoreRow } from "@/components/app/ScoreRow";
import { ScoreManager } from "@/app/(member)/app/scores/ScoreManager";

export const metadata: Metadata = { title: "Scores" };

export default async function ScoresPage() {
  const access = (await getAccess()) as SignedInAccess;
  const unlocked = access.kind === "admin" || access.subscription.hasAccess;

  if (!unlocked) {
    return (
      <div className="flex flex-col gap-6">
        <Heading />
        <LockedCard
          title="Your five scores go here"
          body="Subscribe to log your Stableford rounds — they become your numbers in the monthly draw."
        >
          <ScoreRow scores={[28, 33, 31, 36, 29]} />
        </LockedCard>
      </div>
    );
  }

  const service = new ScoreService(new SupabaseScoreRepository(await createSupabaseServerClient()));
  const entries = await service.list(access.userId);
  const today = todayInTimezone(new Date(), LOCALE.TIMEZONE);

  return (
    <div className="flex flex-col gap-6">
      <Heading />
      <ScoreManager initialEntries={entries} today={today} />
    </div>
  );
}

function Heading() {
  return (
    <header className="flex flex-col gap-1">
      <h1 className="text-4xl">Your rounds</h1>
      <p className="text-ink-2">
        Log your Stableford score after each round. We keep your latest {SCORE.WINDOW_SIZE} by date
        played — a new one replaces the oldest. One round per date.
      </p>
    </header>
  );
}
