import type { NextApiRequest, NextApiResponse } from "next";

import { getFeedback, resolveFeedback } from "@/lib/store";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    return res.status(200).json({ items: (await getFeedback()).reverse() });
  }

  // PATCH /api/admin/feedback  { id, resolved: true }
  if (req.method === "PATCH") {
    const { id } = req.body || {};
    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "缺少 id" });
    }
    try {
      await resolveFeedback(id);
      return res.status(200).json({ ok: true });
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : "操作失败" });
    }
  }

  res.setHeader("Allow", "GET, PATCH");
  return res.status(405).json({ error: "Method not allowed" });
}
