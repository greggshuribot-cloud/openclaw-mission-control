import { AgentRole, AgentStatus, ProposalStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ProposalContent = {
  title: string;
  summary: string;
};

export type CreateProposalInput = {
  userId: string;
  content: ProposalContent;
  pmNotes?: string;
};

export type UpdateProposalInput = {
  status?: ProposalStatus;
  pmNotes?: string | null;
  content?: ProposalContent;
};

const proposalInclude = {
  proposingAgent: {
    select: {
      id: true,
      role: true,
      status: true,
      currentLocation: true,
    },
  },
} satisfies Prisma.ProposalCardInclude;

async function ensureDefaultAgentForUser(userId: string) {
  const existing = await prisma.agent.findFirst({
    where: { userId },
    orderBy: { id: "asc" },
  });

  if (existing) {
    return existing;
  }

  return prisma.agent.create({
    data: {
      userId,
      role: AgentRole.PM,
      status: AgentStatus.IDLE,
      currentLocation: "Mailroom / Outbox",
    },
  });
}

export async function listProposalsForFounder(userId: string) {
  return prisma.proposalCard.findMany({
    where: {
      proposingAgent: {
        userId,
      },
    },
    include: proposalInclude,
    orderBy: { createdAt: "desc" },
  });
}

export async function getProposalForFounder(userId: string, id: string) {
  return prisma.proposalCard.findFirst({
    where: {
      id,
      proposingAgent: {
        userId,
      },
    },
    include: proposalInclude,
  });
}

export async function createProposalForFounder(input: CreateProposalInput) {
  const agent = await ensureDefaultAgentForUser(input.userId);

  return prisma.proposalCard.create({
    data: {
      proposingAgentId: agent.id,
      content: input.content,
      status: ProposalStatus.PENDING_FOUNDER,
      pmNotes: input.pmNotes,
    },
    include: proposalInclude,
  });
}

export async function updateProposalForFounder(userId: string, id: string, input: UpdateProposalInput) {
  const existing = await getProposalForFounder(userId, id);

  if (!existing) {
    return null;
  }

  return prisma.proposalCard.update({
    where: { id },
    data: {
      status: input.status,
      pmNotes: input.pmNotes,
      content: input.content,
    },
    include: proposalInclude,
  });
}

export async function deleteProposalForFounder(userId: string, id: string) {
  const existing = await getProposalForFounder(userId, id);

  if (!existing) {
    return false;
  }

  await prisma.proposalCard.delete({ where: { id } });
  return true;
}
