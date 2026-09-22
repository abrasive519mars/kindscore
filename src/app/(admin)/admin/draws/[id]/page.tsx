import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DRAW } from "@/config/constants";
import { formatInr } from "@/engine/money/paise";
import { formatMonth } from "@/engine/time/dates";
import { createDrawRepository, createDrawService } from "@/lib/draws";
import type { DrawRecord } from "@/repositories/interfaces/DrawRepository";
import { PublishPanel } from "@/app/(admin)/admin/draws/[id]/PublishPanel";
import { SimulatePanel } from "@/app/(admin)/admin/draws/[id]/SimulatePanel";
import { DrawNumbers } from "@/components/draw/DrawNumbers";
import { WinnersTable } from "@/components/draw/WinnersTable";
import { Badge, Banner, Card, Figure, Rule } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Draw" };

const STATUS_TONE = { draft: "neutral", simulated: "warn", published: "success" } as const;
const STATUS_LABEL = { draft: "Draft", simulated: "Simulated", published: "Published" } as const;

function formatStamp(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

/** One draw: simulate (as often as needed) → inspect every number → publish once. */
export default async function AdminDrawPage({ params }: PageProps<"/admin/draws/[id]">) {
  const { id } = await params;
  const repo = await createDrawRepository();
  const service = await createDrawService();
  const draw = await repo.findById(id);
  if (!draw) notFound();

  const [candidates, results, freshness] = await Promise.all([
    repo.listCandidates(),
    draw.status === "draft" ? Promise.resolve([]) : repo.listResults(draw.id),
    service.checkFreshness(draw),
  ]);
  const holders = service.describeHolders(candidates);
  const eligible = candidates.filter((c) => c.scores.length === 5).length;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-4xl">{formatMonth(draw.drawMonth)}</h1>
          <p className="text-ink-2">
            {candidates.length} active {candidates.length === 1 ? "member funds" : "members fund"}{" "}
            the pool · {eligible} with five scores are in the draw
          </p>
        </div>
        <Badge tone={STATUS_TONE[draw.status]}>{STATUS_LABEL[draw.status]}</Badge>
      </header>

      {draw.status !== "published" && (
        <SimulatePanel
          drawId={draw.id}
          currentMode={draw.mode}
          currentStrengthBps={draw.weightStrengthBps}
          holders={holders}
          hasDraft={draw.status === "simulated"}
        />
      )}

      {draw.status !== "draft" && draw.numbers && (
        <Card className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl">
              {draw.status === "published" ? "Published result" : "Draft result"}
            </h2>
            <span className="text-sm text-ink-2">
              {draw.status === "published" && draw.publishedAt
                ? `Published ${formatStamp(draw.publishedAt)}`
                : draw.simulatedAt &&
                  `Simulated ${formatStamp(draw.simulatedAt)} · ${draw.mode}${strengthNote(draw)}`}
            </span>
          </div>
          {freshness.stale && (
            <Banner tone="warn">
              Scores changed since this simulation — re-simulate before publishing.
            </Banner>
          )}
          <DrawNumbers numbers={draw.numbers} size="lg" />
          <PoolBreakdown draw={draw} />
          <Rule />
          <WinnersTable rows={results} numbers={draw.numbers} tierPools={draw.tierPools} />
          {draw.status === "simulated" && (
            <PublishPanel
              drawId={draw.id}
              stale={freshness.stale}
              memberCount={eligible}
              prizesPaise={results.reduce((s, r) => s + r.prizePaise, 0)}
            />
          )}
        </Card>
      )}
    </div>
  );
}

/** " · 60% weighted" when the admin turned the dial down; nothing at the default. */
function strengthNote(draw: DrawRecord): string {
  if (draw.mode !== "algorithmic" || draw.weightStrengthBps === DRAW.WEIGHT_STRENGTH_MAX_BPS)
    return "";
  return ` · ${draw.weightStrengthBps / 100}% weighted`;
}

function PoolBreakdown({ draw }: { draw: DrawRecord }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Figure
        label="Pool"
        value={formatInr(draw.poolPaise)}
        hint={`${draw.activeSubscriberCount} active subscribers`}
      />
      <Figure
        label="Jackpot · 40%"
        value={formatInr(draw.tierPools[5])}
        hint={
          draw.rolloverInPaise
            ? `incl. ${formatInr(draw.rolloverInPaise)} rolled in`
            : "no rollover this month"
        }
        accent
      />
      <Figure label="4 matches · 35%" value={formatInr(draw.tierPools[4])} />
      <Figure label="3 matches · 25%" value={formatInr(draw.tierPools[3])} />
      <p className="text-sm text-ink-2 sm:col-span-2 lg:col-span-4">
        {draw.rolloverOutPaise > 0
          ? `Nobody matched five: ${formatInr(draw.rolloverOutPaise)} rolls into next month's jackpot. `
          : "The jackpot was won. "}
        {draw.unclaimedRetainedPaise > 0 &&
          `${formatInr(draw.unclaimedRetainedPaise)} in unclaimed 4- and 3-match prizes is retained (those tiers never roll over).`}
      </p>
    </div>
  );
}
