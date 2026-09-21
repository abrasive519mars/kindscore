import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface FieldShellProps {
  readonly id: string;
  readonly label: string;
  readonly error?: string;
  readonly hint?: string;
  readonly children: ReactNode;
}

/**
 * Label always visible, error linked with aria-describedby, message rendered beside the field —
 * never a toast (DESIGN.md §7, UX_RESEARCH.md §3.4).
 */
function FieldShell({ id, label, error, hint, children }: FieldShellProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-ink-2">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const CONTROL =
  "h-11 w-full rounded-md border border-line bg-surface px-3 text-[16px] text-ink placeholder:text-ink-3 focus:border-saffron focus:outline-none";

interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  readonly id: string;
  readonly label: string;
  readonly error?: string;
  readonly hint?: string;
}

export function InputField({ id, label, error, hint, className, ...rest }: InputFieldProps) {
  return (
    <FieldShell id={id} label={label} error={error} hint={hint}>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={cn(CONTROL, error && "border-danger", className)}
        {...rest}
      />
    </FieldShell>
  );
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  readonly id: string;
  readonly label: string;
  readonly error?: string;
  readonly hint?: string;
  readonly children: ReactNode;
}

export function SelectField({
  id,
  label,
  error,
  hint,
  className,
  children,
  ...rest
}: SelectFieldProps) {
  return (
    <FieldShell id={id} label={label} error={error} hint={hint}>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={cn(CONTROL, error && "border-danger", className)}
        {...rest}
      >
        {children}
      </select>
    </FieldShell>
  );
}
