"use client";

import { useActionState, useState, type FormEvent } from "react";
import { SCORE } from "@/config/constants";
import type { ScoreEntry } from "@/engine/scores/latestFive";
import type { IsoDate } from "@/engine/time/dates";
import { deleteScore, updateScore } from "@/app/(member)/app/scores/actions";
import type { ActionResult } from "@/lib/errors/action-result";
import { Button } from "@/components/ui/Button";
import { InputField } from "@/components/ui/FormField";

interface ScoreListItemProps {
  readonly entry: ScoreEntry;
  readonly today: IsoDate;
  readonly editing: boolean;
  readonly onEdit: () => void;
  readonly onCancel: () => void;
  readonly onUpdated: (entry: ScoreEntry) => void;
  readonly onDeleted: (id: string) => void;
}

function formatLongDate(date: IsoDate): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** One round: read row, or an inline edit form. Delete asks once ("Delete?") then acts. */
export function ScoreListItem({
  entry,
  today,
  editing,
  onEdit,
  onCancel,
  onUpdated,
  onDeleted,
}: ScoreListItemProps) {
  return editing ? (
    <EditRow entry={entry} today={today} onCancel={onCancel} onUpdated={onUpdated} />
  ) : (
    <ReadRow entry={entry} onEdit={onEdit} onDeleted={onDeleted} />
  );
}

function ReadRow({
  entry,
  onEdit,
  onDeleted,
}: Pick<ScoreListItemProps, "entry" | "onEdit" | "onDeleted">) {
  const [state, action, pending] = useActionState(
    async (prev: ActionResult | null, formData: FormData) => {
      const result = await deleteScore(prev, formData);
      if (result.ok) onDeleted(entry.id);
      return result;
    },
    null,
  );
  const [confirming, setConfirming] = useState(false);

  // First click only arms the button ("Delete?"); the second click actually submits.
  function armBeforeSubmit(event: FormEvent<HTMLFormElement>) {
    if (confirming) return;
    event.preventDefault();
    setConfirming(true);
  }

  return (
    <div className="flex items-center gap-4 py-3">
      <span className="num w-12 font-display text-3xl">{entry.score}</span>
      <span className="flex-1 text-sm text-ink-2">{formatLongDate(entry.playedOn)}</span>
      <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
        Edit
      </Button>
      <form action={action} onSubmit={armBeforeSubmit}>
        <input type="hidden" name="id" value={entry.id} />
        <Button
          type="submit"
          variant={confirming ? "danger" : "ghost"}
          size="sm"
          pending={pending}
          onBlur={() => setConfirming(false)}
        >
          {confirming ? "Delete?" : "Delete"}
        </Button>
      </form>
      {state && !state.ok && (
        <span role="alert" className="text-sm text-danger">
          {state.error.message}
        </span>
      )}
    </div>
  );
}

function EditRow({
  entry,
  today,
  onCancel,
  onUpdated,
}: Pick<ScoreListItemProps, "entry" | "today" | "onCancel" | "onUpdated">) {
  const [state, action, pending] = useActionState(
    async (prev: ActionResult<ScoreEntry> | null, formData: FormData) => {
      const result = await updateScore(prev, formData);
      if (result.ok) onUpdated(result.data);
      return result;
    },
    null,
  );
  const error = state && !state.ok ? state.error : null;

  return (
    <form action={action} className="flex flex-wrap items-end gap-3 py-3" noValidate>
      <input type="hidden" name="id" value={entry.id} />
      <InputField
        id={`score-${entry.id}`}
        name="score"
        label="Score"
        type="number"
        inputMode="numeric"
        min={SCORE.MIN}
        max={SCORE.MAX}
        defaultValue={entry.score}
        className="num w-24"
        error={error?.field === "score" ? error.message : undefined}
      />
      <InputField
        id={`date-${entry.id}`}
        name="playedOn"
        label="Date played"
        type="date"
        max={today}
        defaultValue={entry.playedOn}
        error={error?.field === "playedOn" ? error.message : undefined}
      />
      <div className="flex gap-2 pb-[1px]">
        <Button type="submit" size="sm" pending={pending}>
          Save
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      {error && !error.field && (
        <p role="alert" className="w-full text-sm text-danger">
          {error.message}
        </p>
      )}
    </form>
  );
}
