import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { requireFounderSession } from "@/lib/auth/founder-session";
import {
  deleteProposalForFounder,
  getProposalForFounder,
  updateProposalForFounder,
} from "@/lib/data/proposals";

const idSchema = z.string().uuid();

const updateProposalSchema = z
  .object({
    pmNotes: z.string().trim().max(1000).nullable().optional(),
    title: z.string().trim().min(1).max(160).optional(),
    summary: z.string().trim().min(1).max(4000).optional(),
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
    return res.status(400).json({ error: "Invalid proposal id." });
  }

  const id = parsedId.data;

  if (req.method === "GET") {
    const proposal = await getProposalForFounder(session.userId, id);

    if (!proposal) {
      return res.status(404).json({ error: "Proposal not found." });
    }

    return res.status(200).json({ proposal });
  }

  if (req.method === "PATCH") {
    const parsedPayload = updateProposalSchema.safeParse(req.body);

    if (!parsedPayload.success) {
      return res.status(400).json({ error: "Invalid proposal update payload." });
    }

    const { title, summary, ...rest } = parsedPayload.data;

    const proposal = await getProposalForFounder(session.userId, id);

    if (!proposal) {
      return res.status(404).json({ error: "Proposal not found." });
    }

    const existingContent = proposal.content as { title?: string; summary?: string };

    const updated = await updateProposalForFounder(session.userId, id, {
      ...rest,
      content:
        title !== undefined || summary !== undefined
          ? {
              title: title ?? existingContent.title ?? "",
              summary: summary ?? existingContent.summary ?? "",
            }
          : undefined,
    });

    return res.status(200).json({ proposal: updated });
  }

  if (req.method === "DELETE") {
    const deleted = await deleteProposalForFounder(session.userId, id);

    if (!deleted) {
      return res.status(404).json({ error: "Proposal not found." });
    }

    return res.status(204).end();
  }

  res.setHeader("Allow", "GET, PATCH, DELETE");
  return res.status(405).json({ error: "Method not allowed." });
}
