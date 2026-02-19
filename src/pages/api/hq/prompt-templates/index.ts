import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { requireFounderSession } from "@/lib/auth/founder-session";
import { createPromptTemplate, listPromptTemplates } from "@/lib/data/prompt-templates";

const createPromptTemplateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  content: z.string().trim().min(1).max(12000),
});

const searchSchema = z
  .object({
    q: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .transform((value) => (Array.isArray(value) ? value[0] : value)),
  })
  .strict();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = requireFounderSession(req, res);

  if (!session) {
    return;
  }

  if (req.method === "GET") {
    const parsedQuery = searchSchema.safeParse(req.query);

    if (!parsedQuery.success) {
      return res.status(400).json({ error: "Invalid search query." });
    }

    const templates = await listPromptTemplates(parsedQuery.data.q);
    return res.status(200).json({ templates });
  }

  if (req.method === "POST") {
    const parsed = createPromptTemplateSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid prompt template payload." });
    }

    const template = await createPromptTemplate(parsed.data);
    return res.status(201).json({ template });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed." });
}
