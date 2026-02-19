import { EventType } from "@prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { requireFounderSession } from "@/lib/auth/founder-session";
import { deleteCalendarEventForFounder, getCalendarEventForFounder, updateCalendarEventForFounder } from "@/lib/data/calendar";

const idSchema = z.string().uuid();

const updateCalendarEventSchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    description: z.string().trim().max(4000).nullable().optional(),
    startAt: z.coerce.date().optional(),
    endAt: z.coerce.date().nullable().optional(),
    type: z.nativeEnum(EventType).optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "No fields to update.",
  });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = requireFounderSession(req, res);

  if (!session) {
    return;
  }

  const parsedId = idSchema.safeParse(req.query.id);

  if (!parsedId.success) {
    return res.status(400).json({ error: "Invalid event id." });
  }

  const id = parsedId.data;

  if (req.method === "GET") {
    const event = await getCalendarEventForFounder(session.userId, id);

    if (!event) {
      return res.status(404).json({ error: "Event not found." });
    }

    return res.status(200).json({ event });
  }

  if (req.method === "PATCH") {
    const parsedPayload = updateCalendarEventSchema.safeParse(req.body);

    if (!parsedPayload.success) {
      return res.status(400).json({ error: "Invalid event update payload." });
    }

    try {
      const event = await updateCalendarEventForFounder(session.userId, id, parsedPayload.data);

      if (!event) {
        return res.status(404).json({ error: "Event not found." });
      }

      return res.status(200).json({ event });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ error: error.message });
      }

      return res.status(500).json({ error: "Failed to update event." });
    }
  }

  if (req.method === "DELETE") {
    const deleted = await deleteCalendarEventForFounder(session.userId, id);

    if (!deleted) {
      return res.status(404).json({ error: "Event not found." });
    }

    return res.status(204).end();
  }

  res.setHeader("Allow", "GET, PATCH, DELETE");
  return res.status(405).json({ error: "Method not allowed." });
}
