"use client";

import { LazyMotion, domAnimation, m, useInView, useReducedMotion } from "motion/react";
import { useRef } from "react";
import { PLANS, SPLIT } from "@/config/constants";
import { formatInr } from "@/engine/money/paise";
import { SplitBar } from "@/components/ui/Split";
import { cn } from "@/lib/cn";

const PRIYA = [28, 33, 31, 36, 29];
const DRAWN = [33, 12, 29, 36, 41];
const EASE = [0.23, 1, 0.32, 1] as const;

/**
 * DESIGN.md §3 step 3 — three numbered steps with a named golfer. Two motions, once, on scroll:
 * step 2's sixth score evicting the oldest; step 3's matches filling saffron.
 */
export function HowItWorks() {
  return (
    <section
      className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-20"
      aria-labelledby="how-heading"
    >
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium uppercase tracking-[0.06em] text-ink-2">How it works</p>
        <h2 id="how-heading" className="text-4xl md:text-5xl">
          Three steps. One round a month.
        </h2>
      </header>
      <LazyMotion features={domAnimation} strict>
        <ol className="grid gap-8 md:grid-cols-3">
          <Step
            n={1}
            title="Subscribe and pick your charity."
            body={`At least ${SPLIT.CHARITY_MIN_BPS / 100}% of every payment goes to them. Raise it any time.`}
          >
            <SplitBar
              amountPaise={PLANS.month.pricePaise}
              charityBps={SPLIT.CHARITY_MIN_BPS}
              compact
            />
          </Step>
          <Step
            n={2}
            title="Log your last five scores."
            body="Stableford, 1 to 45, one per date. A sixth replaces the oldest — your five most recent rounds are your numbers."
          >
            <Eviction />
          </Step>
          <Step
            n={3}
            title="Match the monthly draw."
            body="Five numbers from 1 to 45. Match three, four or five and you share the pool."
          >
            <MatchFill />
          </Step>
        </ol>
      </LazyMotion>
    </section>
  );
}

function Step({
  n,
  title,
  body,
  children,
}: {
  n: number;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-6">
      <span className="num font-display text-3xl text-saffron">{n}</span>
      <h3 className="text-2xl">{title}</h3>
      <p className="text-sm text-ink-2">{body}</p>
      <div className="mt-auto pt-2">{children}</div>
    </li>
  );
}

/** 28 33 31 36 29 → a 35 slides in on the left and the 28 (oldest) fades on the right. */
function Eviction() {
  const ref = useRef<HTMLOListElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduced = useReducedMotion();
  const play = inView && !reduced;
  const row = play ? [35, ...PRIYA] : PRIYA;
  return (
    <ol
      ref={ref}
      className="num flex items-baseline gap-4 border-b border-line pb-2 font-display text-3xl"
      aria-label="Priya's scores: a sixth replaces the oldest"
    >
      {row.map((score, i) => {
        const isNew = play && i === 0;
        const isEvicted = play && i === row.length - 1;
        return (
          <m.li
            key={`${score}-${i}`}
            initial={isNew ? { opacity: 0, x: -8 } : false}
            animate={isNew ? { opacity: 1, x: 0 } : isEvicted ? { opacity: 0.25 } : { opacity: 1 }}
            transition={{ duration: isNew ? 0.2 : 0.15, ease: EASE, delay: isNew ? 0.3 : 0.6 }}
            className={cn(isNew && "text-saffron")}
          >
            {score}
          </m.li>
        );
      })}
    </ol>
  );
}

/** Drawn 33 12 29 36 41 above Priya's row; 33, 36, 29 fill saffron once in view. */
function MatchFill() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduced = useReducedMotion();
  const filled = inView || reduced;
  const drawn = new Set(DRAWN);
  return (
    <div ref={ref} className="flex flex-col gap-3">
      <ol className="num flex gap-1.5 font-display text-lg" aria-label="Drawn numbers">
        {DRAWN.map((n) => (
          <li
            key={n}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-md border border-line bg-surface",
              filled && PRIYA.includes(n) && "border-pool text-pool",
            )}
          >
            {n}
          </li>
        ))}
      </ol>
      <ol
        className="num flex items-baseline gap-4 border-b border-line pb-2 font-display text-3xl"
        aria-label="Priya's scores"
      >
        {PRIYA.map((s) => (
          <li
            key={s}
            className={cn(
              "transition-colors duration-200",
              filled && (drawn.has(s) ? "text-saffron" : "text-ink-3"),
            )}
          >
            {s}
          </li>
        ))}
      </ol>
      <p
        className={cn(
          "text-sm transition-opacity duration-300",
          filled ? "opacity-100" : "opacity-0",
        )}
        aria-live="polite"
      >
        <strong className="text-saffron">3 matches</strong> · Priya shared {formatInr(3_750_000)}{" "}
        with 14 others in August.
      </p>
    </div>
  );
}
