import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatMonth } from "@/engine/time/dates";
import { getAccess, type SignedInAccess } from "@/lib/auth/access";
import { createDrawRepository } from "@/lib/draws";
import { DrawReveal } from "@/app/(member)/app/draws/[id]/DrawReveal";
import { Card } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Draw" };

/**
 * The reveal. The server decides everything (numbers, the member's ticket, matches, prize, how
 * many shared each tier); the client only animates it. RLS returns nothing for an unpublished
 * draw, so a guessed id 404s the same as a missing one.
 */
export default async function MemberDrawPage({ params }: PageProps<"/app/draws/[id]">) {
  const { id } = await params;
  const access = (await getAccess()) as SignedInAccess;
  const repo = await createDrawRepository();
  const outcome = (await repo.listMemberOutcomes(access.userId)).find((o) => o.draw.drawId === id);
  if (!outcome) notFound();

  const { draw, entry, prizePaise } = outcome;
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <p className="text-sm text-ink-2">
          <Link href="/app/draws" className="hover:text-ink">
            Draws
          </Link>{" "}
          / {formatMonth(draw.drawMonth)}
        </p>
        <h1 className="text-4xl">{formatMonth(draw.drawMonth)}&apos;s draw</h1>
      </header>

      <Card className="flex flex-col gap-8">
        <DrawReveal
          drawId={draw.drawId}
          numbers={draw.numbers}
          scores={entry?.scores ?? null}
          matchCount={entry?.matchCount ?? 0}
          prizePaise={prizePaise}
          tierPools={draw.tierPools}
          winners={draw.winners}
          rolloverOutPaise={draw.rolloverOutPaise}
        />
      </Card>
    </div>
  );
}
