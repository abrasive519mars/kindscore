"use client";

import { useActionState, useState } from "react";
import type { DrawMode } from "@/engine/draw/generateNumbers";
import { simulateDraw } from "@/app/(admin)/admin/draws/actions";
import { Histogram45 } from "@/components/draw/Histogram45";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

interface Weights {
  readonly holders: readonly number[];
  readonly weights: readonly number[];
}

interface SimulatePanelProps {
  readonly drawId: string;
  readonly currentMode: DrawMode;
  readonly weights: Readonly<Record<DrawMode, Weights>>;
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

/** Pick a mode, see what it does to the odds, simulate. Re-simulating replaces the draft. */
export function SimulatePanel({ drawId, currentMode, weights, hasDraft }: SimulatePanelProps) {
  const [mode, setMode] = useState<DrawMode>(currentMode);
  const [state, action, pending] = useActionState(simulateDraw, null);
  const error = state && !state.ok ? state.error.message : null;

  return (
    <Card className="flex flex-col gap-5">
      <h2 className="text-2xl">{hasDraft ? "Re-simulate" : "Simulate"}</h2>
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="sr-only">Draw mode</legend>
        {MODES.map((option) => (
          <label
            key={option.value}
            className={cn(
              "flex cursor-pointer flex-col gap-1 rounded-md border p-4 transition-colors",
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

      <Histogram45 holders={weights[mode].holders} weights={weights[mode].weights} mode={mode} />

      <form action={action} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="drawId" value={drawId} />
        <input type="hidden" name="mode" value={mode} />
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
