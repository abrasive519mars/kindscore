"use client";

import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { WinningTier } from "@/engine/draw/match";
import { formatInr } from "@/engine/money/paise";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

interface DrawRevealProps {
  readonly drawId: string;
  readonly numbers: readonly number[];
  /** Null when the member was not in this draw. */
  readonly scores: readonly number[] | null;
  readonly matchCount: number;
  readonly prizePaise: number | null;
  /** The member's claim page when they won this draw; the CTA that follows the outcome line. */
  readonly claimHref: string | null;
  readonly claimPaid: boolean;
  readonly tierPools: Readonly<Record<WinningTier, number>>;
  readonly winners: Readonly<Record<WinningTier, number>>;
  readonly rolloverOutPaise: number;
}

type Phase = "rolling" | "matching" | "done";

const TILE_MS = 240;
const TILE_STAGGER_MS = 80;
const MATCH_DELAY_MS = 400;
const MATCH_MS = 200;
const CONFETTI_COUNT = 60;
const EASE = [0.23, 1, 0.32, 1] as const;

function seenKey(drawId: string): string {
  return `draw-seen:${drawId}`;
}

function readSeen(drawId: string): boolean {
  try {
    return sessionStorage.getItem(seenKey(drawId)) === "1";
  } catch {
    return true;
  }
}

function markSeen(drawId: string) {
  try {
    sessionStorage.setItem(seenKey(drawId), "1");
  } catch {
    // Private mode or blocked storage: the reveal simply plays again next time.
  }
}

const subscribeNever = () => () => {};

/**
 * DESIGN.md §4.1. First view: tiles roll in, matches fill saffron, the outcome line resolves.
 * Return visits: the result is shown at once with "Watch the draw" to replay. Reduced motion:
 * the final frame and a "Play the reveal" button that runs it anyway, on request.
 *
 * Whether this is a first view lives in sessionStorage, read through useSyncExternalStore so the
 * server (which can't know) renders the final frame and the client corrects itself on hydration.
 * The flag is written only once the reveal has finished, so it can't flip mid-animation.
 */
export function DrawReveal(props: DrawRevealProps) {
  const reduced = useReducedMotion();
  const seen = useSyncExternalStore(
    subscribeNever,
    () => readSeen(props.drawId),
    () => true,
  );
  const [override, setOverride] = useState<Phase | null>(null);
  const phase: Phase = override ?? (seen || reduced ? "done" : "rolling");

  useEffect(() => {
    if (phase === "done") {
      markSeen(props.drawId);
      return;
    }
    const wait =
      phase === "rolling"
        ? TILE_MS + TILE_STAGGER_MS * (props.numbers.length - 1) + MATCH_DELAY_MS
        : MATCH_MS + 300;
    const next: Phase = phase === "rolling" ? "matching" : "done";
    const timer = setTimeout(() => setOverride(next), wait);
    return () => clearTimeout(timer);
  }, [phase, props.drawId, props.numbers.length]);

  return (
    <LazyMotion features={domAnimation} strict>
      <div className="flex flex-col gap-8">
        <RevealFrame {...props} phase={phase} />
        {phase === "done" && (
          <div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setOverride("rolling")}>
              {reduced ? "Play the reveal" : "Watch the draw again"}
            </Button>
          </div>
        )}
      </div>
    </LazyMotion>
  );
}

interface FrameProps extends DrawRevealProps {
  readonly phase: Phase;
}

