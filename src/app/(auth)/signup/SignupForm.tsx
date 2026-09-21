"use client";

import { useActionState, useState } from "react";
import { signUp } from "@/app/(auth)/actions";
import { SPLIT } from "@/config/constants";
import { Button } from "@/components/ui/Button";
import { InputField, SelectField } from "@/components/ui/FormField";
import { Rule } from "@/components/ui/primitives";
import { SplitSlider } from "@/components/ui/Split";

interface CharityOption {
  readonly id: string;
  readonly name: string;
  readonly city: string;
  readonly outcome_line: string;
  readonly featured_rank: number | null;
}

/**
 * One page, three beats: who you are → which charity → how much of each payment goes to them.
 * The Split slider shows the real rupee split live, before any money is asked for (Phase 5).
 */
interface SignupFormProps {
  readonly charities: readonly CharityOption[];
  /** From a charity profile page (`/signup?charity=<slug>`). */
  readonly defaultCharityId?: string;
}

export function SignupForm({ charities, defaultCharityId }: SignupFormProps) {
  const [state, action, pending] = useActionState(signUp, null);
  const [charityId, setCharityId] = useState(defaultCharityId ?? charities[0]?.id ?? "");
  // React 19 resets the form after every action; keep what was typed so a server error isn't punishing.
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const error = state && !state.ok ? state.error : null;
  const fieldError = (field: string) => (error?.field === field ? error.message : undefined);
  const chosen = charities.find((c) => c.id === charityId);

  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      <InputField
        id="fullName"
        name="fullName"
        label="Your name"
        autoComplete="name"
        required
        value={fullName}
        onChange={(event) => setFullName(event.target.value)}
        error={fieldError("fullName")}
      />
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
        autoComplete="new-password"
        required
        hint="At least 8 characters"
        error={fieldError("password")}
      />

      <Rule className="my-1" />

      <SelectField
        id="charityId"
        name="charityId"
        label="The charity your subscription supports"
        value={charityId}
        onChange={(event) => setCharityId(event.target.value)}
        error={fieldError("charityId")}
        hint={chosen ? `${chosen.city} · ${chosen.outcome_line}` : undefined}
      >
        {charities.map((charity) => (
          <option key={charity.id} value={charity.id}>
            {charity.name}
            {charity.featured_rank === 1 ? " · featured" : ""}
          </option>
        ))}
      </SelectField>

      <SplitSlider name="charityBps" defaultBps={SPLIT.CHARITY_MIN_BPS} />
      {fieldError("charityBps") && (
        <p role="alert" className="text-sm text-danger">
          {fieldError("charityBps")}
        </p>
      )}

      {error && !error.field && (
        <p role="alert" className="text-sm text-danger">
          {error.message}
        </p>
      )}

      <Button type="submit" pending={pending} size="lg" variant="saffron">
        Create account
      </Button>
      <p className="text-xs text-ink-2">
        You can change your charity and share at any time. Cancel anytime.
      </p>
    </form>
  );
}
