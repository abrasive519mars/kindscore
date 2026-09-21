"use client";

import { useActionState } from "react";
import { chooseCharity } from "@/app/(marketing)/charities/actions";
import { Button } from "@/components/ui/Button";

/** "Choose this charity" for a signed-in member; the percentage stays as it was. */
export function ChooseCharityButton({
  charityId,
  charityName,
}: {
  charityId: string;
  charityName: string;
}) {
  const [state, action, pending] = useActionState(chooseCharity, null);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="charityId" value={charityId} />
      <Button type="submit" variant="saffron" pending={pending} className="w-full">
        Choose {charityName.split(" ")[0]} as my charity
      </Button>
      <span className="text-xs text-ink-2">
        Applies from your next payment. Your percentage stays the same.
      </span>
      {state?.ok && (
        <span role="status" className="text-sm text-success">
          Done — {charityName} is now your charity.
        </span>
      )}
      {state && !state.ok && (
        <span role="alert" className="text-sm text-danger">
          {state.error.message}
        </span>
      )}
    </form>
  );
}
