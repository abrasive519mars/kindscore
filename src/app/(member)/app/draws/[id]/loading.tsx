import { Card, Skeleton } from "@/components/ui/primitives";

/** The reveal's frame before the numbers arrive: five hollow tiles, one outcome line. */
export default function DrawLoading() {
  return (
    <div className="flex flex-col gap-8" aria-busy>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-10 w-64" />
      </div>
      <Card className="flex flex-col gap-8">
        <div className="flex gap-4 sm:gap-6">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-10 w-12 sm:h-12 sm:w-14" />
          ))}
        </div>
        <div className="flex gap-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-14 w-14 sm:h-16 sm:w-16" />
          ))}
        </div>
        <Skeleton className="h-7 w-3/4" />
      </Card>
    </div>
  );
}
