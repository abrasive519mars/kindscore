"use client";

import { useActionState, useState } from "react";
import { updateCharityChoice } from "@/app/(member)/app/charity/actions";
import { Button } from "@/components/ui/Button";
import { SelectField } from "@/components/ui/FormField";
import { SplitSlider } from "@/components/ui/Split";

interface Option {
  readonly id: string;
  readonly name: string;
  readonly city: string;
  readonly outcomeLine: string;
}

interface CharityChoiceFormProps {
  readonly charities: readonly Option[];
  readonly currentCharityId: string | null;
  readonly currentBps: number;
}

/** DESIGN.md §4.3 The Split, bound to a form: charity + share, saved together. */
export function CharityChoiceForm({
  charities,
  currentCharityId,
  currentBps,
}: CharityChoiceFormProps) {
  const [state, action, pending] = useActionState(updateCharityChoice, null);
  const [charityId, setCharityId] = useState(currentCharityId ?? charities[0]?.id ?? "");
  const chosen = charities.find((c) => c.id === charityId);
  const error = state && !state.ok ? state.error : null;

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <SelectField
        id="charityId"
        name="charityId"
        label="Your charity"
        value={charityId}
        onChange={(event) => setCharityId(event.target.value)}
        error={error?.field === "charityId" ? error.message : undefined}
      >
        {charities.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} · {c.city}
          </option>
        ))}
      </SelectField>
      <SplitSlider name="charityBps" defaultBps={currentBps} outcomeLine={chosen?.outcomeLine} />
      {error && error.field !== "charityId" && (
        <p role="alert" className="text-sm text-danger">
          {error.message}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" pending={pending}>
          Save
        </Button>
        {state?.ok ? (
          <span role="status" className="text-sm text-success">
            Saved. Applies from your next payment.
          </span>
        ) : (
          <span className="text-sm text-ink-2">
            Applies from your next payment; past payments keep their split.
          </span>
        )}
      </div>
    </form>
  );
}
