"use client";

import { useActionState } from "react";
import { updateMemberProfile } from "@/app/(admin)/admin/users/actions";
import { Button } from "@/components/ui/Button";
import { InputField, SelectField } from "@/components/ui/FormField";
import { SplitSlider } from "@/components/ui/Split";

interface ProfileFormProps {
  readonly userId: string;
  readonly fullName: string;
  readonly charityId: string | null;
  readonly charityBps: number;
  readonly charities: readonly { id: string; name: string; isActive: boolean }[];
}

/** Name, charity and share — the same three fields the member controls. Role and email are not editable here or anywhere. */
export function ProfileForm({
  userId,
  fullName,
  charityId,
  charityBps,
  charities,
}: ProfileFormProps) {
  const [state, action, pending] = useActionState(updateMemberProfile, null);
  const error = state && !state.ok ? state.error : null;
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="userId" value={userId} />
      <InputField
        id="fullName"
        name="fullName"
        label="Name"
        defaultValue={fullName}
        required
        error={error?.field === "fullName" ? error.message : undefined}
      />
      <SelectField
        id="charityId"
        name="charityId"
        label="Charity"
        defaultValue={charityId ?? ""}
        error={error?.field === "charityId" ? error.message : undefined}
      >
        {charities.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
            {c.isActive ? "" : " · hidden"}
          </option>
        ))}
      </SelectField>
      <SplitSlider name="charityBps" defaultBps={charityBps} />
      {error && !error.field && (
        <p role="alert" className="text-sm text-danger">
          {error.message}
        </p>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" pending={pending}>
          Save profile
        </Button>
        {state?.ok && (
          <span role="status" className="text-sm text-success">
            Saved and audited.
          </span>
        )}
      </div>
    </form>
  );
}
