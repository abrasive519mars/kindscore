"use client";

import { LazyMotion, domAnimation, m, useReducedMotion } from "motion/react";
import { DRAW } from "@/config/constants";
import { cn } from "@/lib/cn";

interface Histogram45Props {
  /** Index = the number (1–45); how many eligible members hold it. Index 0 unused. */
  readonly holders: readonly number[];
  /** Same indexing; the draw weight per number for the chosen mode and strength. */
  readonly weights: readonly number[];
  readonly mode: "random" | "algorithmic";
  readonly className?: string;
}

const NUMBERS = Array.from({ length: DRAW.NUMBER_MAX }, (_, i) => i + 1);
const BAR_WIDTH = 100 / DRAW.NUMBER_MAX;
const PLOT_HEIGHT = 90;
const EASE = [0.65, 0, 0.35, 1] as const;

/**
 * The odds, 1–45: saffron bars are the draw weight per number (flat in random mode, the score
 * distribution in algorithmic mode), faint ink bars behind are how many members hold each number.
 * Bars animate between modes and strengths so the dial is felt, not read. Pure SVG.
 */
export function Histogram45({ holders, weights, mode, className }: Histogram45Props) {
  const reduced = useReducedMotion();
  const maxHolders = Math.max(1, ...NUMBERS.map((n) => holders[n] ?? 0));
  const maxWeight = Math.max(1e-9, ...NUMBERS.map((n) => weights[n] ?? 0));
  const heightOf = (value: number, max: number) => (value / max) * PLOT_HEIGHT;
  const transition = reduced ? { duration: 0 } : { duration: 0.32, ease: EASE };

  return (
    <LazyMotion features={domAnimation} strict>
      <figure className={cn("flex flex-col gap-2", className)}>
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="h-40 w-full"
          role="img"
          aria-label={describe(holders, mode)}
        >
          {NUMBERS.map((n) => {
            const holderHeight = heightOf(holders[n] ?? 0, maxHolders);
            const weightHeight = heightOf(weights[n] ?? 0, maxWeight);
            const x = (n - 1) * BAR_WIDTH;
            return (
              <g key={n}>
                <rect
                  x={x + BAR_WIDTH * 0.1}
                  y={100 - holderHeight}
                  width={BAR_WIDTH * 0.8}
                  height={holderHeight}
                  className="fill-ink/10"
                />
                <m.rect
                  x={x + BAR_WIDTH * 0.3}
                  width={BAR_WIDTH * 0.4}
                  initial={false}
                  animate={{ y: 100 - weightHeight, height: weightHeight }}
                  transition={transition}
                  className="fill-saffron"
                />
              </g>
            );
          })}
        </svg>
        <figcaption className="flex justify-between gap-4 text-xs text-ink-2">
          <span>1</span>
          <span className="text-center">
            saffron: chance of each number being drawn —{" "}
            {mode === "random" ? "equal for all" : "follows what members score, never zero"} · grey:
            members holding it
          </span>
          <span>45</span>
        </figcaption>
      </figure>
    </LazyMotion>
  );
}

function describe(holders: readonly number[], mode: string): string {
  const most = NUMBERS.reduce(
    (best, n) => ((holders[n] ?? 0) > (holders[best] ?? 0) ? n : best),
    1,
  );
  return `Draw odds 1 to 45 in ${mode} mode; most-held number is ${most}`;
}
