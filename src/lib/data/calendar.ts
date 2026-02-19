import { EventType, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type CreateCalendarEventInput = {
  userId: string;
  title: string;
  description?: string | null;
  startAt: Date;
  endAt?: Date | null;
  type: EventType;
};

export type UpdateCalendarEventInput = {
  title?: string;
  description?: string | null;
  startAt?: Date;
  endAt?: Date | null;
  type?: EventType;
};

const calendarEventSelect = {
  id: true,
  title: true,
  description: true,
  startAt: true,
  endAt: true,
  type: true,
  createdAt: true,
} satisfies Prisma.CalendarEventSelect;

function assertEventWindow(startAt: Date, endAt?: Date | null): void {
  if (endAt && endAt.getTime() < startAt.getTime()) {
    throw new Error("Event end time must be after start time.");
  }
}

export async function listCalendarEventsForFounder(userId: string) {
  return prisma.calendarEvent.findMany({
    where: { userId },
    select: calendarEventSelect,
    orderBy: [{ startAt: "asc" }, { createdAt: "asc" }],
  });
}

export async function getCalendarEventForFounder(userId: string, id: string) {
  return prisma.calendarEvent.findFirst({
    where: {
      id,
      userId,
    },
    select: calendarEventSelect,
  });
}

export async function createCalendarEventForFounder(input: CreateCalendarEventInput) {
  assertEventWindow(input.startAt, input.endAt);

  return prisma.calendarEvent.create({
    data: {
      userId: input.userId,
      title: input.title,
      description: input.description ?? null,
      startAt: input.startAt,
      endAt: input.endAt ?? null,
      type: input.type,
    },
    select: calendarEventSelect,
  });
}

export async function updateCalendarEventForFounder(userId: string, id: string, input: UpdateCalendarEventInput) {
  const existing = await getCalendarEventForFounder(userId, id);

  if (!existing) {
    return null;
  }

  const nextStart = input.startAt ?? existing.startAt;
  const nextEnd = input.endAt === undefined ? existing.endAt : input.endAt;
  assertEventWindow(nextStart, nextEnd);

  return prisma.calendarEvent.update({
    where: { id },
    data: {
      title: input.title,
      description: input.description,
      startAt: input.startAt,
      endAt: input.endAt,
      type: input.type,
    },
    select: calendarEventSelect,
  });
}

export async function deleteCalendarEventForFounder(userId: string, id: string) {
  const existing = await getCalendarEventForFounder(userId, id);

  if (!existing) {
    return false;
  }

  await prisma.calendarEvent.delete({ where: { id } });
  return true;
}
