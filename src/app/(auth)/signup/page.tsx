import type { Metadata } from "next";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { planIntervalSchema } from "@/schemas/auth";
import { SignupForm } from "@/app/(auth)/signup/SignupForm";
import { subscribeSteps } from "@/components/app/subscribeSteps";
import { Stepper } from "@/components/ui/Stepper";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const { charity: preselectSlug, plan: rawPlan } = (await searchParams) as {
    charity?: string;
    plan?: string;
  };
  const plan = planIntervalSchema.safeParse(rawPlan).data;
  const supabase = await createSupabaseServerClient();
  const { data: charities } = await supabase
    .from("charities")
    .select("id, slug, name, city, outcome_line, featured_rank")
    .eq("is_active", true)
    .order("featured_rank", { ascending: true, nullsFirst: false })
    .order("name");

  return (
    <div className="flex flex-col gap-8">
      <Stepper steps={subscribeSteps(1)} />
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl">
          Play a round. <em className="text-saffron">Fund a cause.</em>
        </h1>
        <p className="text-ink-2">
          Step 1 of 2 — your account and the charity you&apos;ll support. You pick monthly or yearly
          next.
        </p>
      </div>
      <SignupForm
        charities={charities ?? []}
        defaultCharityId={charities?.find((c) => c.slug === preselectSlug)?.id}
        plan={plan}
      />
      <p className="text-sm text-ink-2">
        Already a member?{" "}
        <Link href="/login" className="text-ink underline decoration-saffron underline-offset-4">
          Log in
        </Link>
      </p>
    </div>
  );
}
