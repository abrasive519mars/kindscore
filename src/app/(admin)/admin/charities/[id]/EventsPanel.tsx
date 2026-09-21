"use client";

import { useActionState } from "react";
import { deleteEvent, saveEvent } from "@/app/(admin)/admin/charities/actions";
import type { CharityEvent } from "@/repositories/interfaces/CharityRepository";
import { Button } from "@/components/ui/Button";
import { InputField } from "@/components/ui/FormField";

/** Upcoming events (PRD §08.2): add one, delete one. Times are entered in IST. */
export function EventsPanel({
  charityId,
  events,
}: {
  charityId: string;
  events: readonly CharityEvent[];
}) {
  return (
    <div className="flex flex-col gap-6">
      {events.length > 0 && (
        <ul className="flex flex-col divide-y divide-line">
          {events.map((event) => (
            <EventRow key={event.id} charityId={charityId} event={event} />
          ))}
        </ul>
      )}
      <NewEventForm charityId={charityId} />
    </div>
  );
}

function EventRow({ charityId, event }: { charityId: string; event: CharityEvent }) {
  const [state, action, pending] = useActionState(deleteEvent, null);
  const when = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(new Date(event.startsAt));
  const past = new Date(event.startsAt) < new Date();
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className={past ? "text-ink-3" : undefined}>
        <p className="font-medium">
          {event.title} {past && <span className="text-xs">· past</span>}
        </p>
        <p className="text-sm text-ink-2">
          {when}
          {event.location && ` · ${event.location}`}
        </p>
      </div>
      <form action={action}>
        <input type="hidden" name="id" value={charityId} />
        <input type="hidden" name="eventId" value={event.id} />
        <Button type="submit" size="sm" variant="ghost" pending={pending}>
          Delete
        </Button>
      </form>
      {state && !state.ok && (
        <p role="alert" className="w-full text-sm text-danger">
          {state.error.message}
        </p>
      )}
    </li>
  );
}

function NewEventForm({ charityId }: { charityId: string }) {
  const [state, action, pending] = useActionState(saveEvent, null);
  const error = state && !state.ok ? state.error : null;
  const fieldError = (field: string) => (error?.field === field ? error.message : undefined);
  return (
    <form action={action} className="flex flex-col gap-3 border-t border-line pt-4" noValidate>
      <h3 className="text-lg">Add an event</h3>
      <input type="hidden" name="id" value={charityId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <InputField
          id="event-title"
          name="title"
          label="Title"
          required
          error={fieldError("title")}
        />
        <InputField
          id="event-startsAt"
          name="startsAt"
          label="When (IST)"
          type="datetime-local"
          required
          error={fieldError("startsAt")}
        />
        <InputField
          id="event-location"
          name="location"
          label="Where"
          error={fieldError("location")}
        />
        <InputField
          id="event-description"
          name="description"
          label="One line about it"
          error={fieldError("description")}
        />
      </div>
      {error && !error.field && (
        <p role="alert" className="text-sm text-danger">
          {error.message}
        </p>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" pending={pending}>
          Add event
        </Button>
        {state?.ok && (
          <span role="status" className="text-sm text-success">
            Added.
          </span>
        )}
      </div>
    </form>
  );
}
