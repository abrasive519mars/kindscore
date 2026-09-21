"use client";

import { useActionState, useState } from "react";
import { SCORE } from "@/config/constants";
import type { ScoreEntry } from "@/engine/scores/latestFive";
import { formatShortDate } from "@/engine/time/dates";
import {
  addMemberScore,
  deleteMemberScore,
  updateMemberScore,
} from "@/app/(admin)/admin/users/actions";
import { ScoreRow } from "@/components/app/ScoreRow";
import { Button } from "@/components/ui/Button";
import { InputField } from "@/components/ui/FormField";

interface AdminScoresProps {
  readonly userId: string;
  readonly entries: readonly ScoreEntry[];
}

/** The member's five, editable by the admin through the same actions' rules. Server-rendered list; forms per row. */
export function AdminScores({ userId, entries }: AdminScoresProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-5">
      <ScoreRow scores={entries.map((e) => e.score)} size="md" />
      <ul className="flex flex-col divide-y divide-line" aria-label="Rounds, newest first">
        {entries.map((entry) => (
          <li key={entry.id} className="py-2">
            {editingId === entry.id ? (
              <EditRow userId={userId} entry={entry} onDone={() => setEditingId(null)} />
            ) : (
              <ReadRow userId={userId} entry={entry} onEdit={() => setEditingId(entry.id)} />
            )}
          </li>
        ))}
      </ul>
      <AddRow userId={userId} />
    </div>
  );
}

function ReadRow({
  userId,
  entry,
  onEdit,
}: {
  userId: string;
  entry: ScoreEntry;
  onEdit: () => void;
}) {
  const [state, action, pending] = useActionState(deleteMemberScore, null);
  return (
    <div className="flex flex-wrap items-center gap-4">
      <span className="num w-10 font-display text-2xl">{entry.score}</span>
      <span className="flex-1 text-sm text-ink-2">{formatShortDate(entry.playedOn)}</span>
      <Button type="button" size="sm" variant="ghost" onClick={onEdit}>
        Edit
      </Button>
      <form action={action}>
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="id" value={entry.id} />
        <Button type="submit" size="sm" variant="danger" pending={pending}>
          Delete
        </Button>
      </form>
      {state && !state.ok && (
        <span role="alert" className="w-full text-sm text-danger">
          {state.error.message}
        </span>
      )}
    </div>
  );
}

function EditRow({
  userId,
  entry,
  onDone,
}: {
  userId: string;
  entry: ScoreEntry;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(
    async (prev: Parameters<typeof updateMemberScore>[0], formData: FormData) => {
      const result = await updateMemberScore(prev, formData);
      if (result.ok) onDone();
      return result;
    },
    null,
  );
  const error = state && !state.ok ? state.error : null;
  return (
    <form action={action} className="flex flex-wrap items-end gap-3" noValidate>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="id" value={entry.id} />
      <InputField
        id={`s-${entry.id}`}
        name="score"
        label="Score"
        type="number"
        min={SCORE.MIN}
        max={SCORE.MAX}
        defaultValue={entry.score}
        className="num w-24"
        error={error?.field === "score" ? error.message : undefined}
      />
      <InputField
        id={`d-${entry.id}`}
        name="playedOn"
        label="Date played"
        type="date"
        defaultValue={entry.playedOn}
        error={error?.field === "playedOn" ? error.message : undefined}
      />
      <Button type="submit" size="sm" pending={pending}>
        Save
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={onDone}>
        Cancel
      </Button>
      {error && !error.field && (
        <p role="alert" className="w-full text-sm text-danger">
          {error.message}
        </p>
      )}
    </form>
  );
}

function AddRow({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState(addMemberScore, null);
  const error = state && !state.ok ? state.error : null;
  return (
    <form
      action={action}
      className="flex flex-wrap items-end gap-3 border-t border-line pt-4"
      noValidate
    >
      <input type="hidden" name="userId" value={userId} />
      <InputField
        id="new-score"
        name="score"
        label="Add a score"
        type="number"
        min={SCORE.MIN}
        max={SCORE.MAX}
        defaultValue={30}
        className="num w-24"
        error={error?.field === "score" ? error.message : undefined}
      />
      <InputField
        id="new-date"
        name="playedOn"
        label="Date played"
        type="date"
        error={error?.field === "playedOn" ? error.message : undefined}
      />
      <Button type="submit" size="sm" variant="saffron" pending={pending}>
        Add
      </Button>
      {error && !error.field && (
        <p role="alert" className="w-full text-sm text-danger">
          {error.message}
        </p>
      )}
      {state?.ok && (
        <span role="status" className="w-full text-sm text-success">
          Added and audited.
        </span>
      )}
    </form>
  );
}
