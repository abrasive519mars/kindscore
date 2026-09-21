import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Wordmark } from "@/components/ui/Wordmark";

export default function NotFound() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <div className="mx-auto w-full max-w-6xl px-4 pt-6">
        <Wordmark />
      </div>
      <main className="mx-auto flex max-w-md flex-1 flex-col justify-center gap-4 px-4 py-24">
        <p className="text-sm font-medium uppercase tracking-[0.06em] text-ink-2">404</p>
        <h1 className="text-4xl">Nothing on this hole.</h1>
        <p className="text-ink-2">The page you&apos;re after has moved or never existed.</p>
        <Link href="/">
          <Button>Back to the start</Button>
        </Link>
      </main>
    </div>
  );
}
