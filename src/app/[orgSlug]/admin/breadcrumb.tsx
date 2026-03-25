"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, LayoutDashboard } from "lucide-react";

const ADMIN_LABELS: Record<string, string> = {
  approvals: "Approvals",
  rooms: "Rooms",
  users: "Users",
  "event-types": "Event Types",
  configurations: "Configurations",
  reports: "Reports",
  import: "Import / Export",
  organization: "Organization",
};

export function AdminBreadcrumb({ orgSlug }: { orgSlug: string }) {
  const pathname = usePathname();
  const adminPrefix = `/${orgSlug}/admin`;

  // Only show breadcrumb on admin sub-pages (not the dashboard itself)
  if (pathname === adminPrefix || pathname === adminPrefix + "/") {
    return null;
  }

  // Extract the admin sub-path
  const subPath = pathname.slice(adminPrefix.length + 1); // e.g., "rooms" or "rooms/abc123"
  const segments = subPath.split("/").filter(Boolean);
  const sectionKey = segments[0];
  const sectionLabel = ADMIN_LABELS[sectionKey] || sectionKey;

  return (
    <nav className="flex items-center gap-1.5 text-sm mb-5">
      <Link
        href={`/${orgSlug}/admin`}
        className="flex items-center gap-1.5 text-slate-400 hover:text-primary transition-colors font-medium"
      >
        <LayoutDashboard className="w-3.5 h-3.5" />
        Admin
      </Link>
      <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
      <span className="text-slate-700 font-semibold">{sectionLabel}</span>
    </nav>
  );
}
