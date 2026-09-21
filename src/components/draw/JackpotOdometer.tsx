"use client";

import { LazyMotion, domAnimation, m, useReducedMotion } from "motion/react";
import { formatInr } from "@/engine/money/paise";
import { cn } from "@/lib/cn";

interface JackpotOdometerProps {
  readonly paise: number;
  readonly className?: string;
}

const DIGITS = Array.from({ length: 10 }, (_, i) => String(i));
const ROLL_MS = 900;
const STAGGER_MS = 60;

/**
 * DESIGN.md §4.2 — fixed-width digit columns, each a 0–9 strip that rolls from 0 to its digit on
 * first paint, right to left. Grouping and the ₹ come from formatInr so it reads exactly like every
 * other rupee figure. Reduced motion: the final value, no roll. Screen readers get the plain value.
 */
export function JackpotOdometer({ paise, className }: JackpotOdometerProps) {
  const reduced = useReducedMotion();
  const text = formatInr(paise);
  const digitCount = text.replace(/\D/g, "").length;
  let digitIndex = 0;

  return (
    <LazyMotion features={domAnimation} strict>
      <span
        className={cn("num inline-flex font-display leading-none", className)}
        aria-label={text}
        role="img"
      >
        {[...text].map((char, i) => {
          if (!/\d/.test(char)) {
            return (
              <span key={i} aria-hidden>
                {char}
              </span>
            );
          }
          const delay = ((digitCount - 1 - digitIndex++) * STAGGER_MS) / 1000;
          return <Digit key={i} value={Number(char)} delay={delay} reduced={Boolean(reduced)} />;
        })}
      </span>
    </LazyMotion>
  );
}

function Digit({ value, delay, reduced }: { value: number; delay: number; reduced: boolean }) {
  return (
    <span className="relative inline-block h-[1em] w-[0.62em] overflow-hidden" aria-hidden>
      <m.span
        className="absolute left-0 top-0 flex flex-col"
        initial={reduced ? { y: `${-value}em` } : { y: 0 }}
        animate={{ y: `${-value}em` }}
        transition={
          reduced ? { duration: 0 } : { duration: ROLL_MS / 1000, ease: [0.23, 1, 0.32, 1], delay }
        }
      >
        {DIGITS.map((d) => (
          <span key={d} className="block h-[1em] text-center">
            {d}
          </span>
        ))}
      </m.span>
    </span>
  );
}
