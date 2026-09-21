import Link from "next/link";
import { Wordmark } from "@/components/ui/Wordmark";
import { NavLink } from "@/components/nav/NavLink";

const ADMIN_LINKS = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/draws", label: "Draws" },
  { href: "/admin/charities", label: "Charities" },
  { href: "/admin/winners", label: "Winners" },
  { href: "/admin/reports", label: "Reports" },
] as const;

/** Admin navigation: a left rail on desktop, a horizontal scroller on phones (DESIGN.md §8). */
export function AdminSidebar() {
  return (
    <aside className="border-b border-line bg-bg md:w-56 md:border-b-0 md:border-r">
      <div className="flex h-16 items-center px-4">
        <Wordmark href="/admin" />
        <span className="ml-2 rounded-sm bg-surface-2 px-1.5 text-[11px] font-medium uppercase tracking-wider text-ink-2">
          Admin
        </span>
      </div>
      <nav aria-label="Admin">
        <ul className="flex gap-1 overflow-x-auto px-2 pb-2 text-sm md:flex-col md:pb-0">
          {ADMIN_LINKS.map((link) => (
            <li key={link.href}>
              <NavLink
                href={link.href}
                exact={"exact" in link && link.exact}
                className="block whitespace-nowrap rounded-md px-3 py-2"
                activeClassName="bg-surface-2 text-ink"
              >
                {link.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="hidden px-4 pt-6 text-xs text-ink-3 md:block">
        <Link href="/app" className="hover:text-ink">
          ← Member view
        </Link>
      </div>
    </aside>
  );
}
