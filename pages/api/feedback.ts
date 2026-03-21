import type { NextApiRequest, NextApiResponse } from "next";

import { getResourceById } from "@/lib/store";
import { recordFeedback } from "@/lib/store";
import { FeedbackReason } from "@/lib/types";

const VALID_REASONS: FeedbackReason[] = ["expired", "wrong_file", "extract_error", "other"];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { resource_id, reason, note } = req.body || {};

    if (!resource_id || typeof resource_id !== "string") {
      return res.status(400).json({ error: "缺少 resource_id" });
    }
    if (!reason || !VALID_REASONS.includes(reason as FeedbackReason)) {
      return res.status(400).json({ error: "反馈原因不合法" });
    }

    const resource = await getResourceById(resource_id);
    if (!resource) {
      return res.status(404).json({ error: "资源不存在" });
    }

    const feedback = await recordFeedback({
      resource_id,
      resource_title: resource.title,
      resource_slug: resource.slug,
      reason: reason as FeedbackReason,
      note: typeof note === "string" ? note.slice(0, 200) : undefined,
    });

    return res.status(201).json(feedback);
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "提交失败",
    });
  }
}
