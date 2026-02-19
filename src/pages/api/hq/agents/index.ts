import type { NextApiRequest, NextApiResponse } from "next";
import { requireFounderSession } from "@/lib/auth/founder-session";
import { listAgentsForFounder } from "@/lib/data/agents";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = requireFounderSession(req, res);

  if (!session) {
    return;
  }

  if (req.method === "GET") {
    const agents = await listAgentsForFounder(session.userId);
    return res.status(200).json({ agents });
  }

  res.setHeader("Allow", "GET");
  return res.status(405).json({ error: "Method not allowed." });
}
