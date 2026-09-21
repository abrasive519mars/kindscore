import type { ReactNode } from "react";
import { Wordmark } from "@/components/ui/Wordmark";

/** Centred single column on ivory; the wordmark is the only chrome. */
// Route-group layouts ("/login", "/signup") are not in Next's generated LayoutRoutes, so plain props.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <div className="mx-auto w-full max-w-6xl px-4 pt-6">
        <Wordmark />
      </div>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">{children}</main>
    </div>
  );
}
