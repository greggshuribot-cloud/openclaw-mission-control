import { TaskStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type CreateTaskInput = {
  userId: string;
  title: string;
  description: string;
  status?: TaskStatus;
  assignedAgentId?: string | null;
  dependencyIds?: string[];
};

export type UpdateTaskInput = {
  title?: string;
  description?: string;
  status?: TaskStatus;
  assignedAgentId?: string | null;
  dependencyIds?: string[];
};

const taskInclude = {
  sprint: {
    select: {
      id: true,
      name: true,
    },
  },
  assignedAgent: {
    select: {
      id: true,
      role: true,
      status: true,
      currentLocation: true,
    },
  },
} satisfies Prisma.TaskInclude;

export async function ensureDefaultSprintForUser(userId: string) {
  const existing = await prisma.sprint.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });

  if (existing) {
    return existing;
  }

  return prisma.sprint.create({
    data: {
      userId,
      name: "Default Sprint",
    },
  });
}

async function assertAgentOwnership(userId: string, agentId: string | null | undefined): Promise<void> {
  if (!agentId) {
    return;
  }

  const assignedAgent = await prisma.agent.findFirst({
    where: {
      id: agentId,
      userId,
    },
    select: { id: true },
  });

  if (!assignedAgent) {
    throw new Error("Assigned agent was not found for this founder.");
  }
}

export async function listTasksForFounder(userId: string) {
  return prisma.task.findMany({
    where: {
      sprint: {
        userId,
      },
    },
    include: taskInclude,
    orderBy: [{ sprint: { createdAt: "desc" } }, { title: "asc" }],
  });
}

export async function getTaskForFounder(userId: string, id: string) {
  return prisma.task.findFirst({
    where: {
      id,
      sprint: {
        userId,
      },
    },
    include: taskInclude,
  });
}

export async function createTaskForFounder(input: CreateTaskInput) {
  await assertAgentOwnership(input.userId, input.assignedAgentId);

  const sprint = await ensureDefaultSprintForUser(input.userId);

  return prisma.task.create({
    data: {
      sprintId: sprint.id,
      title: input.title,
      description: input.description,
      status: input.status ?? TaskStatus.TODO,
      assignedAgentId: input.assignedAgentId ?? null,
      dependencyIds: input.dependencyIds ?? [],
    },
    include: taskInclude,
  });
}

export async function updateTaskForFounder(userId: string, id: string, input: UpdateTaskInput) {
  const existing = await getTaskForFounder(userId, id);

  if (!existing) {
    return null;
  }

  if (input.assignedAgentId !== undefined) {
    await assertAgentOwnership(userId, input.assignedAgentId);
  }

  return prisma.task.update({
    where: { id },
    data: {
      title: input.title,
      description: input.description,
      status: input.status,
      assignedAgentId: input.assignedAgentId,
      dependencyIds: input.dependencyIds,
    },
    include: taskInclude,
  });
}

export async function deleteTaskForFounder(userId: string, id: string) {
  const existing = await getTaskForFounder(userId, id);

  if (!existing) {
    return false;
  }

  await prisma.task.delete({ where: { id } });
  return true;
}
