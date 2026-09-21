"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Wordmark } from "@/components/ui/Wordmark";

/** Root error boundary: one line, one action, a request id for support — never a stack trace. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col justify-center gap-4 px-4 py-24">
      <Wordmark />
      <p className="text-sm font-medium uppercase tracking-[0.06em] text-ink-2">
        Something went wrong
      </p>
      <h1 className="text-4xl">That didn&apos;t go through.</h1>
      <p className="text-ink-2">
        Nothing was lost. Try again, and if it keeps happening, tell us the code below.
      </p>
      {error.digest && <p className="num text-xs text-ink-2">Reference {error.digest}</p>}
      <div className="flex flex-wrap gap-3">
        <Button onClick={reset}>Try again</Button>
        <Link href="/">
          <Button variant="ghost">Back to the start</Button>
        </Link>
      </div>
    </main>
  );
}
