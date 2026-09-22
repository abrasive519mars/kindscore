import { Card, Skeleton } from "@/components/ui/primitives";

/** The admin draw page before the candidates are counted: mode cards, histogram, report. */
export default function AdminDrawLoading() {
  return (
    <div className="flex flex-col gap-8" aria-busy>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <Card className="flex flex-col gap-5">
        <Skeleton className="h-7 w-32" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-11 w-48" />
      </Card>
      <Card className="flex flex-col gap-6">
        <Skeleton className="h-7 w-40" />
        <div className="flex gap-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 w-16" />
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </Card>
    </div>
  );
}
