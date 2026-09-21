"use client";

import { useId, useState } from "react";
import { PLANS, SPLIT } from "@/config/constants";
import { splitPayment } from "@/engine/charity/splitPayment";
import { formatInr } from "@/engine/money/paise";
import { cn } from "@/lib/cn";

/**
 * The Split — one bar showing where a payment goes (DESIGN.md §2.4, §4.3):
 * saffron = charity (the member's choice), pool = prize pool (fixed), grey = Kindscore.
 * Static form for cards; interactive form (slider) for signup and the charity page.
 */

interface SplitBarProps {
  readonly amountPaise: number;
  readonly charityBps: number;
  readonly compact?: boolean;
}

export function SplitBar({ amountPaise, charityBps, compact = false }: SplitBarProps) {
  const { charityPaise, poolPaise, platformPaise } = splitPayment(amountPaise, charityBps);
  const pct = (paise: number) => `${(paise / amountPaise) * 100}%`;
  return (
    <div className="flex flex-col gap-2">
      <div
        className="flex h-3 w-full overflow-hidden rounded-full bg-surface-2"
        role="img"
        aria-label={splitLabel(charityPaise, poolPaise, platformPaise)}
      >
        <div
          className="h-full bg-saffron transition-[width] duration-move ease-move"
          style={{ width: pct(charityPaise) }}
        />
        <div
          className="h-full bg-pool transition-[width] duration-move ease-move"
          style={{ width: pct(poolPaise) }}
        />
      </div>
      {!compact && (
        <dl className="num grid grid-cols-3 gap-2 text-sm">
          <SplitLegend swatch="bg-saffron" label="Your charity" value={formatInr(charityPaise)} />
          <SplitLegend swatch="bg-pool" label="Prize pool" value={formatInr(poolPaise)} />
          <SplitLegend
            swatch="bg-surface-2"
            label="Kindscore"
            value={platformPaise === 0 ? "Nothing" : formatInr(platformPaise)}
          />
        </dl>
      )}
    </div>
  );
}

function splitLabel(charity: number, pool: number, platform: number): string {
  return `${formatInr(charity)} to your charity, ${formatInr(pool)} to the prize pool, ${formatInr(platform)} to Kindscore`;
}

function SplitLegend({ swatch, label, value }: { swatch: string; label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="flex items-center gap-1.5 text-ink-2">
        <span className={cn("inline-block h-2 w-2 rounded-full", swatch)} aria-hidden /> {label}
      </dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

interface SplitSliderProps {
  readonly name: string;
  readonly defaultBps?: number;
  readonly amountPaise?: number;
  readonly outcomeLine?: string;
}

/** Slider 10–70% in 5% steps; the bar and rupee figures follow live. */
export function SplitSlider({
  name,
  defaultBps = SPLIT.CHARITY_MIN_BPS,
  amountPaise = PLANS.month.pricePaise,
  outcomeLine,
}: SplitSliderProps) {
  const [bps, setBps] = useState(defaultBps);
  const id = useId();
  const percent = bps / 100;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm font-medium">
          Share of every payment to your charity
        </label>
        <span className="num font-display text-2xl text-saffron">{percent}%</span>
      </div>
      <input
        id={id}
        name={name}
        type="range"
        min={SPLIT.CHARITY_MIN_BPS}
        max={SPLIT.CHARITY_MAX_BPS}
        step={SPLIT.CHARITY_STEP_BPS}
        value={bps}
        onChange={(event) => setBps(Number(event.target.value))}
        className="h-11 w-full cursor-pointer accent-saffron"
        aria-valuetext={`${percent} percent`}
      />
      <SplitBar amountPaise={amountPaise} charityBps={bps} />
      {outcomeLine && <p className="text-sm text-ink-2">{outcomeLine}</p>}
    </div>
  );
}
