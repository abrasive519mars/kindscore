/**
 * Demo accounts (the seeded personas) are shown on /login?demo=1 only when the deployment says
 * so. Read by full name so Next inlines it for the client bundle too.
 */
export function demoAccountsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_ACCOUNTS === "1";
}
