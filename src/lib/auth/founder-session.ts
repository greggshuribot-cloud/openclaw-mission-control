import type { NextApiRequest, NextApiResponse } from "next";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";

function parseCookieHeader(cookieHeader?: string): Map<string, string> {
  const cookies = new Map<string, string>();

  if (!cookieHeader) {
    return cookies;
  }

  for (const part of cookieHeader.split(";")) {
    const [key, ...rest] = part.trim().split("=");

    if (!key) {
      continue;
    }

    cookies.set(key, decodeURIComponent(rest.join("=")));
  }

  return cookies;
}

export type FounderSession = {
  userId: string;
  email: string;
};

export function requireFounderSession(
  req: NextApiRequest,
  res: NextApiResponse,
): FounderSession | null {
  const founderEmail = process.env.FOUNDER_EMAIL?.trim().toLowerCase();

  if (!founderEmail) {
    res.status(500).json({ error: "Founder credentials are not configured." });
    return null;
  }

  const cookies = parseCookieHeader(req.headers.cookie);
  const token = cookies.get(SESSION_COOKIE_NAME);

  if (!token) {
    res.status(401).json({ error: "Authentication required." });
    return null;
  }

  const session = verifySessionToken(token);

  if (!session) {
    res.status(401).json({ error: "Invalid session." });
    return null;
  }

  if (session.email.toLowerCase() !== founderEmail) {
    res.status(403).json({ error: "Founder access required." });
    return null;
  }

  return {
    userId: session.userId,
    email: session.email,
  };
}
