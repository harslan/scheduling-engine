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
  Home,
  ChevronLeft,
  Copy,
  Check,
  ArrowLeftRight,
  Monitor,
  QrCode,
} from "lucide-react";

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

  // Close mobile menu on Escape key
  useEffect(() => {
    if (!mobileOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMobileOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen]);

  // Determine current section for breadcrumb context
  const isInAdmin = pathname.startsWith(`/${orgSlug}/admin`);

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="flex-1">
        {/* Back to admin dashboard when deep in admin */}
        {isInAdmin && isAdmin && (
          <div className="px-4 mb-4">
            <Link
              href={`/${orgSlug}/admin`}
              className="flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-primary transition-colors py-1"
            >
              <ChevronLeft className="w-3 h-3" />
              Admin Dashboard
            </Link>
          </div>
        )}

        <div className="px-4 mb-6">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300 mb-2 px-3">
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
          <Link
            href={`/status/${orgSlug}`}
            target="_blank"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-primary/5 hover:text-primary transition-all"
          >
            <Monitor className="w-4 h-4" />
            {org.roomTerm} Status Board
          </Link>
        </div>

        {isManager && (
          <div className="px-4 mb-6">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300 mb-2 px-3">
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
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300 mb-2 px-3">
              Administration
            </p>
            <NavLink
              href={`/${orgSlug}/admin`}
              icon={<Settings className="w-4 h-4" />}
              exact
            >
              Dashboard
            </NavLink>
            <NavLink
              href={`/${orgSlug}/admin/rooms`}
              icon={<Building2 className="w-4 h-4" />}
            >
              {org.roomTerm}s
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
              {org.eventSingularTerm} Types
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
              href={`/${orgSlug}/admin/reserve`}
              icon={<ArrowLeftRight className="w-4 h-4" />}
            >
              Reserve
            </NavLink>
            <NavLink
              href={`/${orgSlug}/admin/qr-codes`}
              icon={<QrCode className="w-4 h-4" />}
            >
              QR Codes
            </NavLink>
            <NavLink
              href={`/${orgSlug}/admin/organization`}
              icon={<Rss className="w-4 h-4" />}
            >
              Organization
            </NavLink>
          </div>
        )}
      </div>

      {/* Footer section */}
      <div className="px-4 mt-auto">
        {/* iCal subscription */}
        <CalendarFeedCopy orgSlug={orgSlug} />

        {/* Back to home */}
        <div className="border-t border-slate-100 pt-3 pb-2">
          <Link
            href="/"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-primary hover:bg-primary/5 transition-colors"
          >
            <Home className="w-4 h-4" />
            Scheduling Engine Home
          </Link>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3.5 left-4 z-40 p-1.5 text-slate-500 hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
        aria-label="Open menu"
        aria-expanded={mobileOpen}
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar drawer */}
      <nav
        aria-label="Main navigation"
        className={`lg:hidden fixed top-0 left-0 h-full w-72 bg-white border-r border-slate-200 py-4 overflow-y-auto z-50 shadow-2xl transform transition-transform duration-200 ease-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 mb-4">
          <Link href={`/${orgSlug}`} className="text-sm font-bold text-slate-900 truncate">
            {org.eventSingularTerm} Calendar
          </Link>
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {sidebarContent}
      </nav>

      {/* Desktop sidebar */}
      <nav aria-label="Main navigation" className="hidden lg:flex lg:flex-col w-56 bg-white border-r border-slate-200 py-4 overflow-y-auto shrink-0">
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
      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
        isActive
          ? "bg-primary/10 text-primary shadow-sm"
          : "text-slate-600 hover:bg-primary/5 hover:text-primary"
      }`}
    >
      {icon}
      {children}
    </Link>
  );
}

function CalendarFeedCopy({ orgSlug }: { orgSlug: string }) {
  const [copied, setCopied] = useState(false);

  const copyUrl = () => {
    const url = `${window.location.origin}/api/calendar/${orgSlug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="border-t border-slate-100 pt-4 mb-4">
      <p className="text-[10px] uppercase tracking-wider text-slate-300 font-semibold mb-1">
        Calendar Feed
      </p>
      <p className="text-xs text-slate-400 leading-relaxed mb-1.5">
        Subscribe in Outlook or Google Calendar:
      </p>
      <button
        onClick={copyUrl}
        className="group flex items-center gap-1.5 w-full text-left"
      >
        <code className="text-[10px] bg-slate-50 px-1 py-0.5 rounded break-all text-slate-400 group-hover:text-slate-600 transition-colors">
          /api/calendar/{orgSlug}
        </code>
        {copied ? (
          <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
        ) : (
          <Copy className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 shrink-0 transition-colors" />
        )}
      </button>
      {copied && (
        <p className="text-[10px] text-green-500 mt-0.5">Copied!</p>
      )}
    </div>
  );
}
