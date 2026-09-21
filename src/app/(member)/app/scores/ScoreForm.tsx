"use client";

import { useActionState, useState } from "react";
import { SCORE } from "@/config/constants";
import type { ScoreEntry } from "@/engine/scores/latestFive";
import { formatShortDate, type IsoDate } from "@/engine/time/dates";
import { addScore } from "@/app/(member)/app/scores/actions";
import type { ActionResult } from "@/lib/errors/action-result";
import type { AddScoreResult } from "@/services/ScoreService";
import { Button } from "@/components/ui/Button";
import { InputField } from "@/components/ui/FormField";

interface ScoreFormProps {
  readonly today: IsoDate;
  readonly usedDates: readonly IsoDate[];
  readonly entries: readonly ScoreEntry[];
  readonly onAdded: (entry: ScoreEntry) => void;
  readonly onEditRequest: (id: string) => void;
}

/**
 * Score + date, with ±1 steppers for thumbs. Feedback is inline beside the form, never a toast:
 * "Saved — replaced your 19 Aug round (31)", or the conflict with a link to the clashing round.
 */
export function ScoreForm({ today, usedDates, entries, onAdded, onEditRequest }: ScoreFormProps) {
  // The parent is told inside the action, not in an effect: an effect keyed on `onAdded` would
  // re-fire on every parent render and hand the same entry up again.
  const [state, action, pending] = useActionState(
    async (prev: ActionResult<AddScoreResult> | null, formData: FormData) => {
      const result = await addScore(prev, formData);
      if (result.ok) onAdded(result.data.entry);
      return result;
    },
    null,
  );
  const [score, setScore] = useState<number>(30);
  const [playedOn, setPlayedOn] = useState<IsoDate>(today);
  const error = state && !state.ok ? state.error : null;
  const saved = state?.ok ? state.data : null;

  const clash =
    error?.code === "CONFLICT" ? entries.find((e) => e.playedOn === playedOn) : undefined;
  const dateTaken = usedDates.includes(playedOn);
  const step = (delta: number) =>
    setScore((s) => Math.min(SCORE.MAX, Math.max(SCORE.MIN, s + delta)));

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <div className="flex items-end gap-2">
        <InputField
          id="score"
          name="score"
          label="Stableford score"
          type="number"
          inputMode="numeric"
          min={SCORE.MIN}
          max={SCORE.MAX}
          value={score}
          onChange={(event) => setScore(Number(event.target.value))}
          error={error?.field === "score" ? error.message : undefined}
          className="num w-24 text-center text-2xl"
        />
        <div className="mb-[1px] flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => step(-1)}
            aria-label="One less"
          >
            −
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => step(1)}
            aria-label="One more"
          >
            +
          </Button>
        </div>
      </div>
      <InputField
        id="playedOn"
        name="playedOn"
        label="Date played"
        type="date"
        max={today}
        value={playedOn}
        onChange={(event) => setPlayedOn(event.target.value)}
        error={error?.field === "playedOn" ? error.message : undefined}
        hint={
          dateTaken && !error
            ? `You already have a round on ${formatShortDate(playedOn)}`
            : undefined
        }
      />

      {error && !error.field && (
        <p role="alert" className="text-sm text-danger">
          {error.message}
          {clash && (
            <>
              {" "}
              <button
                type="button"
                onClick={() => onEditRequest(clash.id)}
                className="underline underline-offset-4"
              >
                Edit that round
              </button>
            </>
          )}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm text-success">
          Saved.
          {saved.evicted &&
            ` Replaced your ${formatShortDate(saved.evicted.playedOn)} round (${saved.evicted.score}).`}
        </p>
      )}

      <Button type="submit" pending={pending} variant="saffron">
        Add round
      </Button>
    </form>
  );
}
