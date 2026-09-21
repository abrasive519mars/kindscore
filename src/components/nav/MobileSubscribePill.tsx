"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PLANS } from "@/config/constants";
import { formatInr } from "@/engine/money/paise";
import { Button } from "@/components/ui/Button";

/**
 * DESIGN.md §3 / §8 — on phones the Subscribe pill sticks bottom-centre once the hero's CTA has
 * scrolled away. Watches the hero sentinel; renders nothing on wider screens (CSS) or before the
 * hero leaves the viewport.
 */
export function MobileSubscribePill() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const sentinel = document.getElementById("hero-sentinel");
    if (!sentinel) return;
    const observer = new IntersectionObserver(([entry]) => setShow(!entry.isIntersecting), {
      threshold: 0,
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  if (!show) return null;
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 flex justify-center pb-[max(1rem,env(safe-area-inset-bottom))] md:hidden"
      aria-hidden={!show}
    >
      <Link href="/signup">
        <Button variant="saffron" size="lg" className="shadow-nav">
          Subscribe · {formatInr(PLANS.month.pricePaise)}/mo
        </Button>
      </Link>
    </div>
  );
}
