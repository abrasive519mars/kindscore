import Link from "next/link";
import { BRAND } from "@/config/constants";
import { cn } from "@/lib/cn";

/** `Kindscore.` — Newsreader wordmark with the saffron full stop (DESIGN.md §2.4). */
export function Wordmark({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn("font-display text-2xl font-medium tracking-tight text-ink", className)}
      aria-label={`${BRAND.name} home`}
    >
      {BRAND.name}
      <span className="text-saffron">.</span>
    </Link>
  );
}
