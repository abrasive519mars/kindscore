import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "ink" | "saffron" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: Variant;
  readonly size?: Size;
  /** Shows three pulsing dots in place of the label and disables the button. */
  readonly pending?: boolean;
  readonly children: ReactNode;
}

const VARIANT: Record<Variant, string> = {
  ink: "bg-ink text-bg hover:bg-ink/90",
  saffron: "bg-saffron text-saffron-ink hover:bg-saffron/90",
  ghost: "bg-transparent text-ink hover:bg-surface-2",
  danger: "bg-transparent text-danger border border-danger/40 hover:bg-danger/10",
};

const SIZE: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-[15px]",
  lg: "h-13 px-7 text-base",
};

/** DESIGN.md §6 — press scales to .97 (CSS), 120ms ease-out; no hover lift. */
export function Button({
  variant = "ink",
  size = "md",
  pending = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-[transform,background-color] duration-fast ease-enter",
        "active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60",
        VARIANT[variant],
        SIZE[size],
        className,
      )}
    >
      {pending ? <PendingDots /> : children}
    </button>
  );
}

function PendingDots() {
  return (
    <span className="inline-flex gap-1" aria-label="Working">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-pulse rounded-full bg-current"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </span>
  );
}
