import type { NextApiRequest, NextApiResponse } from "next";
import { getClearSessionCookieHeader } from "@/lib/auth/session";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  res.setHeader("Set-Cookie", getClearSessionCookieHeader());
  return res.status(200).json({ ok: true });
}
