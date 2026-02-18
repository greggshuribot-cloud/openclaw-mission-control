import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { ensureFounderUserForEmail } from "@/lib/auth/founder";
import { verifyPassword } from "@/lib/auth/password";
import { createSessionToken, getSessionCookieHeader } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid login payload." });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const password = parsed.data.password;

  await ensureFounderUserForEmail(email);

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const validPassword = await verifyPassword(password, user.passwordHash);

  if (!validPassword) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const token = createSessionToken(user);
  res.setHeader("Set-Cookie", getSessionCookieHeader(token));
  return res.status(200).json({ ok: true });
}
