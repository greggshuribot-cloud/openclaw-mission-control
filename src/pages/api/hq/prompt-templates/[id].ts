import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { requireFounderSession } from "@/lib/auth/founder-session";
import { deletePromptTemplate, updatePromptTemplate } from "@/lib/data/prompt-templates";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const updatePromptTemplateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    content: z.string().trim().min(1).max(12000).optional(),
  })
  .refine((value) => value.name !== undefined || value.content !== undefined, {
    message: "At least one field is required.",
  });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = requireFounderSession(req, res);

  if (!session) {
    return;
  }

  const parsedParams = paramsSchema.safeParse(req.query);

  if (!parsedParams.success) {
    return res.status(400).json({ error: "Invalid template id." });
  }

  const { id } = parsedParams.data;

  if (req.method === "PATCH") {
    const parsedBody = updatePromptTemplateSchema.safeParse(req.body);

    if (!parsedBody.success) {
      return res.status(400).json({ error: "Invalid prompt template payload." });
    }

    const template = await updatePromptTemplate(id, parsedBody.data);

    if (!template) {
      return res.status(404).json({ error: "Prompt template not found." });
    }

    return res.status(200).json({ template });
  }

  if (req.method === "DELETE") {
    const deleted = await deletePromptTemplate(id);

    if (!deleted) {
      return res.status(404).json({ error: "Prompt template not found." });
    }

    return res.status(204).end();
  }

  res.setHeader("Allow", "PATCH, DELETE");
  return res.status(405).json({ error: "Method not allowed." });
}
