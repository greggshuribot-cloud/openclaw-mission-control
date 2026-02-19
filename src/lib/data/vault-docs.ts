import { DocumentKind, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type CreateVaultDocumentInput = {
  userId: string;
  title: string;
  kind: DocumentKind;
  content?: string;
};

export type UpdateVaultDocumentInput = {
  title?: string;
  kind?: DocumentKind;
  content?: string;
};

const vaultDocumentSelect = {
  id: true,
  userId: true,
  title: true,
  kind: true,
  content: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.VaultDocumentSelect;

export async function listVaultDocumentsForFounder(userId: string, search?: string) {
  const query = search?.trim();

  return prisma.vaultDocument.findMany({
    where: {
      userId,
      ...(query
        ? {
            OR: [
              {
                title: {
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
        : {}),
    },
    select: vaultDocumentSelect,
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });
}

export async function createVaultDocumentForFounder(input: CreateVaultDocumentInput) {
  return prisma.vaultDocument.create({
    data: {
      userId: input.userId,
      title: input.title,
      kind: input.kind,
      content: input.content ?? "",
    },
    select: vaultDocumentSelect,
  });
}

export async function getVaultDocumentForFounder(userId: string, id: string) {
  return prisma.vaultDocument.findFirst({
    where: {
      id,
      userId,
    },
    select: vaultDocumentSelect,
  });
}

export async function updateVaultDocumentForFounder(userId: string, id: string, input: UpdateVaultDocumentInput) {
  const existing = await getVaultDocumentForFounder(userId, id);

  if (!existing) {
    return null;
  }

  return prisma.vaultDocument.update({
    where: { id },
    data: {
      title: input.title,
      kind: input.kind,
      content: input.content,
    },
    select: vaultDocumentSelect,
  });
}

export async function deleteVaultDocumentForFounder(userId: string, id: string) {
  const existing = await getVaultDocumentForFounder(userId, id);

  if (!existing) {
    return false;
  }

  await prisma.vaultDocument.delete({ where: { id } });
  return true;
}

export { DocumentKind };
