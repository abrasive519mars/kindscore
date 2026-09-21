"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

interface MobileMenuProps {
  readonly links: ReadonlyArray<{ href: string; label: string }>;
  readonly accountHref: string;
  readonly accountLabel: string;
}

/**
 * DESIGN.md §8 — on phones the nav collapses to a button. The panel is a plain list (no drawer
 * library): Escape closes it, focus returns to the button, the first link gets focus on open.
 */
export function MobileMenu({ links, accountHref, accountLabel }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!open) return;
    firstLinkRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-surface-2"
      >
        <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
        <span aria-hidden className="flex flex-col gap-1.5">
          <span
            className={`block h-0.5 w-5 bg-current transition-transform ${open ? "translate-y-2 rotate-45" : ""}`}
          />
          <span
            className={`block h-0.5 w-5 bg-current transition-opacity ${open ? "opacity-0" : ""}`}
          />
          <span
            className={`block h-0.5 w-5 bg-current transition-transform ${open ? "-translate-y-2 -rotate-45" : ""}`}
          />
        </span>
      </button>
      {open && (
        <nav
          id={panelId}
          aria-label="Menu"
          className="absolute inset-x-0 top-16 border-b border-line bg-bg px-4 py-4 shadow-nav"
        >
          <ul className="flex flex-col">
            {links.map((link, i) => (
              <li key={link.href}>
                <Link
                  ref={i === 0 ? firstLinkRef : undefined}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block py-3 text-lg"
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li className="border-t border-line">
              <Link
                href={accountHref}
                onClick={() => setOpen(false)}
                className="block py-3 text-lg text-ink-2"
              >
                {accountLabel}
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </div>
  );
}
