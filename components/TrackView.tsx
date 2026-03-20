"use client";

import { useEffect, useRef } from "react";

import { TrackEventName } from "@/lib/types";

function ensureIds() {
  if (typeof window === "undefined") {
    return { sessionId: "", anonUserId: "" };
  }

  const storage = window.localStorage;
  let sessionId = window.sessionStorage.getItem("session_id");
  let anonUserId = storage.getItem("anon_user_id");

  if (!sessionId) {
    sessionId = `sess_${Date.now().toString(36)}`;
    window.sessionStorage.setItem("session_id", sessionId);
  }

  if (!anonUserId) {
    anonUserId = `anon_${Date.now().toString(36)}`;
    storage.setItem("anon_user_id", anonUserId);
  }

  return { sessionId, anonUserId };
}

export function trackEvent(
  name: TrackEventName,
  payload: Record<string, unknown> = {}
) {
  if (typeof window === "undefined") {
    return;
  }

  const { sessionId, anonUserId } = ensureIds();

  void fetch("/api/track", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    keepalive: true,
    body: JSON.stringify({
      name,
      session_id: sessionId,
      anon_user_id: anonUserId,
      from_page: window.location.pathname,
      referer: document.referrer,
      ...payload
    })
  });
}

interface TrackViewProps {
  name: TrackEventName;
  payload?: Record<string, unknown>;
}

export function TrackView({ name, payload }: TrackViewProps) {
  const sentRef = useRef(false);

  useEffect(() => {
    if (sentRef.current) {
      return;
    }
    sentRef.current = true;
    trackEvent(name, payload);
  }, [name, payload]);

  return null;
}
