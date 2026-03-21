import type { NextApiRequest, NextApiResponse } from "next";

import { recordEvent } from "@/lib/store";
import { TrackEventName } from "@/lib/types";

const supportedEvents = new Set<TrackEventName>([
  "search_submit",
  "search_result_click",
  "resource_detail_view",
  "outbound_quark_click",
  "outbound_quark_redirect_done"
]);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { name, ...payload } = req.body || {};
  if (!supportedEvents.has(name)) {
    return res.status(400).json({ error: "Unsupported event" });
  }

  const event = await recordEvent({
    name,
    ua: payload.ua || req.headers["user-agent"],
    referer: payload.referer || req.headers.referer,
    ...payload
  });

  return res.status(200).json({ ok: true, event });
}
