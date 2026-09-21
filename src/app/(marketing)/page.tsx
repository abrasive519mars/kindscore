import { loadLanding } from "@/lib/landing";
import { demoAccountsEnabled } from "@/lib/demo";
import { CharityImpact } from "@/components/landing/CharityImpact";
import { ClosingCTA } from "@/components/landing/ClosingCTA";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Jackpot } from "@/components/landing/Jackpot";
import { PracticeDraw } from "@/components/landing/PracticeDraw";
import { Pricing } from "@/components/landing/Pricing";
import { ProofStrip } from "@/components/landing/ProofStrip";
import { MobileSubscribePill } from "@/components/nav/MobileSubscribePill";

/**
 * DESIGN.md §3 — eight sections in the order the research settled on: cause, proof, how, charity,
 * the draw, the jackpot, the price, the ask. Every figure is live; the practice draw is the only
 * thing that is not.
 */
export default async function HomePage() {
  const data = await loadLanding();
  return (
    <>
      <Hero featured={data.featured} />
      <ProofStrip figures={data.proof} />
      <HowItWorks />
      <CharityImpact featured={data.featured} cards={data.cards} />
      <PracticeDraw />
      <Jackpot
        jackpotPaise={data.jackpotPaise}
        ladder={data.ladder}
        upcomingMonth={data.upcomingMonth}
      />
      <Pricing />
      <ClosingCTA showDemo={demoAccountsEnabled()} />
      <MobileSubscribePill />
    </>
  );
}
