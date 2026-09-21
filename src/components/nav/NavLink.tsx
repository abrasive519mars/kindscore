"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface NavLinkProps {
  readonly href: string;
  readonly children: ReactNode;
  readonly exact?: boolean;
  readonly className?: string;
  readonly activeClassName?: string;
}

/** A link that knows when it is the current page (aria-current + active styles). */
export function NavLink({ href, children, exact = false, className, activeClassName = "text-ink" }: NavLinkProps) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn("transition-colors duration-fast", active ? activeClassName : "text-ink-2 hover:text-ink", className)}
    >
      {children}
    </Link>
  );
}
