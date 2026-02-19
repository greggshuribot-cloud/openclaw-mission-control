import { type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type CreatePromptTemplateInput = {
  name: string;
  content: string;
};

export type UpdatePromptTemplateInput = {
  name?: string;
  content?: string;
};

const promptTemplateSelect = {
  id: true,
  name: true,
  content: true,
  createdAt: true,
  _count: {
    select: {
      agents: true,
    },
  },
} satisfies Prisma.PromptTemplateSelect;

export async function listPromptTemplates(search?: string) {
  const query = search?.trim();

  return prisma.promptTemplate.findMany({
    where: query
      ? {
          OR: [
            {
              name: {
                contains: query,
                mode: "insensitive",
              },
            },
            {
              content: {
                contains: query,
                mode: "insensitive",
              },
            },
          ],
        }
      : undefined,
    select: promptTemplateSelect,
    orderBy: [{ createdAt: "desc" }],
  });
}

export async function createPromptTemplate(input: CreatePromptTemplateInput) {
  return prisma.promptTemplate.create({
    data: {
      name: input.name,
      content: input.content,
    },
    select: promptTemplateSelect,
  });
}

export async function getPromptTemplate(id: string) {
  return prisma.promptTemplate.findUnique({
    where: { id },
    select: promptTemplateSelect,
  });
}

export async function updatePromptTemplate(id: string, input: UpdatePromptTemplateInput) {
  const existing = await getPromptTemplate(id);

  if (!existing) {
    return null;
  }

  return prisma.promptTemplate.update({
    where: { id },
    data: {
      name: input.name,
      content: input.content,
    },
    select: promptTemplateSelect,
  });
}

export async function deletePromptTemplate(id: string) {
  const existing = await getPromptTemplate(id);

  if (!existing) {
    return false;
  }

  await prisma.$transaction([
    prisma.agent.updateMany({
      where: { promptTemplateId: id },
      data: { promptTemplateId: null },
    }),
    prisma.promptTemplate.delete({ where: { id } }),
  ]);

  return true;
}
