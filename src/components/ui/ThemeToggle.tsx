"use client";

import { useSyncExternalStore } from "react";

type Theme = "light" | "dark" | "system";
const STORAGE_KEY = "kindscore-theme";
const CHANGE_EVENT = "kindscore-theme-change";
const OPTIONS: ReadonlyArray<{ value: Theme; label: string }> = [
  { value: "light", label: "Light" },
  { value: "system", label: "Auto" },
  { value: "dark", label: "Dark" },
];

/** localStorage is an external store: read it with useSyncExternalStore, not an effect + setState. */
function readTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "light" || saved === "dark" ? saved : "system";
  } catch {
    return "system";
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function writeTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
  try {
    if (theme === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* storage unavailable — the attribute still applies for this page */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Pairs with the pre-paint script in app/layout.tsx. Server snapshot is "system", so no hydration mismatch. */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "system" as Theme);

  return (
    <div role="radiogroup" aria-label="Theme" className="inline-flex rounded-full border border-line p-0.5">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={theme === option.value}
          onClick={() => writeTheme(option.value)}
          className={`rounded-full px-3 py-1 text-sm transition-colors duration-fast ${theme === option.value ? "bg-ink text-bg" : "text-ink-2 hover:text-ink"}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
