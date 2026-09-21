import Link from "next/link";
import { PLANS } from "@/config/constants";
import { formatInr } from "@/engine/money/paise";
import { getAccess } from "@/lib/auth/access";
import { Button } from "@/components/ui/Button";
import { Wordmark } from "@/components/ui/Wordmark";
import { MobileMenu } from "@/components/nav/MobileMenu";
import { NavLink } from "@/components/nav/NavLink";

const LINKS = [
  { href: "/charities", label: "Charities" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/draws", label: "Draws" },
  { href: "/pricing", label: "Pricing" },
] as const;

/** Public navigation (≤ 6 items, DESIGN.md §3). Swaps "Log in" for "Dashboard" when signed in. */
export async function SiteNav() {
  const access = await getAccess();
  const signedIn = access.kind !== "anonymous";
  const accountHref = signedIn ? (access.kind === "admin" ? "/admin" : "/app") : "/login";
  const accountLabel = signedIn ? "Dashboard" : "Log in";

  return (
    <header className="relative sticky top-0 z-20 border-b border-line bg-bg/90 shadow-nav backdrop-blur">
      <nav
        className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4"
        aria-label="Main"
      >
        <Wordmark />
        <ul className="hidden items-center gap-7 text-sm md:flex">
          {LINKS.map((link) => (
            <li key={link.href}>
              <NavLink href={link.href}>{link.label}</NavLink>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2 md:gap-3">
          <Link href={accountHref} className="hidden text-sm text-ink-2 hover:text-ink md:inline">
            {accountLabel}
          </Link>
          <Link href={signedIn ? "/app/subscription" : "/signup"}>
            <Button size="sm">Subscribe · {formatInr(PLANS.month.pricePaise)}/mo</Button>
          </Link>
          <MobileMenu links={LINKS} accountHref={accountHref} accountLabel={accountLabel} />
        </div>
      </nav>
    </header>
  );
}
