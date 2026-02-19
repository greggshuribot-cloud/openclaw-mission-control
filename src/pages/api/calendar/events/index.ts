import { EventType } from "@prisma/client";
import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { requireFounderSession } from "@/lib/auth/founder-session";
import { createCalendarEventForFounder, listCalendarEventsForFounder } from "@/lib/data/calendar";

const createCalendarEventSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(4000).optional(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date().nullable().optional(),
  type: z.nativeEnum(EventType),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = requireFounderSession(req, res);

  if (!session) {
    return;
  }

  if (req.method === "GET") {
    const events = await listCalendarEventsForFounder(session.userId);
    return res.status(200).json({ events });
  }

  if (req.method === "POST") {
    const parsed = createCalendarEventSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid calendar event payload." });
    }

    try {
      const event = await createCalendarEventForFounder({
        userId: session.userId,
        title: parsed.data.title,
        description: parsed.data.description,
        startAt: parsed.data.startAt,
        endAt: parsed.data.endAt,
        type: parsed.data.type,
      });

      return res.status(201).json({ event });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ error: error.message });
      }

      return res.status(500).json({ error: "Failed to create event." });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed." });
}
