import { redirect } from "next/navigation";
import { getAccess } from "@/lib/auth/access";
import { AppNav, BottomNav } from "@/components/nav/AppNav";
import { SubscriptionBanner } from "@/components/app/SubscriptionBanner";

/**
 * Member area. getAccess() is React-cached, so the page and any actions underneath reuse this
 * same resolution. The proxy already redirected signed-out users; this is the belt to its braces.
 */
export default async function MemberLayout({ children }: LayoutProps<"/app">) {
  const access = await getAccess();
  if (access.kind === "anonymous") redirect("/login?next=/app");

  return (
    <div className="flex min-h-full flex-1 flex-col pb-16 md:pb-0">
      <AppNav fullName={access.profile.full_name} isAdmin={access.kind === "admin"} />
      <main id="main" className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8">
        {access.kind === "member" && <SubscriptionBanner subscription={access.subscription} />}
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
