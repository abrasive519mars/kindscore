import type { CharityEvent } from "@/repositories/interfaces/CharityRepository";
import { EmptyState } from "@/components/ui/primitives";

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

/** Upcoming events (PRD §08.2), soonest first. */
export function EventList({ events }: { events: readonly CharityEvent[] }) {
  if (events.length === 0) {
    return (
      <EmptyState
        title="No upcoming events"
        body="Check back — new dates appear here as the charity announces them."
      />
    );
  }
  return (
    <ol className="flex flex-col divide-y divide-line">
      {events.map((event) => (
        <li key={event.id} className="flex flex-col gap-1 py-4 sm:flex-row sm:gap-6">
          <time dateTime={event.startsAt} className="num w-48 shrink-0 text-sm text-ink-2">
            {formatWhen(event.startsAt)}
          </time>
          <div className="flex flex-col gap-1">
            <p className="font-medium">{event.title}</p>
            {event.description && <p className="text-sm text-ink-2">{event.description}</p>}
            {event.location && <p className="text-sm text-ink-3">{event.location}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
