import type { NextApiRequest, NextApiResponse } from "next";
import { ContactStatus } from "@prisma/client";
import { z } from "zod";
import { requireFounderSession } from "@/lib/auth/founder-session";
import {
  deleteCrmContactForFounder,
  getCrmContactForFounder,
  updateCrmContactForFounder,
} from "@/lib/data/crm-contacts";

const idSchema = z.string().uuid();

const updateContactSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    email: z.email().trim().max(320).optional(),
    source: z.string().trim().min(1).max(120).optional(),
    status: z.nativeEnum(ContactStatus).optional(),
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
    return res.status(400).json({ error: "Invalid contact id." });
  }

  const id = parsedId.data;

  if (req.method === "GET") {
    const contact = await getCrmContactForFounder(session.userId, id);

    if (!contact) {
      return res.status(404).json({ error: "Contact not found." });
    }

    return res.status(200).json({ contact });
  }

  if (req.method === "PATCH") {
    const parsed = updateContactSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid contact update payload." });
    }

    try {
      const contact = await updateCrmContactForFounder(session.userId, id, parsed.data);

      if (!contact) {
        return res.status(404).json({ error: "Contact not found." });
      }

      return res.status(200).json({ contact });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ error: error.message });
      }

      return res.status(500).json({ error: "Failed to update contact." });
    }
  }

  if (req.method === "DELETE") {
    const deleted = await deleteCrmContactForFounder(session.userId, id);

    if (!deleted) {
      return res.status(404).json({ error: "Contact not found." });
    }

    return res.status(204).end();
  }

  res.setHeader("Allow", "GET, PATCH, DELETE");
  return res.status(405).json({ error: "Method not allowed." });
}
