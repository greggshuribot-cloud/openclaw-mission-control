import { type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type AssignPromptTemplateInput = {
  userId: string;
  agentId: string;
  promptTemplateId: string | null;
};

const agentSelect = {
  id: true,
  role: true,
  status: true,
  currentLocation: true,
  promptTemplateId: true,
  promptTemplate: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.AgentSelect;

async function assertTemplateExists(promptTemplateId: string | null): Promise<void> {
  if (!promptTemplateId) {
    return;
  }

  const template = await prisma.promptTemplate.findUnique({
    where: { id: promptTemplateId },
    select: { id: true },
  });

  if (!template) {
    throw new Error("Prompt template not found.");
  }
}

export async function listAgentsForFounder(userId: string) {
  return prisma.agent.findMany({
    where: { userId },
    select: agentSelect,
    orderBy: [{ role: "asc" }, { id: "asc" }],
  });
}

export async function assignPromptTemplateToAgent(input: AssignPromptTemplateInput) {
  const existing = await prisma.agent.findFirst({
    where: {
      id: input.agentId,
      userId: input.userId,
    },
    select: { id: true },
  });

  if (!existing) {
    return null;
  }

  await assertTemplateExists(input.promptTemplateId);

  return prisma.agent.update({
    where: { id: input.agentId },
    data: {
      promptTemplateId: input.promptTemplateId,
    },
    select: agentSelect,
  });
}
