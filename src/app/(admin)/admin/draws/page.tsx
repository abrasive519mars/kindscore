import type { Metadata } from "next";
import Link from "next/link";
import { LOCALE } from "@/config/constants";
import { formatInr } from "@/engine/money/paise";
import { formatMonth, nextDrawMonth, todayInTimezone } from "@/engine/time/dates";
import { createDrawRepository } from "@/lib/draws";
import { openDraw } from "@/app/(admin)/admin/draws/actions";
import { DrawNumbers } from "@/components/draw/DrawNumbers";
import { Button } from "@/components/ui/Button";
import { Badge, Banner, Card, EmptyState } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Draws" };

/** PRD §11.02 — the one open draw (or the button that opens the next one) and the published history. */
export default async function AdminDrawsPage({ searchParams }: PageProps<"/admin/draws">) {
  const { error } = (await searchParams) as { error?: string };
  const repo = await createDrawRepository();
  const [open, history, lastMonth] = await Promise.all([
    repo.findOpen(),
    repo.listSummaries(),
    repo.lastPublishedMonth(),
  ]);
  const upcoming = nextDrawMonth(lastMonth, todayInTimezone(new Date(), LOCALE.TIMEZONE));

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-4xl">Draws</h1>
        <p className="text-ink-2">Simulate as often as you like. Publish once.</p>
      </header>
      {error && <Banner tone="danger">{error}</Banner>}

      <Card className="flex flex-col gap-4">
        {open ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl">{formatMonth(open.drawMonth)}</h2>
              <Badge tone={open.status === "simulated" ? "warn" : "neutral"}>
                {open.status === "simulated" ? "Simulated" : "Draft"}
              </Badge>
            </div>
            {open.numbers && <DrawNumbers numbers={open.numbers} />}
            <div>
              <Link href={`/admin/draws/${open.id}`}>
                <Button size="sm">
                  {open.status === "simulated" ? "Review and publish" : "Simulate"}
                </Button>
              </Link>
            </div>
          </>
        ) : (
          <form action={openDraw} className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl">{formatMonth(upcoming)}</h2>
              <p className="text-sm text-ink-2">
                Draws run in calendar order — this is the next one.
              </p>
            </div>
            <Button type="submit" size="sm" variant="saffron">
              Open {formatMonth(upcoming).split(" ")[0]}&apos;s draw
            </Button>
          </form>
        )}
      </Card>

      <section className="flex flex-col gap-3" aria-label="Published draws">
        <h2 className="text-2xl">Published</h2>
        {history.length === 0 ? (
          <EmptyState
            title="No draw published yet"
            body="The first one appears here the moment you publish it."
          />
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-[0.06em] text-ink-2">
                <tr>
                  <th className="px-4 py-3 font-medium">Month</th>
                  <th className="px-4 py-3 font-medium">Mode</th>
                  <th className="px-4 py-3 font-medium">Numbers</th>
                  <th className="px-4 py-3 text-right font-medium">5 / 4 / 3</th>
                  <th className="px-4 py-3 text-right font-medium">Paid out</th>
                  <th className="px-4 py-3 text-right font-medium">Rolled over</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {history.map((d) => (
                  <tr key={d.drawId}>
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/admin/draws/${d.drawId}`} className="hover:text-saffron">
                        {formatMonth(d.drawMonth)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 capitalize">{d.mode}</td>
                    <td className="num px-4 py-3">{d.numbers.join(" · ")}</td>
                    <td className="num px-4 py-3 text-right">
                      {d.winners[5]} / {d.winners[4]} / {d.winners[3]}
                    </td>
                    <td className="num px-4 py-3 text-right">{formatInr(d.prizesPaise)}</td>
                    <td className="num px-4 py-3 text-right">
                      {d.rolloverOutPaise ? formatInr(d.rolloverOutPaise) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>
    </div>
  );
}
