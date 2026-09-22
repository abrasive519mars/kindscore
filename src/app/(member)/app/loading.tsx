import { Card } from "@/components/ui/primitives";
import { Skeleton } from "@/components/ui/primitives";

/** Dimension-matched to the dashboard (DESIGN.md §5): three figures, the score row, two cards. */
export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-8" aria-busy>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-72" />
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="flex flex-col gap-3">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-3 w-40" />
          </Card>
        ))}
      </div>
      <Card className="flex flex-col gap-5">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-14 w-full max-w-md" />
      </Card>
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="flex flex-col gap-3">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </Card>
        <Card className="flex flex-col gap-3">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-12 w-64" />
        </Card>
      </div>
    </div>
  );
}
