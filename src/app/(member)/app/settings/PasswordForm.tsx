"use client";

import { useActionState } from "react";
import { changePassword } from "@/app/(member)/app/settings/actions";
import { Button } from "@/components/ui/Button";
import { PasswordField } from "@/components/ui/PasswordField";

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, null);
  const error = state && !state.ok ? state.error : null;

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <PasswordField
        id="new-password"
        name="password"
        label="New password"
        autoComplete="new-password"
        required
        error={error?.field === "password" ? error.message : undefined}
      />
      {error && !error.field && (
        <p role="alert" className="text-sm text-danger">
          {error.message}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="text-sm text-success">
          Password changed.
        </p>
      )}
      <div>
        <Button type="submit" size="sm" pending={pending}>
          Change password
        </Button>
      </div>
    </form>
  );
}
