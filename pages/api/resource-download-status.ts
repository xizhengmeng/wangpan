import type { NextApiRequest, NextApiResponse } from "next";

import { getResolvedDownloadUrlForResource, getResourceById } from "@/lib/store";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ found: false, downloadUrl: null });
  }

  const id = String(req.query.id || "");
  if (!id) {
    return res.status(400).json({ found: false, downloadUrl: null });
  }

  const resource = await getResourceById(id);
  if (!resource || resource.publish_status === "offline") {
    return res.status(200).json({ found: false, downloadUrl: null });
  }

  const downloadUrl = await getResolvedDownloadUrlForResource(resource);

  return res.status(200).json({
    found: Boolean(downloadUrl),
    downloadUrl: downloadUrl || null,
  });
}
