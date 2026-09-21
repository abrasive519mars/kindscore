import type { Metadata } from "next";
import { PLANS, SPLIT } from "@/config/constants";
import { formatInr } from "@/engine/money/paise";
import { Pricing } from "@/components/landing/Pricing";
import { SplitSlider } from "@/components/ui/Split";

export const metadata: Metadata = {
  title: "Pricing",
  description: `${formatInr(PLANS.month.pricePaise)} a month or ${formatInr(PLANS.year.pricePaise)} a year. At least ${SPLIT.CHARITY_MIN_BPS / 100}% to your charity, ${SPLIT.POOL_SHARE_BPS / 100}% to the prize pool, GST included.`,
};
export const revalidate = 3600;

const FAQ: ReadonlyArray<{ q: string; a: string }> = [
  { q: "Is GST included?", a: "Yes. The price you see is the price you pay." },
  {
    q: "What do I get for the yearly plan?",
    a: "Twelve months for the price of ten, and your prize slice is spread across twelve draws — the same as a monthly member's, month by month.",
  },
  {
    q: "Can I cancel?",
    a: "Any time, from your subscription page. You stay in until the end of the period you paid for, and you can resume before then.",
  },
  {
    q: "What happens if a payment fails?",
    a: "You are out of the draw from that moment until the card is fixed — the page tells you and links straight to the card-update screen. Your scores and history stay.",
  },
  {
    q: "Can I give more than the minimum?",
    a: `Yes, up to ${SPLIT.CHARITY_MAX_BPS / 100}% of every payment, in 5% steps. At ${SPLIT.CHARITY_MAX_BPS / 100}%, Kindscore keeps nothing. You can also donate once, any amount from ₹10.`,
  },
  { q: "Are there bundles or extra entries?", a: "No. One fee, one entry, everyone equal." },
];

export default function PricingPage() {
  return (
    <div className="flex flex-col">
      <Pricing headingLevel={1} />
      <section
        className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-16"
        aria-labelledby="split-heading"
      >
        <h2 id="split-heading" className="text-3xl">
          Where each rupee goes
        </h2>
        <p className="text-lg text-ink-2">
          Slide it. The saffron part is your charity&apos;s, the blue part is the prize pool, the
          grey part runs Kindscore.
        </p>
        <SplitSlider name="pricing-preview" />
      </section>
      <section
        className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pb-20"
        aria-labelledby="pricing-faq"
      >
        <h2 id="pricing-faq" className="text-3xl">
          Questions
        </h2>
        <dl className="flex flex-col divide-y divide-line">
          {FAQ.map((item) => (
            <div key={item.q} className="flex flex-col gap-1 py-4">
              <dt className="font-medium">{item.q}</dt>
              <dd className="text-ink-2">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
