"use client";

import { useEffect, useRef } from "react";

export function ScrollToNow({
  children,
  className,
  isToday,
}: {
  children: React.ReactNode;
  className?: string;
  isToday: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isToday || !ref.current) return;

    const now = new Date();
    const currentHour = now.getHours();
    // Each hour row is ~48px (h-12 = 3rem = 48px). Scroll to 1 hour before current.
    const scrollTarget = Math.max(0, (currentHour - 8) * 48);
    ref.current.scrollTop = scrollTarget;
  }, [isToday]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
