import type { NextApiRequest, NextApiResponse } from "next";

import { isAuthenticated } from "@/lib/auth";
import {
  deleteCategory,
  deleteChannel,
  deleteTopic,
  getContentStructure,
  saveCategory,
  saveChannel,
  saveTopic,
} from "@/lib/store";

function auth(req: NextApiRequest, res: NextApiResponse): boolean {
  if (!isAuthenticated(req)) {
    res.status(401).json({ error: "未授权" });
    return false;
  }
  return true;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!auth(req, res)) return;

  if (req.method === "GET") {
    const structure = await getContentStructure();
    return res.status(200).json(structure);
  }

  if (req.method === "POST" || req.method === "PUT") {
    const { type, ...data } = req.body as { type: "channel" | "category" | "topic"; [key: string]: unknown };

    if (type === "channel") {
      const result = await saveChannel(data as Parameters<typeof saveChannel>[0]);
      return res.status(200).json(result);
    }
    if (type === "category") {
      const result = await saveCategory(data as Parameters<typeof saveCategory>[0]);
      return res.status(200).json(result);
    }
    if (type === "topic") {
      const result = await saveTopic(data as Parameters<typeof saveTopic>[0]);
      return res.status(200).json(result);
    }
    return res.status(400).json({ error: "未知类型" });
  }

  if (req.method === "DELETE") {
    const { type, id } = req.query as { type: string; id: string };
    if (!id) return res.status(400).json({ error: "缺少 id" });

    if (type === "channel") {
      await deleteChannel(id);
      return res.status(200).json({ ok: true });
    }
    if (type === "category") {
      await deleteCategory(id);
      return res.status(200).json({ ok: true });
    }
    if (type === "topic") {
      await deleteTopic(id);
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ error: "未知类型" });
  }

  res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
  res.status(405).end("Method Not Allowed");
}
