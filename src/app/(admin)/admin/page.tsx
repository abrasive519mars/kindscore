import type { Metadata } from "next";
import { formatInr } from "@/engine/money/paise";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Badge, Card, EmptyState, Figure } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Admin" };

/** PRD §11.05 reports, from the reports_summary view — real numbers, even when they are zero. */
export default async function AdminOverviewPage() {
  const supabase = await createSupabaseServerClient();
  const [{ data: summary }, { data: openDraw }] = await Promise.all([
    supabase.from("reports_summary").select("*").single(),
    supabase
      .from("draws")
      .select("draw_month, status, mode")
      .neq("status", "published")
      .maybeSingle(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-4xl">Overview</h1>
        <p className="text-ink-2">Everything the platform is doing, in five numbers.</p>
      </header>

      <section
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5"
        aria-label="Key figures"
      >
        <Card>
          <Figure label="Members" value={summary?.total_members ?? 0} size="md" />
        </Card>
        <Card>
          <Figure label="Active subscribers" value={summary?.active_subscribers ?? 0} size="md" />
        </Card>
        <Card>
          <Figure
            label="Pool this month"
            value={formatInr(summary?.pool_this_month_paise ?? 0)}
            size="md"
          />
        </Card>
        <Card>
          <Figure
            label="Given to charities"
            value={formatInr(summary?.charity_total_paise ?? 0)}
            size="md"
            accent
          />
        </Card>
        <Card>
          <Figure label="Proofs to review" value={summary?.proofs_awaiting_review ?? 0} size="md" />
        </Card>
      </section>

      <section className="grid gap-6 md:grid-cols-2" aria-label="Draw and payouts">
        <Card className="flex flex-col gap-3">
          <h2 className="text-2xl">This month&apos;s draw</h2>
          {openDraw ? (
            <p className="flex items-center gap-2 text-sm">
              {new Date(openDraw.draw_month).toLocaleDateString("en-IN", {
                month: "long",
                year: "numeric",
              })}
              <Badge tone={openDraw.status === "simulated" ? "warn" : "neutral"}>
                {openDraw.status === "simulated" ? "Simulated" : "Draft"}
              </Badge>
              <Badge tone="pool">{openDraw.mode}</Badge>
            </p>
          ) : (
            <EmptyState
              title="No draw open"
              body="Open the month's draw under Draws, simulate it as often as you like, then publish once."
            />
          )}
          <p className="text-sm text-ink-2">
            Jackpot carried into the next draw: {formatInr(summary?.current_rollover_paise ?? 0)}
          </p>
        </Card>
        <Card className="flex flex-col gap-3">
          <h2 className="text-2xl">Payouts</h2>
          <Figure label="Awarded" value={formatInr(summary?.prizes_awarded_paise ?? 0)} />
          <Figure label="Paid out" value={formatInr(summary?.prizes_paid_paise ?? 0)} />
        </Card>
      </section>
    </div>
  );
}
