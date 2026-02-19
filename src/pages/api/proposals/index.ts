import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { requireFounderSession } from "@/lib/auth/founder-session";
import { createProposalForFounder, listProposalsForFounder } from "@/lib/data/proposals";

const createProposalSchema = z.object({
  title: z.string().trim().min(1).max(160),
  summary: z.string().trim().min(1).max(4000),
  pmNotes: z.string().trim().max(1000).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = requireFounderSession(req, res);

  if (!session) {
    return;
  }

  if (req.method === "GET") {
    const proposals = await listProposalsForFounder(session.userId);
    return res.status(200).json({ proposals });
  }

  if (req.method === "POST") {
    const parsed = createProposalSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid proposal payload." });
    }

    const proposal = await createProposalForFounder({
      userId: session.userId,
      content: {
        title: parsed.data.title,
        summary: parsed.data.summary,
      },
      pmNotes: parsed.data.pmNotes,
    });

    return res.status(201).json({ proposal });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed." });
}
