"use client";

import { useActionState } from "react";
import { setFeatured, setVisibility } from "@/app/(admin)/admin/charities/actions";
import { Button } from "@/components/ui/Button";

interface VisibilityPanelProps {
  readonly charityId: string;
  readonly isActive: boolean;
  readonly isFeatured: boolean;
}

/**
 * Spotlight (exactly one charity) and soft-delete. Hiding never deletes: members already giving
 * here keep giving until they change, and the admin is told how many that is.
 */
export function VisibilityPanel({ charityId, isActive, isFeatured }: VisibilityPanelProps) {
  const [featuredState, featuredAction, featuring] = useActionState(setFeatured, null);
  const [visState, visAction, toggling] = useActionState(setVisibility, null);
  const hiddenWith = visState?.ok ? visState.data.subscribers : null;

  return (
    <div className="flex flex-col gap-4">
      <form action={featuredAction} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="id" value={charityId} />
        <Button
          type="submit"
          size="sm"
          variant={isFeatured ? "ghost" : "saffron"}
          disabled={isFeatured}
          pending={featuring}
        >
          {isFeatured ? "This is the spotlight" : "Make this the homepage spotlight"}
        </Button>
        <span className="text-sm text-ink-2">
          Only one charity is featured at a time; this replaces the current one.
        </span>
        {featuredState && !featuredState.ok && (
          <p role="alert" className="w-full text-sm text-danger">
            {featuredState.error.message}
          </p>
        )}
      </form>

      <form
        action={visAction}
        className="flex flex-wrap items-center gap-3 border-t border-line pt-4"
      >
        <input type="hidden" name="id" value={charityId} />
        <input type="hidden" name="visible" value={isActive ? "false" : "true"} />
        <Button type="submit" size="sm" variant={isActive ? "danger" : "ink"} pending={toggling}>
          {isActive ? "Hide from directory" : "List again"}
        </Button>
        <span className="text-sm text-ink-2">
          {isActive
            ? "Removes it from the directory and signup. Nothing is deleted; existing supporters keep contributing."
            : "Hidden. Members cannot pick it until it is listed again."}
        </span>
        {hiddenWith !== null && !isActive && (
          <p role="status" className="w-full text-sm text-warn">
            Hidden. {hiddenWith}{" "}
            {hiddenWith === 1 ? "member still directs their" : "members still direct their"}{" "}
            subscription here — reassign them before this can ever be removed.
          </p>
        )}
        {visState && !visState.ok && (
          <p role="alert" className="w-full text-sm text-danger">
            {visState.error.message}
          </p>
        )}
      </form>
    </div>
  );
}
