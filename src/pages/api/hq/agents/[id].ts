import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { requireFounderSession } from "@/lib/auth/founder-session";
import { assignPromptTemplateToAgent } from "@/lib/data/agents";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const updateAssignmentSchema = z.object({
  promptTemplateId: z.string().uuid().nullable(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = requireFounderSession(req, res);

  if (!session) {
    return;
  }

  const parsedParams = paramsSchema.safeParse(req.query);

  if (!parsedParams.success) {
    return res.status(400).json({ error: "Invalid agent id." });
  }

  if (req.method === "PATCH") {
    const parsedBody = updateAssignmentSchema.safeParse(req.body);

    if (!parsedBody.success) {
      return res.status(400).json({ error: "Invalid assignment payload." });
    }

    try {
      const agent = await assignPromptTemplateToAgent({
        userId: session.userId,
        agentId: parsedParams.data.id,
        promptTemplateId: parsedBody.data.promptTemplateId,
      });

      if (!agent) {
        return res.status(404).json({ error: "Agent not found." });
      }

      return res.status(200).json({ agent });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to assign prompt template.";
      return res.status(400).json({ error: message });
    }
  }

  res.setHeader("Allow", "PATCH");
  return res.status(405).json({ error: "Method not allowed." });
}
