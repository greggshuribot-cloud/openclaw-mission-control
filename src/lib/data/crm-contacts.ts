import { AgentRole, ContactStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type CreateCrmContactInput = {
  userId: string;
  name: string;
  email: string;
  source: string;
  status?: ContactStatus;
  ownerAgentId?: string | null;
};

export type UpdateCrmContactInput = {
  name?: string;
  email?: string;
  source?: string;
  status?: ContactStatus;
  ownerAgentId?: string | null;
};

const crmContactSelect = {
  id: true,
  name: true,
  email: true,
  source: true,
  status: true,
  createdAt: true,
  ownerAgent: {
    select: {
      id: true,
      role: true,
      status: true,
      currentLocation: true,
    },
  },
} satisfies Prisma.CrmContactSelect;

async function assertAgentOwnership(userId: string, ownerAgentId: string | null | undefined): Promise<void> {
  if (!ownerAgentId) {
    return;
  }

  const owner = await prisma.agent.findFirst({
    where: {
      id: ownerAgentId,
      userId,
    },
    select: { id: true },
  });

  if (!owner) {
    throw new Error("Owner agent was not found for this founder.");
  }
}

async function findDefaultOwnerAgentId(userId: string): Promise<string | null> {
  const strategist = await prisma.agent.findFirst({
    where: {
      userId,
      role: AgentRole.STRATEGIST,
    },
    orderBy: { id: "asc" },
    select: { id: true },
  });

  if (strategist) {
    return strategist.id;
  }

  const fallback = await prisma.agent.findFirst({
    where: { userId },
    orderBy: { id: "asc" },
    select: { id: true },
  });

  return fallback?.id ?? null;
}

const founderOwnedContactWhere = (userId: string): Prisma.CrmContactWhereInput => ({
  OR: [
    {
      ownerAgent: {
        is: {
          userId,
        },
      },
    },
    {
      ownerAgentId: null,
    },
  ],
});

export async function listCrmContactsForFounder(userId: string) {
  return prisma.crmContact.findMany({
    where: founderOwnedContactWhere(userId),
    select: crmContactSelect,
    orderBy: [{ createdAt: "desc" }, { name: "asc" }],
  });
}

export async function getCrmContactForFounder(userId: string, id: string) {
  return prisma.crmContact.findFirst({
    where: {
      id,
      ...founderOwnedContactWhere(userId),
    },
    select: crmContactSelect,
  });
}

export async function createCrmContactForFounder(input: CreateCrmContactInput) {
  if (input.ownerAgentId !== undefined) {
    await assertAgentOwnership(input.userId, input.ownerAgentId);
  }

  const ownerAgentId =
    input.ownerAgentId === undefined ? await findDefaultOwnerAgentId(input.userId) : (input.ownerAgentId ?? null);

  return prisma.crmContact.create({
    data: {
      name: input.name,
      email: input.email,
      source: input.source,
      status: input.status ?? ContactStatus.LEAD,
      ownerAgentId,
    },
    select: crmContactSelect,
  });
}

export async function updateCrmContactForFounder(userId: string, id: string, input: UpdateCrmContactInput) {
  const existing = await getCrmContactForFounder(userId, id);

  if (!existing) {
    return null;
  }

  if (input.ownerAgentId !== undefined) {
    await assertAgentOwnership(userId, input.ownerAgentId);
  }

  return prisma.crmContact.update({
    where: { id },
    data: {
      name: input.name,
      email: input.email,
      source: input.source,
      status: input.status,
      ownerAgentId: input.ownerAgentId,
    },
    select: crmContactSelect,
  });
}

export async function deleteCrmContactForFounder(userId: string, id: string) {
  const existing = await getCrmContactForFounder(userId, id);

  if (!existing) {
    return false;
  }

  await prisma.crmContact.delete({ where: { id } });
  return true;
}
