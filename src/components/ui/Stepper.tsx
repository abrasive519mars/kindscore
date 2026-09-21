import { cn } from "@/lib/cn";

export type StepState = "done" | "current" | "future" | "failed";

export interface Step {
  readonly label: string;
  readonly state: StepState;
  /** Timestamp / actor line under the label. */
  readonly caption?: string;
}

/**
 * DESIGN.md §2.5 — a state machine drawn as a line of dots: filled = done, ring = current,
 * hollow = future, danger ring = failed (a rejection). Read out in order for screen readers.
 */
export function Stepper({ steps, className }: { steps: readonly Step[]; className?: string }) {
  return (
    <ol className={cn("flex flex-wrap gap-x-6 gap-y-3", className)} aria-label="Progress">
      {steps.map((step, index) => (
        <li
          key={step.label}
          className="flex items-start gap-2 text-sm"
          aria-current={step.state === "current" ? "step" : undefined}
        >
          <span className="flex h-5 items-center">
            <Dot state={step.state} />
          </span>
          <span className="flex flex-col">
            <span
              className={cn(
                "font-medium",
                step.state === "future" && "text-ink-3",
                step.state === "failed" && "text-danger",
              )}
            >
              {step.label}
            </span>
            {step.caption && <span className="text-xs text-ink-2">{step.caption}</span>}
          </span>
          {index < steps.length - 1 && (
            <span aria-hidden className="ml-4 hidden h-px w-6 self-center bg-line sm:block" />
          )}
        </li>
      ))}
    </ol>
  );
}

function Dot({ state }: { state: StepState }) {
  return (
    <span
      aria-hidden
      className={cn(
        "block h-3 w-3 rounded-full border-2",
        state === "done" && "border-ink bg-ink",
        state === "current" && "border-saffron bg-transparent",
        state === "future" && "border-line bg-transparent",
        state === "failed" && "border-danger bg-danger/20",
      )}
    />
  );
}
