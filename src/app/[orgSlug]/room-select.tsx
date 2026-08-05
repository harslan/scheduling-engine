"use client";

import { useRouter } from "next/navigation";

/** Compact room filter for orgs with many rooms — a select instead of a
 *  ten-row pill wall. Options carry precomputed hrefs (the URL builder
 *  lives in the server component). */
export function RoomSelect({
  options,
  activeHref,
  roomTerm,
}: {
  options: { href: string; label: string }[];
  activeHref: string;
  roomTerm: string;
}) {
  const router = useRouter();
  return (
    <select
      value={activeHref}
      onChange={(e) => router.push(e.target.value)}
      aria-label={`Filter by ${roomTerm.toLowerCase()}`}
      className="w-full sm:w-72 px-3 py-2 border border-slate-200 rounded-xl bg-white text-sm text-slate-700 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all"
    >
      {options.map((o) => (
        <option key={o.href} value={o.href}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
