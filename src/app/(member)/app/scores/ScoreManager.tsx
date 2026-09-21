"use client";

import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from "motion/react";
import { useState } from "react";
import { SCORE } from "@/config/constants";
import type { ScoreEntry } from "@/engine/scores/latestFive";
import { selectRetainedScores } from "@/engine/scores/latestFive";
import { formatShortDate, type IsoDate } from "@/engine/time/dates";
import { Card, EmptyState } from "@/components/ui/primitives";
import { ScoreRow } from "@/components/app/ScoreRow";
import { ScoreForm } from "@/app/(member)/app/scores/ScoreForm";
import { ScoreListItem } from "@/app/(member)/app/scores/ScoreListItem";

interface ScoreManagerProps {
  readonly initialEntries: readonly ScoreEntry[];
  readonly today: IsoDate;
}

/**
 * Owns the list on the client so additions, edits and deletions animate (DESIGN.md §4.4).
 * The server is still the source of truth: every change goes through a server action first and
 * the list is updated from what the action returns — the engine's ordering is re-applied locally.
 */
export function ScoreManager({ initialEntries, today }: ScoreManagerProps) {
  const [entries, setEntries] = useState<readonly ScoreEntry[]>(initialEntries);
  const [editingId, setEditingId] = useState<string | null>(null);
  const reduced = useReducedMotion();
  const remaining = SCORE.WINDOW_SIZE - entries.length;

  function onAdded(entry: ScoreEntry) {
    setEntries((current) => [...selectRetainedScores([...current.filter((e) => e.id !== entry.id), entry]).retained]);
  }
  function onUpdated(entry: ScoreEntry) {
    setEntries((current) => [...selectRetainedScores(current.map((e) => (e.id === entry.id ? entry : e))).retained]);
    setEditingId(null);
  }
  function onDeleted(id: string) {
    setEntries((current) => current.filter((e) => e.id !== id));
  }

  return (
    <LazyMotion features={domAnimation} strict>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="flex flex-col gap-6">
          <ScoreRow scores={entries.map((e) => e.score)} />
          {remaining > 0 && (
            <EmptyState
              title={`Enter ${remaining} more ${remaining === 1 ? "round" : "rounds"} to be in the next draw`}
              body="Five scores are your ticket. A sixth replaces the oldest."
            />
          )}
          <ul className="flex flex-col divide-y divide-line" aria-label="Your rounds, newest first">
            <AnimatePresence initial={false}>
              {entries.map((entry) => (
                <m.li
                  key={entry.id}
                  layout={!reduced}
                  initial={reduced ? false : { opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduced ? undefined : { opacity: 0, transition: { duration: 0.15 } }}
                  transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                >
                  <ScoreListItem
                    entry={entry}
                    today={today}
                    editing={editingId === entry.id}
                    onEdit={() => setEditingId(entry.id)}
                    onCancel={() => setEditingId(null)}
                    onUpdated={onUpdated}
                    onDeleted={onDeleted}
                  />
                </m.li>
              ))}
            </AnimatePresence>
          </ul>
        </Card>

        <Card className="flex flex-col gap-4 self-start">
          <h2 className="text-2xl">Add a round</h2>
          <ScoreForm today={today} usedDates={entries.map((e) => e.playedOn)} onAdded={onAdded} onEditRequest={setEditingId} entries={entries} />
          <p className="text-xs text-ink-3">
            Oldest kept round: {entries.length ? formatShortDate(entries[entries.length - 1].playedOn) : "—"}. Anything older than that can&apos;t be added.
          </p>
        </Card>
      </div>
    </LazyMotion>
  );
}
