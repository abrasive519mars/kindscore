"use client";

import { useActionState } from "react";
import { openBillingPortal } from "@/app/(member)/app/subscription/actions";
import { Button } from "@/components/ui/Button";

/** Opens Stripe's hosted billing portal, where the credited balance is visible. */
export function BillingPortalButton() {
  const [state, action, opening] = useActionState(openBillingPortal, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <Button type="submit" size="sm" pending={opening}>
        See it in your billing portal →
      </Button>
      {state && !state.ok && (
        <span role="alert" className="text-sm text-danger">
          {state.error.message}
        </span>
      )}
    </form>
  );
}
