"use client";

import Link from "next/link";
import { PropsWithChildren } from "react";

import { TrackEventName } from "@/lib/types";
import { trackEvent } from "@/components/TrackView";

interface TrackedLinkProps extends PropsWithChildren {
  href: string;
  eventName: TrackEventName;
  payload?: Record<string, unknown>;
  className?: string;
}

export function TrackedLink({
  href,
  eventName,
  payload,
  className,
  children
}: TrackedLinkProps) {
  function handleClick() {
    trackEvent(eventName, payload);
  }

  return (
    <Link className={className} href={href} onClick={handleClick}>
      {children}
    </Link>
  );
}
