"use client";

import { useEffect, useRef } from "react";

export function ScrollToNow({
  children,
  className,
  isToday,
  timezone,
}: {
  children: React.ReactNode;
  className?: string;
  isToday: boolean;
  timezone?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isToday || !ref.current) return;

    // The grid rows are org-local hours, so "now" must be org-local too.
    const currentHour = timezone
      ? parseInt(
          new Date().toLocaleString("en-US", {
            hour: "numeric",
            hour12: false,
            timeZone: timezone,
          }),
          10
        )
      : new Date().getHours();
    // Each hour row is ~48px (h-12 = 3rem = 48px). Scroll to 1 hour before current.
    const scrollTarget = Math.max(0, (currentHour - 8) * 48);
    ref.current.scrollTop = scrollTarget;
  }, [isToday, timezone]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
