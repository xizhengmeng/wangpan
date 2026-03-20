import type { NextApiRequest, NextApiResponse } from "next";

import { deleteResource, saveResource } from "@/lib/store";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = String(req.query.id || "");

  if (req.method === "PUT") {
    try {
      const resource = saveResource({
        ...req.body,
        id
      });
      return res.status(200).json(resource);
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "更新失败"
      });
    }
  }

  if (req.method === "DELETE") {
    deleteResource(id);
    return res.status(204).end();
  }

  res.setHeader("Allow", "PUT, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}
