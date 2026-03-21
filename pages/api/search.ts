import type { NextApiRequest, NextApiResponse } from "next";

import { runSearch } from "@/lib/store";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const query = typeof req.query.q === "string" ? req.query.q : "";
  const page = Number.parseInt(typeof req.query.page === "string" ? req.query.page : "1", 10) || 1;

  return res.status(200).json(await runSearch(query, page));
}
