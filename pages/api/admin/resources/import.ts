import type { NextApiRequest, NextApiResponse } from "next";

import { importResourcesFromCsv } from "@/lib/store";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { csv, mode = "upsert" } = req.body || {};
    if (!csv || typeof csv !== "string") {
      return res.status(400).json({ error: "CSV 内容不能为空" });
    }

    const result = await importResourcesFromCsv(csv, mode === "insert" ? "insert" : "upsert");
    return res.status(200).json(result);
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : "导入失败"
    });
  }
}
