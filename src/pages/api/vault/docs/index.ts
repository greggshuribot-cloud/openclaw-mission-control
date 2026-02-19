import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { requireFounderSession } from "@/lib/auth/founder-session";
import {
  createVaultDocumentForFounder,
  DocumentKind,
  listVaultDocumentsForFounder,
} from "@/lib/data/vault-docs";

const createVaultDocSchema = z.object({
  title: z.string().trim().min(1).max(200),
  kind: z.nativeEnum(DocumentKind),
  content: z.string().optional(),
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

    const docs = await listVaultDocumentsForFounder(session.userId, parsedQuery.data.q);
    return res.status(200).json({ docs });
  }

  if (req.method === "POST") {
    const parsed = createVaultDocSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid document payload." });
    }

    const doc = await createVaultDocumentForFounder({
      userId: session.userId,
      ...parsed.data,
    });

    return res.status(201).json({ doc });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed." });
}
