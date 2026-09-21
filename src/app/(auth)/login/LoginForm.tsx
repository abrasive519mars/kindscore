"use client";

import { useActionState, useState } from "react";
import { logIn } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/Button";
import { InputField } from "@/components/ui/FormField";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(logIn, null);
  // React 19 resets the form after every action; keep the email so a wrong password doesn't wipe it.
  const [email, setEmail] = useState("");
  const error = state && !state.ok ? state.error : null;
  const fieldError = (field: string) => (error?.field === field ? error.message : undefined);

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="next" value={next} />
      <InputField
        id="email"
        name="email"
        type="email"
        label="Email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={fieldError("email")}
      />
      <InputField
        id="password"
        name="password"
        type="password"
        label="Password"
        autoComplete="current-password"
        required
        error={fieldError("password")}
      />
      {error && !error.field && (
        <p role="alert" className="text-sm text-danger">
          {error.message}
        </p>
      )}
      <Button type="submit" pending={pending} size="lg" className="mt-1">
        Log in
      </Button>
    </form>
  );
}
