"use client";

import { animate, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

interface CountUpProps {
  readonly value: number;
  readonly className?: string;
}

const DURATION_S = 0.9;
const EASE = [0.23, 1, 0.32, 1] as const;

/**
 * An integer that counts from 0 to its value the first time it scrolls into view (DESIGN.md §7,
 * one signature per viewport). Indian grouping; reduced motion shows the final value at once.
 */
export function CountUp({ value, className }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? value : 0);

  useEffect(() => {
    if (!inView || reduced) return;
    const controls = animate(0, value, {
      duration: DURATION_S,
      ease: EASE,
      onUpdate: (latest) => setShown(Math.round(latest)),
    });
    return () => controls.stop();
  }, [inView, reduced, value]);

  return (
    <span ref={ref} className={className} aria-label={value.toLocaleString("en-IN")}>
      {(reduced ? value : shown).toLocaleString("en-IN")}
    </span>
  );
}
