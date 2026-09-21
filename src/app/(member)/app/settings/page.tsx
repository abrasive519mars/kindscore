import type { Metadata } from "next";
import { getAccess, type SignedInAccess } from "@/lib/auth/access";
import { logOut } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/primitives";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ProfileForm } from "@/app/(member)/app/settings/ProfileForm";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const access = (await getAccess()) as SignedInAccess;

  return (
    <div className="flex max-w-xl flex-col gap-8">
      <h1 className="text-4xl">Settings</h1>

      <Card className="flex flex-col gap-4">
        <h2 className="text-xl">Profile</h2>
        <ProfileForm fullName={access.profile.full_name} email={access.profile.email} />
      </Card>

      <Card className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl">Appearance</h2>
          <p className="text-sm text-ink-2">Follows your device unless you choose.</p>
        </div>
        <ThemeToggle />
      </Card>

      <Card className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl">Session</h2>
          <p className="text-sm text-ink-2">Signed in as {access.profile.email}</p>
        </div>
        <form action={logOut}>
          <Button type="submit" variant="ghost">
            Log out
          </Button>
        </form>
      </Card>
    </div>
  );
}
