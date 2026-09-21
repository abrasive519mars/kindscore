import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Hairline-bordered surface. No shadow by default (DESIGN.md §2.3). */
export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={cn("rounded-lg border border-line bg-surface p-6", className)} />;
}

/** Section divider: a hairline with the one saffron dash (DESIGN.md §2.3). */
export function Rule({ className }: { className?: string }) {
  return (
    <div className={cn("relative h-px w-full bg-line", className)} aria-hidden>
      <span className="absolute left-0 top-0 h-px w-6 bg-saffron" />
    </div>
  );
}

interface FigureProps {
  readonly label: string;
  readonly value: ReactNode;
  readonly hint?: ReactNode;
  readonly accent?: boolean;
  readonly className?: string;
}

/** A labelled number — the dashboard's basic unit (DESIGN.md §5 "five figures with trend"). */
export function Figure({ label, value, hint, accent = false, className }: FigureProps) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-[12.5px] font-medium uppercase tracking-[0.06em] text-ink-2">{label}</span>
      <span className={cn("num font-display text-4xl leading-none", accent && "text-saffron")}>{value}</span>
      {hint && <span className="text-sm text-ink-2">{hint}</span>}
    </div>
  );
}

type Tone = "neutral" | "success" | "warn" | "danger" | "saffron" | "pool";

const TONE: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink-2",
  success: "bg-success/12 text-success",
  warn: "bg-warn/12 text-warn",
  danger: "bg-danger/12 text-danger",
  saffron: "bg-saffron/12 text-saffron",
  pool: "bg-pool/12 text-pool",
};

/** One-word status label (DESIGN.md §5: "one word, title case"). */
export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cn("inline-flex h-6 items-center rounded-sm px-2 text-xs font-medium", TONE[tone])}>{children}</span>;
}

/** Full-width notice under the nav for subscription states (DESIGN.md §5 StatusBanner). */
export function Banner({ tone = "warn", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <div role="status" className={cn("rounded-md px-4 py-3 text-sm", TONE[tone])}>
      {children}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-surface-2", className)} aria-hidden />;
}

interface EmptyStateProps {
  readonly title: string;
  readonly body?: string;
  readonly action?: ReactNode;
}

/** Every empty state prompts the next action (UX_RESEARCH.md §3.4). */
export function EmptyState({ title, body, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-line p-6">
      <p className="font-display text-xl">{title}</p>
      {body && <p className="text-sm text-ink-2">{body}</p>}
      {action}
    </div>
  );
}
