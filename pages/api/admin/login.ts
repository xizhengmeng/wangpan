import type { NextApiRequest, NextApiResponse } from "next";

import { checkPassword, clearAuthCookie, setAuthCookie } from "@/lib/auth";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // POST → login
  if (req.method === "POST") {
    const { password } = req.body || {};
    if (!password || typeof password !== "string") {
      return res.status(400).json({ error: "密码不能为空" });
    }
    if (!checkPassword(password)) {
      return res.status(401).json({ error: "密码错误" });
    }
    setAuthCookie(res);
    return res.status(200).json({ ok: true });
  }

  // DELETE → logout
  if (req.method === "DELETE") {
    clearAuthCookie(res);
    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", "POST, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}
