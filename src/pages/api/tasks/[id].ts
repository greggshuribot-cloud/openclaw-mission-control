import type { NextApiRequest, NextApiResponse } from "next";
import { TaskStatus } from "@prisma/client";
import { z } from "zod";
import { requireFounderSession } from "@/lib/auth/founder-session";
import { deleteTaskForFounder, getTaskForFounder, updateTaskForFounder } from "@/lib/data/tasks";

const idSchema = z.string().uuid();

const updateTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    description: z.string().trim().min(1).max(4000).optional(),
    status: z.nativeEnum(TaskStatus).optional(),
    assignedAgentId: z.string().uuid().nullable().optional(),
    dependencyIds: z.array(z.string().uuid()).max(20).optional(),
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
    return res.status(400).json({ error: "Invalid task id." });
  }

  const id = parsedId.data;

  if (req.method === "GET") {
    const task = await getTaskForFounder(session.userId, id);

    if (!task) {
      return res.status(404).json({ error: "Task not found." });
    }

    return res.status(200).json({ task });
  }

  if (req.method === "PATCH") {
    const parsedPayload = updateTaskSchema.safeParse(req.body);

    if (!parsedPayload.success) {
      return res.status(400).json({ error: "Invalid task update payload." });
    }

    try {
      const task = await updateTaskForFounder(session.userId, id, parsedPayload.data);

      if (!task) {
        return res.status(404).json({ error: "Task not found." });
      }

      return res.status(200).json({ task });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ error: error.message });
      }

      return res.status(500).json({ error: "Failed to update task." });
    }
  }

  if (req.method === "DELETE") {
    const deleted = await deleteTaskForFounder(session.userId, id);

    if (!deleted) {
      return res.status(404).json({ error: "Task not found." });
    }

    return res.status(204).end();
  }

  res.setHeader("Allow", "GET, PATCH, DELETE");
  return res.status(405).json({ error: "Method not allowed." });
}
