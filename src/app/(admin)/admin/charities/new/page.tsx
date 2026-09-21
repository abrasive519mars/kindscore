import type { Metadata } from "next";
import Link from "next/link";
import { CharityForm } from "@/app/(admin)/admin/charities/[id]/CharityForm";
import { Card } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "New charity" };

/** Create the record first; photos and events are added on the charity's page once it exists. */
export default function NewCharityPage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <p className="text-sm text-ink-2">
          <Link href="/admin/charities" className="hover:text-ink">
            Charities
          </Link>{" "}
          / New
        </p>
        <h1 className="text-4xl">New charity</h1>
        <p className="text-ink-2">Save the basics, then add the cover photo, gallery and events.</p>
      </header>
      <Card>
        <CharityForm />
      </Card>
    </div>
  );
}
