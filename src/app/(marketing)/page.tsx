import { BRAND } from "@/config/constants";

/** Temporary Phase-0 page proving fonts, tokens and dark mode work. Replaced in Phase 10. */
export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 px-4 py-24">
      <p className="text-sm font-medium uppercase tracking-[0.06em] text-ink-2">Phase 0 · scaffold</p>
      <h1 className="text-6xl leading-[1.05]">
        Your last five rounds <em className="text-saffron">could fund a classroom.</em>
      </h1>
      <p className="max-w-xl text-lg text-ink-2">
        {BRAND.name} — {BRAND.tagline} Every subscription sends at least ₹50 a month to a charity
        you choose, and enters your five most recent Stableford scores into a monthly draw.
      </p>
      <div className="num flex items-baseline gap-8 border-t border-line pt-6 font-display text-5xl">
        <span>28</span>
        <span className="text-saffron">33</span>
        <span>31</span>
        <span className="text-saffron">36</span>
        <span className="text-saffron">29</span>
      </div>
    </main>
  );
}
