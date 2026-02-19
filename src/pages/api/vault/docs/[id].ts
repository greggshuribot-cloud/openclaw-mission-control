import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { requireFounderSession } from "@/lib/auth/founder-session";
import {
  deleteVaultDocumentForFounder,
  DocumentKind,
  getVaultDocumentForFounder,
  updateVaultDocumentForFounder,
} from "@/lib/data/vault-docs";

const idSchema = z.string().uuid();

const updateVaultDocSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    kind: z.nativeEnum(DocumentKind).optional(),
    content: z.string().optional(),
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
    return res.status(400).json({ error: "Invalid document id." });
  }

  const id = parsedId.data;

  if (req.method === "GET") {
    const doc = await getVaultDocumentForFounder(session.userId, id);

    if (!doc) {
      return res.status(404).json({ error: "Document not found." });
    }

    return res.status(200).json({ doc });
  }

  if (req.method === "PATCH") {
    const parsed = updateVaultDocSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid document update payload." });
    }

    const doc = await updateVaultDocumentForFounder(session.userId, id, parsed.data);

    if (!doc) {
      return res.status(404).json({ error: "Document not found." });
    }

    return res.status(200).json({ doc });
  }

  if (req.method === "DELETE") {
    const deleted = await deleteVaultDocumentForFounder(session.userId, id);

    if (!deleted) {
      return res.status(404).json({ error: "Document not found." });
    }

    return res.status(204).end();
  }

  res.setHeader("Allow", "GET, PATCH, DELETE");
  return res.status(405).json({ error: "Method not allowed." });
}
