"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type EventType = "DEADLINE" | "MEETING" | "MILESTONE";

type CalendarEvent = {
  id: string;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string | null;
  type: EventType;
  createdAt: string;
};

type TaskStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE" | "FAILED";

type TaskRecord = {
  id: string;
  status: TaskStatus;
  updatedAt: string;
  sprint: {
    id: string;
    name: string;
    createdAt: string;
  };
};

type EventDraft = {
  title: string;
  startAt: string;
  type: EventType;
};

const eventTypeOptions: EventType[] = ["DEADLINE", "MEETING", "MILESTONE"];

function formatEventType(type: EventType): string {
  return type.toLowerCase();
}

function toLocalDateTimeValue(value: string): string {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function toIsoFromLocalDateTime(value: string): string {
  return new Date(value).toISOString();
}

function nextMeetingStartIso(): string {
  const now = new Date();
  const minutes = now.getMinutes();
  const nextHalfHour = minutes < 30 ? 30 : 60;
  now.setSeconds(0, 0);

  if (nextHalfHour === 60) {
    now.setHours(now.getHours() + 1, 0, 0, 0);
  } else {
    now.setMinutes(nextHalfHour, 0, 0);
  }

  return now.toISOString();
}

export function CalendarView() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [title, setTitle] = useState("");
  const [startAt, setStartAt] = useState(() => toLocalDateTimeValue(new Date().toISOString()));
  const [type, setType] = useState<EventType>("DEADLINE");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [shortcutPending, setShortcutPending] = useState(false);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [draftsById, setDraftsById] = useState<Record<string, EventDraft>>({});

  const loadEvents = useCallback(async () => {
    const response = await fetch("/api/calendar/events", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error("Failed to load events.");
    }

    const payload = (await response.json()) as { events: CalendarEvent[] };
    setEvents(payload.events);
    setDraftsById((current) => {
      const next: Record<string, EventDraft> = {};

      for (const event of payload.events) {
        next[event.id] = current[event.id] ?? {
          title: event.title,
          startAt: toLocalDateTimeValue(event.startAt),
          type: event.type,
        };
      }

      return next;
    });
  }, []);

  const loadTasks = useCallback(async () => {
    const response = await fetch("/api/tasks", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error("Failed to load sprint data.");
    }

    const payload = (await response.json()) as { tasks: TaskRecord[] };
    setTasks(payload.tasks);
  }, []);

  useEffect(() => {
    let active = true;

    async function run() {
      try {
        await Promise.all([loadEvents(), loadTasks()]);
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load calendar data.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    run();

    return () => {
      active = false;
    };
  }, [loadEvents, loadTasks]);

  const upcomingEvents = useMemo(() => {
    const now = Date.now();
    return events
      .filter((event) => new Date(event.startAt).getTime() >= now)
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  }, [events]);

  const projection = useMemo(() => {
    if (tasks.length === 0) {
      return {
        hasSprint: false,
        sprintName: "Current Sprint",
      } as const;
    }

    let selectedSprint = tasks[0].sprint;

    for (const task of tasks) {
      if (new Date(task.sprint.createdAt).getTime() > new Date(selectedSprint.createdAt).getTime()) {
        selectedSprint = task.sprint;
      }
    }

    const currentTasks = tasks.filter((task) => task.sprint.id === selectedSprint.id);
    const openTasks = currentTasks.filter((task) => task.status !== "DONE");
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const completedInLastWeek = currentTasks.filter(
      (task) => task.status === "DONE" && new Date(task.updatedAt).getTime() >= cutoff,
    );

    if (completedInLastWeek.length === 0) {
      return {
        hasSprint: true,
        sprintName: selectedSprint.name,
        openCount: openTasks.length,
        message: "No DONE history in the last 7 days yet. Projection appears once velocity data is available.",
      } as const;
    }

    if (openTasks.length === 0) {
      return {
        hasSprint: true,
        sprintName: selectedSprint.name,
        openCount: 0,
        completedInLastWeek: completedInLastWeek.length,
        projectedDate: new Date(),
      } as const;
    }

    const dailyVelocity = completedInLastWeek.length / 7;
    const daysToComplete = Math.ceil(openTasks.length / dailyVelocity);
    const projectedDate = new Date(Date.now() + daysToComplete * 24 * 60 * 60 * 1000);

    return {
      hasSprint: true,
      sprintName: selectedSprint.name,
      openCount: openTasks.length,
      completedInLastWeek: completedInLastWeek.length,
      projectedDate,
    } as const;
  }, [tasks]);

  async function refreshData() {
    await Promise.all([loadEvents(), loadTasks()]);
  }

  async function handleCreateEvent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setNotice(null);
    setError(null);

    try {
      const response = await fetch("/api/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          startAt: toIsoFromLocalDateTime(startAt),
          type,
        }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to create event.");
      }

      setTitle("");
      setType("DEADLINE");
      setStartAt(toLocalDateTimeValue(new Date().toISOString()));
      await refreshData();
      setNotice({ type: "success", message: "Event created." });
    } catch (submitError) {
      setNotice({
        type: "error",
        message: submitError instanceof Error ? submitError.message : "Failed to create event.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateMeetingShortcut() {
    setShortcutPending(true);
    setNotice(null);
    setError(null);

    try {
      const response = await fetch("/api/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Company Meeting",
          startAt: nextMeetingStartIso(),
          type: "MEETING" satisfies EventType,
        }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to create company meeting.");
      }

      await loadEvents();
      setNotice({ type: "success", message: "Company meeting added to calendar." });
    } catch (meetingError) {
      setNotice({
        type: "error",
        message: meetingError instanceof Error ? meetingError.message : "Failed to create company meeting.",
      });
    } finally {
      setShortcutPending(false);
    }
  }

  function handleDraftUpdate(id: string, next: Partial<EventDraft>) {
    setDraftsById((current) => {
      const existing = current[id];

      if (!existing) {
        return current;
      }

      return {
        ...current,
        [id]: {
          ...existing,
          ...next,
        },
      };
    });
  }

  async function handleSaveEvent(id: string) {
    const draft = draftsById[id];

    if (!draft) {
      return;
    }

    setMutatingId(id);
    setNotice(null);
    setError(null);

    try {
      const response = await fetch(`/api/calendar/events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          startAt: toIsoFromLocalDateTime(draft.startAt),
          type: draft.type,
        }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to update event.");
      }

      await loadEvents();
      setNotice({ type: "success", message: "Event updated." });
    } catch (updateError) {
      setNotice({
        type: "error",
        message: updateError instanceof Error ? updateError.message : "Failed to update event.",
      });
    } finally {
      setMutatingId(null);
    }
  }

  async function handleDeleteEvent(id: string) {
    setMutatingId(id);
    setNotice(null);
    setError(null);

    try {
      const response = await fetch(`/api/calendar/events/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to delete event.");
      }

      await loadEvents();
      setNotice({ type: "success", message: "Event deleted." });
    } catch (deleteError) {
      setNotice({
        type: "error",
        message: deleteError instanceof Error ? deleteError.message : "Failed to delete event.",
      });
    } finally {
      setMutatingId(null);
    }
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <div className="grid gap-4">
        <form onSubmit={handleCreateEvent} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-100">Create Event</h3>
            <button
              type="button"
              onClick={handleCreateMeetingShortcut}
              disabled={shortcutPending}
              className="rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs font-medium text-zinc-200 hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {shortcutPending ? "Adding meeting..." : "+ Company Meeting"}
            </button>
          </div>

          <div className="mt-3 grid gap-2 lg:grid-cols-[1.5fr_1fr_1fr]">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Event title"
              required
              maxLength={160}
              className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
            />
            <input
              type="datetime-local"
              value={startAt}
              onChange={(event) => setStartAt(event.target.value)}
              required
              className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
            />
            <select
              value={type}
              onChange={(event) => setType(event.target.value as EventType)}
              className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
            >
              {eventTypeOptions.map((option) => (
                <option key={option} value={option}>
                  {formatEventType(option)}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Creating..." : "Create event"}
            </button>
          </div>
        </form>

        {error ? (
          <div className="rounded-md border border-rose-800 bg-rose-950/30 px-3 py-2 text-sm text-rose-300">{error}</div>
        ) : null}

        {notice ? (
          <div
            className={
              notice.type === "success"
                ? "rounded-md border border-emerald-800 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-300"
                : "rounded-md border border-rose-800 bg-rose-950/30 px-3 py-2 text-sm text-rose-300"
            }
          >
            {notice.message}
          </div>
        ) : null}

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <h3 className="text-sm font-semibold text-zinc-100">Upcoming Events</h3>

          {loading ? (
            <p className="mt-3 text-sm text-zinc-400">Loading events...</p>
          ) : upcomingEvents.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-400">No upcoming events.</p>
          ) : (
            <div className="mt-3 grid gap-2">
              {upcomingEvents.map((event) => {
                const draft = draftsById[event.id];

                if (!draft) {
                  return null;
                }

                return (
                  <article key={event.id} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                    <div className="grid gap-2 lg:grid-cols-[1.5fr_1fr_1fr_auto]">
                      <input
                        value={draft.title}
                        onChange={(entry) => handleDraftUpdate(event.id, { title: entry.target.value })}
                        maxLength={160}
                        className="rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                      />
                      <input
                        type="datetime-local"
                        value={draft.startAt}
                        onChange={(entry) => handleDraftUpdate(event.id, { startAt: entry.target.value })}
                        className="rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                      />
                      <select
                        value={draft.type}
                        onChange={(entry) => handleDraftUpdate(event.id, { type: entry.target.value as EventType })}
                        className="rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                      >
                        {eventTypeOptions.map((option) => (
                          <option key={option} value={option}>
                            {formatEventType(option)}
                          </option>
                        ))}
                      </select>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleSaveEvent(event.id)}
                          disabled={mutatingId === event.id}
                          className="rounded-md border border-zinc-600 px-2.5 py-1.5 text-xs font-medium text-zinc-200 hover:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteEvent(event.id)}
                          disabled={mutatingId === event.id}
                          className="rounded-md border border-rose-800 px-2.5 py-1.5 text-xs font-medium text-rose-300 hover:border-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <aside className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <h3 className="text-sm font-semibold text-zinc-100">Sprint Projection</h3>

        {loading ? (
          <p className="mt-3 text-sm text-zinc-400">Calculating projection...</p>
        ) : !projection.hasSprint ? (
          <p className="mt-3 text-sm text-zinc-400">No sprint tasks found yet.</p>
        ) : "message" in projection ? (
          <div className="mt-3 rounded-md border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-300">
            <p className="font-medium text-zinc-200">{projection.sprintName}</p>
            <p className="mt-1 text-zinc-400">Open tasks: {projection.openCount}</p>
            <p className="mt-2 text-zinc-400">{projection.message}</p>
          </div>
        ) : (
          <div className="mt-3 rounded-md border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-300">
            <p className="font-medium text-zinc-200">{projection.sprintName}</p>
            <p className="mt-1 text-zinc-400">Open tasks: {projection.openCount}</p>
            <p className="mt-1 text-zinc-400">DONE last 7 days: {projection.completedInLastWeek}</p>
            <p className="mt-2 text-zinc-200">
              Projected completion: {projection.projectedDate.toLocaleDateString()} {projection.projectedDate.toLocaleTimeString()}
            </p>
          </div>
        )}
      </aside>
    </section>
  );
}
