"use client";

import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from "motion/react";
import { useState } from "react";
import { weightsFromHolders, type DrawMode } from "@/engine/draw/generateNumbers";
import {
  describePracticeOutcome,
  PRACTICE_HOLDERS,
  PRACTICE_SAMPLE,
  practiceDraw,
  type PracticeResult,
} from "@/engine/draw/practice";
import { Histogram45 } from "@/components/draw/Histogram45";
import { FadeIn } from "@/components/motion/FadeIn";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

const EASE = [0.23, 1, 0.32, 1] as const;

/**
 * DESIGN.md §3 step 5 — the one "game" section. The real engine runs in the browser against a
 * sample row; nothing is saved. Tiles roll in with an 80ms stagger; never confetti here.
 */
export function PracticeDraw() {
  const [mode, setMode] = useState<DrawMode>("random");
  const [result, setResult] = useState<PracticeResult | null>(null);
  const [pulls, setPulls] = useState(0);
  const reduced = useReducedMotion();
  const drawn = new Set(result?.numbers ?? []);

  function pull() {
    setResult(practiceDraw(mode));
    setPulls((n) => n + 1);
  }

  return (
    <section
      id="draw"
      className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-20"
      aria-labelledby="draw-heading"
    >
      <FadeIn>
        <header className="flex flex-col gap-2">
          <p className="text-sm font-medium uppercase tracking-[0.06em] text-ink-2">The draw</p>
          <h2 id="draw-heading" className="text-4xl md:text-5xl">
            How a draw works.
          </h2>
          <p className="max-w-prose text-lg text-ink-2">
            Once a month, five numbers from 1 to 45. Your five kept scores are your ticket. Try it
            on Priya&apos;s row — this is the real engine, just not the real draw.
          </p>
        </header>
      </FadeIn>

      <FadeIn delay={0.08} className="grid gap-8 lg:grid-cols-[1fr_1fr]">
        <div className="flex flex-col gap-6 rounded-lg border border-line bg-surface p-6">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium uppercase tracking-[0.06em] text-ink-2">
              Priya&apos;s five
            </p>
            <ol
              className="num flex items-baseline gap-5 border-b border-line pb-2 font-display text-4xl"
              aria-label="Sample scores"
            >
              {PRACTICE_SAMPLE.map((s) => (
                <li
                  key={s}
                  className={cn(
                    "transition-colors duration-200",
                    result && (drawn.has(s) ? "text-saffron" : "text-ink-3"),
                  )}
                >
                  {s}
                </li>
              ))}
            </ol>
          </div>
          <div className="flex min-h-14 items-center">
            <LazyMotion features={domAnimation} strict>
              <AnimatePresence mode="wait">
                {result ? (
                  <m.ol
                    key={pulls}
                    className="num flex gap-2 font-display text-3xl"
                    aria-label="Practice draw numbers"
                  >
                    {result.numbers.map((n, i) => (
                      <m.li
                        key={n}
                        initial={reduced ? false : { opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.24, ease: EASE, delay: reduced ? 0 : i * 0.08 }}
                        className={cn(
                          "flex h-14 w-14 items-center justify-center rounded-md border bg-surface",
                          PRACTICE_SAMPLE.includes(n)
                            ? "border-pool text-pool ring-2 ring-pool/30"
                            : "border-line",
                        )}
                      >
                        {n}
                      </m.li>
                    ))}
                  </m.ol>
                ) : (
                  <p key="empty" className="text-sm text-ink-2">
                    Five hollow slots until you pull.
                  </p>
                )}
              </AnimatePresence>
            </LazyMotion>
          </div>
          <p className="min-h-6 text-sm" aria-live="polite">
            {result ? describePracticeOutcome(result) : ""}
          </p>
          <div>
            <Button type="button" variant="saffron" onClick={pull}>
              {result ? "Pull again" : "Pull a practice draw"}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-6">
          <p className="text-sm text-ink-2">
            Random, or weighted by what golfers actually score — the admin chooses each month.
            Weighted follows the shape of everyone&apos;s scores, so more people match; nothing is
            ever impossible.
          </p>
          <fieldset className="flex gap-2">
            <legend className="sr-only">Draw mode</legend>
            {(["random", "algorithmic"] as const).map((value) => (
              <label
                key={value}
                className={cn(
                  "cursor-pointer rounded-full border px-3 py-1 text-sm",
                  mode === value ? "border-ink bg-ink text-bg" : "border-line hover:bg-surface-2",
                )}
              >
                <input
                  type="radio"
                  name="practice-mode"
                  value={value}
                  checked={mode === value}
                  onChange={() => setMode(value)}
                  className="sr-only"
                />
                {value === "random" ? "Random" : "Weighted by scores"}
              </label>
            ))}
          </fieldset>
          <Histogram45
            holders={PRACTICE_HOLDERS}
            weights={weightsFromHolders(mode, PRACTICE_HOLDERS)}
            mode={mode}
          />
        </div>
      </FadeIn>
    </section>
  );
}