function RevealFrame({
  phase,
  numbers,
  scores,
  matchCount,
  prizePaise,
  claimHref,
  claimPaid,
  tierPools,
  winners,
  rolloverOutPaise,
}: FrameProps) {
  const drawn = new Set(numbers);
  const mine = new Set(scores ?? []);
  const showMatches = phase !== "rolling";
  const showOutcome = phase === "done";
  const jackpotWon = matchCount === 5 && Boolean(prizePaise);

  return (
    <>
      <section className="flex flex-col gap-3" aria-label="Your scores">
        <h2 className="text-sm font-medium uppercase tracking-[0.06em] text-ink-2">
          Your five scores
        </h2>
        {scores ? (
          <ol
            className="num flex items-baseline gap-4 border-b border-line pb-3 font-display text-4xl sm:gap-6 sm:text-5xl"
            aria-label="Your scores"
          >
            {scores.map((s, i) => (
              <li
                key={i}
                className={cn(
                  "transition-colors",
                  showMatches && (drawn.has(s) ? "text-saffron" : "text-ink-3"),
                )}
                style={{ transitionDuration: `${MATCH_MS}ms` }}
              >
                {s}
              </li>
            ))}
          </ol>
        ) : (
          <p className="border-b border-line pb-3 text-ink-2">
            You weren&apos;t in this draw — it needs an active subscription and five scores at draw
            time.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3" aria-label="Drawn numbers">
        <h2 className="text-sm font-medium uppercase tracking-[0.06em] text-ink-2">The draw</h2>
        <ol className="num flex items-center gap-2 font-display text-3xl sm:gap-3 sm:text-4xl">
          {numbers.map((n, i) => (
            <Tile
              key={`${n}-${phase === "rolling"}`}
              n={n}
              index={i}
              rolling={phase === "rolling"}
              matched={showMatches && mine.has(n)}
            />
          ))}
        </ol>
      </section>

      <AnimatePresence>
        {showOutcome && (
          <m.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="flex flex-col gap-2"
            aria-live="polite"
          >
            <OutcomeLine
              scores={scores}
              matchCount={matchCount}
              prizePaise={prizePaise}
              claimHref={claimHref}
              claimPaid={claimPaid}
              tierPools={tierPools}
              winners={winners}
              rolloverOutPaise={rolloverOutPaise}
            />
            {jackpotWon && <Confetti />}
          </m.section>
        )}
      </AnimatePresence>
    </>
  );
}

function Tile({
  n,
  index,
  rolling,
  matched,
}: {
  n: number;
  index: number;
  rolling: boolean;
  matched: boolean;
}) {
  return (
    <m.li
      initial={rolling ? { opacity: 0, scale: 0.96 } : false}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        duration: TILE_MS / 1000,
        ease: EASE,
        delay: rolling ? (index * TILE_STAGGER_MS) / 1000 : 0,
      }}
      className={cn(
        "flex h-14 w-14 items-center justify-center rounded-md border bg-surface transition-[box-shadow,border-color,color] sm:h-16 sm:w-16",
        matched ? "border-pool text-pool ring-2 ring-pool/30" : "border-line",
      )}
      style={{ transitionDuration: `${MATCH_MS}ms` }}
    >
      {n}
    </m.li>
  );
}

type OutcomeProps = Pick<
  DrawRevealProps,
  | "scores"
  | "matchCount"
  | "prizePaise"
  | "claimHref"
  | "claimPaid"
  | "tierPools"
  | "winners"
  | "rolloverOutPaise"
>;

function OutcomeLine({
  scores,
  matchCount,
  prizePaise,
  claimHref,
  claimPaid,
  tierPools,
  winners,
  rolloverOutPaise,
}: OutcomeProps) {
  if (!scores)
    return (
      <p className="text-lg">
        Enter five scores and keep your subscription active to be in the next one.
      </p>
    );
  if (prizePaise && (matchCount === 5 || matchCount === 4 || matchCount === 3)) {
    const tier = matchCount as WinningTier;
    const others = winners[tier] - 1;
    return (
      <div className="flex flex-col items-start gap-4">
        <p className="text-2xl">
          <strong className="text-saffron">
            {matchCount === 5 ? "Jackpot — all five" : `${matchCount} matches`}
          </strong>{" "}
          — you win <strong className="num">{formatInr(prizePaise)}</strong>
          {others > 0
            ? ` (${formatInr(tierPools[tier])} shared with ${others} other ${others === 1 ? "member" : "members"})`
            : " — the whole tier"}
          {claimPaid ? ". Paid." : ". Upload your proof to get paid."}
        </p>
        {claimHref && (
          <Link href={claimHref}>
            <Button variant={claimPaid ? "ink" : "saffron"}>
              {claimPaid ? "See your payout →" : "Claim your prize →"}
            </Button>
          </Link>
        )}
      </div>
    );
  }
  return (
    <p className="text-2xl">
      <strong>
        {matchCount === 0
          ? "No match this month"
          : `${matchCount} ${matchCount === 1 ? "match" : "matches"} — three is the first prize`}
      </strong>
      {rolloverOutPaise > 0
        ? ` — nobody took the jackpot, so ${formatInr(rolloverOutPaise)} rolls into next month.`
        : "."}
    </p>
  );
}

/** One burst, 1.2s, saffron and pool rectangles — jackpot only. */
function Confetti() {
  return (
    <div className="pointer-events-none relative h-0" aria-hidden>
      {Array.from({ length: CONFETTI_COUNT }, (_, i) => (
        <m.span
          key={i}
          className={cn(
            "absolute left-1/2 top-0 block h-2 w-1.5 rounded-[1px]",
            i % 3 === 0 ? "bg-pool" : "bg-saffron",
          )}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
          animate={{
            x: (i % 2 ? 1 : -1) * (40 + ((i * 37) % 260)),
            y: -120 + ((i * 53) % 200),
            opacity: 0,
            rotate: (i * 97) % 360,
          }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}
