import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";

function getFounderCredentials() {
  const email = process.env.FOUNDER_EMAIL?.trim().toLowerCase();
  const password = process.env.FOUNDER_PASSWORD;

  if (!email || !password) {
    return null;
  }

  return { email, password };
}

export async function ensureFounderUserForEmail(email: string): Promise<User | null> {
  const founder = getFounderCredentials();

  if (!founder || founder.email !== email) {
    return null;
  }

  const existing = await prisma.user.findUnique({
    where: { email: founder.email },
  });

  if (existing) {
    return existing;
  }

  return prisma.user.create({
    data: {
      email: founder.email,
      passwordHash: await hashPassword(founder.password),
    },
  });
}
