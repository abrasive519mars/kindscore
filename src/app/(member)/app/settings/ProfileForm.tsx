"use client";

import { useActionState } from "react";
import { updateProfile } from "@/app/(member)/app/settings/actions";
import { Button } from "@/components/ui/Button";
import { InputField } from "@/components/ui/FormField";

export function ProfileForm({ fullName, email }: { fullName: string; email: string }) {
  const [state, action, pending] = useActionState(updateProfile, null);
  const error = state && !state.ok ? state.error : null;

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <InputField
        id="fullName"
        name="fullName"
        label="Name"
        defaultValue={fullName}
        autoComplete="name"
        required
        error={error?.field === "fullName" ? error.message : undefined}
      />
      <InputField
        id="email"
        label="Email"
        value={email}
        readOnly
        hint="Email can't be changed here yet."
      />
      {error && !error.field && (
        <p role="alert" className="text-sm text-danger">
          {error.message}
        </p>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" pending={pending} size="sm">
          Save
        </Button>
        {state?.ok && (
          <span role="status" className="text-sm text-success">
            Saved
          </span>
        )}
      </div>
    </form>
  );
}
