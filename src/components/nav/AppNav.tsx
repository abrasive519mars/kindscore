import { Wordmark } from "@/components/ui/Wordmark";
import { NavLink } from "@/components/nav/NavLink";
import { UserMenu } from "@/components/nav/UserMenu";

export const APP_LINKS = [
  { href: "/app", label: "Home", exact: true },
  { href: "/app/scores", label: "Scores" },
  { href: "/app/draws", label: "Draws" },
  { href: "/app/charity", label: "Charity" },
  { href: "/app/winnings", label: "Winnings" },
] as const;

interface AppNavProps {
  readonly fullName: string;
  readonly isAdmin: boolean;
}

/** Member top bar (desktop). The same five links appear in BottomNav on phones. */
export function AppNav({ fullName, isAdmin }: AppNavProps) {
  return (
    <header className="border-b border-line bg-bg">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4" aria-label="App">
        <div className="flex items-center gap-8">
          <Wordmark href="/app" />
          <ul className="hidden items-center gap-6 text-sm md:flex">
            {APP_LINKS.map((link) => (
              <li key={link.href}>
                <NavLink href={link.href} exact={"exact" in link && link.exact}>
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
        <UserMenu fullName={fullName} isAdmin={isAdmin} />
      </nav>
    </header>
  );
}

/** Phone navigation: five items, fixed to the bottom, safe-area aware (DESIGN.md §8). */
export function BottomNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="App"
    >
      <ul className="grid h-14 grid-cols-5">
        {APP_LINKS.map((link) => (
          <li key={link.href} className="flex">
            <NavLink
              href={link.href}
              exact={"exact" in link && link.exact}
              className="flex flex-1 items-center justify-center text-xs font-medium"
              activeClassName="text-saffron"
            >
              {link.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
