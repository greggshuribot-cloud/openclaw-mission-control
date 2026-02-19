import type { NextApiRequest, NextApiResponse } from "next";
import { ProposalStatus } from "@prisma/client";
import { z } from "zod";
import { requireFounderSession } from "@/lib/auth/founder-session";
import { transitionProposalForFounder } from "@/lib/data/proposals";

const idSchema = z.string().uuid();

const transitionSchema = z.object({
  status: z.nativeEnum(ProposalStatus),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = requireFounderSession(req, res);

  if (!session) {
    return;
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const parsedId = idSchema.safeParse(req.query.id);

  if (!parsedId.success) {
    return res.status(400).json({ error: "Invalid proposal id." });
  }

  const parsedPayload = transitionSchema.safeParse(req.body);

  if (!parsedPayload.success) {
    return res.status(400).json({ error: "Invalid transition payload." });
  }

  const result = await transitionProposalForFounder(session.userId, parsedId.data, parsedPayload.data.status);

  if (!result.ok) {
    if (result.code === "NOT_FOUND") {
      return res.status(404).json({ error: result.message });
    }

    return res.status(409).json({ error: result.message, currentStatus: result.currentStatus });
  }

  return res.status(200).json({ proposal: result.proposal, taskCreated: result.taskCreated });
}
