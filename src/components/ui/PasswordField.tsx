"use client";

import { useState, type InputHTMLAttributes } from "react";
import { PASSWORD_MIN } from "@/schemas/auth";
import { CONTROL } from "@/components/ui/FormField";
import { cn } from "@/lib/cn";

interface PasswordFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  readonly id: string;
  readonly label: string;
  readonly error?: string;
}

/** How full the meter is: the share of the minimum length typed so far, capped at 1. */
export function passwordProgress(length: number, min = PASSWORD_MIN): number {
  return Math.min(length / min, 1);
}

/**
 * A password input with a hairline meter that fills as you type and turns green at the minimum
 * length — the rule shown, not just stated. Client-only because it reads what is typed.
 */
export function PasswordField({ id, label, error, className, ...rest }: PasswordFieldProps) {
  const [length, setLength] = useState(0);
  const progress = passwordProgress(length);
  const met = progress >= 1;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <input
        {...rest}
        id={id}
        type="password"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : `${id}-hint`}
        className={cn(CONTROL, error && "border-danger", className)}
        onChange={(event) => {
          setLength(event.target.value.length);
          rest.onChange?.(event);
        }}
      />
      <div className="h-0.5 w-full overflow-hidden rounded-full bg-line" aria-hidden>
        <div
          className={cn(
            "h-full transition-[width,background-color] duration-move ease-move",
            met ? "bg-success" : "bg-saffron",
          )}
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : (
        <p id={`${id}-hint`} className={cn("text-sm", met ? "text-success" : "text-ink-2")}>
          {met ? `Good — ${PASSWORD_MIN}+ characters` : `At least ${PASSWORD_MIN} characters`}
        </p>
      )}
    </div>
  );
}
