import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/primitives";

interface LockedCardProps {
  readonly title: string;
  readonly body: string;
  readonly children?: ReactNode;
}

/**
 * PRD §04 "restricted access" for non-subscribers: the feature is visible but dimmed, with one
 * clear way forward. The member sees what they're missing rather than a wall.
 */
export function LockedCard({ title, body, children }: LockedCardProps) {
  return (
    // Both layers occupy the same grid cell, so the card is as tall as the taller of the two.
    <Card className="grid overflow-hidden p-0">
      <div
        className="pointer-events-none col-start-1 row-start-1 select-none p-6 opacity-40 blur-[1px]"
        aria-hidden
      >
        {children}
      </div>
      <div className="col-start-1 row-start-1 flex flex-col items-start justify-center gap-3 bg-surface/70 p-6">
        <p className="font-display text-xl">{title}</p>
        <p className="max-w-sm text-sm text-ink-2">{body}</p>
        <Link href="/app/subscription">
          <Button variant="saffron" size="sm">
            Subscribe to unlock
          </Button>
        </Link>
      </div>
    </Card>
  );
}
