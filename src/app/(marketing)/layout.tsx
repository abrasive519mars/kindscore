import Link from "next/link";
import { BRAND } from "@/config/constants";
import { SiteNav } from "@/components/nav/SiteNav";
import { Wordmark } from "@/components/ui/Wordmark";

/** Public pages: sticky nav, content, small footer. The real landing page arrives in Phase 10. */
export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteNav />
      <div className="flex flex-1 flex-col">{children}</div>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 text-sm text-ink-2 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-1">
            <Wordmark className="text-xl" />
            <p>{BRAND.tagline}</p>
          </div>
          <ul className="flex gap-6">
            <li>
              <Link href="/charities" className="hover:text-ink">
                Charities
              </Link>
            </li>
            <li>
              <Link href="/how-it-works" className="hover:text-ink">
                How it works
              </Link>
            </li>
            <li>
              <Link href="/pricing" className="hover:text-ink">
                Pricing
              </Link>
            </li>
          </ul>
        </div>
      </footer>
    </div>
  );
}
