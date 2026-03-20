"use client";

import { useEffect, useRef } from "react";

import { trackEvent } from "@/components/TrackView";

interface SearchRecorderProps {
  query: string;
  total: number;
}

export function SearchRecorder({ query, total }: SearchRecorderProps) {
  const sentRef = useRef("");

  useEffect(() => {
    if (!query) {
      return;
    }

    const signature = `${query}:${total}`;
    if (sentRef.current === signature) {
      return;
    }
    sentRef.current = signature;

    trackEvent("search_submit", {
      query,
      result_count: total
    });
  }, [query, total]);

  return null;
}
