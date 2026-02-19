import type { NextApiRequest, NextApiResponse } from "next";
import { TaskStatus } from "@prisma/client";
import { z } from "zod";
import { requireFounderSession } from "@/lib/auth/founder-session";
import { createTaskForFounder, listTasksForFounder } from "@/lib/data/tasks";

const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(4000),
  status: z.nativeEnum(TaskStatus).optional(),
  assignedAgentId: z.string().uuid().nullable().optional(),
  dependencyIds: z.array(z.string().uuid()).max(20).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = requireFounderSession(req, res);

  if (!session) {
    return;
  }

  if (req.method === "GET") {
    const tasks = await listTasksForFounder(session.userId);
    return res.status(200).json({ tasks });
  }

  if (req.method === "POST") {
    const parsed = createTaskSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid task payload." });
    }

    try {
      const task = await createTaskForFounder({
        userId: session.userId,
        ...parsed.data,
      });

      return res.status(201).json({ task });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ error: error.message });
      }

      return res.status(500).json({ error: "Failed to create task." });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed." });
}
