import { AgentRole, AgentStatus, ProposalStatus, TaskStatus, type Prisma } from "@prisma/client";
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
  pmNotes?: string | null;
  content?: ProposalContent;
};

type TransitionErrorCode = "NOT_FOUND" | "INVALID_TRANSITION";

export type TransitionProposalResult =
  | {
      ok: true;
      proposal: Awaited<ReturnType<typeof getProposalForFounder>>;
      taskCreated: boolean;
    }
  | {
      ok: false;
      code: TransitionErrorCode;
      message: string;
      currentStatus?: ProposalStatus;
    };

const allowedTransitions: Record<ProposalStatus, ProposalStatus[]> = {
  [ProposalStatus.PENDING_PM]: [ProposalStatus.PENDING_FOUNDER, ProposalStatus.REJECTED],
  [ProposalStatus.PENDING_FOUNDER]: [ProposalStatus.APPROVED, ProposalStatus.REJECTED],
  [ProposalStatus.APPROVED]: [],
  [ProposalStatus.REJECTED]: [],
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
      status: ProposalStatus.PENDING_PM,
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
      pmNotes: input.pmNotes,
      content: input.content,
    },
    include: proposalInclude,
  });
}

export async function transitionProposalForFounder(
  userId: string,
  id: string,
  nextStatus: ProposalStatus,
): Promise<TransitionProposalResult> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.proposalCard.findFirst({
      where: {
        id,
        proposingAgent: { userId },
      },
      include: proposalInclude,
    });

    if (!existing) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: "Proposal not found.",
      };
    }

    const validNextStatuses = allowedTransitions[existing.status];
    if (!validNextStatuses.includes(nextStatus)) {
      return {
        ok: false,
        code: "INVALID_TRANSITION",
        message: `Invalid transition from ${existing.status} to ${nextStatus}.`,
        currentStatus: existing.status,
      };
    }

    const proposal = await tx.proposalCard.update({
      where: { id },
      data: { status: nextStatus },
      include: proposalInclude,
    });

    let taskCreated = false;
    if (nextStatus === ProposalStatus.APPROVED) {
      const content = proposal.content as ProposalContent;
      const title = (content.title ?? "").trim() || "Untitled proposal";
      const description = (content.summary ?? "").trim() || "No summary provided.";

      const sprint =
        (await tx.sprint.findFirst({
          where: { userId },
          orderBy: { createdAt: "desc" },
        })) ??
        (await tx.sprint.create({
          data: {
            userId,
            name: "Default Sprint",
          },
        }));

      const existingTask = await tx.task.findFirst({
        where: {
          sprintId: sprint.id,
          title,
          description,
        },
        select: { id: true },
      });

      if (!existingTask) {
        await tx.task.create({
          data: {
            sprintId: sprint.id,
            title,
            description,
            status: TaskStatus.TODO,
            dependencyIds: [],
          },
        });
        taskCreated = true;
      }
    }

    return { ok: true, proposal, taskCreated };
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
