"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { logOut } from "@/app/(auth)/actions";

interface UserMenuProps {
  readonly fullName: string;
  readonly isAdmin: boolean;
}

/** Avatar initial → small menu with Subscription, Settings, Admin (if any) and Log out. */
export function UserMenu({ fullName, isAdmin }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initial = fullName.trim().charAt(0).toUpperCase() || "?";

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-ink font-display text-bg"
      >
        {initial}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-48 rounded-md border border-line bg-surface p-1 text-sm">
          <MenuItem href="/app/subscription">Subscription</MenuItem>
          <MenuItem href="/app/settings">Settings</MenuItem>
          {isAdmin && <MenuItem href="/admin">Admin</MenuItem>}
          <form action={logOut}>
            <button type="submit" role="menuitem" className="w-full rounded px-3 py-2 text-left text-ink-2 hover:bg-surface-2 hover:text-ink">
              Log out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function MenuItem({ href, children }: { href: string; children: string }) {
  return (
    <Link href={href} role="menuitem" className="block rounded px-3 py-2 text-ink-2 hover:bg-surface-2 hover:text-ink">
      {children}
    </Link>
  );
}
