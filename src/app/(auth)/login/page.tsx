import type { Metadata } from "next";
import Link from "next/link";
import { safeNextPath } from "@/lib/auth/redirects";
import { LoginForm } from "@/app/(auth)/login/LoginForm";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl">Welcome back.</h1>
        <p className="text-ink-2">Log in to see your scores, your charity and this month&apos;s draw.</p>
      </div>
      <LoginForm next={next} />
      <p className="text-sm text-ink-2">
        New here?{" "}
        <Link href="/signup" className="text-ink underline decoration-saffron underline-offset-4">
          Create an account
        </Link>
      </p>
    </div>
  );
}
