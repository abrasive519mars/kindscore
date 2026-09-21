"use client";

import { useActionState, useState } from "react";
import { formatInr } from "@/engine/money/paise";
import { publishDraw } from "@/app/(admin)/admin/draws/actions";
import { Button } from "@/components/ui/Button";

interface PublishPanelProps {
  readonly drawId: string;
  readonly stale: boolean;
  readonly memberCount: number;
  readonly prizesPaise: number;
}

/**
 * Publish is two-step in place: the first click reveals exactly what will happen, the second does
 * it. No modal — the consequence sits next to the button that causes it.
 */
export function PublishPanel({ drawId, stale, memberCount, prizesPaise }: PublishPanelProps) {
  const [armed, setArmed] = useState(false);
  const [state, action, pending] = useActionState(publishDraw, null);
  const error = state && !state.ok ? state.error.message : null;

  return (
    <div className="flex flex-col gap-3 border-t border-line pt-5">
      {armed ? (
        <form action={action} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="drawId" value={drawId} />
          <p className="text-sm">
            Publishing makes these five numbers final for <strong>{memberCount}</strong> members and
            commits <strong>{formatInr(prizesPaise)}</strong> in prizes. This cannot be undone.
          </p>
          <Button type="submit" variant="saffron" pending={pending} disabled={stale}>
            Confirm — publish
          </Button>
          <Button type="button" variant="ghost" onClick={() => setArmed(false)}>
            Not yet
          </Button>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="saffron"
            disabled={stale}
            onClick={() => setArmed(true)}
            title={stale ? "Re-simulate first" : undefined}
          >
            Publish this draw
          </Button>
          <span className="text-sm text-ink-2">
            {stale ? "Disabled until you re-simulate." : "You will be asked to confirm."}
          </span>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
