import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccess } from "@/lib/auth/access";
import { AdminSidebar } from "@/components/nav/AdminSidebar";
import { Button } from "@/components/ui/Button";

/**
 * Admin area. A signed-in non-admin gets a 403 page rather than a redirect — the URL stays
 * honest and nothing about the admin UI leaks. RLS denies the data regardless.
 */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const access = await getAccess();
  if (access.kind === "anonymous") redirect("/login?next=/admin");
  if (access.kind !== "admin") return <Forbidden />;

  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <AdminSidebar />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8">{children}</main>
    </div>
  );
}

function Forbidden() {
  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col justify-center gap-4 px-4 py-24">
      <p className="text-sm font-medium uppercase tracking-[0.06em] text-ink-2">403</p>
      <h1 className="text-4xl">That door is for admins.</h1>
      <p className="text-ink-2">Your account doesn&apos;t have access to this area.</p>
      <Link href="/app">
        <Button>Back to your dashboard</Button>
      </Link>
    </main>
  );
}
