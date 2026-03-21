import type { NextApiRequest, NextApiResponse } from "next";

import { getContentStructure } from "@/lib/store";

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    const structure = await getContentStructure();
    return res.status(200).json({ structure });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to load layout data",
    });
  }
}
