import type { NextApiRequest, NextApiResponse } from "next";

import { getAllResources, saveResource } from "@/lib/store";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    return res.status(200).json({ items: getAllResources() });
  }

  if (req.method === "POST") {
    try {
      const resource = saveResource(req.body);
      return res.status(201).json(resource);
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "保存失败"
      });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
