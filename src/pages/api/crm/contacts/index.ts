import type { NextApiRequest, NextApiResponse } from "next";
import { ContactStatus } from "@prisma/client";
import { z } from "zod";
import { requireFounderSession } from "@/lib/auth/founder-session";
import { createCrmContactForFounder, listCrmContactsForFounder } from "@/lib/data/crm-contacts";

const createContactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.email().trim().max(320),
  source: z.string().trim().min(1).max(120),
  status: z.nativeEnum(ContactStatus).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = requireFounderSession(req, res);

  if (!session) {
    return;
  }

  if (req.method === "GET") {
    const contacts = await listCrmContactsForFounder(session.userId);
    return res.status(200).json({ contacts });
  }

  if (req.method === "POST") {
    const parsed = createContactSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid contact payload." });
    }

    try {
      const contact = await createCrmContactForFounder({
        userId: session.userId,
        ...parsed.data,
      });

      return res.status(201).json({ contact });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ error: error.message });
      }

      return res.status(500).json({ error: "Failed to create contact." });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed." });
}
