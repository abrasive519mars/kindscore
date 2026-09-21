import type { Metadata } from "next";
import Link from "next/link";
import { DEMO_ACCOUNTS } from "@/config/constants";
import { safeNextPath } from "@/lib/auth/redirects";
import { demoAccountsEnabled } from "@/lib/demo";
import { LoginForm } from "@/app/(auth)/login/LoginForm";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);
  const showDemo = demoAccountsEnabled() && params.demo === "1";

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl">Welcome back.</h1>
        <p className="text-ink-2">
          Log in to see your scores, your charity and this month&apos;s draw.
        </p>
      </div>
      <LoginForm next={next} />
      {showDemo && (
        <section
          className="flex flex-col gap-3 rounded-md border border-line bg-surface p-4 text-sm"
          aria-labelledby="demo-heading"
        >
          <h2 id="demo-heading" className="text-lg">
            Demo accounts
          </h2>
          <p className="text-ink-2">
            Seeded for evaluation. Password for all:{" "}
            <code className="num">{DEMO_ACCOUNTS.password}</code>
          </p>
          <ul className="flex flex-col gap-1">
            {DEMO_ACCOUNTS.personas.map((p) => (
              <li key={p.email} className="flex flex-wrap justify-between gap-2">
                <code className="num">{p.email}</code>
                <span className="text-ink-2">{p.role}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="text-sm text-ink-2">
        New here?{" "}
        <Link href="/signup" className="text-ink underline decoration-saffron underline-offset-4">
          Create an account
        </Link>
      </p>
    </div>
  );
}
