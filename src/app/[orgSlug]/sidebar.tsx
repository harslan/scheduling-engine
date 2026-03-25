"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  Calendar,
  CalendarPlus,
  List,
  Info,
  HelpCircle,
  Settings,
  Users,
  Building2,
  Shield,
  Sparkles,
  Rss,
  FileSpreadsheet,
  BarChart3,
  Layers,
  Tag,
  Menu,
  X,
} from "lucide-react";

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-primary transition-colors"
      aria-label="Toggle menu"
    >
      <Menu className="w-5 h-5" />
    </button>
  );
}

export function Sidebar({
  orgSlug,
  org,
  isManager,
  isAdmin,
  isAuthenticated,
}: {
  orgSlug: string;
  org: {
    eventSingularTerm: string;
    eventPluralTerm: string;
    roomTerm: string;
  };
  isManager: boolean;
  isAdmin: boolean;
  isAuthenticated: boolean;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Close mobile menu on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const sidebarContent = (
    <>
      <div className="px-4 mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
          Calendar
        </p>
        <NavLink href={`/${orgSlug}`} icon={<Calendar className="w-4 h-4" />} exact>
          Calendar
        </NavLink>
        <NavLink
          href={`/${orgSlug}/submit-event`}
          icon={<CalendarPlus className="w-4 h-4" />}
        >
          Submit {org.eventSingularTerm}
        </NavLink>
        {isAuthenticated && (
          <NavLink
            href={`/${orgSlug}/my-events`}
            icon={<List className="w-4 h-4" />}
          >
            My {org.eventPluralTerm}
          </NavLink>
        )}
        {isAuthenticated && (
          <NavLink
            href={`/${orgSlug}/chat`}
            icon={<Sparkles className="w-4 h-4" />}
          >
            AI Assistant
          </NavLink>
        )}
        <NavLink
          href={`/${orgSlug}/rooms`}
          icon={<Info className="w-4 h-4" />}
        >
          {org.roomTerm} Information
        </NavLink>
        <NavLink
          href={`/${orgSlug}/help`}
          icon={<HelpCircle className="w-4 h-4" />}
        >
          Help
        </NavLink>
      </div>

      {isManager && (
        <div className="px-4 mb-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Management
          </p>
          <NavLink
            href={`/${orgSlug}/admin/approvals`}
            icon={<Shield className="w-4 h-4" />}
          >
            Approvals
          </NavLink>
        </div>
      )}

      {isAdmin && (
        <div className="px-4 mb-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Administration
          </p>
          <NavLink
            href={`/${orgSlug}/admin`}
            icon={<Settings className="w-4 h-4" />}
            exact
          >
            Settings
          </NavLink>
          <NavLink
            href={`/${orgSlug}/admin/rooms`}
            icon={<Building2 className="w-4 h-4" />}
          >
            Manage {org.roomTerm}s
          </NavLink>
          <NavLink
            href={`/${orgSlug}/admin/users`}
            icon={<Users className="w-4 h-4" />}
          >
            Users
          </NavLink>
          <NavLink
            href={`/${orgSlug}/admin/event-types`}
            icon={<Tag className="w-4 h-4" />}
          >
            Event Types
          </NavLink>
          <NavLink
            href={`/${orgSlug}/admin/configurations`}
            icon={<Layers className="w-4 h-4" />}
          >
            Configurations
          </NavLink>
          <NavLink
            href={`/${orgSlug}/admin/reports`}
            icon={<BarChart3 className="w-4 h-4" />}
          >
            Reports
          </NavLink>
          <NavLink
            href={`/${orgSlug}/admin/import`}
            icon={<FileSpreadsheet className="w-4 h-4" />}
          >
            Import / Export
          </NavLink>
          <NavLink
            href={`/${orgSlug}/admin/organization`}
            icon={<Rss className="w-4 h-4" />}
          >
            Organization
          </NavLink>
        </div>
      )}

      {/* iCal subscription hint */}
      <div className="px-4 mt-auto">
        <div className="border-t border-slate-100 pt-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-300 font-semibold mb-1">
            Calendar Feed
          </p>
          <p className="text-xs text-slate-400 leading-relaxed">
            Subscribe in Outlook or Google Calendar:{" "}
            <code className="text-[10px] bg-slate-50 px-1 py-0.5 rounded break-all">
              /api/calendar/{orgSlug}
            </code>
          </p>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger button - rendered in the header area */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 left-4 z-40 p-2 text-slate-600 hover:text-primary transition-colors"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/30 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar drawer */}
      <nav
        className={`lg:hidden fixed top-0 left-0 h-full w-64 bg-white border-r border-slate-200 py-4 overflow-y-auto z-50 transform transition-transform duration-200 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex justify-end px-4 mb-2">
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {sidebarContent}
      </nav>

      {/* Desktop sidebar - always visible */}
      <nav className="hidden lg:block w-56 bg-white border-r border-slate-200 py-4 overflow-y-auto shrink-0">
        {sidebarContent}
      </nav>
    </>
  );
}

function NavLink({
  href,
  icon,
  children,
  exact = false,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  exact?: boolean;
}) {
  const pathname = usePathname();
  const isActive = exact
    ? pathname === href
    : pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        isActive
          ? "bg-primary/10 text-primary"
          : "text-slate-600 hover:bg-primary/5 hover:text-primary"
      }`}
    >
      {icon}
      {children}
    </Link>
  );
}
