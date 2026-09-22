"use client";

import { useActionState, useId, useState } from "react";
import { DRAW } from "@/config/constants";
import { weightsFromHolders, type DrawMode } from "@/engine/draw/generateNumbers";
import { simulateDraw } from "@/app/(admin)/admin/draws/actions";
import { Histogram45 } from "@/components/draw/Histogram45";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

interface SimulatePanelProps {
  readonly drawId: string;
  readonly currentMode: DrawMode;
  readonly currentStrengthBps: number;
  /** How many eligible members hold each number; index = the number, 0 unused. */
  readonly holders: readonly number[];
  readonly hasDraft: boolean;
}

const MODES: ReadonlyArray<{ value: DrawMode; title: string; body: string }> = [
  {
    value: "random",
    title: "Random",
    body: "Every number 1–45 has the same chance. A standard lottery.",
  },
  {
    value: "algorithmic",
    title: "Weighted by scores",
    body: "Numbers members actually score are likelier to be drawn — more winners, more excitement. Nothing is ever impossible.",
  },
];

/**
 * Pick a mode, turn the dial, watch the odds move, simulate. The weights shown are the weights
 * the engine will use — `weightsFromHolders` is the same function the draw itself calls.
 */
export function SimulatePanel({
  drawId,
  currentMode,
  currentStrengthBps,
  holders,
  hasDraft,
}: SimulatePanelProps) {
  const [mode, setMode] = useState<DrawMode>(currentMode);
  const [strength, setStrength] = useState(currentStrengthBps);
  const [state, action, pending] = useActionState(simulateDraw, null);
  const error = state && !state.ok ? state.error.message : null;
  const weights = weightsFromHolders(mode, holders, strength);

  return (
    <Card className="flex flex-col gap-5">
      <h2 className="text-2xl">{hasDraft ? "Re-simulate" : "Simulate"}</h2>
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="sr-only">Draw mode</legend>
        {MODES.map((option) => (
          <label
            key={option.value}
            className={cn(
              "flex cursor-pointer flex-col gap-1 rounded-md border p-4 transition-colors duration-fast",
              mode === option.value
                ? "border-saffron bg-saffron/6"
                : "border-line hover:bg-surface-2",
            )}
          >
            <span className="flex items-center gap-2 font-medium">
              <input
                type="radio"
                name="mode-choice"
                value={option.value}
                checked={mode === option.value}
                onChange={() => setMode(option.value)}
                className="accent-saffron"
              />
              {option.title}
            </span>
            <span className="text-sm text-ink-2">{option.body}</span>
          </label>
        ))}
      </fieldset>

      {mode === "algorithmic" && <StrengthDial value={strength} onChange={setStrength} />}

      <Histogram45 holders={holders} weights={weights} mode={mode} />

      <form action={action} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="drawId" value={drawId} />
        <input type="hidden" name="mode" value={mode} />
        <input type="hidden" name="strength" value={strength} />
        <Button type="submit" pending={pending} variant={hasDraft ? "ink" : "saffron"}>
          {hasDraft ? "Re-simulate with fresh numbers" : "Simulate the draw"}
        </Button>
        <span className="text-sm text-ink-2">
          Nobody sees a simulation. Members see only what you publish.
        </span>
      </form>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </Card>
  );
}

/** PRD §11 "configure draw logic": 0% is flat like random, 100% follows the scores in full. */
function StrengthDial({ value, onChange }: { value: number; onChange: (bps: number) => void }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2 rounded-md border border-line p-4">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm font-medium">
          Weighting strength
        </label>
        <span className="num font-display text-2xl text-saffron">{value / 100}%</span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={DRAW.WEIGHT_STRENGTH_MAX_BPS}
        step={DRAW.WEIGHT_STRENGTH_STEP_BPS}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-11 w-full cursor-pointer accent-saffron"
        aria-valuetext={`${value / 100} percent`}
      />
      <p className="text-sm text-ink-2">
        How far the draw leans towards the numbers members hold. 0% is a flat lottery; 100% follows
        the score distribution in full. Recorded with the result.
      </p>
    </div>
  );
}
